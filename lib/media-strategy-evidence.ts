import { televisionStudyMatches } from "./television-measurement";
import {planningStudyBrief,radioTariffCoversStationStudy,commercialTerritoryFits,radioCommercialCoverage,territoryKey} from "./planning-market";
import type {CatalogProduct} from "./catalog-shopping";
import {planningProductPrice} from "./catalog-planning";
import {campaignRentalMonths} from "./catalog-planning";
import {isDigitalProduction} from "./digital-productions";
import {productMedium} from "./diy-catalog";
import { briefMarketKeys, normalized, radioCompatibility, sameMarket, tvValidity, validDate, type BroadcastCatalog, type BroadcastSource } from "./broadcast-catalog";
import { pressValidity, type PressCatalog } from "./press-catalog";
import { radioStationRankings, type RadioTariff } from "./radio-station";
import {radioRegions, type RadioDirectoryCatalog } from "./radio-directory";
import { oohRateUnit, type OohCatalog } from "./ooh-catalog";
import type { InfluencerProfile } from "./media-catalog";
import { lookupKey, type CategoryResearch } from "./infomedia";
import type { PlanAnalysisInput } from "./plan-analysis";
import { mediaGroupForLabel, type MediaGroup } from "./media-groups";
import { tgiUsage } from "./tgi";
import { oohMarketReferences, pressAudienceApplies, pressObservationFor, type AtlAudienceCatalog, type OohMarketReference } from "./atl-audience";
import { planningDaypart, type PlanningDaypart } from "./planning-broadcast";
import type { PlanningCaseContext } from "./planning-reference-cases";
import {coverageFromLabels} from "./geographic-coverage";

export type StrategyBrief = PlanAnalysisInput & { brand?: string; categoryId?: string; referenceYear?: number; clientId?:string|null };
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
  id: string; catalogKey?: string; medium: MediaGroup; provider: string; product: string; market: string; target: string;
  period: string; sourceIds: string[]; sourceUse: EvidenceUse;
  unit: string; unitPriceUsd: number | null; referencePriceUsd: number | null;
  minimumUnits: number; planningMinimumUnits?:number; maximumUnits?: number; planningMaximumUnits?: number; planningTerritory?: string; minimumSpendUsd: number | null;
  planningWeight?: number; planningMaximumSpendUsd?: number; planningDaypart?: PlanningDaypart;
  metrics: { label: string; value: number; unit: string; sourceId: string }[];
  cohort?: string;
  stationId?: string; marketKeys?: string[]; stationCoverage?: string[]; coverageKeys?: string[];
  geo?: { latitude: number; longitude: number };
  oohPhoto?: { assetId: string; kind: "asset" | "format" };
  physicalAssetId?: string;
  digitalProduction?: {id:string;rights:string[]};
  note: string;
};
export type StrategyEvidenceBundle = {
  referenceCases?: PlanningCaseContext[];
  oohMarketReferences?: OohMarketReference[];
  channelShares?: { provider:string;sharePct:number;period:string;market:string;target:string }[];
  asOf: string; sources: StrategySource[]; candidates: StrategyCandidate[];
  competition: { brand: string; estimatedInvestment: number; soi: number; declared: boolean }[];
  categoryMix: { medium: MediaGroup; share: number }[];
  consumption: { medium: MediaGroup; value: number; comparable: boolean; sourceId: string }[];
  gaps: string[]; researchPeriod: string; competitionAvailable: boolean;
  audienceReferences: { sourceId: string; medium: MediaGroup; provider: string; product: string; rating: number | null; reachPct?:number; audience?:number; rank?:number }[];
};
export type StrategyCatalogs = { atlAudience?:AtlAudienceCatalog; tvShares?:{channel:string;sharePct:number;periodStart:string;periodEnd:string}[]; workspaceProducts?:CatalogProduct[]; broadcast: BroadcastCatalog; press: PressCatalog; radio: RadioDirectoryCatalog; ooh: OohCatalog; influencers: InfluencerProfile[]; tvAudience: TvAudienceObservation[] };
export function scopePlanningResearch(research:CategoryResearch,bundle:StrategyEvidenceBundle):CategoryResearch {
  return {...research,tgi:bundle.consumption.some(c=>c.comparable)?research.tgi:undefined,periods:research.periods.map(p=>bundle.competitionAvailable?p:{...p,mediaMix:[]})};
}
const cents = (n: number) => Math.round(n * 100) / 100;
const groups: MediaGroup[] = ["television", "radio", "press", "ooh", "digital", "influencers"];
const nonnegative = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
const selected = (brief: StrategyBrief, medium: MediaGroup) => brief.selectedMedia.includes(medium);
const datesCover = (from: string | null, to: string | null, brief: StrategyBrief) => validDate(from ?? "") && validDate(to ?? "") && validDate(brief.startDate) && validDate(brief.endDate) && from! <= brief.startDate! && to! >= brief.endDate!;
const coverageLabel=(key:string)=>radioRegions.find(r=>territoryKey(r.key)===territoryKey(key))?.label??coverageFromLabels([key])[0]?.label??key;

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
  return commercialTerritoryFits(keys,brief);
}
function radioPrice(tariff: RadioTariff, brief: StrategyBrief) {
  if (!datesCover(tariff.validFrom, tariff.validTo, brief) || !tariffMarket(tariff.market, brief)) return null;
  // Per-second rates require an explicit duration. Never assume a spot length.
  const rates = tariff.rates.filter(r => nonnegative(r.amountUsd) && r.amountUsd > 0 && (tariff.unit === "spot" || (r.seconds != null && r.seconds > 0)));
  return rates.map(r => ({ label: r.label, amount: tariff.unit === "second" ? cents(r.amountUsd! * r.seconds!) : r.amountUsd!, unit: r.seconds ? `spot ${r.seconds} s` : "spot" })).sort((a,b) => a.amount - b.amount)[0] ?? null;
}
function territorialFit(city: string, provinces: string[], brief: StrategyBrief) {
  // Nationwide availability also permits delivery in a requested canton. It
  // does not turn a single movable format into nationwide campaign coverage.
  if (provinces.some(p => ["nacional", "nacionales", "ecuador"].includes(normalized(p)))) return true;
  const scope = brief.coverage ?? [];
  if (scope.length) return scope.some(c => c.kind === "country" || (c.kind === "city" && normalized(c.label) === normalized(city)) || (c.kind === "province" && provinces.some(p => normalized(p) === normalized(c.label))));
  const keys = briefMarketKeys(brief);
  return keys.includes("nacional") || keys.includes(normalized(city)) || provinces.some(p => keys.includes(normalized(p)));
}

/** Selected category, original source scopes and bounded candidate projections only. */
export function buildStrategyEvidence(brief: StrategyBrief, research: CategoryResearch, catalogs: StrategyCatalogs, asOf: string): StrategyEvidenceBundle {
  const shareBrief=planningStudyBrief(["guayaquil","quito"],brief);
  const channelShares=(catalogs.tvShares??[]).filter(row=>shareBrief&&tvAudienceApplies({id:"channel-share",study:"TV",periodStart:row.periodStart,periodEnd:row.periodEnd,market:"Guayaquil · Quito",marketKeys:["guayaquil","quito"],target:"Personas 18+",ageMin:18,ageMax:99,sex:"all",nse:"all",basis:"period_average",offerIds:[],ratingPct:null,reachPct:null},{...brief,...shareBrief},asOf)&&Number.isFinite(row.sharePct)&&row.sharePct>=0&&row.sharePct<=100).map(row=>({provider:row.channel,sharePct:row.sharePct,period:`${row.periodStart} – ${row.periodEnd}`,market:"Guayaquil · Quito",target:"Personas 18+"}));
  const sources = new Map<string, StrategySource>(), candidates: StrategyCandidate[] = [], gaps: string[] = [];
  const audienceReferences:StrategyEvidenceBundle["audienceReferences"]=[];
  const addSource = (source: StrategySource) => { sources.set(source.id, source); return source.id; };
  const pressStudies=(catalogs.atlAudience?.press??[]).filter(s=>selected(brief,"press")&&pressAudienceApplies(s,brief,asOf));
  const pressSource=(s:typeof pressStudies[number])=>addSource({id:`press-study:${s.periodStart}:${s.periodEnd}:${s.sex}:${s.marketKeys.join("-")}`,kind:"ranking",label:"Ranking y alcance de lectura de prensa",period:`${s.periodStart} – ${s.periodEnd}`,market:s.marketKeys.join(" · "),target:`${s.sex==="all"?"Personas":s.sex==="male"?"Hombres":"Mujeres"} ${s.ageMin}–${s.ageMax} · todos los NSE`,use:"comparable",note:"Alcance de lectura del medio en el universo completo del estudio. No es alcance de una inserción ni se multiplica por compras. La posición se ordena por alcance; personas combina los dos universos por sus tamaños."});
  for(const s of pressStudies)audienceReferences.push({sourceId:pressSource(s),medium:"press",provider:s.provider,product:"Lectura de la publicación",rating:null,reachPct:s.reachPct,audience:s.audience,rank:s.rank});
  const oohReferences:OohMarketReference[]=selected(brief,"ooh")?oohMarketReferences(catalogs.atlAudience?.ooh??[],brief,asOf).map(r=>{
    const sourceId=addSource({id:`ooh-study:${normalized(r.city)}`,kind:"ranking",label:"Optimiza VP · referencia territorial",period:r.observedOn??"Corte no declarado",market:r.city,target:"Público y universo no declarados",use:"context",note:"Última base disponible, histórica. Ranking, circulación e impactos del soporte observado; no son personas únicas ni mediciones actuales del inventario. No extrapolar a otro elemento, público o período."});
    return {sourceId,city:r.city,location:[r.street,r.intersection].filter(Boolean).join(" / "),format:r.format,rank:r.rank,score:r.score,estimatedImpacts:r.estimatedImpacts,impactPeriod:r.impactPeriod,observedOn:r.observedOn};
  }):[];
  if(catalogs.atlAudience?.error)gaps.push(catalogs.atlAudience.error);
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
    for(const study of [...catalogs.tvAudience].filter(s=>{const local=planningStudyBrief(s.marketKeys,brief);return local&&tvAudienceApplies(s,{...brief,...local},asOf);}).sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd)||(b.ratingPct??0)-(a.ratingPct??0)).slice(0,30)){
      const applies=true;
      const sid=addSource({id:`tv-rating:${study.id}`,kind:"rating",label:study.study,period:`${study.periodStart} – ${study.periodEnd}`,market:study.market,target:study.target,use:applies?"comparable":"context",note:study.basis==="premiere"?"Resultado de la noche de estreno; no es un promedio de campaña ni se extrapola a otros públicos.":applies?"Medición homologada para los filtros del brief.":"El público, la plaza o el período no reproducen todos los filtros del brief."});
      audienceReferences.push({sourceId:sid,medium:"television",provider:study.channel??"Canal de la fuente",product:study.program??"Programa de la fuente",rating:study.ratingPct});
    }
    for (const source of catalogs.broadcast.sources.filter(s => s.kind === "tv")) {
      const local=planningStudyBrief(source.marketKeys,brief);
      if (!tvValidity(source,brief.startDate,brief.endDate) || !commercialTerritoryFits(source.marketKeys,brief,true) || source.annualContract) continue;
      const sid = addSource({ id: `tv-tariff:${source.id}`, kind: "tariff", label: source.label, period: `${source.periodStart} – ${source.periodEnd}`, market: source.market, target: source.target, use: "comparable", note: source.conditions });
      for (const offer of catalogs.broadcast.tv.filter(o => o.sourceId === source.id && nonnegative(o.priceUsd) && o.priceUsd > 0).slice(0,150)) {
        const studies = catalogs.tvAudience.filter(s => s.offerIds.includes(offer.id) && local&&tvAudienceApplies(s,{...brief,...local},asOf)).sort((a,b) => b.periodEnd.localeCompare(a.periodEnd));
        const study = studies[0], metrics: StrategyCandidate["metrics"] = [];
        if (study) { const rid = addSource({ id:`tv-rating:${study.id}`, kind:"rating", label:study.study,period:`${study.periodStart} – ${study.periodEnd}`,market:study.market,target:study.target,use:"comparable",note:"Medición de la fuente; no se suma como alcance único de campaña." }); if (nonnegative(study.ratingPct)) metrics.push({label:"Rating",value:study.ratingPct,unit:"%",sourceId:rid}); if (nonnegative(study.reachPct)) metrics.push({label:"Alcance del programa",value:study.reachPct,unit:"%",sourceId:rid}); }
        if(catalogs.workspaceProducts?.some(p=>p.key===`tv:${source.id}:${offer.id}`))continue;
        candidates.push({id:`tv:${offer.id}`,catalogKey:`tv:${source.id}:${offer.id}`,medium:"television",coverageKeys:source.marketKeys,provider:source.label,product:offer.title,planningDaypart:planningDaypart([offer.schedule,offer.note].join(" · ")),market:source.market,target:study?.target??source.target,period:`${source.periodStart} – ${source.periodEnd}`,sourceIds:[sid,...metrics.map(m=>m.sourceId)],sourceUse:"comparable",unit:`spot ${source.spotSeconds ?? "por definir"} s`,unitPriceUsd:offer.priceUsd,referencePriceUsd:offer.priceUsd,minimumUnits:1,minimumSpendUsd:offer.priceUsd,metrics,cohort:study?JSON.stringify([study.study,study.periodStart,study.periodEnd,study.marketKeys,study.target,study.ageMin,study.ageMax,study.sex,study.nse]):undefined,note:[offer.day,offer.schedule,source.conditions,study ? "" : "Sin rating homologado para el target."].filter(Boolean).join(" · ")});
      }
    }
    if (!candidates.some(c => c.medium === "television")) gaps.push("TV: no hay tarifas compatibles con todas las fechas, plaza y condiciones del brief.");
    if (!candidates.some(c => c.medium === "television" && c.metrics.some(m => m.label === "Rating"))) gaps.push("TV: faltan ratings por programa homologados para la plaza, público y período del brief.");
  }
  if (selected(brief,"radio")) {
    for (const station of catalogs.radio.stations) {
      const rankings = radioStationRankings(station.profile,catalogs.broadcast,asOf).filter(r => {const local=planningStudyBrief(r.source.marketKeys,brief);return local&&radioCompatibility(r.source,local) === null && validDate(brief.startDate) && Date.parse(brief.startDate) - Date.parse(r.source.periodEnd) <= 366 * 86_400_000;});
      for (const {source,row} of rankings) {
        const localBrief={...brief,...planningStudyBrief(source.marketKeys,brief)!};
        const sid = addSource({id:`radio-study:${source.id}`,kind:"ranking",label:source.label,period:`${source.periodStart} – ${source.periodEnd}`,market:source.market,target:source.target,use:"comparable",note:`${source.frequency} · ${source.daypart}. Cohorte independiente; no se mezcla con otras plazas, públicos o franjas.`});
        if(!audienceReferences.some(r=>r.sourceId===sid&&r.provider===station.name)) audienceReferences.push({sourceId:sid,medium:"radio",provider:station.name,product:source.daypart,rating:row.rating,rank:row.rank??undefined});
        const priced = station.profile.tariffs.map(t => ({t,price:radioPrice(t,localBrief),coverage:radioCommercialCoverage(t.market.split(/\s*[·,+]\s*/),station.regionKeys)})).filter(x => x.price&&x.coverage.length).sort((a,b) => a.price!.amount-b.price!.amount)[0];
        const signalCoverage=priced?.coverage??station.regionKeys;
        const ids=[sid]; if(priced) ids.push(addSource({id:`radio-tariff:${station.id}:${priced.t.id}`,kind:"tariff",label:priced.t.label,period:`${priced.t.validFrom} – ${priced.t.validTo}`,market:priced.t.market,target:priced.t.target,use:"comparable",note:priced.t.conditions}));
        const metrics: StrategyCandidate["metrics"] = []; if(nonnegative(row.rating)) metrics.push({label:"Rating",value:row.rating,unit:"puntos",sourceId:sid}); if(nonnegative(row.share)) metrics.push({label:"Share",value:row.share,unit:"%",sourceId:sid}); if(nonnegative(row.rank)) metrics.push({label:"Posición",value:row.rank,unit:"ranking",sourceId:sid});
        candidates.push({id:`radio:${station.id}:${source.id}`,medium:"radio",coverageKeys:signalCoverage,stationId:station.id,marketKeys:source.marketKeys,stationCoverage:signalCoverage.map(coverageLabel),provider:station.name,product:`${source.frequency} · ${source.daypart}`,market:source.market,target:source.target,period:`${source.periodStart} – ${source.periodEnd}`,sourceIds:ids,sourceUse:"comparable",unit:priced?.price?.unit ?? "spot por definir",unitPriceUsd:priced?.price?.amount ?? null,referencePriceUsd:priced?.price?.amount ?? null,minimumUnits:1,minimumSpendUsd:priced?.price?.amount ?? null,metrics,note:[priced?.t.conditions ?? "Falta una tarifa compatible para calcular cuñas comprables.",sameMarket(source,brief)?"":"El ranking describe únicamente la plaza indicada dentro de la cobertura seleccionada; no representa toda la provincia ni el país."].filter(Boolean).join(" ")});
      }
    }
    if(!candidates.some(c=>c.medium==="radio")) gaps.push("Radio: no hay una cohorte de ranking homologada para todos los filtros del brief.");
    if(!candidates.some(c=>c.medium==="radio"&&c.unitPriceUsd!=null)) gaps.push("Radio: no hay una tarifa vigente y compatible para cuantificar la pauta.");
  }
  if (selected(brief,"press")) for (const entry of catalogs.press.entries) for (const edition of entry.editions) for (const offer of edition.offers) {
    // A documented city offer belongs inside its province, while an unknown
    // or wider package must not inherit geography from the publication name.
    if (!offer.marketOptions.some(markets=>commercialTerritoryFits(markets,brief))) continue;
    const valid = pressValidity(edition,brief.startDate,brief.endDate);
    if(edition.validFrom&&edition.validTo&&!valid)continue;
    const sid = addSource({id:`press:${entry.id}:${edition.id}`,kind:"tariff",label:`${entry.name} · ${edition.label}`,period:edition.period,market:offer.market,target:offer.target,use:valid ? "comparable" : "context",note:edition.conditions.join(" · ")});
    candidates.push({id:`press:${entry.id}:${edition.id}:${offer.id}`,medium:"press",coverageKeys:offer.marketOptions.flat(),provider:entry.name,product:offer.name,market:offer.market,target:offer.target,period:edition.period,sourceIds:[sid],sourceUse:valid ? "comparable" : "context",unit:offer.unit === "CPM" ? "mil impresiones" : offer.unit,unitPriceUsd:valid ? offer.priceUsd : null,referencePriceUsd:offer.priceUsd,minimumUnits:1,minimumSpendUsd:valid ? offer.priceUsd : null,metrics:[],note:[offer.specs,edition.validFrom && edition.validTo ? "" : "Vigencia no declarada; tarifa de referencia."].filter(Boolean).join(" · ")});
  }
  if(selected(brief,"press")&&!candidates.some(c=>c.medium==="press"&&c.unitPriceUsd!=null)) gaps.push("Prensa: faltan tarifas con vigencia y plaza compatibles con la campaña.");
  if(selected(brief,"ooh")) for(const asset of catalogs.ooh.assets) {
    if(asset.purchaseAssetId && asset.purchaseAssetId !== asset.id) continue;
    if(!territorialFit(asset.city,asset.provinces,brief)) continue;
    const sid=addSource({id:`ooh:${asset.id}`,kind:"inventory",label:`${asset.brand || asset.providerSlug} · ${asset.name}`,period:asset.reference||"Corte no declarado",market:[asset.city,...asset.provinces].filter(Boolean).join(" · "),target:"Audiencia del soporte no medida",use:"context",note:"Inventario territorial; disponibilidad y vigencia comercial no confirmadas para esta campaña."});
    const rate=asset.rates.filter(r=>r.amount!=null && r.amount>0).sort((a,b)=>a.amount!-b.amount!)[0];
    candidates.push({id:`ooh:${asset.id}`,medium:"ooh",coverageKeys:[asset.city,...asset.provinces],provider:asset.brand||asset.providerSlug,product:[asset.name,asset.code].filter(Boolean).join(" · "),market:[asset.city,asset.address].filter(Boolean).join(" · "),target:"Sin audiencia homologada",period:asset.reference||"Corte no declarado",sourceIds:[sid],sourceUse:"context",unit:rate?oohRateUnit(rate):"unidad por definir",unitPriceUsd:null,referencePriceUsd:rate?.amount??null,minimumUnits:1,minimumSpendUsd:null,metrics:[],...(asset.photo?{oohPhoto:{assetId:asset.id,kind:asset.photoKind}}:{}),...(asset.latitude!=null&&asset.longitude!=null?{geo:{latitude:asset.latitude,longitude:asset.longitude}}:{}),note:"Referencia por unidad original. No se asume disponibilidad ni se convierte afluencia en alcance."});
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
  for(const p of catalogs.workspaceProducts??[]){
    const medium=productMedium(p);if(!selected(brief,medium)||!(p.source.workspaceProductId||p.source.agreementId||p.source.standingPrice))continue;
    // Additional production/branding charges remain in the commercial catalog,
    // but are not independent media placements or geographic coverage.
    const component=normalized(p.source.rate?.component||p.format);
    const ancillary=/\b(?:branding|produccion|impresion|instalacion|montaje|desmontaje)\b/;
    const billingUnit=normalized(p.unit);
    const ancillaryUnit=ancillary.test(billingUnit)&&/\b(?:pago unico|cambio de|por servicio)\b/.test(billingUnit);
    if(medium==="ooh"&&(ancillaryUnit||ancillary.test(component)&&!/\b(?:pauta|alquiler|arrendamiento|exhibicion|difusion)\b/.test(component)))continue;
    const asset = medium === "ooh" && p.source.assetId ? catalogs.ooh.assets.find(asset => asset.id === p.source.assetId) : undefined;
    const station=medium==="radio"&&p.source.stationId?catalogs.radio.stations.find(s=>s.id===p.source.stationId):undefined;
    const radioCoverage=station?radioCommercialCoverage(p.marketKeys?.length?p.marketKeys:p.location.split(/\s*[·,+]\s*/),station.regionKeys):undefined;
    const radioCoverageLabels=radioCoverage?.map(coverageLabel);
    const marketFit=asset?territorialFit(asset.city,asset.provinces,brief):radioCoverage?commercialTerritoryFits(radioCoverage,brief,true):p.marketKeys?.length?commercialTerritoryFits(p.marketKeys,brief,medium==="television"):tariffMarket(p.location,brief);
    if(!marketFit)continue;
    const priced=planningProductPrice(p,brief.startDate,brief.endDate),referencePrice=p.priceCents??p.referencePriceCents??null;
    const quoted=Boolean(priced),period=p.validTo?`${p.validFrom??""} – ${p.validTo}`:p.validFrom?`Desde ${p.validFrom}`:p.reference;
    const digitalProduction=isDigitalProduction(p)?p.digitalProduction:undefined;
    const digitalMonths=digitalProduction&&/^(month|mes|mensual)$/i.test(p.billingPeriod??p.unit)?campaignRentalMonths(brief.startDate??"",brief.endDate??""):null;
    const sid=addSource({id:`workspace-tariff:${p.key}`,kind:"tariff",label:`${p.provider} · ${p.name}`,period,market:p.location,target:"Tarifa comercial",use:quoted?"comparable":"context",note:p.conditions});
    candidates.push({id:`workspace:${p.key}`,catalogKey:p.key,medium,coverageKeys:asset?[asset.city,...asset.provinces]:radioCoverage??p.marketKeys??p.location.split(/\s*[·,+]\s*/),...(p.source.stationId?{stationId:p.source.stationId}:{}),...(radioCoverageLabels?{stationCoverage:radioCoverageLabels}:{}),marketKeys:radioCoverage??p.marketKeys??p.location.split(/\s*[·,+]\s*/).map(normalized),provider:p.provider,product:p.name,...(medium==="television"?{planningDaypart:planningDaypart(p.format)}:{}),market:radioCoverageLabels?.join(" · ")??p.location,target:"Tarifa comercial",period,sourceIds:[sid],sourceUse:quoted?"comparable":"context",unit:priced?.unit??p.unit,unitPriceUsd:priced?.priceUsd??null,referencePriceUsd:referencePrice==null?null:referencePrice/100,minimumUnits:1,...(asset?.recordType==="asset"?{maximumUnits:1,physicalAssetId:asset.id}:{}),...(digitalProduction?{digitalProduction:{id:digitalProduction.id,rights:digitalProduction.rights}}:{}),...(digitalMonths?{planningMinimumUnits:digitalMonths,maximumUnits:digitalMonths}:{}),minimumSpendUsd:priced?.priceUsd??null,metrics:[],...(asset?.photo?{oohPhoto:{assetId:asset.id,kind:asset.photoKind}}:{}),...(asset?.latitude!=null&&asset.longitude!=null?{geo:{latitude:asset.latitude,longitude:asset.longitude}}:{}),note:[p.format,p.conditions].filter(Boolean).join(" · ")});
  }
  for(const c of candidates.filter(c=>c.medium==="television"&&c.catalogKey&&c.id.startsWith("workspace:"))){
    const p=catalogs.workspaceProducts?.find(p=>p.key===c.catalogKey);
    if(!p)continue;
    const study=catalogs.tvAudience.filter(s=>{
      // Most studies belong to another programme. Reject those before resolving
      // the Ecuador territory hierarchy for every account-product/study pair.
      if(!televisionStudyMatches(p,s))return false;
      const local=planningStudyBrief(s.marketKeys,brief);
      return local&&tvAudienceApplies(s,{...brief,...local},asOf);
    }).sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd))[0];
    if(!study||study.ratingPct==null)continue;
    const sid=addSource({id:`tv-rating:${study.id}`,kind:"rating",label:study.study,period:`${study.periodStart} – ${study.periodEnd}`,market:study.market,target:study.target,use:"comparable",note:"Promedio del programa para su plaza y público."});
    c.metrics=[{label:"Rating",value:study.ratingPct,unit:"%",sourceId:sid}];c.sourceIds.push(sid);c.target=study.target;c.cohort=JSON.stringify([study.study,study.periodStart,study.periodEnd,study.marketKeys,study.target]);
  }
  // Match the curated station's purchased signal without relabeling a study's denominator.
  for(const c of candidates.filter(c=>c.medium==="radio"&&c.stationId&&c.id.startsWith("radio:"))){
    const local=planningStudyBrief(c.marketKeys??[],brief);
    if(!local)continue;
    const price=candidates.filter(p=>p.id.startsWith("workspace:")&&p.medium==="radio"&&p.stationId===c.stationId&&p.unitPriceUsd!=null&&p.unitPriceUsd>0&&(sameMarket({marketKeys:p.marketKeys??[]} as BroadcastSource,local)||radioTariffCoversStationStudy(p.marketKeys??[],c.marketKeys??[],c.stationCoverage??[]))).sort((a,b)=>a.unitPriceUsd!-b.unitPriceUsd!||a.id.localeCompare(b.id))[0];
    if(price){c.coverageKeys=price.coverageKeys;c.stationCoverage=price.stationCoverage??c.stationCoverage;c.catalogKey=price.catalogKey;c.unitPriceUsd=price.unitPriceUsd;c.referencePriceUsd=price.referencePriceUsd;c.minimumSpendUsd=price.minimumSpendUsd;c.unit=price.unit;c.sourceIds=[...new Set([...c.sourceIds.filter(id=>!id.startsWith("radio-tariff:")),...price.sourceIds])];c.note=[c.note.replace("Falta una tarifa compatible para calcular cuñas comprables.",""),price.note].filter(Boolean).join(" ");}
  }
  for(const c of candidates.filter(c=>c.medium==="press")){
    const s=pressObservationFor(c.provider,`${c.product} ${c.unit}`,pressStudies,brief,asOf);
    if(!s)continue;
    const sid=pressSource(s);
    c.sourceIds=[...new Set([...c.sourceIds,sid])];c.cohort=sid;
    c.metrics.push({label:"Alcance de lectura",value:s.reachPct,unit:"%",sourceId:sid},{label:"Posición por lectura",value:s.rank,unit:"ranking",sourceId:sid});
  }
  const resolvedTariffGaps:Partial<Record<MediaGroup,string>>={television:"TV: no hay tarifas compatibles con todas las fechas, plaza y condiciones del brief.",radio:"Radio: no hay una tarifa vigente y compatible para cuantificar la pauta.",press:"Prensa: faltan tarifas con vigencia y plaza compatibles con la campaña."};
  for(const [medium,gap] of Object.entries(resolvedTariffGaps))if(candidates.some(c=>c.medium===medium&&c.id.startsWith("workspace:")&&c.unitPriceUsd!=null)){const i=gaps.indexOf(gap);if(i>=0)gaps.splice(i,1);}
  if(candidates.some(c=>c.medium==="television"&&c.metrics.some(m=>m.label==="Rating"))){
    const i=gaps.indexOf("TV: faltan ratings por programa homologados para la plaza, público y período del brief.");
    if(i>=0)gaps.splice(i,1);
  }
  // Preserve account-priced options even when a large source catalog is loaded first.
  const boundedCandidates=groups.flatMap(m=>{
    const sorted=candidates.filter(c=>c.medium===m).sort((a,b)=>Number(b.unitPriceUsd!=null)-Number(a.unitPriceUsd!=null)||Number(Boolean(b.metrics.length))-Number(Boolean(a.metrics.length))||Number(Boolean(b.oohPhoto))-Number(Boolean(a.oohPhoto)));
    if(sorted.length<=100||!["television","radio","press","ooh"].includes(m))return sorted.slice(0,100);
    // Large tariffs must preserve other requested cities and publications.
    const balanced:StrategyCandidate[]=[];
    // Preserve current purchasable products before contextual inventory. Many
    // unpriced addresses must not crowd out priced assets grouped in one city.
    // Within each tier, keep the geographic/publication round-robin.
    for(const tier of [sorted.filter(c=>c.unitPriceUsd!=null),sorted.filter(c=>c.unitPriceUsd==null)]){
      const markets=new Map<string,StrategyCandidate[]>();
      for(const candidate of tier){const key=normalized(m==="press"?candidate.provider:m==="radio"&&candidate.stationCoverage?.length?candidate.stationCoverage.slice().sort().join(" · "):candidate.market);const rows=markets.get(key)??[];rows.push(candidate);markets.set(key,rows);}
      const maxRows=Math.max(0,...[...markets.values()].map(rows=>rows.length));
      for(let i=0;i<maxRows&&balanced.length<100;i++)for(const market of markets.values())if(market[i]&&balanced.length<100)balanced.push(market[i]);
    }
    return balanced;
  });
  const needed=new Set(["category-investment","audience-consumption",...audienceReferences.map(r=>r.sourceId),...oohReferences.map(r=>r.sourceId),...boundedCandidates.flatMap(c=>c.sourceIds)]);
  const boundedSources=[...sources.values()].filter(s=>needed.has(s.id)).slice(0,800), sourceIds=new Set(boundedSources.map(s=>s.id));
  return {asOf,sources:boundedSources,candidates:boundedCandidates.filter(c=>c.sourceIds.every(id=>sourceIds.has(id))),competition,categoryMix,consumption,gaps:[...new Set(gaps)].slice(0,30),researchPeriod:period?.periodLabel??"Sin período",competitionAvailable,audienceReferences,channelShares,oohMarketReferences:oohReferences};
}
