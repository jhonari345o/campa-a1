import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Cerebro de Mavi. Soporta proveedores intercambiables:
 *  1) Amazon Bedrock (recomendado): modelos abiertos (Llama/Mistral/Nova) en TU
 *     cuenta AWS, sin servidor. Se activa con BEDROCK_MODEL_ID.
 *  2) OpenRouter Free Router: OPENROUTER_API_KEY, con openrouter/free por defecto.
 *  3) DeepSeek directo: compatible, pero su API comercial no se trata como gratuita.
 *  4) Endpoint compatible con OpenAI (vLLM/Ollama/TGI): LLM_BASE_URL.
 */
export async function chatCompletion(
  messages: LlmMessage[],
  opts?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  const preferred = process.env.AI_PROVIDER?.trim().toLowerCase();
  const openRouterFallbacks = (process.env.OPENROUTER_FALLBACK_MODELS
    || "minimax/minimax-m3:free,openrouter/free")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  const openRouter = () => openaiChat(messages, opts, {
    baseUrl: "https://openrouter.ai/api/v1",
    model: process.env.OPENROUTER_MODEL || "openrouter/free",
    fallbackModels: openRouterFallbacks,
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://one.ad-mavericks.com",
      "X-OpenRouter-Title": "Ad Mavericks One · Mavi",
    },
  });
  const deepSeek = () => openaiChat(messages, opts, {
    baseUrl: "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    apiKey: process.env.DEEPSEEK_API_KEY,
  });

  if (preferred === "openrouter" && process.env.OPENROUTER_API_KEY) return openRouter();
  if (preferred === "deepseek" && process.env.DEEPSEEK_API_KEY) return deepSeek();
  if (preferred === "bedrock" && process.env.BEDROCK_MODEL_ID) return bedrockChat(messages, opts);
  if (preferred && !["openrouter", "deepseek", "bedrock", "compatible"].includes(preferred)) {
    throw new Error("MODELO_NO_CONFIGURADO");
  }
  if (preferred === "compatible" && process.env.LLM_BASE_URL && process.env.LLM_MODEL) {
    return openaiChat(messages, opts, {
      baseUrl: process.env.LLM_BASE_URL,
      model: process.env.LLM_MODEL,
      apiKey: process.env.LLM_API_KEY,
    });
  }
  if (preferred) throw new Error("MODELO_NO_CONFIGURADO");

  if (process.env.BEDROCK_MODEL_ID) return bedrockChat(messages, opts);
  if (process.env.OPENROUTER_API_KEY) return openRouter();
  if (process.env.DEEPSEEK_API_KEY) return deepSeek();
  if (process.env.LLM_BASE_URL && process.env.LLM_MODEL) {
    return openaiChat(messages, opts, {
      baseUrl: process.env.LLM_BASE_URL,
      model: process.env.LLM_MODEL,
      apiKey: process.env.LLM_API_KEY,
    });
  }
  throw new Error("MODELO_NO_CONFIGURADO");
}

// ---- Amazon Bedrock (Converse API: unificada para Llama/Mistral/Nova) ----
async function bedrockChat(messages: LlmMessage[], opts?: { maxTokens?: number; temperature?: number }) {
  const region = process.env.BEDROCK_REGION || "us-east-1";
  const accessKeyId = process.env.BEDROCK_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BEDROCK_SECRET_ACCESS_KEY;

  const client = new BedrockRuntimeClient({
    region,
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
  );

  const reply = res.output?.message?.content?.[0]?.text;
  if (!reply) throw new Error("Bedrock no devolvio texto.");
  return reply.trim();
}

// ---- Endpoint compatible con OpenAI (vLLM / Ollama / TGI) ----
async function openaiChat(
  messages: LlmMessage[],
  opts: { maxTokens?: number; temperature?: number } | undefined,
  provider: {
    baseUrl: string;
    model: string;
    fallbackModels?: string[];
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
        messages,
        max_tokens: opts?.maxTokens ?? 1024,
        temperature: opts?.temperature ?? 0.4,
        stream: false,
      }),
      signal: AbortSignal.timeout(requestTimeoutMs),
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
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const reply = data.choices?.[0]?.message?.content;
  if (typeof reply !== "string") throw new Error("Respuesta inesperada del modelo.");
  return reply.trim();
}
