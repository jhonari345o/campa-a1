import { mediaGroupForLabel, type MediaGroup } from "./media-groups";
import { mediaGroupLabel } from "./plan-optimizer";
import type { MediaPlan, PlanRow } from "./planner";
import type { StrategyBrief, StrategyCandidate, StrategyEvidenceBundle } from "./media-strategy-evidence";

export const STRATEGY_VERSION = "2026-11-01.2";
export type StrategyAiState = "validated" | "cached" | "not_configured" | "quota" | "unavailable" | "rejected";
export type StrategyAdvice = {
  summary: string;
  allocations: { medium: MediaGroup; weight: number; rationale: string; evidenceIds: string[]; candidateIds: string[] }[];
  questions: string[];
};
export type StrategyAllocation = {
  medium: MediaGroup; pct: number; amountUsd: number | null; rationale: string; sourceIds: string[];
  readiness: "reference" | "needs_quote" | "platform_budget";
  candidate: StrategyCandidate | null; units: number | null; referenceSpendUsd: number | null; remainderUsd: number | null;
};
export type StrategyReport = {
  customized?: boolean;
  version: string; generatedAt: string; fingerprint: string; model: string | null; aiState: StrategyAiState;
  summary: string; allocations: StrategyAllocation[]; sources: StrategyEvidenceBundle["sources"];
  competition: StrategyEvidenceBundle["competition"]; gaps: string[]; questions: string[];
  audienceReferences: StrategyEvidenceBundle["audienceReferences"];
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
  const units=Math.min(10_000,Math.floor(budgetCents/unitCents));
  const spend=Math.round(units*price*100)/100;
  return {units,spend,remainder:Math.round((amount-spend)*100)/100};
}
function baseWeights(brief:StrategyBrief,bundle:StrategyEvidenceBundle,plan:MediaPlan) {
  const allowed=allowedStrategyMedia(brief,bundle);
  return allowed.map(m=>{
    const rows=plan.plan.filter(r=>mediaGroupForLabel(r.label)===m), prior=rows.reduce((n,r)=>n+r.pct,0);
    const category=bundle.categoryMix.find(x=>x.medium===m)?.share??0, consumption=bundle.consumption.find(x=>x.medium===m&&x.comparable)?.value??0;
    // A candidate without category pressure is a documented option, not measured category demand.
    return {medium:m,weight:prior>0?prior:category>0?category:consumption>0?consumption/100:0.08};
  });
}
function candidateSort(a:StrategyCandidate,b:StrategyCandidate,brief?:Pick<StrategyBrief,"objective"|"priority">) {
  // Compare ratings only inside the very same study/cohort, never across methodologies.
  const ar=a.metrics.find(m=>m.label==="Rating"),br=b.metrics.find(m=>m.label==="Rating");
  if(a.unitPriceUsd!=null&&b.unitPriceUsd==null)return -1;
  if(b.unitPriceUsd!=null&&a.unitPriceUsd==null)return 1;
  const sameCohort=ar&&br&&(ar.sourceId===br.sourceId||a.cohort&&a.cohort===b.cohort)&&ar.unit===br.unit&&a.unit===b.unit;
  if(sameCohort&&ar!.value>0&&br!.value>0){
    if(/eficiencia|costo/.test(normalize(`${brief?.objective??""} ${brief?.priority??""}`))&&a.unitPriceUsd!=null&&b.unitPriceUsd!=null){const difference=a.unitPriceUsd/ar!.value-b.unitPriceUsd/br!.value;if(difference)return difference;}
    if(ar!.value!==br!.value)return br!.value-ar!.value;
  }
  return (a.unitPriceUsd??Infinity)-(b.unitPriceUsd??Infinity)||a.id.localeCompare(b.id);
}
export function strategyCandidatePool(bundle:StrategyEvidenceBundle,medium:MediaGroup,brief?:Pick<StrategyBrief,"objective"|"priority">) {
  const all=bundle.candidates.filter(c=>c.medium===medium);
  if(medium==="radio") {
    // Stable cohort selection keeps the latest independent study intact.
    const cohorts=new Map<string,StrategyCandidate[]>();
    for(const c of all){const id=c.sourceIds.find(s=>s.startsWith("radio-study:"));if(id)cohorts.set(id,[...(cohorts.get(id)??[]),c]);}
    const chosen=[...cohorts].sort((a,b)=>{
      const sourceA=bundle.sources.find(s=>s.id===a[0]),sourceB=bundle.sources.find(s=>s.id===b[0]);
      return (sourceB?.period??"").localeCompare(sourceA?.period??"")||b[1].length-a[1].length||a[0].localeCompare(b[0]);
    })[0]?.[1]??[];
    return chosen.sort((a,b)=>candidateSort(a,b,brief));
  }
  if(medium==="television"){
    const measured=all.filter(c=>c.cohort&&c.metrics.some(m=>m.label==="Rating"));
    const cohorts=[...new Set(measured.map(c=>c.cohort!))].sort((a,b)=>{
      const period=(key:string)=>{const c=measured.find(c=>c.cohort===key);return bundle.sources.find(s=>c?.sourceIds.includes(s.id)&&s.kind==="rating")?.period.slice(-10)??"";};
      return period(b).localeCompare(period(a))||a.localeCompare(b);
    });
    if(cohorts.length)return [...measured.filter(c=>c.cohort===cohorts[0]).sort((a,b)=>candidateSort(a,b,brief)),...all.filter(c=>!measured.includes(c)).sort((a,b)=>candidateSort(a,b,brief))];
  }
  return all.sort((a,b)=>candidateSort(a,b,brief));
}
function affordableWeights(weights:{medium:MediaGroup;weight:number}[],bundle:StrategyEvidenceBundle,budget:number|null) {
  let result=weights;
  for(let i=0;i<ALL.length;i++) {
    const allocations=allocateStrategyBudget(result,budget);
    const blocked=new Set(allocations.filter(a=>{
      if(a.amountUsd==null)return false;
      const pool=strategyCandidatePool(bundle,a.medium),priced=pool.filter(c=>c.unitPriceUsd!=null&&c.unitPriceUsd>0);
      return priced.length>0&&!priced.some(c=>(c.minimumSpendUsd??c.unitPriceUsd!)<=a.amountUsd!);
    }).map(a=>a.medium));
    if(!blocked.size)break;
    result=result.filter(r=>!blocked.has(r.medium));
  }
  return result;
}
/** JSON is an instruction proposal. Server-owned sources, metrics, rates and arithmetic are immutable. */
export function parseStrategyAdvice(raw:string,brief:StrategyBrief,bundle:StrategyEvidenceBundle):StrategyAdvice|null {
  if(typeof raw!=="string"||raw.length>24_000)return null;
  let v:Record<string,unknown>;try{v=obj(JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,"").trim()));}catch{return null;}
  const text=(s:unknown,max:number)=>typeof s==="string"&&s.trim().length>0&&s.length<=max&&!/[<>]|https?:|www\.|garantiz/i.test(s)&&!/[\d%$€]/.test(s.replace(/\bB2[BC]\b/gi,""));
  if(!text(v.summary,1400)||!Array.isArray(v.allocations)||!v.allocations.length||v.allocations.length>6||!Array.isArray(v.questions)||v.questions.length>5||!v.questions.every(q=>text(q,400)))return null;
  const allowed=new Set(allowedStrategyMedia(brief,bundle)),sourceIds=new Set(bundle.sources.filter(s=>s.use!=="unavailable").map(s=>s.id)),used=new Set<string>();
  const allocations:StrategyAdvice["allocations"]=[];
  for(const value of v.allocations){const r=obj(value),medium=r.medium as MediaGroup;
    if(!allowed.has(medium)||used.has(medium)||!Number.isInteger(r.weight)||Number(r.weight)<0||Number(r.weight)>10_000||!text(r.rationale,700)||!Array.isArray(r.evidenceIds)||!r.evidenceIds.length||r.evidenceIds.length>6||!r.evidenceIds.every(id=>typeof id==="string"&&sourceIds.has(id))||!Array.isArray(r.candidateIds)||r.candidateIds.length>3)return null;
    const pool=strategyCandidatePool(bundle,medium,brief).slice(0,8);
    if(!r.candidateIds.every(id=>typeof id==="string"&&pool.some(c=>c.id===id)))return null;
    const relevantSources=new Set(["category-investment",...(bundle.consumption.some(c=>c.medium===medium)?["audience-consumption"]:[]),...pool.flatMap(c=>c.sourceIds),...bundle.audienceReferences.filter(r=>r.medium===medium).map(r=>r.sourceId)]);
    if(!r.evidenceIds.every(id=>relevantSources.has(String(id))))return null;
    used.add(medium);allocations.push({medium,weight:Number(r.weight),rationale:String(r.rationale).trim(),evidenceIds:r.evidenceIds as string[],candidateIds:[...new Set(r.candidateIds as string[])]});
  }
  if(allocations.reduce((n,r)=>n+r.weight,0)!==10_000)return null;
  return {summary:String(v.summary).trim(),allocations,questions:v.questions as string[]};
}
export function strategyAiPayload(brief:StrategyBrief,bundle:StrategyEvidenceBundle,plan:MediaPlan) {
  const allowed=allowedStrategyMedia(brief,bundle);
  const candidates=allowed.flatMap(m=>strategyCandidatePool(bundle,m,brief).slice(0,8));
  const wanted=new Set(["category-investment","audience-consumption",...candidates.flatMap(c=>c.sourceIds),...bundle.audienceReferences.map(r=>r.sourceId)]);
  return {version:STRATEGY_VERSION,brief,allowedMedia:allowed,evidence:{sources:bundle.sources.filter(s=>wanted.has(s.id)),competition:bundle.competition,categoryMix:bundle.categoryMix,consumption:bundle.consumption,candidates,audienceReferences:bundle.audienceReferences,gaps:bundle.gaps},baseline:baseWeights(brief,bundle,plan),rules:["Las cifras y el presupuesto se calculan en el servidor.","La inversión de competidores no mide efectividad.","Las fuentes contextuales no son mediciones del target.","Un tarifario no es un rating y un ranking no es alcance de campaña.","No declares una mezcla óptima universal; compara solo alternativas respaldadas."]};
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
    const purchase=referenceQuantity(candidate,row.amountUsd);
    return {...row,rationale:advice?.rationale??baseline.plan.find(r=>mediaGroupForLabel(r.label)===row.medium)?.rationale??"Alternativa documentada para evaluar con el objetivo del brief.",sourceIds:advice?.evidenceIds??[...(bundle.categoryMix.some(c=>c.medium===row.medium)?["category-investment"]:[]),...(candidate?.sourceIds??[])],readiness:row.medium==="digital"?"platform_budget":candidate?.unitPriceUsd!=null?"reference":"needs_quote",candidate,units:purchase.units,referenceSpendUsd:purchase.spend,remainderUsd:purchase.remainder};
  });
  const assigned=allocations.reduce((n,a)=>n+(a.amountUsd??0),0),budget=brief.budgetUsd;
  const alternatives=[{id:"evidence",label:"Referencia de categoría y público",weights:baseWeights(brief,bundle,baseline)},{id:"concentrated",label:"Concentración en medios con tarifa compatible",weights:weights.map(w=>({...w,weight:w.weight*(bundle.candidates.some(c=>c.medium===w.medium&&c.unitPriceUsd!=null)?1.5:.65)}))}].map(a=>({id:a.id,label:a.label,allocations:allocateStrategyBudget(affordableWeights(a.weights,bundle,budget),budget)}));
  const reserveUsd=budget==null?null:Math.max(0,Math.round((budget-assigned)*100)/100);
  return {version:STRATEGY_VERSION,generatedAt:options.generatedAt,fingerprint:options.fingerprint,model:options.model??null,aiState:options.aiState,summary:options.advice?.summary??"La propuesta cruza la inversión observada de la categoría, el consumo comparable del público y las opciones de medios documentadas. Las referencias que no reproducen el brief se muestran por separado.",allocations,sources:bundle.sources,competition:bundle.competition,audienceReferences:bundle.audienceReferences,gaps:[...new Set(gaps)].slice(0,35),questions:options.advice?.questions??[],candidateCount:bundle.candidates.length,budgetUsd:budget,reserveUsd,alternatives,evaluation:{budgetConserved:budget==null||assigned<=budget+.005&&Math.abs(assigned+(reserveUsd??0)-budget)<.005&&allocations.every(a=>Number.isFinite(a.amountUsd)&&a.amountUsd!>=0),permittedMediaOnly:allocations.every(a=>brief.selectedMedia.includes(a.medium)&&!excludedMedia(brief).includes(a.medium)),measuredReachAvailable:false,comparableConsumption:bundle.consumption.some(c=>c.comparable)}};
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
    if(!digital.length)digital=[{label:"Digital",pct:1,amount:null}];
    const total=digital.reduce((n,r)=>n+r.pct,0)||1,cents=a.amountUsd==null?null:Math.round(a.amountUsd*100);let assigned=0;
    for(const [i,r] of digital.entries()){const amountCents=cents==null?null:i===digital.length-1?cents-assigned:Math.floor(cents*r.pct/total);assigned+=amountCents??0;rows.push({label:r.label,pct:a.pct*r.pct/total,amount:amountCents==null?null:amountCents/100,rationale:a.rationale});}
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
    const selected=rows.filter(r=>mediaGroupForLabel(r.label)===a.medium),amountUsd=budget==null?null:Math.round(selected.reduce((n,r)=>n+(r.amount??0),0)*100)/100;
    const purchase=referenceQuantity(a.candidate,amountUsd);
    return {...a,pct:selected.reduce((n,r)=>n+r.pct,0),amountUsd,units:purchase.units,referenceSpendUsd:purchase.spend,remainderUsd:purchase.remainder};
  });
  const customized=rows.some(r=>Math.abs((base.plan.find(p=>p.label===r.label)?.pct??0)-r.pct)>.000001);
  return {...base,plan:rows,strategy:{...base.strategy,customized,allocations,...(customized?{summary:"Distribución personalizada sobre las fuentes y productos documentados del brief."}:{})}};
}
