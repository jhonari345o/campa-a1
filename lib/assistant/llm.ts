import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Cerebro de Mavi. Soporta dos proveedores:
 *  1) Amazon Bedrock (recomendado): modelos abiertos (Llama/Mistral/Nova) en TU
 *     cuenta AWS, sin servidor. Se activa con BEDROCK_MODEL_ID.
 *  2) Endpoint compatible con OpenAI (vLLM/Ollama/TGI): se activa con LLM_BASE_URL.
 */
export async function chatCompletion(
  messages: LlmMessage[],
  opts?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  if (process.env.BEDROCK_MODEL_ID) return bedrockChat(messages, opts);
  if (process.env.LLM_BASE_URL && process.env.LLM_MODEL) return openaiChat(messages, opts);
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
  const convo = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: [{ text: m.content }] }));

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
async function openaiChat(messages: LlmMessage[], opts?: { maxTokens?: number; temperature?: number }) {
  const base = process.env.LLM_BASE_URL!;
  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.LLM_API_KEY ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      messages,
      max_tokens: opts?.maxTokens ?? 1024,
      temperature: opts?.temperature ?? 0.4,
      stream: false,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`El modelo respondio ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const reply = data.choices?.[0]?.message?.content;
  if (typeof reply !== "string") throw new Error("Respuesta inesperada del modelo.");
  return reply.trim();
}
