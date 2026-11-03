import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { getLlmConfiguration } from "./llm-config";
import { availableFreeModels } from "./free-model-routing";

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };
type CompletionOptions = { maxTokens?: number; temperature?: number; signal?: AbortSignal; json?: boolean; responseSchema?: {name:string;schema:Record<string,unknown>}; timeoutMs?: number; reasoningEffort?: "low" | "medium" | "high"; reasoningEnabled?: boolean; fastFreeRouting?: boolean; onModel?: (model: string) => void };

/** Retain a bounded diagnosis, never the provider's raw account/prompt details. */
async function providerErrorCode(res: Response): Promise<string> {
  const base = `PROVIDER_HTTP_${res.status}`;
  if (res.status !== 400) return base;
  try {
    const data = await res.json() as { error?: { message?: unknown; code?: unknown } };
    const message = typeof data.error?.message === "string" ? data.error.message.toLowerCase() : "";
    if (/models|fallback/.test(message) && /too many|at most|maximum|limit|length|array/.test(message)) return `${base}_MODEL_COUNT`;
    if (/sort|partition/.test(message)) return `${base}_ROUTING`;
    if (/reasoning|thinking/.test(message)) return `${base}_REASONING`;
    if (/model/.test(message) && /invalid|not found|not available|unavailable|unknown|not a valid/.test(message)) return `${base}_MODEL`;
    if (/response_format|json_object|json_schema|structured output/.test(message)) return `${base}_FORMAT`;
    if (/context|token limit|maximum.*tokens/.test(message)) return `${base}_CONTEXT`;
  } catch { /* Unparseable provider bodies remain a status-only diagnosis. */ }
  return base;
}

/**
 * Cerebro de Mavi. Soporta proveedores intercambiables:
 *  1) Amazon Bedrock (opcional): modelos abiertos (Llama/Mistral/Nova) en TU
 *     cuenta AWS, sin servidor. Se activa con BEDROCK_MODEL_ID.
 *  2) OpenRouter: configuración compartida con el planificador y sus fallbacks.
 *  3) DeepSeek directo: compatible, pero su API comercial no se trata como gratuita.
 *  4) Endpoint compatible con OpenAI (vLLM/Ollama/TGI): LLM_BASE_URL.
 */
export async function chatCompletion(
  messages: LlmMessage[],
  opts?: CompletionOptions,
): Promise<string> {
  const config = getLlmConfiguration();
  if (!config) throw new Error("MODELO_NO_CONFIGURADO");
  if (config.provider === "bedrock") return bedrockChat(messages, { ...opts, maxAttempts: 1 });
  if (config.provider === "openrouter") return openaiChat(messages, opts, {
    baseUrl: "https://openrouter.ai/api/v1",
    model: config.model,
    fallbackModels: config.fallbackModels,
    freeOnly: config.freeOnly,
    openRouter: true,
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://one.ad-mavericks.com",
      "X-OpenRouter-Title": "Ad Mavericks One · Mavi",
    },
  });
  if (config.provider === "deepseek") return openaiChat(messages, opts, {
    baseUrl: "https://api.deepseek.com",
    model: config.model,
    apiKey: process.env.DEEPSEEK_API_KEY,
  });

  return openaiChat(messages, opts, { baseUrl: config.endpoint!, model: config.model, apiKey: process.env.LLM_API_KEY });
}

// ---- Amazon Bedrock (Converse API: unificada para Llama/Mistral/Nova) ----
export async function bedrockChat(messages: LlmMessage[], opts?: { maxTokens?: number; temperature?: number; signal?: AbortSignal; maxAttempts?: number }) {
  const region = process.env.BEDROCK_REGION || "us-east-1";
  const accessKeyId = process.env.BEDROCK_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BEDROCK_SECRET_ACCESS_KEY;

  const client = new BedrockRuntimeClient({
    region,
    ...(opts?.maxAttempts ? { maxAttempts: opts.maxAttempts } : {}),
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
  });

  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => ({ text: m.content }));

  // Converse exige: (1) empezar con un mensaje de "user"; (2) que los roles
  // alternen user/assistant. La UI de Mavi arranca con un saludo del asistente,
  // asi que quitamos los turnos "assistant" iniciales y fusionamos turnos
  // consecutivos del mismo rol.
  const turns = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", text: m.content }));
  while (turns.length && turns[0].role !== "user") turns.shift();

  const convo: { role: "user" | "assistant"; content: { text: string }[] }[] = [];
  for (const t of turns) {
    const last = convo[convo.length - 1];
    if (last && last.role === t.role) {
      last.content[0].text += `\n\n${t.text}`;
    } else {
      convo.push({ role: t.role, content: [{ text: t.text }] });
    }
  }
  if (!convo.length) throw new Error("No hay ningun mensaje del usuario todavia.");

  const res = await client.send(
    new ConverseCommand({
      modelId: process.env.BEDROCK_MODEL_ID!,
      system: system.length ? system : undefined,
      messages: convo,
      inferenceConfig: { maxTokens: opts?.maxTokens ?? 1024, temperature: opts?.temperature ?? 0.4 },
    }),
    { abortSignal: opts?.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(18000)]) : AbortSignal.timeout(18000) },
  );

  if (res.stopReason === "max_tokens") throw new Error("BEDROCK_OUTPUT_TRUNCATED");
  const reply = res.output?.message?.content?.flatMap(block => block.text ? [block.text] : []).join("\n");
  if (!reply) throw new Error("Bedrock no devolvio texto.");
  return reply.trim();
}

// ---- Endpoint compatible con OpenAI (vLLM / Ollama / TGI) ----
async function openaiChat(
  messages: LlmMessage[],
  opts: CompletionOptions | undefined,
  provider: {
    baseUrl: string;
    model: string;
    fallbackModels?: string[];
    freeOnly?: boolean;
    openRouter?: boolean;
    apiKey?: string;
    headers?: Record<string, string>;
  },
) {
  const fallbackModels = (provider.fallbackModels ?? [])
    .filter((model) => model !== provider.model);
  const configuredTimeout = opts?.timeoutMs ?? Number(process.env.LLM_REQUEST_TIMEOUT_MS ?? "17000");
  const requestTimeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(25_000, Math.max(5_000, configuredTimeout))
    : 17_000;
  // One deadline covers inference, response reading and a possible free retry.
  const signal = opts?.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(requestTimeoutMs)]) : AbortSignal.timeout(requestTimeoutMs);
  let models = [provider.model, ...fallbackModels];
  const deadline = Date.now() + requestTimeoutMs;
  let retriedTruncation = false;
  let omitReasoningOption = false;
  const fastFree = Boolean(opts?.fastFreeRouting && provider.openRouter && provider.freeOnly);
  if (fastFree) models = await availableFreeModels(models, Boolean(opts?.responseSchema || opts?.json), Math.ceil(new TextEncoder().encode(JSON.stringify(messages)).length / 2) + (opts?.maxTokens ?? 1024), signal, Boolean(opts?.responseSchema));
  const maxAttempts = Math.min(3, models.length) + (fastFree ? 1 : 0);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const hasRetryTime = () => attempt < maxAttempts - 1 && !signal.aborted && deadline - Date.now() >= 5000;
    const canAdvance = () => provider.openRouter && provider.freeOnly && models.length > 1 && hasRetryTime();
    // A live model gets the remaining caller deadline. Cutting every attempt
    // at ten seconds discarded valid slower completions from the free pool.
    // HTTP/model failures can still advance immediately without resetting it.
    const attemptSignal = signal;
    let res: Response;
    let data: { model?: string; choices?: { finish_reason?: string; message?: { content?: string } }[] } | undefined;
    try {
      attemptSignal.throwIfAborted();
      res = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
          ...provider.headers,
        },
        body: JSON.stringify({
          model: models[0],
          // Keep each gateway request bounded; the full free pool remains
          // available to subsequent attempts within the same deadline.
          ...(models.length > 1 ? { models: models.slice(0, 3) } : {}),
          ...(provider.freeOnly||provider.openRouter&&opts?.responseSchema ? { provider: { ...(provider.freeOnly?{max_price: { prompt: 0, completion: 0 }}:{}),...(opts?.responseSchema?{require_parameters:true}:{}),...(fastFree?{sort:{by:"latency",partition:"none"}}:{}) } } : {}),
          ...(opts?.responseSchema ? {response_format:{type:"json_schema",json_schema:{...opts.responseSchema,strict:true}}} : opts?.json ? { response_format: { type: "json_object" } } : {}),
          ...(!omitReasoningOption && provider.openRouter && opts?.reasoningEnabled===false ? { reasoning: { enabled:false } } : !omitReasoningOption && provider.openRouter && opts?.reasoningEffort ? { reasoning: { effort: opts.reasoningEffort, exclude: true } } : {}),
          messages,
          max_tokens: opts?.maxTokens ?? 1024,
          temperature: opts?.temperature ?? 0.4,
          stream: false,
        }),
        signal: attemptSignal,
      });
      // Body reads use the same per-attempt deadline as the request headers.
      if (res.ok) data = await res.json();
    } catch (error) {
      if (fastFree && canAdvance()) { models = models.slice(1); continue; }
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new Error("PROVIDER_TIMEOUT");
      }
      throw error;
    }
    if (!res.ok) {
      const code = await providerErrorCode(res);
      // Some free models require reasoning and reject an explicit disable.
      // Retry the same free pool once with its native default. Keep the schema,
      // zero-price cap, output limit and original cancellation deadline intact.
      if (code === "PROVIDER_HTTP_400_REASONING" && fastFree && !omitReasoningOption && (opts?.reasoningEnabled === false || opts?.reasoningEffort) && hasRetryTime()) {
        omitReasoningOption = true;
        continue;
      }
      // A retired model or an unsupported option can be rejected before the
      // gateway applies its models fallback. Advance only within the configured
      // free pool and original deadline. Never retry authentication/access denial.
      if ((res.status === 400 || fastFree && (res.status === 429 || res.status >= 500)) && canAdvance()) {
        models = models.slice(1);
        continue;
      }
      throw new Error(code);
    }
    if (data?.choices?.[0]?.finish_reason === "length") {
      // HTTP 200 with incomplete content does not trigger OpenRouter's normal
      // error fallback. Retry once within the same deadline, only in the free pool.
      const remaining = models.slice(1).filter(model => model !== data.model);
      if (provider.openRouter && provider.freeOnly && !retriedTruncation && remaining.length && hasRetryTime()) {
        retriedTruncation = true;
        models = remaining;
        continue;
      }
      throw new Error("PROVIDER_OUTPUT_TRUNCATED");
    }
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string") throw new Error("Respuesta inesperada del modelo.");
    if (typeof data?.model === "string" && /^[a-z0-9._:/-]{1,160}$/i.test(data.model)) opts?.onModel?.(data.model);
    return reply.trim();
  }
  throw new Error("PROVIDER_OUTPUT_TRUNCATED");
}
