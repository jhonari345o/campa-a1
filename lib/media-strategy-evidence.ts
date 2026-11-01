import { briefMarketKeys, normalized, radioCompatibility, sameMarket, tvValidity, validDate, type BroadcastCatalog, type BroadcastSource } from "./broadcast-catalog";
import { pressMarketMatches, pressValidity, type PressCatalog } from "./press-catalog";
import { radioStationRankings, type RadioTariff } from "./radio-station";
import type { RadioDirectoryCatalog } from "./radio-directory";
import { oohRateUnit, type OohCatalog } from "./ooh-catalog";
import type { InfluencerProfile } from "./media-catalog";
import { lookupKey, type CategoryResearch } from "./infomedia";
import type { PlanAnalysisInput } from "./plan-analysis";
import { mediaGroupForLabel, type MediaGroup } from "./media-groups";
import { tgiUsage } from "./tgi";

export type StrategyBrief = PlanAnalysisInput & { brand?: string; categoryId?: string; referenceYear?: number };
export type EvidenceUse = "comparable" | "context" | "unavailable";
export type StrategySource = {
  id: string; kind: "competition" | "consumption" | "rating" | "ranking" | "tariff" | "inventory";
  label: string; period: string; market: string; target: string; use: EvidenceUse; note: string;
};
export type TvAudienceObservation = {
  id: string; study: string; periodStart: string; periodEnd: string; market: string; marketKeys: string[];
  target: string; ageMin: number | null; ageMax: number | null; sex: string; nse: string;
  channel?: string; program?: string; basis?: "period_average" | "premiere" | "unknown";
  offerIds: string[]; ratingPct: number | null; reachPct: number | null;
};
export type StrategyCandidate = {
  id: string; medium: MediaGroup; provider: string; product: string; market: string; target: string;
  period: string; sourceIds: string[]; sourceUse: EvidenceUse;
  unit: string; unitPriceUsd: number | null; referencePriceUsd: number | null;
  minimumUnits: number; minimumSpendUsd: number | null;
  metrics: { label: string; value: number; unit: string; sourceId: string }[];
  cohort?: string;
  geo?: { latitude: number; longitude: number };
  note: string;
};
export type StrategyEvidenceBundle = {
  asOf: string; sources: StrategySource[]; candidates: StrategyCandidate[];
  competition: { brand: string; estimatedInvestment: number; soi: number; declared: boolean }[];
  categoryMix: { medium: MediaGroup; share: number }[];
  consumption: { medium: MediaGroup; value: number; comparable: boolean; sourceId: string }[];
  gaps: string[]; researchPeriod: string; competitionAvailable: boolean;
  audienceReferences: { sourceId: string; medium: MediaGroup; provider: string; product: string; rating: number | null }[];
};
export type StrategyCatalogs = { broadcast: BroadcastCatalog; press: PressCatalog; radio: RadioDirectoryCatalog; ooh: OohCatalog; influencers: InfluencerProfile[]; tvAudience: TvAudienceObservation[] };
export function scopePlanningResearch(research:CategoryResearch,bundle:StrategyEvidenceBundle):CategoryResearch {
  return {...research,tgi:bundle.consumption.some(c=>c.comparable)?research.tgi:undefined,periods:research.periods.map(p=>bundle.competitionAvailable?p:{...p,mediaMix:[]})};
}
const cents = (n: number) => Math.round(n * 100) / 100;
const groups: MediaGroup[] = ["television", "radio", "press", "ooh", "digital", "influencers"];
const nonnegative = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
const selected = (brief: StrategyBrief, medium: MediaGroup) => brief.selectedMedia.includes(medium);
const datesCover = (from: string | null, to: string | null, brief: StrategyBrief) => validDate(from ?? "") && validDate(to ?? "") && validDate(brief.startDate) && validDate(brief.endDate) && from! <= brief.startDate! && to! >= brief.endDate!;

/** No fuzzy target matching: an unmeasured segment is a gap, not a synthetic rating. */
export function tvAudienceApplies(study: TvAudienceObservation, brief: StrategyBrief, asOf: string) {
  if(study.basis!=="period_average"||study.ageMin==null||study.ageMax==null)return false;
  if (!validDate(study.periodStart) || !validDate(study.periodEnd) || !validDate(brief.startDate) || !validDate(asOf) || study.periodStart > study.periodEnd || study.periodEnd > brief.startDate || study.periodEnd > asOf) return false;
  if (Date.parse(brief.startDate) - Date.parse(study.periodEnd) > 366 * 86_400_000) return false;
  const age = normalized(brief.ageRange), expected = study.ageMax === 99 ? `${study.ageMin}` : `${study.ageMin} ${study.ageMax}`;
  const agesMatch = age === expected || age === `personas ${expected}` || (study.ageMin === 18 && study.ageMax === 99 && age === "personas 18");
  const sex = study.sex === "all" ? "todas las personas" : study.sex === "female" ? "mujeres" : study.sex === "male" ? "hombres" : "";
  return agesMatch && sameMarket({ marketKeys: study.marketKeys } as BroadcastSource, brief) && normalized(brief.sex) === sex && study.nse === "all" && normalized(brief.socioeconomic) === "todos los nse" && brief.audienceType === "B2C";
}
function tariffMarket(market: string, brief: StrategyBrief) {
  const keys = market.split(/\s*\+\s*|\s*[·,]\s*/).map(normalized).filter(Boolean);
  return sameMarket({ marketKeys: keys.map(k => /^(ecuador|todo ecuador|nacional)$/.test(k) ? "nacional" : k) } as BroadcastSource, brief);
}
function radioPrice(tariff: RadioTariff, brief: StrategyBrief) {
  if (!datesCover(tariff.validFrom, tariff.validTo, brief) || !tariffMarket(tariff.market, brief)) return null;
  // Per-second rates require an explicit duration. Never assume a spot length.
  const rates = tariff.rates.filter(r => nonnegative(r.amountUsd) && r.amountUsd > 0 && (tariff.unit === "spot" || (r.seconds != null && r.seconds > 0)));
  return rates.map(r => ({ label: r.label, amount: tariff.unit === "second" ? cents(r.amountUsd * r.seconds!) : r.amountUsd, unit: r.seconds ? `spot ${r.seconds} s` : "spot" })).sort((a,b) => a.amount - b.amount)[0] ?? null;
}
function territorialFit(city: string, provinces: string[], brief: StrategyBrief) {
  const scope = brief.coverage ?? [];
  if (scope.length) return scope.some(c => c.kind === "country" || (c.kind === "city" && normalized(c.label) === normalized(city)) || (c.kind === "province" && provinces.some(p => normalized(p) === normalized(c.label))));
  const keys = briefMarketKeys(brief);
  return keys.includes("nacional") || keys.includes(normalized(city)) || provinces.some(p => keys.includes(normalized(p)));
}

/** Selected category, original source scopes and bounded candidate projections only. */
export function buildStrategyEvidence(brief: StrategyBrief, research: CategoryResearch, catalogs: StrategyCatalogs, asOf: string): StrategyEvidenceBundle {
  const sources = new Map<string, StrategySource>(), candidates: StrategyCandidate[] = [], gaps: string[] = [];
  const audienceReferences:StrategyEvidenceBundle["audienceReferences"]=[];
  const addSource = (source: StrategySource) => { sources.set(source.id, source); return source.id; };
  const period = research.periods.find(p => p.year === research.referenceYear) ?? research.periods[0];
  const cut = period && validDate(research.dataThrough) ? (period.year < Number(research.dataThrough.slice(0,4)) ? `${period.year}-12-31` : research.dataThrough) : "";
  const observationDate = validDate(brief.startDate) ? brief.startDate : asOf;
  const competitionAvailable = Boolean(period && validDate(cut) && cut <= observationDate && cut <= asOf);
  const competitionSource = addSource({ id: "category-investment", kind: "competition", label: "Inversión observada de la categoría", period: period?.periodLabel ?? "Sin período", market: "Cobertura del estudio", target: period?.sourceTarget ?? "No declarado", use: competitionAvailable ? "context" : "unavailable", note: competitionAvailable ? "Inversión estimada de competidores; no mide efectividad, compra neta ni ejecución del cliente." : "El corte no está disponible o es posterior a la fecha de referencia de la campaña." });
  const categoryMix: StrategyEvidenceBundle["categoryMix"] = [];
  if (competitionAvailable && period) {
    const totals = new Map<MediaGroup, number>(); let total = 0;
    for (const row of period.mediaMix) if (nonnegative(row.estimatedInvestment)) { const medium = mediaGroupForLabel(row.media); if (medium) { totals.set(medium, (totals.get(medium) ?? 0) + row.estimatedInvestment); total += row.estimatedInvestment; } }
    for (const [medium, amount] of totals) categoryMix.push({ medium, share: total > 0 ? amount / total : 0 });
  } else gaps.push("No hay un corte de inversión de categoría anterior al inicio de la campaña.");
  const declared = new Set((brief.competitors ?? "").split(/[,;\n]+/).map(lookupKey).filter(Boolean));
  const brands=period?[...new Map([...(period.declaredBrands??[]),...period.topBrands,...(period.focusBrand?[period.focusBrand]:[])].map(b=>[lookupKey(b.brand),b])).values()]:[];
  const competition = competitionAvailable ? brands.filter(b => lookupKey(b.brand) !== lookupKey(brief.brand ?? "")).slice(0,22).map(b => ({ brand: b.brand, estimatedInvestment: b.estimatedInvestment, soi: b.soi, declared: declared.has(lookupKey(b.brand)) })) : [];
  for (const key of declared) if (!competition.some(b => lookupKey(b.brand) === key)) gaps.push(`Competidor declarado sin coincidencia en el corte consultado: ${key}.`);
  const consumption: StrategyEvidenceBundle["consumption"] = [];
  if (research.tgi) {
    const tgi = research.tgi;
    const id = addSource({ id: "audience-consumption", kind: "consumption", label: tgi.study, period: tgi.period, market: tgi.geography, target: tgi.targetLabel, use: tgi.relationship === "age_matched" ? "comparable" : "context", note: tgi.note });
    for (const medium of groups) { const value = tgiUsage(medium, tgi); if (value != null) consumption.push({ medium, value, comparable: tgi.relationship === "age_matched", sourceId: id }); }
    if (tgi.relationship !== "age_matched") gaps.push("El consumo TGI disponible es contextual: no reproduce todos los filtros del público y la plaza.");
  } else gaps.push("No hay una referencia TGI cargada para este análisis.");

  if (selected(brief,"television")) {
    for(const study of [...catalogs.tvAudience].filter(s=>validDate(s.periodEnd)&&s.periodEnd<=asOf).sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd)).slice(0,12)){
      const applies=tvAudienceApplies(study,brief,asOf);
      const sid=addSource({id:`tv-rating:${study.id}`,kind:"rating",label:study.study,period:`${study.periodStart} – ${study.periodEnd}`,market:study.market,target:study.target,use:applies?"comparable":"context",note:study.basis==="premiere"?"Resultado de la noche de estreno; no es un promedio de campaña ni se extrapola a otros públicos.":applies?"Medición homologada para los filtros del brief.":"El público, la plaza o el período no reproducen todos los filtros del brief."});
      audienceReferences.push({sourceId:sid,medium:"television",provider:study.channel??"Canal de la fuente",product:study.program??"Programa de la fuente",rating:study.ratingPct});
    }
    for (const source of catalogs.broadcast.sources.filter(s => s.kind === "tv")) {
      if (!tvValidity(source,brief.startDate,brief.endDate) || !sameMarket(source,brief) || source.annualContract) continue;
      const sid = addSource({ id: `tv-tariff:${source.id}`, kind: "tariff", label: source.label, period: `${source.periodStart} – ${source.periodEnd}`, market: source.market, target: source.target, use: "comparable", note: source.conditions });
      for (const offer of catalogs.broadcast.tv.filter(o => o.sourceId === source.id && nonnegative(o.priceUsd) && o.priceUsd > 0).slice(0,150)) {
        const studies = catalogs.tvAudience.filter(s => s.offerIds.includes(offer.id) && tvAudienceApplies(s,brief,asOf)).sort((a,b) => b.periodEnd.localeCompare(a.periodEnd));
        const study = studies[0], metrics: StrategyCandidate["metrics"] = [];
        if (study) { const rid = addSource({ id:`tv-rating:${study.id}`, kind:"rating", label:study.study,period:`${study.periodStart} – ${study.periodEnd}`,market:study.market,target:study.target,use:"comparable",note:"Medición de la fuente; no se suma como alcance único de campaña." }); if (nonnegative(study.ratingPct)) metrics.push({label:"Rating",value:study.ratingPct,unit:"%",sourceId:rid}); if (nonnegative(study.reachPct)) metrics.push({label:"Alcance del programa",value:study.reachPct,unit:"%",sourceId:rid}); }
        candidates.push({id:`tv:${offer.id}`,medium:"television",provider:source.label,product:offer.title,market:source.market,target:study?.target??source.target,period:`${source.periodStart} – ${source.periodEnd}`,sourceIds:[sid,...metrics.map(m=>m.sourceId)],sourceUse:"comparable",unit:`spot ${source.spotSeconds ?? "por definir"} s`,unitPriceUsd:offer.priceUsd,referencePriceUsd:offer.priceUsd,minimumUnits:1,minimumSpendUsd:offer.priceUsd,metrics,cohort:study?JSON.stringify([study.study,study.periodStart,study.periodEnd,study.marketKeys,study.target,study.ageMin,study.ageMax,study.sex,study.nse]):undefined,note:[offer.day,offer.schedule,source.conditions,study ? "" : "Sin rating homologado para el target."].filter(Boolean).join(" · ")});
      }
    }
    if (!candidates.some(c => c.medium === "television")) gaps.push("TV: no hay tarifas compatibles con todas las fechas, plaza y condiciones del brief.");
    if (!candidates.some(c => c.medium === "television" && c.metrics.some(m => m.label === "Rating"))) gaps.push("TV: faltan ratings por programa homologados para la plaza, público y período del brief.");
  }
  if (selected(brief,"radio")) {
    for (const station of catalogs.radio.stations) {
      const rankings = radioStationRankings(station.profile,catalogs.broadcast,asOf).filter(r => radioCompatibility(r.source,brief) === null && validDate(brief.startDate) && Date.parse(brief.startDate) - Date.parse(r.source.periodEnd) <= 366 * 86_400_000);
      for (const {source,row} of rankings) {
        const sid = addSource({id:`radio-study:${source.id}`,kind:"ranking",label:source.label,period:`${source.periodStart} – ${source.periodEnd}`,market:source.market,target:source.target,use:"comparable",note:`${source.frequency} · ${source.daypart}. Cohorte independiente; no se mezcla con otras plazas, públicos o franjas.`});
        const priced = station.profile.tariffs.map(t => ({t,price:radioPrice(t,brief)})).filter(x => x.price).sort((a,b) => a.price!.amount-b.price!.amount)[0];
        const ids=[sid]; if(priced) ids.push(addSource({id:`radio-tariff:${station.id}:${priced.t.id}`,kind:"tariff",label:priced.t.label,period:`${priced.t.validFrom} – ${priced.t.validTo}`,market:priced.t.market,target:priced.t.target,use:"comparable",note:priced.t.conditions}));
        const metrics: StrategyCandidate["metrics"] = []; if(nonnegative(row.rating)) metrics.push({label:"Rating",value:row.rating,unit:"puntos",sourceId:sid}); if(nonnegative(row.share)) metrics.push({label:"Share",value:row.share,unit:"%",sourceId:sid}); if(nonnegative(row.rank)) metrics.push({label:"Posición",value:row.rank,unit:"ranking",sourceId:sid});
        candidates.push({id:`radio:${station.id}:${source.id}`,medium:"radio",provider:station.name,product:`${source.frequency} · ${source.daypart}`,market:source.market,target:source.target,period:`${source.periodStart} – ${source.periodEnd}`,sourceIds:ids,sourceUse:"comparable",unit:priced?.price?.unit ?? "spot por definir",unitPriceUsd:priced?.price?.amount ?? null,referencePriceUsd:priced?.price?.amount ?? null,minimumUnits:1,minimumSpendUsd:priced?.price?.amount ?? null,metrics,note:priced?.t.conditions ?? "Falta una tarifa compatible para calcular cuñas comprables."});
      }
    }
    if(!candidates.some(c=>c.medium==="radio")) gaps.push("Radio: no hay una cohorte de ranking homologada para todos los filtros del brief.");
    if(!candidates.some(c=>c.medium==="radio"&&c.unitPriceUsd!=null)) gaps.push("Radio: no hay una tarifa vigente y compatible para cuantificar la pauta.");
  }
  if (selected(brief,"press")) for (const entry of catalogs.press.entries) for (const edition of entry.editions) for (const offer of edition.offers) {
    if (!pressMarketMatches(offer,briefMarketKeys(brief))) continue;
    const valid = pressValidity(edition,brief.startDate,brief.endDate);
    if(edition.validFrom&&edition.validTo&&!valid)continue;
    const sid = addSource({id:`press:${entry.id}:${edition.id}`,kind:"tariff",label:`${entry.name} · ${edition.label}`,period:edition.period,market:offer.market,target:offer.target,use:valid ? "comparable" : "context",note:edition.conditions.join(" · ")});
    candidates.push({id:`press:${entry.id}:${edition.id}:${offer.id}`,medium:"press",provider:entry.name,product:offer.name,market:offer.market,target:offer.target,period:edition.period,sourceIds:[sid],sourceUse:valid ? "comparable" : "context",unit:offer.unit === "CPM" ? "mil impresiones" : offer.unit,unitPriceUsd:valid ? offer.priceUsd : null,referencePriceUsd:offer.priceUsd,minimumUnits:1,minimumSpendUsd:valid ? offer.priceUsd : null,metrics:[],note:[offer.specs,edition.validFrom && edition.validTo ? "" : "Vigencia no declarada; tarifa de referencia."].filter(Boolean).join(" · ")});
  }
  if(selected(brief,"press")&&!candidates.some(c=>c.medium==="press"&&c.unitPriceUsd!=null)) gaps.push("Prensa: faltan tarifas con vigencia y plaza compatibles con la campaña.");
  if(selected(brief,"ooh")) for(const asset of catalogs.ooh.assets) {
    if(!territorialFit(asset.city,asset.provinces,brief)) continue;
    const sid=addSource({id:`ooh:${asset.id}`,kind:"inventory",label:`${asset.brand || asset.providerSlug} · ${asset.name}`,period:asset.reference||"Corte no declarado",market:[asset.city,...asset.provinces].filter(Boolean).join(" · "),target:"Audiencia del soporte no medida",use:"context",note:"Inventario territorial; disponibilidad y vigencia comercial no confirmadas para esta campaña."});
    const rate=asset.rates.filter(r=>r.amount>0).sort((a,b)=>a.amount-b.amount)[0];
    candidates.push({id:`ooh:${asset.id}`,medium:"ooh",provider:asset.brand||asset.providerSlug,product:[asset.name,asset.code].filter(Boolean).join(" · "),market:[asset.city,asset.address].filter(Boolean).join(" · "),target:"Sin audiencia homologada",period:asset.reference||"Corte no declarado",sourceIds:[sid],sourceUse:"context",unit:rate?oohRateUnit(rate):"unidad por definir",unitPriceUsd:null,referencePriceUsd:rate?.amount??null,minimumUnits:1,minimumSpendUsd:null,metrics:[],...(asset.latitude!=null&&asset.longitude!=null?{geo:{latitude:asset.latitude,longitude:asset.longitude}}:{}),note:"Referencia por unidad original. No se asume disponibilidad ni se convierte afluencia en alcance."});
  }
  if(selected(brief,"ooh")&&!candidates.some(c=>c.medium==="ooh")) gaps.push("Vía pública: no hay activos localizados dentro de las coberturas seleccionadas.");
  if(selected(brief,"influencers")){
    const context=normalized(`${brief.keyword} ${brief.audience}`);
    const theme=/restaurante|comida|gastronom|alimento|bebida|cafe/.test(context)?"foodie":/belleza|maquillaje|cosmet|cuidado personal/.test(context)?"beauty":/deporte|futbol|fitness|atletismo/.test(context)?"deportes":null;
    for(const profile of catalogs.influencers.filter(p=>p.name.trim()&&(p.category===theme||context.includes(normalized(p.name)))).slice(0,30)){
      const sid=addSource({id:`creator:${profile.id}`,kind:"inventory",label:profile.name,period:"Vigencia no declarada",market:"Territorio de audiencia no homologado",target:`Categoría editorial: ${profile.category}`,use:"context",note:"Perfil declarado; seguidores, views y engagement no equivalen a alcance de campaña ni a afinidad medida con el target."});
      const rates=profile.rates.length?profile.rates.slice(0,5):[{format:"Entregable por definir",amountUsd:NaN}];
      for(const [i,rate] of rates.entries())candidates.push({id:`creator:${profile.id}:${i}`,medium:"influencers",provider:profile.name,product:rate.format,market:"Territorio por homologar",target:`Categoría editorial: ${profile.category}`,period:"Vigencia no declarada",sourceIds:[sid],sourceUse:"context",unit:rate.format,unitPriceUsd:null,referencePriceUsd:nonnegative(rate.amountUsd)?rate.amountUsd:null,minimumUnits:1,minimumSpendUsd:null,metrics:[],note:"Candidato editorial: confirmar composición de audiencia, territorio, derechos y vigencia antes de cotizar."});
    }
    gaps.push("Influenciadores: falta homologar audiencia, derechos, territorio y vigencia de cada perfil; no se asigna afinidad por seguidores.");
  }
  if(selected(brief,"digital") && (brief.trackingStatus!=="Implementado y validado" || brief.adAccountsStatus!=="Existen y tenemos acceso")) gaps.push("Digital: completar destino, tracking y acceso a cuentas antes de emitir un forecast de resultados.");
  if(selected(brief,"digital")) gaps.push("Digital: la distribución propuesta no sustituye un forecast de plataforma ni predice conversiones.");
  void competitionSource;
  const boundedSources=[...sources.values()].slice(0,500), sourceIds=new Set(boundedSources.map(s=>s.id));
  return {asOf,sources:boundedSources,candidates:candidates.filter(c=>c.sourceIds.every(id=>sourceIds.has(id))).slice(0,800),competition,categoryMix,consumption,gaps:[...new Set(gaps)].slice(0,30),researchPeriod:period?.periodLabel??"Sin período",competitionAvailable,audienceReferences};
}
