export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Cliente para el modelo propio de Mavi. Habla el protocolo estandar
 * "chat completions" (compatible con OpenAI), que exponen los servidores de
 * modelos abiertos mas comunes: vLLM, Ollama, Text Generation Inference (TGI),
 * LM Studio, y pasarelas hacia Amazon Bedrock. Asi el sitio no depende de
 * ningun proveedor: solo se configura la URL y el nombre del modelo.
 *
 * Variables de entorno:
 *   LLM_BASE_URL  ej. http://TU-SERVIDOR:8000/v1  (o el /v1 de Ollama)
 *   LLM_MODEL     ej. "llama-3.1-8b-instruct" o "mistral"
 *   LLM_API_KEY   opcional, si tu servidor lo exige
 */
export async function chatCompletion(
  messages: LlmMessage[],
  opts?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  const base = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  if (!base || !model) {
    throw new Error("MODELO_NO_CONFIGURADO");
  }

  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.LLM_API_KEY ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts?.maxTokens ?? 1024,
      temperature: opts?.temperature ?? 0.4,
      stream: false,
    }),
    // El modelo puede tardar unos segundos en generar.
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    throw new Error(`El modelo respondio ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const reply = data.choices?.[0]?.message?.content;
  if (typeof reply !== "string") {
    throw new Error("Respuesta inesperada del modelo.");
  }
  return reply.trim();
}
