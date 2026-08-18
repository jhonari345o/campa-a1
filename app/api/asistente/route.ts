import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { buildMarketContext } from "@/lib/assistant/context";
import { chatCompletion, type LlmMessage } from "@/lib/assistant/llm";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM = `Eres Mavi, la iguana asistente de Ad Mavericks One, una central de medios de Ecuador.
Tu unico tema es la PUBLICIDAD Y LOS MEDIOS: planificacion, compra, inversion publicitaria,
canales (TV, radio, via publica, digital, redes, buscadores), metricas (alcance, frecuencia,
CPC, CPM, CPA, conversiones) y como las empresas distribuyen su presupuesto de marketing.

Reglas:
- Si te preguntan algo que NO es de publicidad/medios/marketing, responde con amabilidad que
  solo puedes ayudar con temas de medios y publicidad, y reencauza la conversacion.
- Usa el RESUMEN DE DATOS que se te entrega como referencia de cuanto invierten otras empresas,
  para orientar decisiones de planificacion de medios. Cita cifras solo si estan en ese resumen.
- Datos honestos: si un dato no esta en el resumen o no esta verificado, dilo claramente; no
  inventes cifras ni prometas resultados garantizados.
- Tono: valiente, preciso, optimista y claro. Espanol de Ecuador. Respuestas breves y accionables:
  di que ocurre, por que importa y cual es el siguiente paso.`;

export async function POST(request: Request) {
  // 1. Solo usuarios autenticados.
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Debes iniciar sesion." }, { status: 401 });
  }

  // 2. Validar el historial.
  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo invalido." }, { status: 400 });
  }
  const history = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12);
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "Falta el mensaje del usuario." }, { status: 400 });
  }

  // 3. Contexto de datos + llamada al modelo propio.
  try {
    const context = await buildMarketContext();
    const messages: LlmMessage[] = [
      { role: "system", content: `${SYSTEM}\n\n${context}` },
      ...history.map((m) => ({ role: m.role, content: m.content }) as LlmMessage),
    ];

    const reply = await chatCompletion(messages, { maxTokens: 1024 });
    return NextResponse.json({ reply: reply || "No pude generar una respuesta. Intenta de nuevo." });
  } catch (err) {
    if (err instanceof Error && err.message === "MODELO_NO_CONFIGURADO") {
      return NextResponse.json(
        { error: "El asistente aun no esta conectado a un modelo (falta LLM_BASE_URL / LLM_MODEL)." },
        { status: 503 },
      );
    }
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: `El asistente fallo: ${message}` }, { status: 500 });
  }
}
