import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { buildMarketContext } from "@/lib/assistant/context";
import { chatCompletion, type LlmMessage } from "@/lib/assistant/llm";
import { buildLiveTrendContext, shouldUseLiveTrends } from "@/lib/assistant/trends";
import { isAiAssistantEnabled, isAiWebTrendsEnabled } from "@/lib/commercial";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM = `Eres Mavi, la iguana guayaca de Ad Mavericks One, una central de medios de Ecuador.
Eres una guia de medios y creativa. Ayudas a los clientes a PREPARAR su plan de medios:
les indicas que canales evaluar y por que, y GENERAS borradores y guiones (video, redes,
television, radio, WhatsApp).

Tus fuentes son el CONTEXTO interno que se te entrega (inversion del mercado, giros de negocio,
canales y plantillas de campana) y, cuando aparezca la sección FUENTES ACTUALES DE INTERNET,
las fuentes enlazadas y fechadas de esa sección.

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
- Cuando uses tendencias actuales, separa el hecho publicado de tu inferencia publicitaria,
  menciona la fecha de consulta y explica por que la señal es o no pertinente para el negocio.
- No repitas una respuesta estándar: adapta la recomendación al giro, objetivo, audiencia,
  geografía, presupuesto y momento de la conversación. Explica el porqué de cada canal.
- Nunca afirmas que compraste, reservaste, publicaste o activaste pauta. Toda recomendacion,
  presupuesto y borrador requiere revision y aprobacion humana.
- No conviertes ranking de radio, OTS, circulacion, seguidores o impresiones en alcance
  comparable. Si no hay metodologia homologada, indicas "pendiente de homologacion".
- Tono: valiente, preciso, optimista y cercano. Espanol de Ecuador. Respuestas accionables:
  que hacer, por que y el siguiente paso. Guiones en formato claro y listos para usar.`;

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 100) || crypto.randomUUID();
  const headers = { "x-request-id": requestId, "cache-control": "no-store" };

  if (!isAiAssistantEnabled()) {
    return NextResponse.json(
      { error: "Mavi permanece deshabilitada hasta validar el tratamiento de datos con el proveedor de IA." },
      { status: 503, headers },
    );
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Tipo de contenido no admitido." }, { status: 415, headers });
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 32_768) {
    return NextResponse.json({ error: "La consulta es demasiado grande." }, { status: 413, headers });
  }
  const origin = request.headers.get("origin");
  if (!origin || !isAllowedOrigin(origin, request.url)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403, headers });
  }

  // 1. Solo usuarios autenticados.
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Debes iniciar sesion." }, { status: 401, headers });
  }

  // 2. Validar el historial.
  let body: { messages?: ChatMessage[]; consent?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo invalido." }, { status: 400, headers });
  }
  if (body.consent !== true) {
    return NextResponse.json({ error: "Falta confirmar el tratamiento de la consulta." }, { status: 403, headers });
  }
  const history = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ ...m, content: m.content.trim().slice(0, 4000) }))
    .slice(-12);
  const totalChars = history.reduce((sum, message) => sum + message.content.length, 0);
  if (totalChars > 16_000) {
    return NextResponse.json({ error: "La conversacion es demasiado larga. Inicia una consulta nueva." }, { status: 413, headers });
  }
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "Falta el mensaje del usuario." }, { status: 400, headers });
  }

  // 3. Contexto de datos + llamada al modelo propio.
  try {
    const context = await buildMarketContext();
    const lastUserMessage = history[history.length - 1].content;
    const live = isAiWebTrendsEnabled() && shouldUseLiveTrends(lastUserMessage)
      ? await buildLiveTrendContext(lastUserMessage)
      : { context: "", sources: [] };
    const messages: LlmMessage[] = [
      { role: "system", content: `${SYSTEM}\n\n${context}${live.context ? `\n\n${live.context}` : ""}` },
      ...history.map((m) => ({ role: m.role, content: m.content }) as LlmMessage),
    ];

    const reply = await chatCompletion(messages, { maxTokens: 1024 });
    return NextResponse.json(
      { reply: reply || "No pude generar una respuesta. Intenta de nuevo.", sources: live.sources },
      { headers },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "MODELO_NO_CONFIGURADO") {
      return NextResponse.json(
        { error: "El asistente aun no tiene un proveedor aprobado y configurado." },
        { status: 503, headers },
      );
    }
    console.error(JSON.stringify({ event: "assistant.error", request_id: requestId, error: "provider_failure" }));
    return NextResponse.json(
      { error: "Mavi no pudo responder. Intenta de nuevo mas tarde.", requestId },
      { status: 500, headers },
    );
  }
}

function isAllowedOrigin(origin: string, requestUrl: string): boolean {
  try {
    const candidates = [new URL(requestUrl).origin];
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      candidates.push(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin);
    }
    return candidates.includes(new URL(origin).origin);
  } catch {
    return false;
  }
}
