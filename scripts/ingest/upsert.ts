import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Helpers idempotentes (get-or-create / update). Evitan duplicados sin
 * depender de restricciones unicas en la base: buscan por clave natural.
 */

const sourceCache = new Map<string, string>();

/** Devuelve el id de una fuente por nombre; la crea si no existe. */
export async function ensureSource(db: SupabaseClient, name: string): Promise<string | null> {
  if (!name) return null;
  if (sourceCache.has(name)) return sourceCache.get(name)!;

  const { data: found } = await db.from("data_sources").select("id").eq("name", name).maybeSingle();
  if (found?.id) {
    sourceCache.set(name, found.id);
    return found.id;
  }
  const { data: created } = await db
    .from("data_sources")
    .insert({ name })
    .select("id")
    .single();
  if (created?.id) sourceCache.set(name, created.id);
  return created?.id ?? null;
}

export type AdvertiserInput = {
  name: string;
  legal_id?: string | null;
  sector?: string | null;
  province?: string | null;
  status?: "verificado" | "pendiente";
  source_id?: string | null;
};

/** Busca por RUC (si hay) o por nombre; crea o actualiza. Devuelve el id. */
export async function upsertAdvertiser(db: SupabaseClient, a: AdvertiserInput): Promise<string> {
  let query = db.from("advertisers").select("id");
  query = a.legal_id ? query.eq("legal_id", a.legal_id) : query.ilike("name", a.name);
  const { data: existing } = await query.maybeSingle();

  const payload = {
    name: a.name,
    legal_id: a.legal_id ?? null,
    sector: a.sector ?? null,
    province: a.province ?? null,
    status: a.status ?? "pendiente",
    source_id: a.source_id ?? null,
  };

  if (existing?.id) {
    await db.from("advertisers").update(payload).eq("id", existing.id);
    return existing.id;
  }
  const { data: created, error } = await db.from("advertisers").insert(payload).select("id").single();
  if (error) throw new Error(`advertiser "${a.name}": ${error.message}`);
  return created!.id;
}

export type ChannelInput = { name: string; media_type: string; owner?: string | null };

/** Deduplica un medio/canal por (nombre, tipo). */
export async function upsertChannel(db: SupabaseClient, c: ChannelInput): Promise<void> {
  const { data: existing } = await db
    .from("media_channels")
    .select("id")
    .ilike("name", c.name)
    .eq("media_type", c.media_type)
    .maybeSingle();

  const payload = { name: c.name, media_type: c.media_type, owner: c.owner ?? null };
  if (existing?.id) {
    await db.from("media_channels").update(payload).eq("id", existing.id);
  } else {
    const { error } = await db.from("media_channels").insert(payload);
    if (error) throw new Error(`channel "${c.name}": ${error.message}`);
  }
}

export type InvestmentInput = {
  advertiser_id: string;
  media_type?: string | null;
  period_year: number;
  period_month?: number | null;
  amount_usd?: number | null;
  status?: "verificado" | "pendiente";
  source_id?: string | null;
  notes?: string | null;
};

/** Deduplica por (anunciante, medio, periodo). */
export async function upsertInvestment(db: SupabaseClient, inv: InvestmentInput): Promise<void> {
  const { data: existing } = await db
    .from("ad_investments")
    .select("id")
    .eq("advertiser_id", inv.advertiser_id)
    .eq("period_year", inv.period_year)
    .eq("period_month", inv.period_month ?? null)
    .eq("media_type", inv.media_type ?? null)
    .maybeSingle();

  const payload = {
    advertiser_id: inv.advertiser_id,
    media_type: inv.media_type ?? null,
    period_year: inv.period_year,
    period_month: inv.period_month ?? null,
    amount_usd: inv.amount_usd ?? null,
    status: inv.status ?? "pendiente",
    source_id: inv.source_id ?? null,
    notes: inv.notes ?? null,
  };

  if (existing?.id) {
    await db.from("ad_investments").update(payload).eq("id", existing.id);
  } else {
    const { error } = await db.from("ad_investments").insert(payload);
    if (error) throw new Error(`investment: ${error.message}`);
  }
}

export type MonthlyInvestmentInput = {
  advertiser_id: string;
  period_year: number;
  period_month: number;
  amount_usd?: number | null;
  avisos?: number | null;
  status?: "verificado" | "pendiente";
  source_id?: string | null;
};

/** Deduplica por (anunciante, anio, mes) en la tabla mensual aparte. */
export async function upsertMonthlyInvestment(db: SupabaseClient, inv: MonthlyInvestmentInput): Promise<void> {
  const { data: existing } = await db
    .from("ad_investments_monthly")
    .select("id")
    .eq("advertiser_id", inv.advertiser_id)
    .eq("period_year", inv.period_year)
    .eq("period_month", inv.period_month)
    .maybeSingle();

  const payload = {
    advertiser_id: inv.advertiser_id,
    period_year: inv.period_year,
    period_month: inv.period_month,
    amount_usd: inv.amount_usd ?? null,
    avisos: inv.avisos ?? null,
    status: inv.status ?? "pendiente",
    source_id: inv.source_id ?? null,
  };

  if (existing?.id) {
    await db.from("ad_investments_monthly").update(payload).eq("id", existing.id);
  } else {
    const { error } = await db.from("ad_investments_monthly").insert(payload);
    if (error) throw new Error(`monthly investment: ${error.message}`);
  }
}

export type MetricInput = {
  advertiser_id: string;
  platform: string;
  period_year: number;
  period_month?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  spend_usd?: number | null;
  conversions?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  cpm?: number | null;
  cpa?: number | null;
  status?: "verificado" | "pendiente";
  source_id?: string | null;
};

/** Deduplica por (anunciante, plataforma, periodo). */
export async function upsertMetric(db: SupabaseClient, m: MetricInput): Promise<void> {
  const { data: existing } = await db
    .from("digital_metrics")
    .select("id")
    .eq("advertiser_id", m.advertiser_id)
    .eq("platform", m.platform)
    .eq("period_year", m.period_year)
    .eq("period_month", m.period_month ?? null)
    .maybeSingle();

  const payload = { status: "pendiente" as const, ...m };

  if (existing?.id) {
    await db.from("digital_metrics").update(payload).eq("id", existing.id);
  } else {
    const { error } = await db.from("digital_metrics").insert(payload);
    if (error) throw new Error(`metric: ${error.message}`);
  }
}
