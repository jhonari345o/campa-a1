import { optionalWithinBudget } from "@/lib/optional-task";
import { bedrockChat } from "@/lib/assistant/llm";
import { buildLiveTrendContext, type LiveTrendSource } from "@/lib/assistant/trends";
import { isAiAssistantEnabled, isAiWebTrendsEnabled } from "@/lib/commercial";
import {
  DIGITAL_PLATFORMS,
  OOH_PROVIDERS,
  PRESS_OUTLETS,
} from "@/lib/media-catalog";
import { mediaGroupForLabel, type MediaGroup } from "@/lib/media-groups";
import { mediaGroupLabel } from "@/lib/plan-optimizer";
import type { PlanAnalysisInput } from "@/lib/plan-analysis";
import type { MediaPlan, PlanRow } from "@/lib/planner";
import { createAdminClient } from "@/lib/supabase/admin";
import { compatibleTv, compatibleRadio, sourceDescription, emptyBroadcastCatalog, type BroadcastCatalog, type BroadcastTvOffer } from "@/lib/broadcast-catalog";

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
  geo?: OohGeoRecommendation;
};

export type OohGeoRecommendation = {
  latitude: number;
  longitude: number;
  mapUrl: string;
  streetViewUrl: string;
  locationStatus: "inventory" | "zone_candidate";
  fitScore: number | null;
  audienceFit: string;
  priceFit: string;
  trafficEvidence: string;
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

type OohLocationRow = {
  id?: unknown;
  asset_code?: unknown;
  status?: unknown;
  provider_name?: unknown;
  asset_name?: unknown;
  city?: unknown;
  province?: unknown;
  address?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  format?: unknown;
  monthly_rate_usd?: unknown;
  production_rate_usd?: unknown;
  audience_tags?: unknown;
  context_tags?: unknown;
  affluence_index?: unknown;
  affluence_source?: unknown;
  street_view_pano_id?: unknown;
  source_note?: unknown;
  verified_at?: unknown;
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
  timeoutMs = 18_000,
): Promise<DetailedMediaRecommendation> {
  if (plan.strategy) return strategyExecutions(brief, plan);
  const selectedGroups = new Set(plan.plan.map((row) => mediaGroupForLabel(row.label)).filter(Boolean));
  const checks = [
    "Los presupuestos por ejecución conservan el total recomendado para cada medio.",
    "Tarifas y cantidades son referencias de planificación; disponibilidad, IVA y negociación se reconfirman antes de ordenar.",
    "Ratings, reach, rankings, OTS, seguidores e impresiones permanecen en sus propias metodologías y no se suman como alcance único.",
    "Las ubicaciones de vía pública solo se presentan como exactas cuando existen en el inventario; lo demás queda marcado para validación.",
    "Google Maps y Street View muestran el punto geográfico; la cobertura 360 depende de la disponibilidad de imágenes de Google.",
  ];
  let available: DetailedMediaRecommendation = {
    engine: "datos", aiNarrative: null, liveSources: [], checks,
    channelPlans: plan.plan.map((row) => buildChannelPlan(row, brief, emptyBroadcastCatalog, [], [], [])),
  };
  return optionalWithinBudget(async (signal) => {
    const [broadcast, ooh, oohLocations, influencers] = await Promise.all([
      selectedGroups.has("radio") || selectedGroups.has("television") ? import("@/lib/broadcast-server").then(m=>m.getBroadcastCatalog()).catch(()=>emptyBroadcastCatalog) : Promise.resolve(emptyBroadcastCatalog),
      selectedGroups.has("ooh") ? readOohInventory(signal) : Promise.resolve([]),
      selectedGroups.has("ooh") ? readOohLocations(signal) : Promise.resolve([]),
      selectedGroups.has("influencers") ? readInfluencers(signal) : Promise.resolve([]),
    ]);
    const channelPlans = plan.plan.map((row) => buildChannelPlan(row, brief, broadcast, ooh, oohLocations, influencers));
    available = { ...available, channelPlans };
    const live = isAiWebTrendsEnabled()
      ? await buildLiveTrendContext(`${brief.keyword} ${brief.objective} ${brief.audience} ${brief.geography} tendencias mercado consumo`, signal)
      : { context: "", sources: [] };
    available = { ...available, liveSources: live.sources };
    const aiNarrative = await buildAiNarrative(brief, channelPlans, live.context, signal);
    return { ...available, engine: aiNarrative ? "datos+ia" : "datos", aiNarrative };
  }, () => available, timeoutMs);
}

/** A source-backed planning allocation is not an order or a predicted result. */
function strategyExecutions(brief: PlanAnalysisInput, plan: MediaPlan): DetailedMediaRecommendation {
  const strategy = plan.strategy!;
  return {
    engine: strategy.aiState === "validated" || strategy.aiState === "cached" ? "datos+ia" : "datos",
    aiNarrative: !strategy.customized && (strategy.aiState === "validated" || strategy.aiState === "cached") ? strategy.summary : null,
    liveSources: [],
    checks: ["Las fuentes conservan su plaza, público, período y unidad originales.", "Las cantidades calculadas con tarifa compatible no superan la asignación del medio.", "Las partidas sin una tarifa compatible se mantienen como presupuesto pendiente de cotización."],
    channelPlans: plan.plan.map(row => {
      const kind = mediaGroupForLabel(row.label)!;
      if (kind === "digital") return { kind, label: row.label, budgetUsd: row.amount, objective: channelObjective(kind,brief.objective), rationale: row.rationale ?? "", executions: digitalExecutions(row,brief) };
      const allocation = strategy.allocations.find(a=>a.medium===kind), candidate=allocation?.candidate;
      const sourceText = candidate?.sourceIds.map(id=>strategy.sources.find(s=>s.id===id)).filter(Boolean).map(s=>`${s!.label} · ${s!.period} · ${s!.market} · ${s!.target}`).join("; ");
      const execution:DetailedExecution = candidate ? {
        id:candidate.id,provider:candidate.provider,product:candidate.product,location:candidate.market,schedule:candidate.period,budgetUsd:row.amount,
        referenceUnitPriceUsd:candidate.unitPriceUsd,estimatedUnits:allocation?.units??null,unit:candidate.unit,
        status:candidate.unitPriceUsd!=null&&candidate.sourceUse==="comparable"&&(allocation?.units??0)>0?"cotizable":"validacion",
        evidence:[sourceText,candidate.metrics.map(m=>`${m.label}: ${m.value} ${m.unit}`).join(" · "),candidate.note].filter(Boolean).join(". "),
        nextStep:candidate.unitPriceUsd!=null?"Revisar la combinación, frecuencia y disponibilidad antes de emitir la orden.":"Completar una cotización con vigencia y plaza compatibles antes de cuantificar o comprar.",
        ...(candidate.geo?{geo:{...candidate.geo,...googleMapUrls(candidate.geo.latitude,candidate.geo.longitude,""),locationStatus:"inventory" as const,fitScore:null,audienceFit:"Composición de audiencia no homologada para este soporte.",priceFit:"La tarifa conserva su unidad original y requiere vigencia para la campaña.",trafficEvidence:"Sin una medición de movilidad o alcance aplicable al brief."}}:{}),
      } : pendingExecution(kind,`${mediaGroupLabel(kind)} por completar`,brief.geography,row.amount,"No hay un producto homologado para todos los filtros del brief.");
      return {kind,label:row.label,budgetUsd:row.amount,objective:channelObjective(kind,brief.objective),rationale:row.rationale??"",executions:[execution]};
    }),
  };
}

function buildChannelPlan(
  row: PlanRow,
  brief: PlanAnalysisInput,
  broadcast: BroadcastCatalog,
  ooh: OohCatalogRow[],
  oohLocations: OohLocationRow[],
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
  if (kind === "television") return { ...common, executions: televisionExecutions(row, brief, broadcast) };
  if (kind === "radio") return { ...common, executions: radioExecutions(row, brief, broadcast) };
  if (kind === "ooh") {
    const located = oohLocationExecutions(row, brief, oohLocations);
    return { ...common, executions: located.length ? located : oohExecutions(row, brief, ooh) };
  }
  if (kind === "press") return { ...common, executions: pressExecutions(row, brief) };
  if (kind === "influencers") return { ...common, executions: influencerExecutions(row, brief, influencers) };
  return { ...common, executions: digitalExecutions(row, brief) };
}

function televisionExecutions(row: PlanRow, brief: PlanAnalysisInput, catalog: BroadcastCatalog): DetailedExecution[] {
  const candidates = compatibleTv(catalog, brief).filter(c=>c.offer.priceUsd > 0 && (row.amount == null || c.offer.priceUsd <= row.amount))
    .sort((a,b)=>scoreTvOffer(b.offer,brief,row.amount)-scoreTvOffer(a.offer,brief,row.amount));
  const chosen = candidates.filter((c,i,all)=>all.findIndex(x=>x.source.provider===c.source.provider)===i).slice(0,3);
  if (!chosen.length) return [pendingExecution("tv","Programas por validar",brief.geography,row.amount,"No hay una tarifa que cubra todas las fechas, plaza y condiciones del brief. Consulta las ediciones disponibles en Televisión.")];
  return allocate(row.amount,chosen.length).map((budget,index)=>{
    const {source,offer}=chosen[index];
    return {id:offer.id,provider:source.label,product:offer.title,location:source.market,schedule:`${offer.day} · ${offer.schedule}`,budgetUsd:budget,referenceUnitPriceUsd:offer.priceUsd,estimatedUnits:budget==null?null:Math.floor(budget/offer.priceUsd),unit:`spot ${source.spotSeconds} s`,status:"validacion",evidence:`${sourceDescription(source)}. ${source.conditions}`,nextStep:"Confirmar programa, público, cupo y condiciones comerciales antes de ordenar."};
  });
}

function radioExecutions(row: PlanRow, brief: PlanAnalysisInput, catalog: BroadcastCatalog): DetailedExecution[] {
  const ranked=compatibleRadio(catalog,brief).slice(0,3);
  if (!ranked.length) return [pendingExecution("radio","Emisoras por plaza y público",brief.geography,row.amount,"No hay un estudio con la misma plaza y público del brief. Los cortes disponibles pueden consultarse por separado en Radio.")];
  return allocate(row.amount,ranked.length).map((budget,index)=>{
    const {source,row:station}=ranked[index];
    return {id:station.id,provider:station.name,product:`Cuñas y menciones · ${station.genre||"Género no indicado"}`,location:source.market,schedule:source.daypart,budgetUsd:budget,referenceUnitPriceUsd:null,estimatedUnits:null,unit:"pauta por cotizar",status:"validacion",evidence:`${sourceDescription(source)} · rating ${station.rating ?? "—"} · share ${station.share ?? "—"}%. Referencia histórica; no es alcance de campaña.`,nextStep:"Confirmar tarifa y disponibilidad para la campaña. El ranking conserva la franja y público medidos."};
  });
}

function oohLocationExecutions(row: PlanRow, brief: PlanAnalysisInput, locations: OohLocationRow[]): DetailedExecution[] {
  if (!locations.length) return [];
  const ranked = locations
    .map((location) => ({ location, ...scoreOohLocation(location, brief, row.amount) }))
    .sort((a, b) => b.score - a.score || (numeric(a.location.monthly_rate_usd) ?? Infinity) - (numeric(b.location.monthly_rate_usd) ?? Infinity));
  const geographicallyMatched = ranked.filter((item) => item.geographyScore > 0);
  const pool = geographicallyMatched.length ? geographicallyMatched : ranked;
  const affordable = pool.filter((item) => {
    const rate = numeric(item.location.monthly_rate_usd);
    return rate != null && row.amount != null && rate <= row.amount;
  });
  const chosen = (affordable.length ? affordable : pool).slice(0, 3);
  const budgets = allocate(row.amount, chosen.length);

  return chosen.map((item, index) => {
    const location = item.location;
    const latitude = numeric(location.latitude)!;
    const longitude = numeric(location.longitude)!;
    const status = value(location.status) === "inventory" ? "inventory" : "zone_candidate";
    const rate = numeric(location.monthly_rate_usd);
    const budget = budgets[index];
    const assetName = value(location.asset_name) || value(location.asset_code) || "Punto de vía pública";
    const city = value(location.city) || marketFromGeography(brief.geography);
    const address = value(location.address);
    const provider = value(location.provider_name);
    const mapUrls = googleMapUrls(latitude, longitude, value(location.street_view_pano_id));
    const audienceFit = item.audienceReason || "Afinidad pendiente de validar con una fuente de movilidad o audiencia.";
    const priceFit = rate == null
      ? "Tarifa pendiente: todavía no se puede comparar una alternativa más barata."
      : budget != null && rate <= budget
        ? `La referencia de ${moneyText(rate)} cabe en la asignación de ${moneyText(budget)}.`
        : `La referencia de ${moneyText(rate)} supera ${budget == null ? "un presupuesto todavía no declarado" : `la asignación de ${moneyText(budget)}`}; buscar un activo más económico.`;
    const affluence = numeric(location.affluence_index);
    const trafficEvidence = affluence != null && value(location.affluence_source)
      ? `Índice de afluencia ${displayNumber(affluence)}/100 · ${value(location.affluence_source)}`
      : "Afluencia y composición etaria todavía no medidas; la afinidad mostrada es una hipótesis de planificación.";
    return {
      id: `ooh-location-${slug(value(location.asset_code) || assetName)}`,
      provider: provider || (status === "zone_candidate" ? `Zona candidata · ${city}` : "Proveedor por confirmar"),
      product: value(location.format) || (status === "inventory" ? "Activo de vía pública" : "Zona para búsqueda de inventario"),
      location: [assetName, address, city].filter(Boolean).join(" · "),
      schedule: status === "inventory" ? "Periodo del brief · disponibilidad por confirmar" : "Muestreo geográfico preliminar",
      budgetUsd: budget,
      referenceUnitPriceUsd: rate,
      estimatedUnits: rate != null && budget != null && budget >= rate ? Math.floor(budget / rate) : null,
      unit: rate != null ? "mes de exhibición" : "zona de prospección",
      status: status === "inventory" && rate != null ? "cotizable" : "validacion",
      evidence: value(location.source_note) || "Registro geográfico cargado en Supabase.",
      nextStep: status === "inventory"
        ? "Reconfirmar foto, cara, sentido, visibilidad, flujo, disponibilidad, tarifa, producción, permisos e IVA."
        : "Solicitar a proveedores los activos disponibles alrededor de este punto y cargar tarifa, foto, cara, flujo y disponibilidad antes de cotizar.",
      geo: {
        latitude,
        longitude,
        ...mapUrls,
        locationStatus: status,
        fitScore: item.score,
        audienceFit,
        priceFit,
        trafficEvidence,
      },
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

async function readOohInventory(signal?: AbortSignal): Promise<OohCatalogRow[]> {
  try {
    const { data, error } = await createAdminClient(signal)
      .from("media_catalog_items")
      .select("slug, name, coverage, status, status_note, metadata, media_catalog_rates(label, amount_usd, unit, status, conditions, metadata)")
      .eq("kind", "ooh")
      .eq("active", true);
    return error ? [] : (data ?? []) as OohCatalogRow[];
  } catch {
    return [];
  }
}

async function readOohLocations(signal?: AbortSignal): Promise<OohLocationRow[]> {
  try {
    const { data, error } = await createAdminClient(signal)
      .from("ooh_locations")
      .select("id, asset_code, status, provider_name, asset_name, city, province, address, latitude, longitude, format, monthly_rate_usd, production_rate_usd, audience_tags, context_tags, affluence_index, affluence_source, street_view_pano_id, source_note, verified_at")
      .eq("active", true)
      .neq("status", "inactive");
    return error ? [] : (data ?? []) as OohLocationRow[];
  } catch {
    return [];
  }
}

async function readInfluencers(signal?: AbortSignal): Promise<InfluencerRow[]> {
  try {
    const { data, error } = await createAdminClient(signal)
      .from("influencer_profiles")
      .select("id, name, category, platform, followers, avg_views, engagement_pct, follower_quality_pct, influencer_rates(format, amount_usd)")
      .eq("active", true);
    return error ? [] : (data ?? []) as InfluencerRow[];
  } catch {
    return [];
  }
}

async function buildAiNarrative(brief: PlanAnalysisInput, channels: DetailedChannelPlan[], liveContext: string, signal?: AbortSignal): Promise<string | null> {
  if (!isAiAssistantEnabled() || process.env.INFOMEDIA_AWS_AI_ENABLED !== "true" || !process.env.BEDROCK_MODEL_ID) return null;
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
    return await bedrockChat([
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
    ], { maxTokens: 320, temperature: 0.25, signal });
  } catch {
    return null;
  }
}

function scoreTvOffer(offer: BroadcastTvOffer, brief: PlanAnalysisInput, budget: number | null): number {
  const text = normalize(`${offer.title} ${offer.schedule}`);
  const audience = normalize(`${brief.audience} ${brief.ageRange} ${brief.audienceType} ${brief.keyword}`);
  const objective = normalize(brief.objective);
  let score = 1;
  if (/b2b|empresa|profesional|finanz|inmobili|noticia|entrevista/.test(audience) && /notic|24 horas|televistazo|entrevista|contacto directo/.test(text)) score += 5;
  if (/13-17|18-24|18-34|joven|moda|entreten|tecnolog/.test(audience) && /simpson|enchufe|combate|soy el mejor|after|cine/.test(text)) score += 4;
  if (/famil|hogar|salud|farmacia|retail|consumo/.test(audience) && /manana|de casa|contacto|comunidad|noticiero|telenovela/.test(text)) score += 3;
  if (/reconocimiento|alcance/.test(objective) && /19:|20:|21:|estelar|noticiero iii|destiny/.test(text)) score += 3;
  if (/venta|lead|mensaje|eficiencia|visita/.test(objective) && (offer.priceUsd ?? Infinity) <= 1500) score += 3;
  if (budget && offer.priceUsd && offer.priceUsd <= budget / 3) score += 2;
  return score;
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


function marketFromGeography(geography: string): string {
  if (!geography) return "Plaza por confirmar";
  return geography.split("·")[0]?.trim() || geography;
}


function scoreOohLocation(location: OohLocationRow, brief: PlanAnalysisInput, budget: number | null) {
  const city = value(location.city);
  const province = value(location.province);
  const address = value(location.address);
  const wanted = normalize(marketFromGeography(brief.geography));
  const candidatePlace = normalize(`${city} ${province} ${address}`);
  let geographyScore = 0;
  if (!wanted || wanted === "todo ecuador") geographyScore = 5;
  else if (candidatePlace.includes(wanted)) geographyScore = 15;
  else if (wanted.includes("guayaquil") && /samborondon|daule|duran/.test(candidatePlace)) geographyScore = 9;
  else if (wanted.includes("quito") && /cumbaya|tumbaco/.test(candidatePlace)) geographyScore = 8;

  const audienceTags = stringArray(location.audience_tags);
  const contextTags = stringArray(location.context_tags);
  const target = normalize(`${brief.keyword} ${brief.audience} ${brief.ageRange} ${brief.socioeconomic} ${brief.businessModel}`);
  const matchedAudience = audienceTags.filter((tag) => overlapWords(target, normalize(tag)) > 0);
  const matchedContext = contextTags.filter((tag) => overlapWords(target, normalize(tag)) > 0);
  let audienceScore = Math.min(8, matchedAudience.length * 3);
  if (/25-34|35-44|25-54|25-45/.test(target) && audienceTags.some((tag) => /25-45/.test(tag))) audienceScore += 5;
  const contextScore = Math.min(6, matchedContext.length * 2);
  const rate = numeric(location.monthly_rate_usd);
  const priceScore = rate == null || budget == null ? 0 : rate <= budget / 3 ? 10 : rate <= budget ? 7 : -6;
  const inventoryScore = value(location.status) === "inventory" ? 7 : 0;
  const affluenceScore = (numeric(location.affluence_index) ?? 0) / 10;
  const raw = geographyScore + audienceScore + contextScore + priceScore + inventoryScore + affluenceScore;
  const score = Math.max(0, Math.min(100, Math.round(35 + raw * 1.45)));
  const audienceReason = [...matchedAudience, ...matchedContext].length
    ? `Coincide con: ${[...matchedAudience, ...matchedContext].slice(0, 4).join(", ")}.`
    : audienceTags.length
      ? `Hipótesis disponible: ${audienceTags.slice(0, 3).join(", ")}; requiere fuente de movilidad.`
      : "No existe segmentación de audiencia para este punto todavía.";
  return { score, geographyScore, audienceReason };
}

function googleMapUrls(latitude: number, longitude: number, panoramaId: string) {
  const viewpoint = encodeURIComponent(`${latitude},${longitude}`);
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${viewpoint}`;
  const pano = panoramaId ? `&pano=${encodeURIComponent(panoramaId)}` : "";
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano${pano}&viewpoint=${viewpoint}`;
  return { mapUrl, streetViewUrl };
}

function overlapWords(left: string, right: string): number {
  const leftWords = new Set(left.split(/[^a-z0-9]+/).filter((word) => word.length >= 4));
  return right.split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && leftWords.has(word)).length;
}

function stringArray(input: unknown): string[] {
  return Array.isArray(input) ? input.map(value).filter(Boolean) : [];
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

function moneyText(input: number): string {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(input);
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
