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
  updated_at: string;
};

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
  const db = await createClient();
  const { data, error } = await db
    .from("media_plans")
    .select("id, name, status, mode, stage, version, progress, brief, updated_at")
    .eq("owner_id", userId)
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
    updated_at: String(row.updated_at),
  }));
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
