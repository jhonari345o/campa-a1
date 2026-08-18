import { createAdminClient } from "@/lib/supabase/admin";
import { MEDIA_TYPE_LABELS, money } from "@/lib/market";

/**
 * Arma el contexto de Mavi. Corre del lado del servidor con la clave de
 * servicio (los clientes no ven la data cruda; solo la respuesta de Mavi).
 * Combina: (1) resumen agregado de inversion del mercado y (2) la base de
 * conocimiento de giros, canales y plantillas de campana. Sin Internet.
 */
export async function buildMarketContext(): Promise<string> {
  let db;
  try {
    db = createAdminClient();
  } catch {
    return "La base de conocimiento aun no esta disponible.";
  }

  const [{ data: investments }, { data: giros }, { data: canales }, { data: campanas }] =
    await Promise.all([
      db.from("ad_investments").select("media_type, amount_usd").limit(4000),
      db.from("kb_giros").select("giro, publico, canales, tono, ideas"),
      db.from("kb_canales").select("canal, para_que, como_invertir, formato, tip"),
      db.from("kb_campanas").select("tipo, titulo, estructura"),
    ]);

  // Resumen de inversion por medio (referencia del mercado).
  const byMedia = new Map<string, number>();
  let total = 0;
  for (const r of investments ?? []) {
    const amt = Number(r.amount_usd ?? 0);
    if (amt <= 0) continue;
    const k = r.media_type ?? "otros";
    byMedia.set(k, (byMedia.get(k) ?? 0) + amt);
    total += amt;
  }
  const mediaLines =
    [...byMedia.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([mt, v]) => `- ${MEDIA_TYPE_LABELS[mt] ?? mt}: ${money(v)} (${total ? Math.round((v / total) * 100) : 0}%)`)
      .join("\n") || "- (sin datos)";

  const giroLines =
    (giros ?? [])
      .map((g) => `- ${g.giro}: publico ${g.publico}; canales ${g.canales}; tono ${g.tono}; ideas: ${g.ideas}`)
      .join("\n") || "- (sin datos)";

  const canalLines =
    (canales ?? [])
      .map((c) => `- ${c.canal}: ${c.para_que}. Como invertir: ${c.como_invertir}. Formato: ${c.formato}. Tip: ${c.tip}`)
      .join("\n") || "- (sin datos)";

  const campanaLines =
    (campanas ?? [])
      .map((c) => `- [${c.tipo}] ${c.titulo}: ${c.estructura}`)
      .join("\n") || "- (sin datos)";

  return [
    `INVERSION DEL MERCADO POR MEDIO (referencia, total ${money(total)}):`,
    mediaLines,
    "",
    "GIROS DE NEGOCIO (publico, canales, tono, ideas):",
    giroLines,
    "",
    "CANALES DE PUBLICIDAD (para que sirve, como invertir, formato, tip):",
    canalLines,
    "",
    "PLANTILLAS DE CAMPANA Y GUIONES:",
    campanaLines,
  ].join("\n");
}
