import "server-only";

import { getMetaCampaignDurationDays } from "@/lib/ads/config";

type MetaConfig = {
  accessToken: string;
  adAccountId: string;
  pageId: string;
  instagramUserId?: string;
  apiVersion: string;
};

type MetaIdResponse = { id: string };
type MetaListResponse<T> = { data?: T[]; paging?: { next?: string } };
type MetaPost = { id: string; permalink?: string; permalink_url?: string };

export type MetaCampaignInput = {
  jobId: string;
  red: "facebook" | "instagram";
  postUrl: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  budgetCents: number;
  objective?: string;
};

export type MetaCampaignIds = {
  campaignId: string;
  adsetId: string;
  creativeId: string;
  adId: string;
  sourcePostId: string;
};

export type MetaCreateOptions = {
  existing?: Partial<MetaCampaignIds>;
  onProgress?: (ids: Partial<MetaCampaignIds>) => Promise<void>;
};

export type MetaInsights = {
  impresiones: number;
  alcance: number;
  clics: number;
  gasto_usd: number;
};

export function isMetaConfigured(): boolean {
  return Boolean(
    process.env.META_ACCESS_TOKEN &&
      process.env.META_AD_ACCOUNT_ID &&
      process.env.META_PAGE_ID,
  );
}

/**
 * Crea campaña, conjunto, creativo y anuncio reales, todos en PAUSED.
 * El presupuesto no puede consumirse hasta que un administrador active el
 * anuncio mediante la accion separada.
 */
export async function createPausedMetaCampaign(
  input: MetaCampaignInput,
  options: MetaCreateOptions = {},
): Promise<MetaCampaignIds> {
  const config = getConfig(input.red);
  const progress: Partial<MetaCampaignIds> = { ...options.existing };
  const save = async (update: Partial<MetaCampaignIds>) => {
    Object.assign(progress, update);
    await options.onProgress?.(progress);
  };
  const sourcePostId = progress.sourcePostId ?? await resolveSourcePost(config, input.red, input.postUrl);
  if (!progress.sourcePostId) await save({ sourcePostId });
  const suffix = input.jobId.slice(0, 8);
  const name = `Ad Mavericks ${input.red} ${suffix}`;

  let campaignId = progress.campaignId;
  if (!campaignId) {
    const campaign = await metaPost<MetaIdResponse>(config, `${config.adAccountId}/campaigns`, {
      name,
      objective: "OUTCOME_AWARENESS",
      buying_type: "AUCTION",
      special_ad_categories: [],
      status: "PAUSED",
    });
    campaignId = campaign.id;
    await save({ campaignId });
  }

  const startsAt = new Date(Date.now() + 60 * 60 * 1000);
  const endsAt = new Date(
    startsAt.getTime() + getMetaCampaignDurationDays() * 24 * 60 * 60 * 1000,
  );
  const targeting: Record<string, unknown> = {
    age_min: 18,
    age_max: 65,
    geo_locations: {
      custom_locations: [
        {
          latitude: input.latitude,
          longitude: input.longitude,
          radius: Math.max(1, Math.round(input.radiusKm)),
          distance_unit: "kilometer",
        },
      ],
      location_types: ["home", "recent"],
    },
    publisher_platforms: input.red === "instagram" ? ["instagram"] : ["facebook"],
  };

  let adsetId = progress.adsetId;
  if (!adsetId) {
    const adset = await metaPost<MetaIdResponse>(config, `${config.adAccountId}/adsets`, {
      name: `${name} · radio ${Math.round(input.radiusKm)} km`,
      campaign_id: campaignId,
      optimization_goal: "REACH",
      billing_event: "IMPRESSIONS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      lifetime_budget: input.budgetCents,
      targeting,
      start_time: toMetaDate(startsAt),
      end_time: toMetaDate(endsAt),
      status: "PAUSED",
    });
    adsetId = adset.id;
    await save({ adsetId });
  }

  const creativePayload: Record<string, unknown> = {
    name: `${name} · creativo`,
  };
  if (input.red === "facebook") {
    creativePayload.object_story_id = sourcePostId;
    creativePayload.page_id = config.pageId;
  } else {
    creativePayload.source_instagram_media_id = sourcePostId;
    creativePayload.instagram_user_id = config.instagramUserId;
    creativePayload.object_story_spec = { page_id: config.pageId };
  }
  let creativeId = progress.creativeId;
  if (!creativeId) {
    const creative = await metaPost<MetaIdResponse>(config, `${config.adAccountId}/adcreatives`, creativePayload);
    creativeId = creative.id;
    await save({ creativeId });
  }

  let adId = progress.adId;
  if (!adId) {
    const ad = await metaPost<MetaIdResponse>(config, `${config.adAccountId}/ads`, {
      name: `${name} · anuncio`,
      adset_id: adsetId,
      creative: { creative_id: creativeId },
      status: "PAUSED",
    });
    adId = ad.id;
    await save({ adId });
  }

  return {
    campaignId,
    adsetId,
    creativeId,
    adId,
    sourcePostId,
  };
}

/** Activa el anuncio de abajo hacia arriba; la campaña se activa al final. */
export async function activateMetaCampaign(ids: Pick<MetaCampaignIds, "campaignId" | "adsetId" | "adId">) {
  const config = getConfig();
  await metaPost(config, ids.adId, { status: "ACTIVE" });
  await metaPost(config, ids.adsetId, { status: "ACTIVE" });
  await metaPost(config, ids.campaignId, { status: "ACTIVE" });
}

export async function pauseMetaCampaign(ids: Pick<MetaCampaignIds, "campaignId" | "adsetId" | "adId">) {
  const config = getConfig();
  // Pausar la campaña primero corta la entrega aunque otro cambio falle.
  await metaPost(config, ids.campaignId, { status: "PAUSED" });
  await Promise.allSettled([
    metaPost(config, ids.adsetId, { status: "PAUSED" }),
    metaPost(config, ids.adId, { status: "PAUSED" }),
  ]);
}

export async function getMetaAdInsights(adId: string): Promise<MetaInsights> {
  const config = getConfig();
  const result = await metaGet<MetaListResponse<Record<string, string>>>(config, `${adId}/insights`, {
    fields: "impressions,reach,clicks,spend",
    date_preset: "maximum",
  });
  const row = result.data?.[0] ?? {};
  return {
    impresiones: safeNumber(row.impressions),
    alcance: safeNumber(row.reach),
    clics: safeNumber(row.clicks),
    gasto_usd: safeNumber(row.spend),
  };
}

async function resolveSourcePost(
  config: MetaConfig,
  red: "facebook" | "instagram",
  requestedUrl: string,
): Promise<string> {
  const wanted = normalizeSocialUrl(requestedUrl);

  if (red === "facebook") {
    const parsedPostId = parseFacebookPostId(requestedUrl);
    if (parsedPostId) {
      const objectStoryId = `${config.pageId}_${parsedPostId}`;
      try {
        await metaGet(config, objectStoryId, { fields: "id" });
        return objectStoryId;
      } catch {
        // Si la URL no incluye un id util, intentamos buscar por permalink.
      }
    }
    const posts = await readMetaPages<MetaPost>(config, `${config.pageId}/posts`, {
      fields: "id,permalink_url",
      limit: "100",
    });
    const match = posts.find((post) => normalizeSocialUrl(post.permalink_url ?? "") === wanted);
    if (match) return match.id;
    throw new Error("La publicacion de Facebook no pertenece a la pagina Meta configurada o no es accesible.");
  }

  const instagramUserId = config.instagramUserId!;
  const media = await readMetaPages<MetaPost>(config, `${instagramUserId}/media`, {
    fields: "id,permalink",
    limit: "100",
  });
  const match = media.find((post) => normalizeSocialUrl(post.permalink ?? "") === wanted);
  if (!match) {
    throw new Error("La publicacion de Instagram no pertenece a la cuenta profesional configurada o no es accesible.");
  }
  return match.id;
}

async function readMetaPages<T>(
  config: MetaConfig,
  path: string,
  params: Record<string, string>,
): Promise<T[]> {
  const rows: T[] = [];
  let result = await metaGet<MetaListResponse<T>>(config, path, params);
  for (let page = 0; page < 5; page += 1) {
    rows.push(...(result.data ?? []));
    if (!result.paging?.next) break;
    result = await metaFetchUrl<MetaListResponse<T>>(config, result.paging.next);
  }
  return rows;
}

function getConfig(red?: "facebook" | "instagram"): MetaConfig {
  const accessToken = process.env.META_ACCESS_TOKEN?.trim();
  const rawAccount = process.env.META_AD_ACCOUNT_ID?.trim();
  const pageId = process.env.META_PAGE_ID?.trim();
  const instagramUserId = process.env.META_INSTAGRAM_USER_ID?.trim();
  if (!accessToken || !rawAccount || !pageId) {
    throw new Error("Meta no esta configurado: faltan token, cuenta publicitaria o pagina.");
  }
  if (red === "instagram" && !instagramUserId) {
    throw new Error("Falta META_INSTAGRAM_USER_ID para pautar publicaciones de Instagram.");
  }
  const accountDigits = rawAccount.replace(/^act_/, "");
  if (!/^\d+$/.test(accountDigits) || !/^\d+$/.test(pageId)) {
    throw new Error("Los identificadores de Meta configurados no son validos.");
  }
  return {
    accessToken,
    adAccountId: `act_${accountDigits}`,
    pageId,
    instagramUserId,
    apiVersion: process.env.META_GRAPH_API_VERSION?.trim() || "v25.0",
  };
}

async function metaPost<T = unknown>(config: MetaConfig, path: string, body: Record<string, unknown>): Promise<T> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    params.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  return metaRequest<T>(config, path, { method: "POST", body: params });
}

async function metaGet<T = unknown>(config: MetaConfig, path: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(params);
  return metaRequest<T>(config, `${path}?${query.toString()}`, { method: "GET" });
}

async function metaRequest<T>(
  config: MetaConfig,
  path: string,
  init: { method: "GET" | "POST"; body?: URLSearchParams },
): Promise<T> {
  const cleanPath = path.replace(/^\/+/, "");
  const url = `https://graph.facebook.com/${config.apiVersion}/${cleanPath}`;
  return metaFetchUrl<T>(config, url, init);
}

async function metaFetchUrl<T>(
  config: MetaConfig,
  url: string,
  init: { method?: "GET" | "POST"; body?: URLSearchParams } = {},
): Promise<T> {
  const target = new URL(url);
  if (target.protocol !== "https:" || target.hostname !== "graph.facebook.com") {
    throw new Error("Meta devolvio una direccion de API no permitida.");
  }
  const response = await fetch(target, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init.body?.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const result = (await response.json()) as T & {
    error?: { message?: string; code?: number; error_subcode?: number };
  };
  if (!response.ok || result.error) {
    const code = [result.error?.code, result.error?.error_subcode].filter(Boolean).join("/");
    throw new Error(`Meta rechazo la operacion${code ? ` (${code})` : ""}: ${result.error?.message ?? "error desconocido"}`);
  }
  return result;
}

function normalizeSocialUrl(value: string): string {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, "");
    return `${host}${path}`.toLowerCase();
  } catch {
    return "";
  }
}

function parseFacebookPostId(value: string): string | null {
  try {
    const url = new URL(value);
    const queryId = url.searchParams.get("story_fbid") || url.searchParams.get("fbid");
    if (queryId && /^\d+$/.test(queryId)) return queryId;
    const parts = url.pathname.split("/").filter(Boolean);
    const markerIndex = parts.findIndex((part) => ["posts", "videos", "reel"].includes(part));
    const candidate = markerIndex >= 0 ? parts[markerIndex + 1] : null;
    return candidate && /^\d+$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function toMetaDate(value: Date): string {
  return value.toISOString().replace(/\.\d{3}Z$/, "+0000");
}

function safeNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
