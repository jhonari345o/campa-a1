import { createAdminClient } from "@/lib/supabase/admin";
import { MEDIA_TYPE_LABELS } from "@/lib/market";

export type PlanInput = {
  keyword: string; // giro del negocio, p.ej. "cafeteria", "banco", "farmacia"
  budgetUsd?: number | null; // presupuesto mensual opcional
};

export type PlanRow = { label: string; pct: number; amount: number | null };

export type MediaPlan = {
  matched: number; // # de anunciantes similares encontrados
  totalRef: number; // inversion de referencia (suma)
  basis: "giro" | "mercado";
  benchmark: PlanRow[]; // como invierte el giro (referencia real)
  plan: PlanRow[]; // plan recomendado por canal (digital + tradicional)
};

// Reparto recomendado dentro de la porcion "digital" (no viene desglosado en la
// data cruda; es una recomendacion de Ad Mavericks).
const DIGITAL_SPLIT: { label: string; w: number }[] = [
  { label: "Meta — Facebook e Instagram", w: 0.45 },
  { label: "Google — Busqueda y YouTube", w: 0.3 },
  { label: "WhatsApp Business", w: 0.12 },
  { label: "TikTok", w: 0.13 },
];

const DIGITAL_TYPES = new Set(["sitios_apps", "otros", "buscadores", "redes_sociales", "video_streaming"]);

/**
 * Construye un plan de medios para un cliente a partir de la inversion real de
 * negocios similares. Corre del lado del servidor con la clave de servicio; el
 * cliente nunca ve la data cruda, solo el plan derivado.
 */
export async function buildMediaPlan(input: PlanInput): Promise<MediaPlan> {
  const db = createAdminClient();
  const kw = input.keyword.trim();

  // Busca inversiones de anunciantes cuyo nombre contiene la palabra del giro.
  let query = db
    .from("ad_investments")
    .select("media_type, amount_usd, advertisers!inner(name)")
    .limit(4000);
  if (kw) query = query.ilike("advertisers.name", `%${kw}%`);

  let { data } = await query;
  let basis: MediaPlan["basis"] = "giro";
  const advertisers = new Set<string>();

  // Si no hay suficientes coincidencias, usa el mercado completo como base.
  if (!data || data.length < 3) {
    basis = "mercado";
    const res = await db.from("ad_investments").select("media_type, amount_usd, advertisers(name)").limit(4000);
    data = res.data ?? [];
  }

  const byMedia = new Map<string, number>();
  let total = 0;
  for (const r of data ?? []) {
    const amt = Number(r.amount_usd ?? 0);
    if (amt <= 0) continue;
    const key = r.media_type ?? "otros";
    byMedia.set(key, (byMedia.get(key) ?? 0) + amt);
    total += amt;
    const adv = r.advertisers as unknown as { name?: string } | null;
    if (adv?.name) advertisers.add(adv.name);
  }

  const budget = input.budgetUsd && input.budgetUsd > 0 ? input.budgetUsd : null;
  const pctOf = (v: number) => (total > 0 ? v / total : 0);

  // Benchmark: como invierte el giro por medio (real).
  const benchmark: PlanRow[] = [...byMedia.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([mt, v]) => ({
      label: MEDIA_TYPE_LABELS[mt] ?? mt,
      pct: pctOf(v),
      amount: budget ? budget * pctOf(v) : null,
    }));

  // Plan recomendado: medios tradicionales con su peso real + digital desglosado.
  let digitalShare = 0;
  const traditional: PlanRow[] = [];
  for (const [mt, v] of byMedia.entries()) {
    if (DIGITAL_TYPES.has(mt)) {
      digitalShare += pctOf(v);
    } else {
      traditional.push({
        label: MEDIA_TYPE_LABELS[mt] ?? mt,
        pct: pctOf(v),
        amount: budget ? budget * pctOf(v) : null,
      });
    }
  }
  // Piso digital: si el giro casi no usa digital, recomendamos al menos 35%.
  const recommendedDigital = Math.max(digitalShare, 0.35);
  // Re-normaliza tradicionales para dejar espacio al digital recomendado.
  const tradTotal = traditional.reduce((s, r) => s + r.pct, 0) || 1;
  const tradScale = (1 - recommendedDigital) / tradTotal;
  const plan: PlanRow[] = traditional
    .map((r) => ({
      label: r.label,
      pct: r.pct * tradScale,
      amount: budget ? budget * r.pct * tradScale : null,
    }))
    .filter((r) => r.pct > 0.005)
    .sort((a, b) => b.pct - a.pct);

  for (const d of DIGITAL_SPLIT) {
    const pct = recommendedDigital * d.w;
    plan.push({ label: d.label, pct, amount: budget ? budget * pct : null });
  }
  plan.sort((a, b) => b.pct - a.pct);

  return {
    matched: advertisers.size,
    totalRef: total,
    basis,
    benchmark,
    plan,
  };
}
