import { diversifyRadio, diversifyTelevision } from "./planning-broadcast";
import { DIGITAL_PRODUCTIONS_LABEL, mediaGroupForLabel, type MediaGroup } from "./media-groups";
import { mediaGroupLabel } from "./plan-optimizer";
import type { MediaPlan, PlanRow } from "./planner";
import type { StrategyBrief, StrategyCandidate, StrategyEvidenceBundle } from "./media-strategy-evidence";
import { briefMarketKeys } from "./broadcast-catalog";
import { planningStudyBrief, nationalTerritoryOrder, territoryProvince, territoryKey, territoriesOverlap } from "./planning-market";
import { coverageFromLabels } from "./geographic-coverage";

export const STRATEGY_VERSION = "2026-11-03.35";
export const MAX_STRATEGY_EXECUTIONS = 25;
// Planning policy approved by the platform owner; it is not an audience study.
export const STARTING_MEDIA_MIX: Readonly<Record<MediaGroup, number>> = {
  television: 30, digital: 30, ooh: 20, radio: 10, press: 2, influencers: 8,
};
const MODEL_CANDIDATE_LIMIT = 32;
type TerritoryBrief = Pick<StrategyBrief,"objective"|"priority"> & Partial<StrategyBrief>;
export type StrategyAiState = "validated" | "cached" | "not_configured" | "quota" | "unavailable" | "rejected";
export type StrategyAdvice = {
  summary: string;
  allocations: { medium: MediaGroup; weight: number; rationale: string; evidenceIds: string[]; candidateIds: string[]; productionWeight?: number }[];
  questions: string[];
};
export type StrategyExecution = {candidate:StrategyCandidate;amountUsd:number|null;units:number|null;referenceSpendUsd:number|null;remainderUsd:number|null};
export type StrategyAllocation = {
  medium: MediaGroup; pct: number; amountUsd: number | null; rationale: string; sourceIds: string[];
  readiness: "reference" | "needs_quote" | "platform_budget";
  executions?: StrategyExecution[];
  candidate: StrategyCandidate | null; units: number | null; referenceSpendUsd: number | null; remainderUsd: number | null;
};
export type StrategyReport = {
  customized?: boolean;
  version: string; generatedAt: string; fingerprint: string; model: string | null; aiState: StrategyAiState;
  aiRetryable?: boolean;
  summary: string; allocations: StrategyAllocation[]; sources: StrategyEvidenceBundle["sources"];
  competition: StrategyEvidenceBundle["competition"]; gaps: string[]; questions: string[];
  audienceReferences: StrategyEvidenceBundle["audienceReferences"];
  channelShares?: StrategyEvidenceBundle["channelShares"];
  candidateCount: number; budgetUsd: number | null; reserveUsd: number | null;
  alternatives: { id: string; label: string; allocations: { medium: MediaGroup; pct: number; amountUsd: number | null }[] }[];
  evaluation: { budgetConserved: boolean; permittedMediaOnly: boolean; measuredReachAvailable: false; comparableConsumption: boolean };
};
const ALL: MediaGroup[]=["television","radio","ooh","press","digital","influencers"];
const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const finite=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v);
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};

/** Only explicit exclusions are hard constraints; ambiguous prose remains for review. */
export function excludedMedia(brief: StrategyBrief): MediaGroup[] {
  const terms: Record<MediaGroup,string[]>={television:["tv","television"],radio:["radio"],ooh:["ooh","via publica","vallas"],press:["prensa","periodicos"],digital:["digital"],influencers:["influenciadores","influencers"]};
  const lines=(brief.restrictions??"").split(/[\n.;]+/).map(normalize);
  return ALL.filter(m=>lines.some(line=>terms[m].some(term=>line===`sin ${term}`||line===`no usar ${term}`||line===`no pautar en ${term}`||line===`excluir ${term}`||line.startsWith("excluir medios ")&&line.slice(15).split(/\s*,\s*|\s+y\s+/).includes(term))));
}
export function allowedStrategyMedia(brief:StrategyBrief,bundle:StrategyEvidenceBundle):MediaGroup[] {
  const excluded=new Set(excludedMedia(brief));
  return ALL.filter(m=>brief.selectedMedia.includes(m)&&!excluded.has(m)&&(bundle.categoryMix.some(x=>x.medium===m&&x.share>0)||bundle.consumption.some(x=>x.medium===m&&x.comparable&&x.value>0)||bundle.candidates.some(c=>c.medium===m)));
}

/** Largest remainder allocation in integer cents, deterministic under reordered inputs. */
export function allocateStrategyBudget(weights: {medium:MediaGroup;weight:number}[],budget:number|null) {
  const clean=ALL.flatMap(m=>{const w=weights.find(x=>x.medium===m)?.weight;return finite(w)&&w>0?[{medium:m,weight:w}]:[];});
  const total=clean.reduce((n,r)=>n+r.weight,0);
  if(!total||!Number.isFinite(total))return [];
  const cents=budget!=null&&finite(budget)&&budget>0?Math.round(budget*100):null;
  const rows=clean.map(r=>({...r,pct:r.weight/total,amountCents:cents==null?null:Math.floor(cents*r.weight/total),fraction:cents==null?0:cents*r.weight/total%1}));
  let remaining=cents==null?0:cents-rows.reduce((n,r)=>n+(r.amountCents??0),0);
  const ranked=[...rows].sort((a,b)=>b.fraction-a.fraction||ALL.indexOf(a.medium)-ALL.indexOf(b.medium));
  for(let i=0;remaining>0;i++,remaining--)ranked[i%ranked.length].amountCents!++;
  return rows.filter(r=>r.amountCents==null||r.amountCents>0).map(r=>({medium:r.medium,pct:cents&&r.amountCents!=null?r.amountCents/cents:r.pct,amountUsd:r.amountCents==null?null:r.amountCents/100}));
}

export function referenceQuantity(candidate:StrategyCandidate|null,amount:number|null) {
  const price=candidate?.unitPriceUsd;
  if(price==null||!Number.isFinite(price)||price<=0||amount==null||amount<0)return {units:null,spend:null,remainder:null};
  const unitCents=Math.max(1,Math.ceil(price*100)),budgetCents=Math.round(amount*100);
  const units=Math.min(10_000,candidate?.maximumUnits??10_000,candidate?.planningMaximumUnits??10_000,Math.floor(budgetCents/unitCents));
  const spend=Math.round(units*price*100)/100;
  return {units,spend,remainder:Math.round((amount-spend)*100)/100};
}
/** Split one medium's budget once across its selected executions; preserve cents and quantities. */
export function allocateStrategyExecutions(candidates:StrategyCandidate[],amount:number|null):StrategyExecution[] {
  const unique=[...new Map(candidates.map(c=>[JSON.stringify([c.medium==="ooh"&&c.physicalAssetId?`asset:${c.physicalAssetId}`:c.id,c.planningTerritory??null]),c])).values()].slice(0,MAX_STRATEGY_EXECUTIONS);
  let remaining=amount==null?null:Math.round(amount*100);
  const minimum=(c:StrategyCandidate)=>Math.ceil(Math.max(c.minimumSpendUsd??c.unitPriceUsd??0,(c.unitPriceUsd??0)*(c.planningMinimumUnits??1))*100);
  const capacity=(c:StrategyCandidate)=>Math.min(c.planningMaximumSpendUsd==null?Infinity:Math.floor(c.planningMaximumSpendUsd*100),c.unitPriceUsd==null?Infinity:Math.ceil(c.unitPriceUsd*100)*Math.min(c.maximumUnits??Infinity,c.planningMaximumUnits??Infinity));
  const selected=unique.filter(c=>{
    const cost=minimum(c);
    if(cost>capacity(c)||remaining!=null&&cost>remaining)return false;
    if(remaining!=null)remaining-=cost;
    return true;
  });
  const budgets=selected.map(minimum);
  // Water-fill only executions that can absorb more budget. A fixed location
  // is bought once; its unused envelope moves to other selected products.
  while(remaining!=null&&remaining>0){
    const eligible=selected.flatMap((c,i)=>budgets[i]<capacity(c)?[i]:[]);
    if(!eligible.length)break;
    const available=remaining,weight=(i:number)=>Math.max(.001,selected[i].planningWeight??1);
    const totalWeight=eligible.reduce((n,i)=>n+weight(i),0);
    const slices=eligible.map(i=>({i,cents:Math.floor(available*weight(i)/totalWeight),fraction:available*weight(i)/totalWeight%1}));
    let extra=available-slices.reduce((n,s)=>n+s.cents,0);
    for(const slice of [...slices].sort((a,b)=>b.fraction-a.fraction||a.i-b.i)){if(extra--<=0)break;slice.cents++;}
    for(const {i,cents} of slices){
      const added=Math.min(cents,capacity(selected[i])-budgets[i]);
      budgets[i]+=added;remaining-=added;
    }
  }
  // Pool fractional insertion remainders without increasing the medium total
  // or a station's monthly ceiling. This can fund another real spot instead
  // of leaving one spot split across two unusable envelopes.
  if(amount!=null)for(const i of selected.map((_,i)=>i).sort((a,b)=>(selected[b].planningWeight??1)-(selected[a].planningWeight??1)||a-b)){
    const c=selected[i];if(c.unitPriceUsd==null)continue;
    const unit=Math.ceil(c.unitPriceUsd*100),need=unit-budgets[i]%unit;
    const donors=selected.flatMap((p,j)=>j!==i&&p.unitPriceUsd!=null?[{j,free:budgets[j]%Math.ceil(p.unitPriceUsd*100)}]:[]);
    if(budgets[i]+need>capacity(c)||donors.reduce((n,d)=>n+d.free,0)<need)continue;
    let left=need;
    for(const donor of donors){const take=Math.min(left,donor.free);budgets[donor.j]-=take;budgets[i]+=take;left-=take;if(!left)break;}
  }
  return selected.map((candidate,i)=>{
    const budget=amount==null?null:budgets[i]/100;
    const purchase=referenceQuantity(candidate,budget);
    return {candidate,amountUsd:budget,units:purchase.units,referenceSpendUsd:purchase.spend,remainderUsd:purchase.remainder};
  });
}

/** Programmes are explicit AI choices, never an automatic replacement for platform media. */
function digitalProductions(candidates:StrategyCandidate[],amount:number|null):StrategyExecution[] {
  const seen=new Set<string>();
  const selected=candidates.filter(c=>{
    const id=c.digitalProduction?.id;
    if(!id||seen.has(id)||c.unitPriceUsd==null||c.sourceUse!=="comparable")return false;
    seen.add(id);return true;
  });
  return allocateStrategyExecutions(selected,amount).filter(e=>e.units!=null&&e.units>0).map(e=>({...e,amountUsd:e.referenceSpendUsd,remainderUsd:0}));
}
export function digitalProductionSpend(allocation:StrategyAllocation) {
  return Math.round((allocation.executions??[]).filter(e=>e.candidate.digitalProduction).reduce((n,e)=>n+(e.referenceSpendUsd??0),0)*100)/100;
}
function digitalPlanRows(platforms:PlanRow[],allocation:StrategyAllocation,budget:number|null):PlanRow[] {
  const productionSpend=digitalProductionSpend(allocation),rows:PlanRow[]=[];
  if(productionSpend>0)rows.push({label:DIGITAL_PRODUCTIONS_LABEL,amount:productionSpend,pct:budget?productionSpend/budget:0,rationale:allocation.rationale});
  const cents=allocation.amountUsd==null?null:Math.max(0,Math.round((allocation.amountUsd-productionSpend)*100));
  if(cents===0)return rows;
  const eligible=platforms.filter(r=>mediaGroupForLabel(r.label)==="digital"&&r.label!==DIGITAL_PRODUCTIONS_LABEL&&!/whatsapp/i.test(r.label)&&r.pct>0);
  const digital=eligible.length?eligible:[{label:"Digital",pct:1,amount:null}],total=digital.reduce((n,r)=>n+r.pct,0);let assigned=0;
  for(const [i,r] of digital.entries()){
    const amountCents=cents==null?null:i===digital.length-1?cents-assigned:Math.floor(cents*r.pct/total);assigned+=amountCents??0;
    rows.push({label:r.label,pct:budget&&amountCents!=null?amountCents/100/budget:allocation.pct*r.pct/total,amount:amountCents==null?null:amountCents/100,rationale:allocation.rationale});
  }
  return rows;
}

function baseWeights(brief:StrategyBrief,bundle:StrategyEvidenceBundle,plan:MediaPlan) {
  const allowed=allowedStrategyMedia(brief,bundle);
  const fullMix=ALL.every(m=>brief.selectedMedia.includes(m))&&!excludedMedia(brief).length;
  return allowed.map(m=>{
    if(fullMix)return {medium:m,weight:STARTING_MEDIA_MIX[m]};
    const rows=plan.plan.filter(r=>mediaGroupForLabel(r.label)===m), prior=rows.reduce((n,r)=>n+r.pct,0);
    const category=bundle.categoryMix.find(x=>x.medium===m)?.share??0, consumption=bundle.consumption.find(x=>x.medium===m&&x.comparable)?.value??0;
    // A candidate without category pressure is a documented option, not measured category demand.
    return {medium:m,weight:prior>0?prior:category>0?category:consumption>0?consumption/100:0.08};
  });
}
function candidateSort(a:StrategyCandidate,b:StrategyCandidate,brief?:TerritoryBrief) {
  // Compare ratings only inside the very same study/cohort, never across methodologies.
  const ar=a.metrics.find(m=>m.label==="Rating"),br=b.metrics.find(m=>m.label==="Rating");
  if(a.unitPriceUsd!=null&&b.unitPriceUsd==null)return -1;
  if(b.unitPriceUsd!=null&&a.unitPriceUsd==null)return 1;
  if(a.medium==="ooh"&&b.medium==="ooh") {
    const ap=a.unitPriceUsd??a.referencePriceUsd,bp=b.unitPriceUsd??b.referencePriceUsd;
    const aPriced=ap!=null&&ap>0,bPriced=bp!=null&&bp>0;
    if(aPriced!==bPriced)return aPriced?-1:1;
    if(Boolean(a.oohPhoto)!==Boolean(b.oohPhoto))return a.oohPhoto?-1:1;
    return (ap??Infinity)-(bp??Infinity)||a.id.localeCompare(b.id);
  }
  if(a.medium==="press"&&b.medium==="press"&&a.cohort&&a.cohort===b.cohort&&a.unit===b.unit){
    const ap=a.metrics.find(m=>m.label==="Alcance de lectura"),bp=b.metrics.find(m=>m.label==="Alcance de lectura");
    if(ap&&bp&&ap.value!==bp.value)return bp.value-ap.value;
  }
  const sameCohort=ar&&br&&(ar.sourceId===br.sourceId||a.cohort&&a.cohort===b.cohort)&&ar.unit===br.unit&&a.unit===b.unit;
  if(sameCohort&&ar!.value>0&&br!.value>0){
    if(/eficiencia|costo/.test(normalize(`${brief?.objective??""} ${brief?.priority??""}`))&&a.unitPriceUsd!=null&&b.unitPriceUsd!=null){const difference=a.unitPriceUsd/ar!.value-b.unitPriceUsd/br!.value;if(difference)return difference;}
    if(ar!.value!==br!.value)return br!.value-ar!.value;
  }
  return (a.unitPriceUsd??Infinity)-(b.unitPriceUsd??Infinity)||a.id.localeCompare(b.id);
}
const radioFootprint=(candidate:StrategyCandidate)=>normalize(candidate.stationCoverage?.length?candidate.stationCoverage.slice().sort().join(", "):candidate.market);
function radioCoversMarket(candidate:StrategyCandidate,market:string,brief:StrategyBrief) {
  const coverage=candidate.stationCoverage;
  if(!coverage?.length)return false;
  return Boolean(planningStudyBrief([market],{...brief,coverage:undefined,geography:coverage.map(m=>normalize(m)==="nacionales"?"nacional":m).join(", ")}));
}
function rawStrategyCandidatePool(bundle:StrategyEvidenceBundle,medium:MediaGroup,brief?:TerritoryBrief) {
  const all=bundle.candidates.filter(c=>c.medium===medium);
  if(medium==="radio") {
    // Retain each documented market/cohort independently. Never compare ratings across plazas.
    const cohorts=new Map<string,StrategyCandidate[]>();
    for(const c of all){const id=c.sourceIds.find(s=>s.startsWith("radio-study:"));if(id)cohorts.set(id,[...(cohorts.get(id)??[]),c]);}
    const groups=[...cohorts].sort((a,b)=>{
      const sourceA=bundle.sources.find(s=>s.id===a[0]),sourceB=bundle.sources.find(s=>s.id===b[0]);
      return (sourceA?.market??"").localeCompare(sourceB?.market??"","es")||(sourceB?.period??"").localeCompare(sourceA?.period??"")||a[0].localeCompare(b[0]);
    }).map(([,rows])=>{
      // The measured cohort may consolidate several cities. Preserve the
      // stations' actual signals before bounding the model's candidate list.
      const footprints=new Map<string,StrategyCandidate[]>();
      for(const c of rows.sort((a,b)=>candidateSort(a,b,brief))){const key=radioFootprint(c);footprints.set(key,[...(footprints.get(key)??[]),c]);}
      const balanced:StrategyCandidate[]=[];
      for(let i=0;i<Math.max(0,...[...footprints.values()].map(g=>g.length));i++)for(const group of footprints.values())if(group[i])balanced.push(group[i]);
      return balanced;
    });
    const ranked:StrategyCandidate[]=[];
    for(let i=0;i<Math.max(0,...groups.map(g=>g.length));i++)for(const group of groups)if(group[i])ranked.push(group[i]);
    const priced = all.filter(c=>c.id.startsWith("workspace:")&&c.unitPriceUsd!=null).sort((a,b)=>candidateSort(a,b,brief));
    return [...ranked,...priced];
  }
  if(medium==="press"||medium==="ooh"){
    const publications=new Map<string,StrategyCandidate[]>();
    for(const c of all){const key=normalize(medium==="press"?c.provider:c.market),rows=publications.get(key)??[];rows.push(c);publications.set(key,rows);}
    const groups=[...publications.values()].map(rows=>rows.sort((a,b)=>candidateSort(a,b,brief))).sort((a,b)=>candidateSort(a[0],b[0],brief));
    const ranked:StrategyCandidate[]=[];
    for(let i=0;i<Math.max(0,...groups.map(g=>g.length));i++)for(const group of groups)if(group[i])ranked.push(group[i]);
    return ranked;
  }
  if(medium==="television"){
    const measured=all.filter(c=>c.cohort&&c.metrics.some(m=>m.label==="Rating"));
    const cohorts=[...new Set(measured.map(c=>c.cohort!))].sort((a,b)=>{
      const period=(key:string)=>{const c=measured.find(c=>c.cohort===key);return bundle.sources.find(s=>c?.sourceIds.includes(s.id)&&s.kind==="rating")?.period.slice(-10)??"";};
      return period(b).localeCompare(period(a))||a.localeCompare(b);
    });
    // Preserve every applicable market/study. Taking only the newest cohort can
    // silently remove a requested plaza before the AI sees any of its channels.
    const groups=cohorts.map(cohort=>measured.filter(c=>c.cohort===cohort).sort((a,b)=>candidateSort(a,b,brief)));
    const ranked:StrategyCandidate[]=[];
    for(let i=0;i<Math.max(0,...groups.map(g=>g.length));i++)for(const group of groups)if(group[i])ranked.push(group[i]);
    if(ranked.length)return [...ranked,...all.filter(c=>!measured.includes(c)).sort((a,b)=>candidateSort(a,b,brief))];
  }
  return all.sort((a,b)=>candidateSort(a,b,brief));
}
function candidateTerritories(c:StrategyCandidate):string[] {
  if(c.planningTerritory)return [territoryKey(c.planningTerritory)];
  return (c.stationCoverage??c.coverageKeys??(c.id.startsWith("radio:")?[]:c.marketKeys??c.market.split(/\s*[·,+]\s*/))).map(territoryKey);
}
function territoryTargets(brief:TerritoryBrief):string[] {
  return briefMarketKeys({...brief,geography:brief.geography??""}).includes("nacional")?nationalTerritoryOrder():briefMarketKeys({...brief,geography:brief.geography??""}).map(territoryKey);
}
/** Bound the AI input after preserving territories, not before. Ratings stay
 * ordered inside their own cohort; geography never changes a measurement. */
export function strategyCandidatePool(bundle:StrategyEvidenceBundle,medium:MediaGroup,brief?:TerritoryBrief) {
  const raw=rawStrategyCandidatePool(bundle,medium,brief);
  if(!brief||!(brief.coverage?.length||brief.geography))return raw;
  const national=briefMarketKeys({...brief,geography:brief.geography??""}).includes("nacional"),targets=territoryTargets(brief);
  const buckets=new Map<number,StrategyCandidate[]>();
  for(const c of raw){
    const keys=candidateTerritories(c);
    const global=keys.includes("nacional");
    const index=global?-1:targets.findIndex(t=>keys.some(k=>territoriesOverlap(k,t)));
    const bucket=index<0&&!global?targets.length:index;
    buckets.set(bucket,[...(buckets.get(bucket)??[]),c]);
  }
  const groups=[...buckets].sort((a,b)=>a[0]-b[0]).map(([,rows])=>rows);
  const ordered:StrategyCandidate[]=[];
  for(let i=0;i<Math.max(0,...groups.map(g=>g.length));i++)for(const rows of groups)if(rows[i])ordered.push(rows[i]);
  // National radio and digital remain accessible even with a small budget.
  if(national&&["radio","digital"].includes(medium))return [...ordered.filter(c=>candidateTerritories(c).includes("nacional")),...ordered.filter(c=>!candidateTerritories(c).includes("nacional"))];
  return ordered;
}
function territorialChoices(pool:StrategyCandidate[],preferred:StrategyCandidate[],brief:StrategyBrief,amount:number|null):StrategyCandidate[] {
  const national=briefMarketKeys(brief).includes("nacional");
  const selected:StrategyCandidate[]=[];let remaining=amount;
  const days=brief.startDate&&brief.endDate?Math.max(1,Math.ceil((Date.parse(brief.endDate)-Date.parse(brief.startDate))/86400000)+1):20;
  const targets=territoryTargets(brief);
  const isMovable=(c:StrategyCandidate)=>c.medium==="ooh"&&c.maximumUnits!==1&&candidateTerritories({...c,planningTerritory:undefined}).includes("nacional");
  const sameProduct=(a:StrategyCandidate,b:StrategyCandidate)=>a.medium==="ooh"&&b.medium==="ooh"&&a.physicalAssetId&&b.physicalAssetId?a.physicalAssetId===b.physicalAssetId:a.medium==="radio"&&b.medium==="radio"?(a.stationId&&b.stationId?a.stationId===b.stationId:normalize(a.provider)===normalize(b.provider)&&candidateTerritories(a).sort().join(",")===candidateTerritories(b).sort().join(",")):(a.catalogKey&&b.catalogKey?a.catalogKey===b.catalogKey:a.id===b.id)&&a.planningTerritory===b.planningTerritory;
  const cadence=(c:StrategyCandidate)=>national&&c.medium==="radio"?Math.min(20,days):1;
  const planned=(c:StrategyCandidate,target?:string):StrategyCandidate=>({...c,
    planningMinimumUnits:cadence(c),
    // Editorial planning ceiling, not a supplier availability claim. More
    // budget should broaden the station mix instead of buying dozens a day.
    ...(c.medium==="radio"?{planningMaximumUnits:days*6}:{}),
    ...(isMovable(c)&&target?{planningTerritory:brief.coverage?.find(s=>territoryKey(s.label)===target)?.label??coverageFromLabels([`Provincia de ${target}`])[0]?.label??target}:{}),
  });
  const canAdd=(c:StrategyCandidate|undefined)=>{
    if(!c||selected.length>=MAX_STRATEGY_EXECUTIONS||selected.some(s=>sameProduct(s,c)))return false;
    const minimum=Math.max(c.minimumSpendUsd??c.unitPriceUsd??0,(c.unitPriceUsd??0)*cadence(c));
    if(remaining!=null&&(c.unitPriceUsd==null||minimum>remaining))return false;
    return true;
  };
  const add=(c:StrategyCandidate|undefined)=>{
    if(!c||!canAdd(c))return false;
    selected.push(c);
    if(remaining!=null)remaining-=Math.max(c.minimumSpendUsd??c.unitPriceUsd??0,(c.unitPriceUsd??0)*cadence(c));
    return true;
  };
  const ranked=[...preferred,...pool.filter(c=>!preferred.some(p=>p.id===c.id))];
  const forTarget=(target:string)=>{
    // Fixed local inventory precedes a relocatable nationwide format. One
    // truck/activation is assigned to one territory, not all Ecuador at once.
    const local=ranked.filter(c=>!isMovable(c)&&candidateTerritories(c).some(k=>territoriesOverlap(k,target)));
    return [...local,...ranked.filter(isMovable)].map(c=>planned(c,target));
  };
  if(national){
    add(ranked.filter(c=>["radio","digital"].includes(c.medium)&&candidateTerritories(c).includes("nacional")).map(c=>planned(c)).find(canAdd));
    for(const target of targets)add(forTarget(target).find(c=>canAdd(c)&&!candidateTerritories(c).includes("nacional")&&candidateTerritories(c).some(k=>territoryProvince(k)===target)));
    if(!selected.length)add(ranked.map(c=>planned(c,targets[0])).find(canAdd));
  }else{
    // Preserve the AI's products, then fill affordable uncovered requested areas.
    for(const c of preferred)add(planned(c,targets.find(t=>!selected.some(s=>candidateTerritories(s).some(k=>territoriesOverlap(k,t))))??targets[0]));
    for(const target of targets)if(!selected.some(c=>candidateTerritories(c).some(k=>territoriesOverlap(k,target))))add(forTarget(target).find(canAdd));
    if(!selected.length)add(ranked.map(c=>planned(c,targets[0])).find(canAdd));
  }
  if(amount!=null&&selected.length){
    const spend=(rows:StrategyCandidate[])=>allocateStrategyExecutions(rows,amount).reduce((n,e)=>n+(e.referenceSpendUsd??e.amountUsd??0),0);
    // A repeatable outing can otherwise absorb the whole remainder and prevent
    // every additional physical location. Broaden OOH with current priced
    // assets before repeating that format; retain a transparent cash remainder.
    // Other media still require the extra row to improve executable spend.
    let used=spend(selected);
    for(const raw of ranked){
      const c=planned(raw,targets[0]);
      if(!canAdd(c))continue;
      const broadenOoh=c.medium==="ooh"&&c.maximumUnits===1&&selected.some(s=>s.medium==="ooh"&&s.maximumUnits!==1&&s.unitPriceUsd!=null);
      if(broadenOoh&&add(c)){used=spend(selected);continue;}
      const minimum=Math.max(c.minimumSpendUsd??c.unitPriceUsd??0,(c.unitPriceUsd??0)*cadence(c));
      if(amount-used<minimum-.005)continue;
      const next=spend([...selected,c]);
      if(next>used+.005&&add(c))used=next;
    }
  }
  return selected;
}
function affordableWeights(weights:{medium:MediaGroup;weight:number}[],bundle:StrategyEvidenceBundle,budget:number|null) {
  let result=weights;
  for(let i=0;i<ALL.length;i++) {
    const allocations=allocateStrategyBudget(result,budget);
    const blocked=new Set(allocations.filter(a=>{
      if(a.amountUsd==null||a.medium==="digital")return false;
      const pool=strategyCandidatePool(bundle,a.medium),priced=pool.filter(c=>c.unitPriceUsd!=null&&c.unitPriceUsd>0);
      return priced.length>0&&!priced.some(c=>(c.minimumSpendUsd??c.unitPriceUsd!)<=a.amountUsd!);
    }).map(a=>a.medium));
    if(!blocked.size)break;
    result=result.filter(r=>!blocked.has(r.medium));
  }
  return result;
}
/** JSON is an instruction proposal. Server-owned sources, metrics, rates and arithmetic are immutable. */
export function parseStrategyAdvice(raw:string,brief:StrategyBrief,bundle:StrategyEvidenceBundle,onReject?:(code:string)=>void,onSafeText?:()=>void):StrategyAdvice|null {
  const reject=(code:string)=>{onReject?.(code);return null;};
  if(typeof raw!=="string"||raw.length>24_000)return reject("SIZE");
  let v:Record<string,unknown>;try{v=obj(JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,"").trim()));}catch{return reject("JSON");}
  const internalCopy=/\b(?:mixPolicy|productionWeight|digitalOptions|candidateIds?|evidenceIds?|referenceCases|allocationOptions|outputContract|allowedMedia|executionPatterns|providerCount|budgetScale|stationCoverage|coverageKeys|territorialPolicy|same_client|structural_reference|ooh|press|influencers)\b/i;
  const text=(s:unknown,max:number)=>typeof s==="string"&&s.trim().length>0&&s.length<=max&&!/[<>]|https?:|www\.|garantiz/i.test(s)&&!internalCopy.test(s)&&!/[\d%$€]/.test(s.replace(/\bB2[BC]\b/gi,""));
  if(typeof v.summary!=="string")return reject("SUMMARY");
  let safeTextUsed=!text(v.summary,1400);
  if(!Array.isArray(v.allocations)||!v.allocations.length||v.allocations.length>6)return reject("ALLOCATIONS");
  // Optional follow-up prose is not part of the allocation contract. Drop malformed
  // questions without discarding an otherwise valid, source-bound recommendation.
  const questions = Array.isArray(v.questions) ? v.questions.filter(q=>text(q,400)).slice(0,5) as string[] : [];
  const allowed=new Set(allowedStrategyMedia(brief,bundle)),sourceIds=new Set(bundle.sources.filter(s=>s.use!=="unavailable").map(s=>s.id)),used=new Set<string>();
  const weights = new Map<MediaGroup,number>();
  for (const value of v.allocations) {
    const r=obj(value), medium=r.medium as MediaGroup;
    if(!allowed.has(medium)||weights.has(medium))return reject("MEDIUM");
    if(!Number.isInteger(r.weight)||Number(r.weight)<0||Number(r.weight)>10_000)return reject("WEIGHT");
    weights.set(medium,Number(r.weight));
  }
  // The model proposes relative priorities, not money. Canonicalize them with
  // the same deterministic cent allocation used by the budget calculator.
  // A percent-scale answer or a rounding discrepancy cannot alter total spend.
  const canonicalWeights=new Map(allocateStrategyBudget([...weights].map(([medium,weight])=>({medium,weight})),100).map(r=>[r.medium,Math.round(r.amountUsd!*100)]));
  if(!canonicalWeights.size)return reject("WEIGHT_TOTAL");
  const allocations:StrategyAdvice["allocations"]=[];
  for(const value of v.allocations){const r=obj(value),medium=r.medium as MediaGroup;
    if(!allowed.has(medium)||used.has(medium))return reject("MEDIUM");
    if(!Number.isInteger(r.weight)||Number(r.weight)<0||Number(r.weight)>10_000)return reject("WEIGHT");
    const weight=canonicalWeights.get(medium)??0;
    if(typeof r.rationale!=="string")return reject("RATIONALE");
    const safeRationale=text(r.rationale,700);
    safeTextUsed ||= !safeRationale;
    if(!Array.isArray(r.evidenceIds)||!r.evidenceIds.length||r.evidenceIds.length>6||!r.evidenceIds.every(id=>typeof id==="string"&&sourceIds.has(id)))return reject("EVIDENCE_IDS");
    if(!Array.isArray(r.candidateIds))return reject("CANDIDATE_SHAPE");
    if(r.candidateIds.length>MAX_STRATEGY_EXECUTIONS)return reject("CANDIDATE_COUNT");
    const pool=strategyCandidatePool(bundle,medium,brief).slice(0,MODEL_CANDIDATE_LIMIT);
    if(!r.candidateIds.every(id=>typeof id==="string"&&pool.some(c=>c.id===id)))return reject("CANDIDATE_UNKNOWN");
    const hasProductions=medium==="digital"&&pool.some(c=>c.digitalProduction&&(r.candidateIds as string[]).includes(c.id));
    // A list of programmes is not permission to spend the entire digital
    // allocation. Their envelope must be an explicit, validated AI decision.
    const productionWeight=hasProductions&&weight>0?r.productionWeight:0;
    if(productionWeight===undefined)return reject("DIGITAL_SPLIT_MISSING");
    if(!Number.isInteger(productionWeight))return reject("DIGITAL_SPLIT_TYPE");
    if(Number(productionWeight)<0||Number(productionWeight)>10_000)return reject("DIGITAL_SPLIT_RANGE");
    // Extra fields on other media and an editorial envelope with no selected
    // programme have no purchase effect. Discard them instead of rejecting
    // valid television, radio and platform decisions from the same response.
    if(medium==="radio"&&weight>0&&r.candidateIds.length){
      const markets=briefMarketKeys(brief),amount=brief.budgetUsd==null?null:brief.budgetUsd*weight/10000;
      // Enforce a feasible multi-plaza selection, not an impossible national
      // inventory promise or a footprint inferred from the study denominator.
      const required=markets.filter(m=>pool.some(c=>radioCoversMarket(c,m,brief)&&(amount==null||c.unitPriceUsd!=null&&(c.minimumSpendUsd??c.unitPriceUsd)<=amount/markets.length)));
      const picked=pool.filter(c=>(r.candidateIds as string[]).includes(c.id));
      if(required.length>1&&required.length<=MAX_STRATEGY_EXECUTIONS&&!required.every(m=>picked.some(c=>radioCoversMarket(c,m,brief))))return reject("RADIO_GEOGRAPHY");
    }
    const relevantSources=new Set(["category-investment",...(bundle.consumption.some(c=>c.medium===medium)?["audience-consumption"]:[]),...pool.flatMap(c=>c.sourceIds),...bundle.audienceReferences.filter(r=>r.medium===medium).map(r=>r.sourceId),...(medium==="ooh"?(bundle.oohMarketReferences??[]).map(r=>r.sourceId):[])]);
    if(!r.evidenceIds.every(id=>relevantSources.has(String(id))))return reject("EVIDENCE_MEDIUM");
    // Explanatory prose cannot inject a metric, guarantee or link. If the model
    // supplied unsafe copy, discard the entire field. Its structured selection
    // still must pass every source, geography, medium and weight check above.
    const safeRationales:Record<MediaGroup,string>={
      television:"Selecciona programas y franjas dentro de las opciones de televisión de tu cuenta.",
      radio:"Combina emisoras según la cobertura solicitada y las opciones de pauta disponibles.",
      ooh:"Organiza la presencia física en las zonas elegidas con los formatos disponibles.",
      press:"Incluye publicaciones y formatos dentro de las opciones de tu cuenta.",
      digital:"Distribuye la inversión digital de acuerdo con el objetivo del brief.",
      influencers:"Selecciona perfiles y productos dentro del catálogo de tu cuenta.",
    };
    used.add(medium);allocations.push({medium,weight,rationale:safeRationale?String(r.rationale).trim():safeRationales[medium],evidenceIds:r.evidenceIds as string[],candidateIds:[...new Set(r.candidateIds as string[])],...(medium==="digital"?{productionWeight:Number(productionWeight)}:{})});
  }
  if(allocations.reduce((n,r)=>n+r.weight,0)!==10_000)return reject("WEIGHT_TOTAL");
  if(safeTextUsed)onSafeText?.();
  return {summary:text(v.summary,1400)?String(v.summary).trim():"La recomendación organiza la inversión entre los medios seleccionados y sus opciones de compra.",allocations,questions};
}
export function strategyAiPayload(brief:StrategyBrief,bundle:StrategyEvidenceBundle,plan:MediaPlan) {
  const allowed=allowedStrategyMedia(brief,bundle);
  const candidates=allowed.flatMap(m=>strategyCandidatePool(bundle,m,brief).slice(0,MODEL_CANDIDATE_LIMIT));
  const candidateIds=new Set(candidates.map(c=>c.id));
  const referenceCases=(bundle.referenceCases??[]).map(c=>({...c,media:c.media.map(m=>({...m,preferredCandidateIds:m.preferredCandidateIds.filter(id=>candidateIds.has(id))}))}));
  const wanted=new Set(["category-investment","audience-consumption",...candidates.flatMap(c=>c.sourceIds),...bundle.audienceReferences.map(r=>r.sourceId),...(bundle.oohMarketReferences??[]).map(r=>r.sourceId)]);
  const availableSourceIds=new Set(bundle.sources.filter(s=>s.use!=="unavailable").map(s=>s.id));
  const allocationOptions=allowed.map(medium=>({medium,
    evidenceIds:[...new Set(["category-investment",...(bundle.consumption.some(c=>c.medium===medium)?["audience-consumption"]:[]),...candidates.filter(c=>c.medium===medium).flatMap(c=>c.sourceIds),...bundle.audienceReferences.filter(r=>r.medium===medium).map(r=>r.sourceId),...(medium==="ooh"?(bundle.oohMarketReferences??[]).map(r=>r.sourceId):[])])].filter(id=>availableSourceIds.has(id)),
    candidateIds:candidates.filter(c=>c.medium===medium).map(c=>c.id),
  }));
  // Use the same integer scale as the response contract, instead of fractional baseline shares.
  const baseline=allocateStrategyBudget(baseWeights(brief,bundle,plan),100).map(r=>({medium:r.medium,weight:Math.round(r.amountUsd!*100)}));
  const outputContract={summary:"Texto breve sin cifras",allocations:[{medium:"Copiar de allocationOptions",weight:"Peso relativo entero entre cero y diez mil; el servidor normaliza la suma y conserva el presupuesto",rationale:"Texto breve sin cifras",evidenceIds:"Entre uno y seis identificadores de evidenceIds del mismo medio",candidateIds:"Entre cero y veinticinco identificadores de candidateIds del mismo medio, solo los necesarios para la cobertura y el presupuesto",productionWeight:"Solo en digital: entero de cero a diez mil que fija la fracción máxima del presupuesto digital para programas editoriales; el resto va a plataformas. Obligatorio si seleccionas programas; cero sin programas."}],questions:[]};
  const mixPolicy={startingPercentages:STARTING_MEDIA_MIX,appliesToAllSix:ALL.every(m=>brief.selectedMedia.includes(m)),adjustable:true,basis:"Política de planificación; no es una medición",adjustUsing:["competencia","consumo comparable de la audiencia","estudios y vigencia","rankings y ratings de cada plaza y público","cobertura","objetivo","presupuesto y tarifas"]};
  return {version:STRATEGY_VERSION,brief,mixPolicy,digitalOptions:{platforms:plan.plan.filter(r=>mediaGroupForLabel(r.label)==="digital"&&r.label!==DIGITAL_PRODUCTIONS_LABEL&&!/whatsapp/i.test(r.label)).map(r=>r.label),requestedPlatforms:brief.digitalPlatforms,programmeBudgetIsExplicit:true},territorialPolicy:{nationalPriority:nationalTerritoryOrder(),nationalFirst:briefMarketKeys(brief).includes("nacional"),coverageBeforeMeasurements:true},allowedMedia:allowed,allocationOptions,outputContract,referenceCases,broadcastPolicy:{tvMinimumProgramsPerChannel:2,tvPlanningBands:["A","AA","AAA"],lateForRelevantAdultsOnly:true,radioMonthlyStationBudgetUsd:{from:1000,to:2000}},evidence:{sources:bundle.sources.filter(s=>wanted.has(s.id)),competition:bundle.competition,categoryMix:bundle.categoryMix,consumption:bundle.consumption,candidates,audienceReferences:bundle.audienceReferences,channelShares:bundle.channelShares,oohMarketReferences:bundle.oohMarketReferences,gaps:bundle.gaps},baseline,rules:["Las cifras y el presupuesto se calculan en el servidor.","La inversión de competidores no mide efectividad.","Las fuentes contextuales no son mediciones del target.","Un tarifario no es un rating y un ranking no es alcance de campaña.","No declares una mezcla óptima universal; compara solo alternativas respaldadas."]};
}
export function buildStrategyReport(brief:StrategyBrief,bundle:StrategyEvidenceBundle,baseline:MediaPlan,options:{advice?:StrategyAdvice|null;aiState:StrategyAiState;model?:string|null;fingerprint:string;generatedAt:string}):StrategyReport {
  const weights=options.advice?.allocations.map(r=>({medium:r.medium,weight:r.weight}))??baseWeights(brief,bundle,baseline);
  const feasible=affordableWeights(weights,bundle,brief.budgetUsd),rows=allocateStrategyBudget(feasible,brief.budgetUsd);
  const gaps=[...bundle.gaps], omitted=weights.filter(w=>w.weight>0&&!rows.some(a=>a.medium===w.medium));
  if(omitted.length)gaps.push(`Sin asignación comprable al nivel de presupuesto calculado: ${omitted.map(r=>mediaGroupLabel(r.medium)).join(", ")}.`);
  if((brief.restrictions??"").trim()&&options.aiState!=="validated"&&options.aiState!=="cached")gaps.push("Las restricciones de texto libre requieren revisión; las exclusiones explícitas de medios sí se aplican.");
  const allocations:StrategyAllocation[]=rows.map(row=>{
    const advice=options.advice?.allocations.find(a=>a.medium===row.medium),pool=strategyCandidatePool(bundle,row.medium,brief);
    const preferred=advice?.candidateIds.map(id=>pool.find(c=>c.id===id)!).filter(Boolean)??[];
    const candidate=[...preferred,...pool].find(c=>row.amountUsd==null||c.unitPriceUsd==null||(c.minimumSpendUsd??c.unitPriceUsd)<=row.amountUsd)??null;
    const seeds=row.medium==="digital"?[]:territorialChoices(pool,preferred,brief,row.amountUsd);
    const choices=row.medium==="television"?diversifyTelevision(pool,preferred,brief,row.amountUsd,bundle.channelShares,MAX_STRATEGY_EXECUTIONS):row.medium==="radio"?diversifyRadio(pool,seeds,brief,row.amountUsd,MAX_STRATEGY_EXECUTIONS):seeds;
    const productionWeight=advice?.productionWeight??0;
    const productionBudget=row.amountUsd==null?null:Math.floor(Math.round(row.amountUsd*100)*productionWeight/10_000)/100;
    let executions=row.medium==="digital"?digitalProductions(preferred,productionBudget):allocateStrategyExecutions(choices,row.amountUsd);
    if(!executions.length&&candidate&&!["television","radio","digital"].includes(row.medium))executions=allocateStrategyExecutions([candidate],row.amountUsd);
    const first=executions[0],purchase=first?{units:first.units,spend:first.referenceSpendUsd,remainder:first.remainderUsd}:referenceQuantity(candidate,row.amountUsd);
    const amountUsd=row.amountUsd==null?null:row.medium==="digital"?row.amountUsd:executions.length?Math.round(executions.reduce((n,e)=>n+(e.amountUsd??0),0)*100)/100:["television","radio"].includes(row.medium)?0:row.amountUsd;
    return {...row,amountUsd,pct:brief.budgetUsd&&amountUsd!=null?amountUsd/brief.budgetUsd:row.pct,executions,rationale:advice?.rationale??baseline.plan.find(r=>mediaGroupForLabel(r.label)===row.medium)?.rationale??"Alternativa documentada para evaluar con el objetivo del brief.",sourceIds:advice?.evidenceIds??[...(bundle.categoryMix.some(c=>c.medium===row.medium)?["category-investment"]:[]),...executions.flatMap(e=>e.candidate.sourceIds)],readiness:row.medium==="digital"?"platform_budget":candidate?.unitPriceUsd!=null?"reference":"needs_quote",candidate:first?.candidate??(["television","radio","digital"].includes(row.medium)?null:candidate),units:first?.units??(["television","radio","digital"].includes(row.medium)?null:purchase.units),referenceSpendUsd:row.medium==="digital"&&!first?null:purchase.spend,remainderUsd:row.medium==="digital"&&!first?null:purchase.remainder};
  });
  const assigned=allocations.reduce((n,a)=>n+(a.amountUsd??0),0),budget=brief.budgetUsd;
  const alternatives=[{id:"evidence",label:"Distribución inicial",weights:baseWeights(brief,bundle,baseline)},{id:"concentrated",label:"Concentración en medios con tarifa compatible",weights:weights.map(w=>({...w,weight:w.weight*(bundle.candidates.some(c=>c.medium===w.medium&&c.unitPriceUsd!=null)?1.5:.65)}))}].map(a=>({id:a.id,label:a.label,allocations:allocateStrategyBudget(affordableWeights(a.weights,bundle,budget),budget)}));
  const reserveUsd=budget==null?null:Math.max(0,Math.round((budget-assigned)*100)/100);
  return {version:STRATEGY_VERSION,generatedAt:options.generatedAt,fingerprint:options.fingerprint,model:options.model??null,aiState:options.aiState,summary:options.advice?.summary??"La propuesta cruza la inversión observada de la categoría, el consumo comparable del público y las opciones de medios documentadas. Las referencias que no reproducen el brief se muestran por separado.",allocations,sources:bundle.sources,competition:bundle.competition,audienceReferences:bundle.audienceReferences,channelShares:bundle.channelShares,gaps:[...new Set(gaps)].slice(0,35),questions:options.advice?.questions??[],candidateCount:bundle.candidates.length,budgetUsd:budget,reserveUsd,alternatives,evaluation:{budgetConserved:budget==null||assigned<=budget+.005&&Math.abs(assigned+(reserveUsd??0)-budget)<.005&&allocations.every(a=>Number.isFinite(a.amountUsd)&&a.amountUsd!>=0),permittedMediaOnly:allocations.every(a=>brief.selectedMedia.includes(a.medium)&&!excludedMedia(brief).includes(a.medium)),measuredReachAvailable:false,comparableConsumption:bundle.consumption.some(c=>c.comparable)}};
}
/** Digital tools such as WhatsApp are destinations, never automatic paid-media budget lines. */
export function applyStrategyPlan(base:MediaPlan,report:StrategyReport,brief:StrategyBrief):MediaPlan {
  const rows:PlanRow[]=[];
  for(const a of report.allocations){
    if(a.medium!=="digital"){rows.push({label:mediaGroupLabel(a.medium),pct:a.pct,amount:a.amountUsd,rationale:a.rationale});continue;}
    let digital=base.plan.filter(r=>mediaGroupForLabel(r.label)==="digital"&&!/whatsapp/i.test(r.label));
    if(brief.digitalPlatforms.length){
      const platformRows:Record<string,string>={meta:"Meta — Facebook e Instagram","google ads":"Google Ads",youtube:"Google — YouTube",tiktok:"TikTok","programmatic dv360":"Programmatic — Ad Mavericks DSP","retail media":"Retail media — plataforma por definir"};
      digital=[...new Set(brief.digitalPlatforms.map(p=>platformRows[normalize(p)]).filter(Boolean))].map(label=>({label,pct:1,amount:null}));
    }
    rows.push(...digitalPlanRows(digital,a,brief.budgetUsd));
  }
  return {...base,plan:rows.sort((a,b)=>b.pct-a.pct),strategySummary:report.summary,strategy:report};
}

/** Recomputes a human-adjusted distribution in cents without reusing old quantities. */
export function customizeStrategyPlan(base:MediaPlan,requested:PlanRow[],budget:number|null):MediaPlan {
  const total=requested.reduce((n,r)=>n+r.pct,0);
  if(!total||!Number.isFinite(total))return {...base,plan:[]};
  const cents=budget==null?null:Math.round(budget*100);
  const rows=requested.map(r=>({...r,pct:r.pct/total,amount:cents==null?null:Math.floor(cents*r.pct/total)/100}));
  let remainder=cents==null?0:cents-rows.reduce((n,r)=>n+Math.round((r.amount??0)*100),0);
  const ranked=[...rows].sort((a,b)=>((cents??0)*b.pct%1)-((cents??0)*a.pct%1)||a.label.localeCompare(b.label));
  for(let i=0;remainder>0;i++,remainder--)ranked[i%ranked.length].amount=Math.round(((ranked[i%ranked.length].amount??0)+.01)*100)/100;
  if(!base.strategy)return {...base,plan:rows};
  const allocations=base.strategy.allocations.map(a=>{
    const selected=rows.filter(r=>mediaGroupForLabel(r.label)===a.medium),requestedAmount=budget==null?null:Math.round(selected.reduce((n,r)=>n+(r.amount??0),0)*100)/100;
    const requestedProduction=budget==null?null:Math.round(selected.filter(r=>r.label===DIGITAL_PRODUCTIONS_LABEL).reduce((n,r)=>n+(r.amount??0),0)*100)/100;
    const executions=a.executions?(a.medium==="digital"?digitalProductions(a.executions.map(e=>e.candidate),requestedProduction):allocateStrategyExecutions(a.executions.map(e=>e.candidate),requestedAmount)):undefined;
    const amountUsd=requestedAmount==null?null:a.medium==="digital"?requestedAmount:a.executions?.length?Math.round((executions??[]).reduce((n,e)=>n+(e.amountUsd??0),0)*100)/100:requestedAmount;
    const first=executions?.[0],candidate=a.medium==="digital"?first?.candidate??null:a.candidate,purchase=first?{units:first.units,spend:first.referenceSpendUsd,remainder:first.remainderUsd}:referenceQuantity(candidate,amountUsd);
    return {...a,candidate,...(executions?{executions}:{}),pct:budget&&amountUsd!=null?amountUsd/budget:selected.reduce((n,r)=>n+r.pct,0),amountUsd,units:purchase.units,referenceSpendUsd:purchase.spend,remainderUsd:purchase.remainder};
  });
  for(const allocation of allocations){
    if(allocation.medium==="digital")continue;
    const group=rows.filter(r=>mediaGroupForLabel(r.label)===allocation.medium),totalPct=group.reduce((n,r)=>n+r.pct,0);let assigned=0;
    for(const [i,row] of group.entries()){
      const cents=allocation.amountUsd==null?null:Math.round(allocation.amountUsd*100);
      const amount=cents==null?null:i===group.length-1?cents-assigned:Math.floor(cents*(totalPct?row.pct/totalPct:0));
      assigned+=amount??0;row.amount=amount==null?null:amount/100;
      row.pct=budget&&row.amount!=null?row.amount/budget:row.pct;
    }
  }
  const customized=rows.some(r=>Math.abs((base.plan.find(p=>p.label===r.label)?.pct??0)-r.pct)>.000001);
  const assigned=allocations.reduce((n,a)=>n+(a.amountUsd??0),0),reserveUsd=budget==null?null:Math.max(0,Math.round((budget-assigned)*100)/100);
  const digital=allocations.find(a=>a.medium==="digital");
  const finalRows=digital?[...rows.filter(r=>mediaGroupForLabel(r.label)!=="digital"),...digitalPlanRows(rows,digital,budget)].sort((a,b)=>b.pct-a.pct):rows;
  return {...base,plan:finalRows,strategy:{...base.strategy,customized,allocations,budgetUsd:budget,reserveUsd,evaluation:{...base.strategy.evaluation,budgetConserved:budget==null||Math.abs(assigned+(reserveUsd??0)-budget)<.005},...(customized?{summary:"Distribución personalizada sobre las fuentes y productos documentados del brief."}:{})}};
}
