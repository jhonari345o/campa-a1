import { chatCompletion } from "@/lib/assistant/llm";
import { buildLiveTrendContext, type LiveTrendSource } from "@/lib/assistant/trends";
import { isAiAssistantEnabled, isAiWebTrendsEnabled } from "@/lib/commercial";
import {
  DIGITAL_PLATFORMS,
  OOH_PROVIDERS,
  PRESS_OUTLETS,
} from "@/lib/media-catalog";
import { mediaGroupForLabel, type MediaGroup } from "@/lib/media-groups";
import type { PlanAnalysisInput } from "@/lib/plan-analysis";
import type { MediaPlan, PlanRow } from "@/lib/planner";
import { createAdminClient } from "@/lib/supabase/admin";
import { TV_RATE_CATALOGS, type TvOffer } from "@/lib/tv-rate-catalog";

export type DetailedExecution = {
  id: string;
  provider: string;
  product: string;
  location: string;
  schedule: string;
  budgetUsd: number | null;
  referenceUnitPriceUsd: number | null;
  estimatedUnits: number | null;
  unit: string;
  status: "cotizable" | "validacion";
  evidence: string;
  nextStep: string;
};

export type DetailedChannelPlan = {
  kind: MediaGroup;
  label: string;
  budgetUsd: number | null;
  objective: string;
  rationale: string;
  executions: DetailedExecution[];
};

export type DetailedMediaRecommendation = {
  engine: "datos" | "datos+ia";
  aiNarrative: string | null;
  liveSources: LiveTrendSource[];
  channelPlans: DetailedChannelPlan[];
  checks: string[];
};

type RadioMetric = {
  station_name: unknown;
  genre: unknown;
  rating: unknown;
  share: unknown;
  reach_pct: unknown;
  audience_rank: unknown;
  reach_rank: unknown;
};

type CatalogRate = {
  label?: unknown;
  amount_usd?: unknown;
  unit?: unknown;
  status?: unknown;
  conditions?: unknown;
  metadata?: unknown;
};

type OohCatalogRow = {
  slug?: unknown;
  name?: unknown;
  coverage?: unknown;
  status?: unknown;
  status_note?: unknown;
  metadata?: unknown;
  media_catalog_rates?: CatalogRate[] | null;
};

type InfluencerRow = {
  id?: unknown;
  name?: unknown;
  category?: unknown;
  platform?: unknown;
  followers?: unknown;
  avg_views?: unknown;
  engagement_pct?: unknown;
  follower_quality_pct?: unknown;
  influencer_rates?: Array<{ format?: unknown; amount_usd?: unknown }> | null;
};

export async function buildDetailedMediaRecommendation(
  brief: PlanAnalysisInput,
  plan: MediaPlan,
): Promise<DetailedMediaRecommendation> {
  const selectedGroups = new Set(plan.plan.map((row) => mediaGroupForLabel(row.label)).filter(Boolean));
  const [radio, ooh, influencers] = await Promise.all([
    selectedGroups.has("radio") ? readRadioMetrics() : Promise.resolve([]),
    selectedGroups.has("ooh") ? readOohInventory() : Promise.resolve([]),
    selectedGroups.has("influencers") ? readInfluencers() : Promise.resolve([]),
  ]);

  const channelPlans = plan.plan.map((row) => buildChannelPlan(row, brief, radio, ooh, influencers));
  const checks = [
    "Los presupuestos por ejecución conservan el total recomendado para cada medio.",
    "Tarifas y cantidades son referencias de planificación; disponibilidad, IVA y negociación se reconfirman antes de ordenar.",
    "Ratings, reach, rankings, OTS, seguidores e impresiones permanecen en sus propias metodologías y no se suman como alcance único.",
    "Las ubicaciones de vía pública solo se presentan como exactas cuando existen en el inventario; lo demás queda marcado para validación.",
  ];
  const live = isAiWebTrendsEnabled()
    ? await buildLiveTrendContext(`${brief.keyword} ${brief.objective} ${brief.audience} ${brief.geography} tendencias mercado consumo`)
    : { context: "", sources: [] };
  const aiNarrative = await buildAiNarrative(brief, channelPlans, live.context);
  return { engine: aiNarrative ? "datos+ia" : "datos", aiNarrative, liveSources: live.sources, channelPlans, checks };
}

function buildChannelPlan(
  row: PlanRow,
  brief: PlanAnalysisInput,
  radio: RadioMetric[],
  ooh: OohCatalogRow[],
  influencers: InfluencerRow[],
): DetailedChannelPlan {
  const kind = mediaGroupForLabel(row.label) ?? "digital";
  const common = {
    kind,
    label: row.label,
    budgetUsd: row.amount,
    objective: channelObjective(kind, brief.objective),
    rationale: row.rationale ?? "Ejecución priorizada por el mix recomendado y el brief.",
  };
  if (kind === "television") return { ...common, executions: televisionExecutions(row, brief) };
  if (kind === "radio") return { ...common, executions: radioExecutions(row, brief, radio) };
  if (kind === "ooh") return { ...common, executions: oohExecutions(row, brief, ooh) };
  if (kind === "press") return { ...common, executions: pressExecutions(row, brief) };
  if (kind === "influencers") return { ...common, executions: influencerExecutions(row, brief, influencers) };
  return { ...common, executions: digitalExecutions(row, brief) };
}

function televisionExecutions(row: PlanRow, brief: PlanAnalysisInput): DetailedExecution[] {
  const candidates = Object.values(TV_RATE_CATALOGS).flatMap((catalog) =>
    catalog.offers
      .filter((offer) => offer.priceUsd != null && offer.priceUsd > 0)
      .map((offer) => ({ catalog, offer, score: scoreTvOffer(offer, brief, row.amount) })),
  ).sort((a, b) => b.score - a.score || (a.offer.priceUsd ?? 0) - (b.offer.priceUsd ?? 0));
  const chosen: typeof candidates = [];
  const providers = new Set<string>();
  for (const candidate of candidates) {
    if (chosen.length >= 3) break;
    if (providers.has(candidate.catalog.channelSlug)) continue;
    chosen.push(candidate);
    providers.add(candidate.catalog.channelSlug);
  }
  return allocate(row.amount, chosen.length).map((budget, index) => {
    const { catalog, offer } = chosen[index];
    const price = offer.priceUsd!;
    return {
      id: `tv-${catalog.channelSlug}-${offer.id}`,
      provider: channelName(catalog.channelSlug),
      product: offer.title,
      location: offer.market || marketFromGeography(brief.geography),
      schedule: `${offer.day} · ${offer.schedule}`,
      budgetUsd: budget,
      referenceUnitPriceUsd: price,
      estimatedUnits: budget == null ? null : Math.max(1, Math.floor(budget / price)),
      unit: offer.unit,
      status: "validacion",
      evidence: `${catalog.priceBasis}. Verificado: ${catalog.lastVerified}.`,
      nextStep: "Confirmar afinidad del programa, rating homologado, vigencia, cupo, IVA y negociación final.",
    };
  });
}

function radioExecutions(row: PlanRow, brief: PlanAnalysisInput, radio: RadioMetric[]): DetailedExecution[] {
  const preferred = preferredRadioGenres(brief);
  const ranked = radio
    .map((station) => ({ station, score: scoreRadio(station, preferred) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (!ranked.length) return [pendingExecution("radio", "Emisoras por plaza", brief.geography, row.amount, "El ranking de radio no respondió en esta consulta.")];
  return allocate(row.amount, ranked.length).map((budget, index) => {
    const station = ranked[index].station;
    const genre = value(station.genre) || "Género por confirmar";
    const reach = numeric(station.reach_pct);
    const rating = numeric(station.rating);
    const rank = numeric(station.audience_rank);
    return {
      id: `radio-${slug(value(station.station_name))}`,
      provider: value(station.station_name),
      product: `Cuñas y menciones · ${genre}`,
      location: marketFromStation(value(station.station_name), brief.geography),
      schedule: preferredRadioSchedule(brief),
      budgetUsd: budget,
      referenceUnitPriceUsd: null,
      estimatedUnits: null,
      unit: "pauta por cotizar",
      status: "validacion",
      evidence: [rank ? `ranking de audiencia #${rank}` : "ranking pendiente", rating ? `rating ${rating}` : null, reach ? `reach ${reach}%` : null].filter(Boolean).join(" · "),
      nextStep: "Solicitar tarifario, cobertura técnica, franja, frecuencia y vigencia antes de emitir la orden.",
    };
  });
}

function oohExecutions(row: PlanRow, brief: PlanAnalysisInput, inventory: OohCatalogRow[]): DetailedExecution[] {
  const location = marketFromGeography(brief.geography);
  const inventoryExecutions = inventory.flatMap((provider) => {
    const rates = provider.media_catalog_rates ?? [];
    return rates.map((rate, index) => {
      const meta = object(rate.metadata);
      const providerMeta = object(provider.metadata);
      const exact = firstText(meta, ["address", "direccion", "location", "ubicacion", "site", "sector", "zone", "zona"])
        || firstText(providerMeta, ["address", "direccion", "location", "ubicacion", "site", "sector", "zone", "zona"]);
      const city = firstText(meta, ["city", "ciudad", "market", "plaza"])
        || firstText(providerMeta, ["city", "ciudad", "market", "plaza"]);
      const coordinates = coordinatesFrom(meta) || coordinatesFrom(providerMeta);
      const locatedAt = [exact, city, coordinates].filter(Boolean).join(" · ") || value(provider.coverage) || location;
      return {
        provider: value(provider.name) || value(provider.slug),
        rate,
        location: locatedAt,
        score: locationScore(locatedAt, brief.geography) + (numeric(rate.amount_usd) ? 2 : 0),
        index,
      };
    });
  }).sort((a, b) => b.score - a.score).slice(0, 3);

  if (inventoryExecutions.length) {
    return allocate(row.amount, inventoryExecutions.length).map((budget, index) => {
      const item = inventoryExecutions[index];
      return {
        id: `ooh-${slug(item.provider)}-${item.index}`,
        provider: item.provider,
        product: value(item.rate.label) || "Activo de vía pública",
        location: item.location,
        schedule: "Periodo del brief · disponibilidad por confirmar",
        budgetUsd: budget,
        referenceUnitPriceUsd: numeric(item.rate.amount_usd),
        estimatedUnits: numeric(item.rate.amount_usd) && budget != null ? Math.max(1, Math.floor(budget / numeric(item.rate.amount_usd)!)) : null,
        unit: value(item.rate.unit) || "unidad por cotizar",
        status: normalizeStatus(item.rate.status),
        evidence: value(item.rate.conditions) || "Ficha del inventario comercial cargado en Supabase.",
        nextStep: "Validar coordenadas, foto vigente, flujo, visibilidad, iluminación, disponibilidad, permisos e IVA.",
      };
    });
  }

  const providers = OOH_PROVIDERS
    .map((provider) => ({ provider, score: locationScore(provider.coverage || provider.detail, brief.geography) + (provider.status === "cotizable" ? 2 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return allocate(row.amount, providers.length).map((budget, index) => {
    const provider = providers[index].provider;
    return {
      id: `ooh-${provider.slug}`,
      provider: provider.name,
      product: provider.summary,
      location: `${location} · activo exacto por seleccionar`,
      schedule: "Periodo del brief",
      budgetUsd: budget,
      referenceUnitPriceUsd: null,
      estimatedUnits: null,
      unit: "ubicación por cotizar",
      status: provider.status === "cotizable" ? "cotizable" : "validacion",
      evidence: provider.coverage ? `Cobertura declarada: ${provider.coverage}.` : provider.statusNote,
      nextStep: "Abrir inventario del proveedor y confirmar dirección, coordenadas, foto, formato, flujo, disponibilidad, tarifa e IVA.",
    };
  });
}

function pressExecutions(row: PlanRow, brief: PlanAnalysisInput): DetailedExecution[] {
  const location = normalize(brief.geography);
  const ranked = PRESS_OUTLETS.map((outlet) => {
    let score = outlet.status === "cotizable" ? 3 : outlet.status === "validacion" ? 2 : 1;
    if (location.includes("guayaquil") && /universo|expreso|extra|metro/.test(normalize(outlet.name))) score += 3;
    if (location.includes("quito") && /comercio|metro/.test(normalize(outlet.name))) score += 3;
    return { outlet, score };
  }).sort((a, b) => b.score - a.score).slice(0, 2);
  return allocate(row.amount, ranked.length).map((budget, index) => {
    const outlet = ranked[index].outlet;
    return {
      id: `press-${outlet.slug}`,
      provider: outlet.name,
      product: outlet.summary,
      location: outlet.detail,
      schedule: "Edición y fecha por confirmar",
      budgetUsd: budget,
      referenceUnitPriceUsd: null,
      estimatedUnits: null,
      unit: "formato por cotizar",
      status: outlet.status === "cotizable" ? "cotizable" : "validacion",
      evidence: outlet.statusNote,
      nextStep: "Confirmar edición, formato, circulación/lectura con metodología, fecha de cierre, tarifa e IVA.",
    };
  });
}

function digitalExecutions(row: PlanRow, brief: PlanAnalysisInput): DetailedExecution[] {
  const normalized = normalize(row.label);
  const platform = DIGITAL_PLATFORMS.find((item) => normalized.includes(normalize(item.name.split(" ")[0])))
    ?? DIGITAL_PLATFORMS.find((item) => normalized.includes(item.slug.split("-")[0]));
  return [{
    id: `digital-${platform?.slug ?? slug(row.label)}`,
    provider: platform?.name ?? row.label,
    product: platform?.formats ?? "Campaña configurada por objetivo, audiencia y destino.",
    location: brief.geography || "Cobertura del brief",
    schedule: "Fechas del brief · aprendizaje y optimización continua",
    budgetUsd: row.amount,
    referenceUnitPriceUsd: null,
    estimatedUnits: null,
    unit: "presupuesto de plataforma",
    status: digitalReady(brief) ? "cotizable" : "validacion",
    evidence: platform?.measurement ?? "Forecast por plataforma y evento de conversión.",
    nextStep: digitalReady(brief)
      ? "Validar creatividades, audiencias, URL, atribución y publicar primero como borrador pausado."
      : "Completar destino, tracking y acceso a la cuenta antes de producir un forecast o activar pauta.",
  }];
}

function influencerExecutions(row: PlanRow, brief: PlanAnalysisInput, profiles: InfluencerRow[]): DetailedExecution[] {
  const preferred = influencerCategory(brief);
  const ranked = profiles
    .map((profile) => ({ profile, score: (value(profile.category) === preferred ? 4 : 0) + (numeric(profile.engagement_pct) ?? 0) + (numeric(profile.follower_quality_pct) ?? 0) / 20 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (!ranked.length) return [pendingExecution("influencer", "Perfiles por categoría", brief.geography, row.amount, "Los perfiles deben validarse en el catálogo autenticado.")];
  return allocate(row.amount, ranked.length).map((budget, index) => {
    const profile = ranked[index].profile;
    const rate = (profile.influencer_rates ?? []).sort((a, b) => (numeric(a.amount_usd) ?? Infinity) - (numeric(b.amount_usd) ?? Infinity))[0];
    const unitPrice = numeric(rate?.amount_usd);
    return {
      id: `influencer-${value(profile.id) || slug(value(profile.name))}`,
      provider: value(profile.name),
      product: value(rate?.format) || `${value(profile.platform) || "Red social"} · formato por definir`,
      location: brief.geography || "Ecuador",
      schedule: "Fecha y derechos por acordar",
      budgetUsd: budget,
      referenceUnitPriceUsd: unitPrice,
      estimatedUnits: unitPrice && budget != null ? Math.max(1, Math.floor(budget / unitPrice)) : null,
      unit: "contenido",
      status: unitPrice ? "cotizable" : "validacion",
      evidence: `Engagement ${displayNumber(profile.engagement_pct, "%")} · calidad ${displayNumber(profile.follower_quality_pct, "%")} · views promedio ${displayNumber(profile.avg_views)}.`,
      nextStep: "Reconfirmar disponibilidad, audiencia, tarifa, derechos de pauta, territorio, duración, plataforma e IVA.",
    };
  });
}

async function readRadioMetrics(): Promise<RadioMetric[]> {
  try {
    const { data, error } = await createAdminClient().rpc("get_radio_catalog");
    return error ? [] : (data ?? []) as RadioMetric[];
  } catch {
    return [];
  }
}

async function readOohInventory(): Promise<OohCatalogRow[]> {
  try {
    const { data, error } = await createAdminClient()
      .from("media_catalog_items")
      .select("slug, name, coverage, status, status_note, metadata, media_catalog_rates(label, amount_usd, unit, status, conditions, metadata)")
      .eq("kind", "ooh")
      .eq("active", true);
    return error ? [] : (data ?? []) as OohCatalogRow[];
  } catch {
    return [];
  }
}

async function readInfluencers(): Promise<InfluencerRow[]> {
  try {
    const { data, error } = await createAdminClient()
      .from("influencer_profiles")
      .select("id, name, category, platform, followers, avg_views, engagement_pct, follower_quality_pct, influencer_rates(format, amount_usd)")
      .eq("active", true);
    return error ? [] : (data ?? []) as InfluencerRow[];
  } catch {
    return [];
  }
}

async function buildAiNarrative(brief: PlanAnalysisInput, channels: DetailedChannelPlan[], liveContext: string): Promise<string | null> {
  if (!isAiAssistantEnabled()) return null;
  const compact = channels.map((channel) => ({
    medio: channel.label,
    presupuesto: channel.budgetUsd,
    ejecuciones: channel.executions.map((execution) => ({
      proveedor: execution.provider,
      producto: execution.product,
      ubicacion: execution.location,
      presupuesto: execution.budgetUsd,
      evidencia: execution.evidence,
    })),
  }));
  try {
    return await chatCompletion([
      {
        role: "system",
        content: "Eres el estratega de medios de Ad Mavericks One. Redacta en español de Ecuador un dictamen de máximo 180 palabras. Usa exclusivamente los candidatos y cifras entregados. Explica por qué encajan con el giro, objetivo, audiencia y geografía; señala la principal validación pendiente. No inventes métricas, ubicaciones, tarifas ni resultados.",
      },
      {
        role: "user",
        content: JSON.stringify({
          giro: brief.keyword,
          objetivo: brief.objective,
          audiencia: brief.audience,
          geografia: brief.geography,
          presupuesto: brief.budgetUsd,
          canales: compact,
          fuentes_actuales: liveContext || "No se consultaron fuentes actuales para este plan.",
        }),
      },
    ], { maxTokens: 320, temperature: 0.25 });
  } catch {
    return null;
  }
}

function scoreTvOffer(offer: TvOffer, brief: PlanAnalysisInput, budget: number | null): number {
  const text = normalize(`${offer.title} ${offer.schedule} ${offer.market ?? ""}`);
  const audience = normalize(`${brief.audience} ${brief.ageRange} ${brief.audienceType} ${brief.keyword}`);
  const objective = normalize(brief.objective);
  let score = 1;
  if (/b2b|empresa|profesional|finanz|inmobili|noticia|entrevista/.test(audience) && /notic|24 horas|televistazo|entrevista|contacto directo/.test(text)) score += 5;
  if (/13-17|18-24|18-34|joven|moda|entreten|tecnolog/.test(audience) && /simpson|enchufe|combate|soy el mejor|after|cine/.test(text)) score += 4;
  if (/famil|hogar|salud|farmacia|retail|consumo/.test(audience) && /manana|de casa|contacto|comunidad|noticiero|telenovela/.test(text)) score += 3;
  if (/reconocimiento|alcance/.test(objective) && /19:|20:|21:|estelar|noticiero iii|destiny/.test(text)) score += 3;
  if (/venta|lead|mensaje|eficiencia|visita/.test(objective) && (offer.priceUsd ?? Infinity) <= 1500) score += 3;
  if (budget && offer.priceUsd && offer.priceUsd <= budget / 3) score += 2;
  if (locationScore(offer.market || "", brief.geography) > 0) score += 2;
  return score;
}

function preferredRadioGenres(brief: PlanAnalysisInput): string[] {
  const text = normalize(`${brief.keyword} ${brief.audience} ${brief.ageRange} ${brief.audienceType}`);
  if (/b2b|empresa|profesional|finanz|inmobili|politic/.test(text)) return ["NOTICIAS", "DEPORTES"];
  if (/13-17|18-24|18-34|joven|moda|tecnolog|univers/.test(text)) return ["POP/JUVENIL", "MUSICA EN INGLES"];
  if (/deporte|auto|moto|futbol/.test(text)) return ["DEPORTES", "NOTICIAS"];
  if (/famil|hogar|salud|farmacia/.test(text)) return ["TROPICAL VARIADA", "ROMANTICA", "NOTICIAS"];
  return ["TROPICAL VARIADA", "POP/JUVENIL", "NOTICIAS"];
}

function scoreRadio(station: RadioMetric, preferred: string[]): number {
  const genre = normalize(value(station.genre));
  const genreIndex = preferred.findIndex((item) => genre.includes(normalize(item)));
  const affinity = genreIndex < 0 ? 0 : (preferred.length - genreIndex) * 4;
  const rank = numeric(station.audience_rank) ?? 999;
  const reachRank = numeric(station.reach_rank) ?? 999;
  return affinity + Math.max(0, 12 - rank) + Math.max(0, 8 - reachRank) + (numeric(station.rating) ?? 0);
}

function preferredRadioSchedule(brief: PlanAnalysisInput): string {
  const text = normalize(`${brief.audience} ${brief.businessModel} ${brief.keyword}`);
  if (/b2b|empresa|profesional|trabaj/.test(text)) return "Movilidad laboral · mañana y tarde";
  if (/restaurante|comida|delivery|retail|tienda/.test(text)) return "Antes de compra · media mañana, almuerzo y regreso a casa";
  return "Franjas de mayor afinidad por confirmar con la emisora";
}

function influencerCategory(brief: PlanAnalysisInput): string {
  const text = normalize(`${brief.keyword} ${brief.audience}`);
  if (/restaurante|comida|food|cafe|bebida/.test(text)) return "foodie";
  if (/belleza|beauty|moda|cosmet/.test(text)) return "beauty";
  return "deportes";
}

function channelObjective(kind: MediaGroup, objective: string): string {
  const objectives: Record<MediaGroup, string> = {
    television: "Construir notoriedad audiovisual y frecuencia en contenidos afines.",
    radio: "Ganar frecuencia contextual por plaza, género y franja.",
    ooh: "Cubrir rutas, zonas de decisión y cercanía a puntos de venta.",
    press: "Aportar contexto, credibilidad y profundidad editorial.",
    digital: `Optimizar hacia ${objective || "el evento definido"} con medición por plataforma.`,
    influencers: "Producir demostración y prueba social con derechos definidos.",
  };
  return objectives[kind];
}

function allocate(total: number | null, count: number): Array<number | null> {
  if (count <= 0) return [];
  if (total == null) return Array.from({ length: count }, () => null);
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  return Array.from({ length: count }, (_, index) => (base + (index < cents - base * count ? 1 : 0)) / 100);
}

function pendingExecution(id: string, provider: string, location: string, budget: number | null, evidence: string): DetailedExecution {
  return {
    id,
    provider,
    product: "Selección específica pendiente",
    location: location || "Plaza por confirmar",
    schedule: "Por definir",
    budgetUsd: budget,
    referenceUnitPriceUsd: null,
    estimatedUnits: null,
    unit: "por cotizar",
    status: "validacion",
    evidence,
    nextStep: "Completar la fuente comercial antes de emitir una orden.",
  };
}

function digitalReady(brief: PlanAnalysisInput): boolean {
  const tracking = normalize(brief.trackingStatus);
  const accounts = normalize(brief.adAccountsStatus);
  const ready = (value: string) => /implementad|configurad|complet|activ|list/.test(value) && !/parcial|falta|pendiente|sin |no /.test(value);
  return Boolean(brief.digitalDestination) && ready(tracking) && ready(accounts);
}

function channelName(slugValue: string): string {
  const names: Record<string, string> = {
    ecuavisa: "Ecuavisa",
    "red-comercial": "Red Comercial · RTS/TVC",
    teleamazonas: "Teleamazonas",
    "tc-television": "TC Televisión",
    "catomedia-ucsg": "Catomedia · UCSG TV",
  };
  return names[slugValue] ?? slugValue;
}

function marketFromGeography(geography: string): string {
  if (!geography) return "Plaza por confirmar";
  return geography.split("·")[0]?.trim() || geography;
}

function marketFromStation(station: string, geography: string): string {
  if (/\(q\)|\(uio\)|quito/i.test(station)) return "Quito";
  if (/\(g\)|\(gye\)|guayaquil/i.test(station)) return "Guayaquil";
  return marketFromGeography(geography);
}

function locationScore(candidate: string, geography: string): number {
  const wanted = normalize(marketFromGeography(geography));
  if (!wanted || wanted === "todo ecuador") return /nacional|ecuador/.test(normalize(candidate)) ? 3 : 1;
  return normalize(candidate).includes(wanted) ? 5 : 0;
}

function coordinatesFrom(metadata: Record<string, unknown>): string {
  const lat = numeric(metadata.latitude ?? metadata.lat);
  const lng = numeric(metadata.longitude ?? metadata.lng ?? metadata.lon);
  return lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "";
}

function firstText(metadata: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const result = value(metadata[key]);
    if (result) return result;
  }
  return "";
}

function normalizeStatus(status: unknown): "cotizable" | "validacion" {
  return value(status) === "cotizable" ? "cotizable" : "validacion";
}

function object(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
}

function value(input: unknown): string {
  return typeof input === "string" || typeof input === "number" ? String(input).trim() : "";
}

function numeric(input: unknown): number | null {
  if (input == null || input === "") return null;
  const result = Number(input);
  return Number.isFinite(result) ? result : null;
}

function displayNumber(input: unknown, suffix = ""): string {
  const result = numeric(input);
  return result == null ? "por confirmar" : `${new Intl.NumberFormat("es-EC", { maximumFractionDigits: 2 }).format(result)}${suffix}`;
}

function normalize(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function slug(input: string): string {
  return normalize(input).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}
