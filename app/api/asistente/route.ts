import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { buildMarketContext } from "@/lib/assistant/context";
import { chatCompletion, type LlmMessage } from "@/lib/assistant/llm";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM = `Eres Mavi, la iguana guayaca de Ad Mavericks One, una central de medios de Ecuador.
Eres una asesora de medios y creativa. Ayudas a los clientes a EJECUTAR su plan de medios:
les indicas en que canales invertir y como, y GENERAS campanas y guiones (video, redes,
television, radio, WhatsApp).

Tus unicas fuentes son el CONTEXTO que se te entrega (inversion del mercado, giros de negocio,
canales y plantillas de campana). NO tienes acceso a Internet.

Que haces:
- Partes del plan/presupuesto del cliente. Si no lo tienes, preguntale su giro, presupuesto y
  objetivo antes de recomendar.
- Recomiendas canales y como invertir usando los CANALES y GIROS del contexto, y la referencia
  de inversion del mercado.
- Cuando te lo pidan (o cuando ayude), generas propuestas concretas: ideas de campana y GUIONES
  listos (usa las PLANTILLAS de campana como estructura) para video/reels, redes, TV y radio.

Reglas:
- Solo hablas de publicidad, medios y campanas. Si preguntan otra cosa, reencauza con amabilidad.
- Datos honestos: si algo no esta en el contexto, dilo; no inventes cifras ni prometas
  resultados garantizados.
- Tono: valiente, preciso, optimista y cercano. Espanol de Ecuador. Respuestas accionables:
  que hacer, por que y el siguiente paso. Guiones en formato claro y listos para usar.`;

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
