import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { getLlmConfiguration } from "./llm-config";

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };
type CompletionOptions = { maxTokens?: number; temperature?: number; signal?: AbortSignal; json?: boolean };

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
    apiKey?: string;
    headers?: Record<string, string>;
  },
) {
  const fallbackModels = (provider.fallbackModels ?? [])
    .filter((model) => model !== provider.model);
  const configuredTimeout = Number(process.env.LLM_REQUEST_TIMEOUT_MS ?? "17000");
  const requestTimeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(22_000, Math.max(5_000, configuredTimeout))
    : 17_000;
  let res: Response;
  try {
    res = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
        ...provider.headers,
      },
      body: JSON.stringify({
        model: provider.model,
        ...(fallbackModels.length ? { models: [provider.model, ...fallbackModels] } : {}),
        ...(provider.freeOnly ? { provider: { max_price: { prompt: 0, completion: 0 } } } : {}),
        ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
        messages,
        max_tokens: opts?.maxTokens ?? 1024,
        temperature: opts?.temperature ?? 0.4,
        stream: false,
      }),
      signal: opts?.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(requestTimeoutMs)]) : AbortSignal.timeout(requestTimeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("PROVIDER_TIMEOUT");
    }
    throw error;
  }
  if (!res.ok) {
    // El cuerpo del proveedor puede contener detalles de cuenta. Registramos
    // únicamente el estado HTTP para diagnosticar sin filtrar credenciales.
    throw new Error(`PROVIDER_HTTP_${res.status}`);
  }
  const data = (await res.json()) as { choices?: { finish_reason?: string; message?: { content?: string } }[] };
  if (data.choices?.[0]?.finish_reason === "length") throw new Error("PROVIDER_OUTPUT_TRUNCATED");
  const reply = data.choices?.[0]?.message?.content;
  if (typeof reply !== "string") throw new Error("Respuesta inesperada del modelo.");
  return reply.trim();
}
