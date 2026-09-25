import { createClient } from "@/lib/supabase/server";
import type { InfluencerProfile, RadioStation } from "@/lib/media-catalog";

export type SavedMediaPlan = {
  id: string;
  name: string;
  status: string;
  mode: string;
  stage: string;
  version: number;
  progress: number;
  brief: Record<string, unknown>;
  analysis: Record<string, unknown>;
  proposal: Record<string, unknown>;
  selection: Record<string, unknown>;
  updated_at: string;
};

export type SavedPlanVersion = {
  id: number;
  version: number;
  snapshot: Record<string, unknown>;
  created_at: string;
};

export type OohLocationOption = {
  id: string;
  assetCode: string;
  status: "inventory" | "zone_candidate";
  providerName: string | null;
  name: string;
  city: string;
  province: string;
  address: string;
  latitude: number;
  longitude: number;
  format: string | null;
  monthlyRateUsd: number | null;
  productionRateUsd: number | null;
  audienceTags: string[];
  contextTags: string[];
  affluenceIndex: number | null;
  sourceNote: string;
  verifiedAt: string | null;
};

export type CatalogHealth = {
  total: number;
  cotizable: number;
  validation: number;
  directory: number;
  stale: number;
  withoutDate: number;
};
export type PlanComment = { id: string; authorId: string; body: string; createdAt: string };
export type PlanApproval = { id: string; actorId: string; decision: "approved" | "changes_requested"; note: string | null; planVersion: number; createdAt: string };

type RadioCatalogRow = {
  station_name: unknown;
  genre: unknown;
  rating: unknown;
  share: unknown;
  rating_audience: unknown;
  reach_audience: unknown;
  reach_pct: unknown;
  audience_rank: unknown;
  reach_rank: unknown;
};

/**
 * Devuelve el ranking derivado para el catálogo autenticado. La vista cruda
 * continúa siendo administrativa; el navegador recibe solo métricas por
 * emisora, sin workbook, filas fuente ni datos de anunciantes.
 */
export async function getRadioCatalog(): Promise<RadioStation[]> {
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("get_radio_catalog");
    if (error) return [];
    return ((data ?? []) as RadioCatalogRow[]).map((row) => ({
      name: String(row.station_name),
      genre: row.genre ? String(row.genre) : null,
      rating: numberOrNull(row.rating),
      share: numberOrNull(row.share),
      audience: numberOrNull(row.rating_audience),
      reach: numberOrNull(row.reach_audience),
      reachPct: numberOrNull(row.reach_pct),
      audienceRank: numberOrNull(row.audience_rank),
      reachRank: numberOrNull(row.reach_rank),
      imagePath: radioImagePath(String(row.station_name)),
    }));
  } catch {
    return [];
  }
}

function radioImagePath(name: string): string | null {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return normalized === "los 40" || normalized === "los40"
    ? "/providers/radio/los40/logo.png"
    : null;
}

export async function getInfluencerCatalog(): Promise<InfluencerProfile[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("influencer_profiles")
    .select(
      "id, slug, category, name, handle, platform, profile_url, followers, avg_views, engagement_pct, follower_quality_pct, influencer_rates(format, amount_usd)",
    )
    .eq("active", true)
    .order("category")
    .order("name");
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    category: row.category as InfluencerProfile["category"],
    name: String(row.name),
    handle: row.handle ? String(row.handle) : null,
    platform: row.platform ? String(row.platform) : null,
    profileUrl: row.profile_url ? String(row.profile_url) : null,
    followers: numberOrNull(row.followers),
    avgViews: numberOrNull(row.avg_views),
    engagementPct: numberOrNull(row.engagement_pct),
    followerQualityPct: numberOrNull(row.follower_quality_pct),
    rates: ((row.influencer_rates ?? []) as { format: unknown; amount_usd: unknown }[])
      .map((rate) => ({ format: String(rate.format), amountUsd: Number(rate.amount_usd) }))
      .sort((a, b) => a.format.localeCompare(b.format, "es")),
  }));
}

export async function getMySavedPlans(userId: string): Promise<SavedMediaPlan[]> {
  void userId;
  const db = await createClient();
  const { data, error } = await db
    .from("media_plans")
    .select("id, name, status, mode, stage, version, progress, brief, analysis, proposal, selection, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    status: String(row.status),
    mode: String(row.mode),
    stage: String(row.stage),
    version: Number(row.version),
    progress: Number(row.progress),
    brief: (row.brief ?? {}) as Record<string, unknown>,
    analysis: (row.analysis ?? {}) as Record<string, unknown>,
    proposal: (row.proposal ?? {}) as Record<string, unknown>,
    selection: (row.selection ?? {}) as Record<string, unknown>,
    updated_at: String(row.updated_at),
  }));
}

export async function getMySavedPlan(userId: string, planId: string): Promise<SavedMediaPlan | null> {
  void userId;
  if (!/^[0-9a-f-]{36}$/i.test(planId)) return null;
  const db = await createClient();
  const { data, error } = await db
    .from("media_plans")
    .select("id, name, status, mode, stage, version, progress, brief, analysis, proposal, selection, updated_at")
    .eq("id", planId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: String(data.id),
    name: String(data.name),
    status: String(data.status),
    mode: String(data.mode),
    stage: String(data.stage),
    version: Number(data.version),
    progress: Number(data.progress),
    brief: (data.brief ?? {}) as Record<string, unknown>,
    analysis: (data.analysis ?? {}) as Record<string, unknown>,
    proposal: (data.proposal ?? {}) as Record<string, unknown>,
    selection: (data.selection ?? {}) as Record<string, unknown>,
    updated_at: String(data.updated_at),
  };
}

export async function getMyPlanVersions(userId: string, planId: string): Promise<SavedPlanVersion[]> {
  const plan = await getMySavedPlan(userId, planId);
  if (!plan) return [];
  const db = await createClient();
  const { data, error } = await db
    .from("media_plan_versions")
    .select("id, version, snapshot, created_at")
    .eq("plan_id", planId)
    .order("version", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    version: Number(row.version),
    snapshot: (row.snapshot ?? {}) as Record<string, unknown>,
    created_at: String(row.created_at),
  }));
}

export async function getPlanCollaboration(userId: string, planId: string): Promise<{ comments: PlanComment[]; approvals: PlanApproval[] }> {
  const plan = await getMySavedPlan(userId, planId);
  if (!plan) return { comments: [], approvals: [] };
  const db = await createClient();
  const [{ data: comments }, { data: approvals }] = await Promise.all([
    db.from("media_plan_comments").select("id, author_id, body, created_at").eq("plan_id", planId).order("created_at", { ascending: false }).limit(100),
    db.from("media_plan_approvals").select("id, actor_id, decision, note, plan_version, created_at").eq("plan_id", planId).order("created_at", { ascending: false }).limit(100),
  ]);
  return {
    comments: (comments ?? []).map((row) => ({ id: String(row.id), authorId: String(row.author_id), body: String(row.body), createdAt: String(row.created_at) })),
    approvals: (approvals ?? []).map((row) => ({ id: String(row.id), actorId: String(row.actor_id), decision: row.decision === "approved" ? "approved" : "changes_requested", note: row.note ? String(row.note) : null, planVersion: Number(row.plan_version), createdAt: String(row.created_at) })),
  };
}

export async function getOohLocationCatalog(): Promise<OohLocationOption[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("ooh_locations")
    .select("id, asset_code, status, provider_name, asset_name, city, province, address, latitude, longitude, format, monthly_rate_usd, production_rate_usd, audience_tags, context_tags, affluence_index, source_note, verified_at")
    .eq("active", true)
    .neq("status", "inactive")
    .order("city")
    .order("asset_name");
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: String(row.id),
    assetCode: String(row.asset_code),
    status: row.status === "inventory" ? "inventory" : "zone_candidate",
    providerName: row.provider_name ? String(row.provider_name) : null,
    name: String(row.asset_name),
    city: String(row.city),
    province: String(row.province),
    address: String(row.address),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    format: row.format ? String(row.format) : null,
    monthlyRateUsd: numberOrNull(row.monthly_rate_usd),
    productionRateUsd: numberOrNull(row.production_rate_usd),
    audienceTags: Array.isArray(row.audience_tags) ? row.audience_tags.map(String) : [],
    contextTags: Array.isArray(row.context_tags) ? row.context_tags.map(String) : [],
    affluenceIndex: numberOrNull(row.affluence_index),
    sourceNote: String(row.source_note),
    verifiedAt: row.verified_at ? String(row.verified_at) : null,
  }));
}

export async function getCatalogHealth(): Promise<CatalogHealth> {
  const db = await createClient();
  const { data, error } = await db
    .from("media_catalog_items")
    .select("status, valid_at, updated_at")
    .eq("active", true);
  if (error) return { total: 0, cotizable: 0, validation: 0, directory: 0, stale: 0, withoutDate: 0 };
  const today = Date.now();
  return (data ?? []).reduce<CatalogHealth>((health, row) => {
    health.total += 1;
    if (row.status === "cotizable") health.cotizable += 1;
    else if (row.status === "validacion") health.validation += 1;
    else health.directory += 1;
    if (!row.valid_at) health.withoutDate += 1;
    else if (today - new Date(String(row.valid_at)).getTime() > 90 * 86_400_000) health.stale += 1;
    return health;
  }, { total: 0, cotizable: 0, validation: 0, directory: 0, stale: 0, withoutDate: 0 });
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
