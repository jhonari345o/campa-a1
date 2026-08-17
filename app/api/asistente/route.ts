import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { buildMarketContext } from "@/lib/assistant/context";

export const runtime = "nodejs";

const MODEL = "claude-opus-5";

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
  di que ocurre, por que importa y cual es el siguiente paso.
- No incluyas etiquetas XML internas ni de sistema en tu respuesta.`;

export async function POST(request: Request) {
  // 1. Solo usuarios autenticados.
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Debes iniciar sesion." }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "El asistente aun no esta configurado (falta ANTHROPIC_API_KEY)." },
      { status: 503 },
    );
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

  // 3. Contexto de datos + llamada a Claude.
  try {
    const context = await buildMarketContext();
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      thinking: { type: "disabled" },
      system: `${SYSTEM}\n\n${context}`,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({
        reply:
          "Prefiero no responder eso. Puedo ayudarte con planificacion de medios, inversion publicitaria y metricas. ¿Que necesitas?",
      });
    }

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({ reply: reply || "No pude generar una respuesta. Intenta de nuevo." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: `El asistente fallo: ${message}` }, { status: 500 });
  }
}
