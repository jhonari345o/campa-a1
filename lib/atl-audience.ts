import { normalized, validDate } from "./broadcast-catalog";
import { planningStudyBrief } from "./planning-market";
import type { StrategyBrief } from "./media-strategy-evidence";

export type PressAudience = {
 id:string; provider:string; sex:"all"|"male"|"female"; ageMin:number; ageMax:number; nse:string;
 universe:number; audience:number; reachPct:number; exclusiveReachPct:number; rank:number;
 periodStart:string; periodEnd:string; marketKeys:string[]; row:number; derived:boolean;
};
export type OohObservation = {
 id:string; city:string; street:string; intersection:string; sector:string; provider:string; format:string;
 height:number|null; width:number|null; latitude:number|null; longitude:number|null; observedOn:string|null;
 rank:number|null; score:number|null; circulation:number|null; estimatedImpacts:number|null;
 impactPeriod:"day"|"unspecified"; originalImageCode:string; row:number;
};
export type AtlAudienceCatalog = {press:PressAudience[];ooh:OohObservation[];error?:string};
export type OohMarketReference = {sourceId:string;city:string;location:string;format:string;rank:number|null;score:number|null;estimatedImpacts:number|null;impactPeriod:"day"|"unspecified";observedOn:string|null};
const number=(v:unknown,min=0,max=1e12):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>=min&&v<=max;
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==="object"&&!Array.isArray(v);
/** Fail closed on malformed imports; raw workbook fields never become instructions. */
export function parseAtlAudience(value:unknown,medium:"press"|"ooh"):PressAudience[]|OohObservation[] {
 if(!object(value)||value.version!==1||value.medium!==medium||!Array.isArray(value.rows)||value.rows.length>10000)throw new Error("INVALID_ATL_SOURCE");
 const ids=new Set<string>();
 for(const r of value.rows){
  if(!object(r)||typeof r.id!=="string"||!/^[a-z0-9-]{1,150}$/.test(r.id)||ids.has(r.id)||!number(r.row,1,100000))throw new Error("INVALID_ATL_ROW");
  ids.add(r.id);
  if(medium==="press"){
   if(typeof r.provider!=="string"||r.provider.length>200||!["all","male","female"].includes(String(r.sex))||r.nse!=="all"||!number(r.ageMin,0,99)||!number(r.ageMax,r.ageMin,99)||!number(r.universe,1)||!number(r.audience,0,r.universe)||!number(r.reachPct,0,100)||!number(r.exclusiveReachPct,0,r.reachPct)||!number(r.rank,1,10000)||!validDate(String(r.periodStart))||!validDate(String(r.periodEnd))||String(r.periodStart)>String(r.periodEnd)||!Array.isArray(r.marketKeys)||!r.marketKeys.length||r.marketKeys.length>25||r.marketKeys.some(k=>typeof k!=="string"||k.length>100)||typeof r.derived!=="boolean")throw new Error("INVALID_PRESS_OBSERVATION");
   if(Math.abs(r.audience/r.universe*100-r.reachPct)>.01)throw new Error("PRESS_UNIVERSE_MISMATCH");
  }else{
   for(const field of ["city","street","intersection","sector","provider","format","originalImageCode"])if(typeof r[field]!=="string"||(r[field] as string).length>500)throw new Error("INVALID_OOH_TEXT");
   if(r.observedOn!==null&&!validDate(String(r.observedOn))||!["day","unspecified"].includes(String(r.impactPeriod)))throw new Error("INVALID_OOH_PERIOD");
   for(const field of ["height","width","rank","score","circulation","estimatedImpacts"])if(r[field]!==null&&!number(r[field]))throw new Error("INVALID_OOH_METRIC");
   if(r.latitude!==null&&!number(r.latitude,-90,90)||r.longitude!==null&&!number(r.longitude,-180,180))throw new Error("INVALID_OOH_COORDINATE");
  }
 }
 return value.rows as PressAudience[]|OohObservation[];
}
export function pressAudienceApplies(s:PressAudience,brief:StrategyBrief,asOf:string){
 const age=normalized(brief.ageRange),expected=s.ageMax===99?String(s.ageMin):`${s.ageMin} ${s.ageMax}`;
 const sex=s.sex==="all"?"todas las personas":s.sex==="male"?"hombres":"mujeres";
 return brief.audienceType==="B2C"&&(age===expected||age===`personas ${expected}`)&&normalized(brief.sex)===sex&&normalized(brief.socioeconomic)==="todos los nse"&&Boolean(planningStudyBrief(s.marketKeys,brief))&&validDate(brief.startDate)&&validDate(asOf)&&s.periodEnd<=brief.startDate&&s.periodEnd<=asOf&&Date.parse(brief.startDate)-Date.parse(s.periodEnd)<=366*86400000;
}
const publicationAliases:Record<string,string>={"metro ecuador":"metro","diario el universo":"el universo","diario expreso":"expreso","diario extra":"extra"};
export const pressPublicationKey=(name:string)=>publicationAliases[normalized(name)]??normalized(name);
/** Per-edition readership; additional insertions do not imply new readers. */
export function pressObservationFor(provider:string,format:string,rows:PressAudience[],brief:StrategyBrief,asOf:string){
 const kind=normalized(format);
 if(/\bcpm\b|digital|\bweb\b|\bvideo\b|\bstory\b|\bstories\b|facebook|instagram/.test(kind)||/banner/.test(kind)&&!/impres|portada|pagina/.test(kind))return undefined;
 return rows.filter(s=>pressPublicationKey(s.provider)===pressPublicationKey(provider)&&pressAudienceApplies(s,brief,asOf)).sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd)||a.id.localeCompare(b.id))[0];
}
/** Historical traffic studies inform territory research, never current inventory reach. */
export function oohMarketReferences(rows:OohObservation[],brief:StrategyBrief,asOf:string):OohObservation[]{
 const markets=new Map<string,OohObservation[]>();
 for(const r of rows){
  if(!planningStudyBrief([normalized(r.city)],brief)||r.observedOn&&r.observedOn>asOf)continue;
  const city=normalized(r.city),observations=markets.get(city)??[];observations.push(r);markets.set(city,observations);
 }
 const result:OohObservation[]=[];
 for(const city of [...markets.keys()].sort()){
  const seen=new Set<string>();let count=0;
  for(const r of markets.get(city)!.sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity)||a.id.localeCompare(b.id))){
   const key=JSON.stringify([normalized(r.street),normalized(r.intersection),r.latitude,r.longitude,normalized(r.format)]);
   if(seen.has(key))continue;seen.add(key);result.push(r);if(++count===6)break;
  }
 }
 return result;
}
