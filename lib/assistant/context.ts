import { createClient } from "@/lib/supabase/server";
import { MEDIA_TYPE_LABELS, money } from "@/lib/market";

/**
 * Arma un resumen compacto de la base de inversion publicitaria para
 * fundamentar (grounding) las respuestas de Mavi. Solo datos de mercado,
 * agregados; nada de datos de una empresa cliente en particular.
 */
export async function buildMarketContext(): Promise<string> {
  const supabase = await createClient();

  const [{ data: investments }, { data: metrics }] = await Promise.all([
    supabase
      .from("ad_investments")
      .select("media_type, amount_usd, status, period_year, advertisers(name, sector)")
      .order("period_year", { ascending: false })
      .limit(500),
    supabase
      .from("digital_metrics")
      .select("platform, spend_usd, impressions, clicks, status")
      .limit(500),
  ]);

  const inv = investments ?? [];
  if (inv.length === 0 && (metrics ?? []).length === 0) {
    return "No hay datos de inversion publicitaria cargados todavia en la base.";
  }

  // Totales y verificacion.
  const total = inv.reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
  const verified = inv.filter((r) => r.status === "verificado").length;

  // Por medio.
  const byMedia = new Map<string, number>();
  for (const r of inv) {
    const key = r.media_type ?? "otros";
    byMedia.set(key, (byMedia.get(key) ?? 0) + Number(r.amount_usd ?? 0));
  }

  // Por sector.
  const bySector = new Map<string, number>();
  // Por anunciante.
  const byAdvertiser = new Map<string, number>();
  for (const r of inv) {
    const adv = r.advertisers as unknown as { name: string; sector: string | null } | null;
    if (adv?.sector) bySector.set(adv.sector, (bySector.get(adv.sector) ?? 0) + Number(r.amount_usd ?? 0));
    if (adv?.name) byAdvertiser.set(adv.name, (byAdvertiser.get(adv.name) ?? 0) + Number(r.amount_usd ?? 0));
  }

  const top = (m: Map<string, number>, n: number, label = (k: string) => k) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => `- ${label(k)}: ${money(v)}`)
      .join("\n");

  // Metricas digitales por plataforma.
  const byPlatform = new Map<string, { spend: number; impr: number; clicks: number }>();
  for (const m of metrics ?? []) {
    const cur = byPlatform.get(m.platform) ?? { spend: 0, impr: 0, clicks: 0 };
    cur.spend += Number(m.spend_usd ?? 0);
    cur.impr += Number(m.impressions ?? 0);
    cur.clicks += Number(m.clicks ?? 0);
    byPlatform.set(m.platform, cur);
  }
  const platformLines = [...byPlatform.entries()]
    .map(([p, v]) => `- ${p}: inversion ${money(v.spend)}, ${v.impr.toLocaleString("es-EC")} impresiones, ${v.clicks.toLocaleString("es-EC")} clics`)
    .join("\n");

  return [
    `RESUMEN DE LA BASE DE INVERSION PUBLICITARIA (muestra de ${inv.length} registros):`,
    `Inversion total registrada: ${money(total)}. Registros verificados: ${verified} de ${inv.length}.`,
    "",
    "Inversion por tipo de medio:",
    top(byMedia, 10, (k) => MEDIA_TYPE_LABELS[k] ?? k) || "- (sin datos)",
    "",
    "Inversion por sector economico:",
    top(bySector, 8) || "- (sin datos)",
    "",
    "Principales anunciantes por inversion:",
    top(byAdvertiser, 12) || "- (sin datos)",
    "",
    "Metricas digitales por plataforma:",
    platformLines || "- (sin datos)",
  ].join("\n");
}
