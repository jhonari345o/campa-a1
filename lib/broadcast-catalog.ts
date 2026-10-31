import type { CoverageSelection } from "./geographic-coverage";

export type BroadcastSource = {
  id: string; kind: "tv" | "radio"; label: string; provider: string;
  periodStart: string; periodEnd: string; market: string; marketKeys: string[];
  target: string; ageMin: number | null; ageMax: number | null; sex: string; nse: string;
  frequency: string; daypart: string; annualContract: boolean; conditions: string;
  spotSeconds: number | null; minimumSeconds: number | null; taxIncluded: boolean | null;
};
export type BroadcastTvOffer = { id: string; sourceId: string; day: string; title: string; schedule: string; priceUsd: number; target: string; note: string; };
export type BroadcastRadioRow = { id: string; sourceId: string; name: string; genre: string; rating: number | null; share: number | null; audience: number | null; rank: number | null };
export type BroadcastCatalog = { sources: BroadcastSource[]; tv: BroadcastTvOffer[]; radio: BroadcastRadioRow[]; error?: string };
export type BroadcastBrief = { startDate?: string; endDate?: string; geography: string; coverage?: CoverageSelection[]; ageRange?: string; sex?: string; socioeconomic?: string; audienceType?: string; annualContract?: boolean };
export const emptyBroadcastCatalog: BroadcastCatalog = { sources: [], tv: [], radio: [] };
export function normalized(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
export function validDate(value: string | undefined): value is string { return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value; }
export function tvValidity(source: BroadcastSource, start?: string, end = start) {
  return source.kind === "tv" && validDate(source.periodStart) && validDate(source.periodEnd) && validDate(start) && validDate(end) && end >= start && source.periodStart <= start && source.periodEnd >= end;
}
export function briefMarketKeys(brief: BroadcastBrief): string[] {
  if (brief.coverage?.length) return brief.coverage.map(c => c.kind === "country" ? "nacional" : normalized(c.label));
  return brief.geography.split(/[·,]/).map(normalized).filter(Boolean).map(k => k === "todo ecuador" || k === "ecuador" ? "nacional" : k);
}
/** Exact study territory only: consolidated Quito/Guayaquil is not a Quito-only estimate. */
export function sameMarket(source: BroadcastSource, brief: BroadcastBrief) {
  const requested = [...new Set(briefMarketKeys(brief))].sort();
  const observed = [...new Set(source.marketKeys.map(normalized))].sort();
  return observed.length > 0 && requested.length === observed.length && requested.every((key,i) => key === observed[i]);
}
export function radioCompatibility(source: BroadcastSource, brief: BroadcastBrief): string | null {
  if (source.kind !== "radio" || !validDate(source.periodStart) || !validDate(source.periodEnd) || source.nse !== "all" || !["all","male","female"].includes(source.sex)) return "El estudio no tiene un corte homologado para este público";
  if (!validDate(brief.startDate) || source.periodEnd > brief.startDate) return "Selecciona una fecha posterior al estudio";
  if (!sameMarket(source, brief)) return "La plaza del estudio no coincide con el brief";
  if (brief.audienceType && brief.audienceType !== "B2C") return "El estudio no tiene un corte de audiencia empresarial";
  const age = normalized(brief.ageRange ?? "");
  if (source.ageMin !== 18 || source.ageMax !== 99 || !["personas 18", "18 99", "18"].includes(age)) return "El estudio corresponde a personas de 18 a 99 años";
  const sex = normalized(brief.sex ?? "");
  const expected = source.sex === "all" ? "todas las personas" : source.sex === "male" ? "hombres" : "mujeres";
  if (sex !== expected || normalized(brief.socioeconomic ?? "") !== "todos los nse") return "El público del estudio no coincide con el brief";
  return null;
}
export function compatibleRadio(catalog: BroadcastCatalog, brief: BroadcastBrief) {
  const sources = catalog.sources.filter(s => s.kind === "radio" && radioCompatibility(s,brief) === null);
  const latest = sources.map(s=>s.periodEnd).sort().at(-1);
  // Keep each frequency/daypart in its own cohort; never rank combined studies together.
  const cohort = sources.filter(s=>s.periodEnd === latest).sort((a,b)=>a.id.localeCompare(b.id))[0];
  return cohort ? catalog.radio.filter(r=>r.sourceId === cohort.id).sort((a,b)=>(b.rating ?? -1)-(a.rating ?? -1)).map(row=>({row,source:cohort})) : [];
}
export function compatibleTv(catalog: BroadcastCatalog, brief: BroadcastBrief) {
  return catalog.sources.filter(s=>s.kind === "tv" && tvValidity(s,brief.startDate,brief.endDate) && sameMarket(s,brief) && (!s.annualContract || brief.annualContract)).flatMap(source=>catalog.tv.filter(o=>o.sourceId === source.id).map(offer=>({source,offer})));
}
export function sourceDescription(s: BroadcastSource) { return `${s.periodStart} – ${s.periodEnd} · ${s.market} · ${s.target}${s.frequency ? ` · ${s.frequency}` : ""}${s.daypart ? ` · ${s.daypart}` : ""}`; }

/** Re-resolve submitted picks from the private catalog; never trust browser prices or metrics. */
export function validateBroadcastSelections(catalog: BroadcastCatalog, brief: BroadcastBrief, selections: Record<string, unknown>): { ok: true; selections: Record<string, unknown> } | { ok: false; error: string } {
  const tv = Array.isArray(selections.tv) ? selections.tv : [];
  const radio = Array.isArray(selections.radio) ? selections.radio : [];
  if (tv.length > 100 || radio.length > 100) return {ok:false,error:"Reduce la selección a 100 opciones por medio."};
  if ((tv.length || radio.length) && catalog.error) return {ok:false,error:catalog.error};
  const tvPicks: Record<string,unknown>[] = [], radioPicks: Record<string,unknown>[] = [];
  const quantity = (v: unknown) => Number.isInteger(v) && Number(v)>0 && Number(v)<=10000;
  for (const pick of tv) {
    const offer = catalog.tv.find(o=>o.id===pick?.id && o.sourceId===pick?.sourceId);
    const source = catalog.sources.find(s=>s.id===offer?.sourceId && s.kind==='tv');
    if (!offer || !source || !quantity(pick.quantity)) return {ok:false,error:"Selecciona nuevamente los programas desde una edición del catálogo privado y revisa las cantidades."};
    if (!tvValidity(source,brief.startDate,brief.endDate)) return {ok:false,error:`${source.label}: las fechas del plan quedan fuera del tarifario. Retira la selección o elige otra edición.`};
    const applicable = sameMarket(source,brief) && !source.annualContract;
    tvPicks.push({id:offer.id,sourceId:source.id,channel:source.label,title:offer.title,schedule:`${offer.day} · ${offer.schedule}`,market:source.market,context:sourceDescription(source),conditions:source.conditions,unitSeconds:source.spotSeconds,unitPrice:applicable?offer.priceUsd:null,quantity:pick.quantity});
  }
  for (const pick of radio) {
    const row = catalog.radio.find(r=>r.id===pick?.id && r.sourceId===pick?.sourceId);
    const source = catalog.sources.find(s=>s.id===row?.sourceId && s.kind==='radio');
    if (!row || !source || !quantity(pick.spotsPerDay) || !quantity(pick.days)) return {ok:false,error:"Selecciona nuevamente las emisoras desde un estudio del catálogo privado y revisa las cantidades."};
    const mismatch=radioCompatibility(source,brief);
    if(mismatch) return {ok:false,error:`${row.name}: ${mismatch}. Revisa el brief o retira esta emisora.`};
    radioPicks.push({id:row.id,sourceId:source.id,name:row.name,context:sourceDescription(source),spotsPerDay:pick.spotsPerDay,days:pick.days,rating:row.rating,share:row.share,audience:row.audience});
  }
  return {ok:true,selections:{...selections,tv:tvPicks,radio:radioPicks}};
}
