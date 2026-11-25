import { briefMarketKeys, normalized, validDate } from "./broadcast-catalog";
import { territoriesOverlap } from "./planning-market";
import type { MediaGroup } from "./media-groups";
import type { StrategyBrief, StrategyCandidate } from "./media-strategy-evidence";

export const CASE_FORMATS = ["broadcast_spot", "broadcast_mention", "broadcast_package", "news", "rotative", "billboard_fixed", "billboard_led", "totem", "mupi", "mural", "mobile", "transit", "digital_circuit", "activation", "print", "digital_platform", "digital_program", "creator"] as const;
type CaseFormat = typeof CASE_FORMATS[number];
export type PlanningCaseDefinition = {
  version: 1; basis: "approved_plan" | "executed_plan" | "reference_plan";
  periodStart: string; periodEnd: string; approvedMonths: string[];
  completeBudget?: boolean;
  categoryKeywords: string[];
  lines: {medium:MediaGroup;provider:string|null;format:CaseFormat;marketKeys:string[];spendUsd:number|null;quantity:number|null}[];
};
export type PlanningCaseRecord = {id:string;companyId:string|null;clientId:string|null;sharing:"client"|"method";definition:unknown};
export type PlanningCaseContext = {
  id: string; relationship: "same_client" | "structural_reference";
  basis: PlanningCaseDefinition["basis"]; approvedMonthCount: number; durationDays: number;
  clientApprovedMonthCount: number;
  budgetScale: number | null;
  media: {medium:MediaGroup;investmentSharePct:number|null;providerCount:number|null;formats:CaseFormat[];territoryCount:number;preferredCandidateIds:string[];executionPatterns:{format:CaseFormat;providerCount:number|null;unitsPerCampaign:number|null;unitsPer30Days:number|null;unitsPerProviderPer30Days:number|null}[]}[];
};
const MEDIA:MediaGroup[]=["television","radio","ooh","press","digital","influencers"];
const number=(v:unknown,max:number)=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=max;
const strings=(v:unknown,max:number,length:number)=>Array.isArray(v)&&v.length<=max&&v.every(s=>typeof s==="string"&&s.length>0&&s.length<=length);
// Regional affiliates with the same name are separate signals. Television
// retains a channel count; programme editions remain in the current catalogue.
const providerIdentity=(line:PlanningCaseDefinition["lines"][number])=>line.provider==null?null:JSON.stringify([normalized(line.provider),line.medium==="radio"?[...new Set(line.marketKeys.map(normalized))].sort():[]]);
/** Curated structured facts only. Emails, attachments, approval messages,
 * client names and arbitrary notes never enter the recommendation prompt. */
export function parsePlanningCase(value:unknown):PlanningCaseDefinition|null {
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const d=value as PlanningCaseDefinition;
  if(d.version!==1||!["approved_plan","executed_plan","reference_plan"].includes(d.basis)||!validDate(d.periodStart)||!validDate(d.periodEnd)||d.periodEnd<d.periodStart||!strings(d.approvedMonths,120,7)||new Set(d.approvedMonths).size!==d.approvedMonths.length||d.approvedMonths.some(m=>!/^\d{4}-(0[1-9]|1[0-2])$/.test(m))||!strings(d.categoryKeywords,20,80)||!Array.isArray(d.lines)||!d.lines.length||d.lines.length>300)return null;
  if(d.basis==="approved_plan"&&!d.approvedMonths.length)return null;
  if(d.completeBudget!==undefined&&typeof d.completeBudget!=="boolean")return null;
  if(d.approvedMonths.some(m=>m<d.periodStart.slice(0,7)||m>d.periodEnd.slice(0,7)))return null;
  if(d.lines.some(l=>!l||!MEDIA.includes(l.medium)||l.provider!==null&&(typeof l.provider!=="string"||!l.provider.trim()||l.provider.length>160)||!CASE_FORMATS.includes(l.format)||!strings(l.marketKeys,30,80)||!l.marketKeys.length||l.spendUsd!==null&&!number(l.spendUsd,1e8)||l.quantity!==null&&!number(l.quantity,1e7)))return null;
  return {version:1,basis:d.basis,periodStart:d.periodStart,periodEnd:d.periodEnd,approvedMonths:[...d.approvedMonths],completeBudget:d.completeBudget??true,categoryKeywords:[...d.categoryKeywords],lines:d.lines.map(l=>({medium:l.medium,provider:l.provider,format:l.format,marketKeys:[...l.marketKeys],spendUsd:l.spendUsd,quantity:l.quantity}))};
}
/** A prior plan informs choices, not current prices or effectiveness. A long
 * approved relationship is useful even when no performance report exists. */
export function selectPlanningCases(records:PlanningCaseRecord[],brief:StrategyBrief,candidates:StrategyCandidate[],scope:{companyId?:string|null;clientId?:string|null}):PlanningCaseContext[] {
  const wanted=new Set(brief.selectedMedia),markets=briefMarketKeys(brief),category=normalized(brief.keyword);
  const sameClient=(record:PlanningCaseRecord)=>record.sharing==="client"&&Boolean(scope.companyId)&&record.companyId===scope.companyId&&(record.clientId??null)===(scope.clientId??null);
  const approvedMonths=new Set(records.filter(sameClient).flatMap(r=>{const d=parsePlanningCase(r.definition);return d?.lines.some(l=>wanted.has(l.medium))?d.approvedMonths:[];}));
  const ranked=records.flatMap(record=>{
    const d=parsePlanningCase(record.definition);if(!d)return [];
    const same=sameClient(record);
    const generic=record.sharing==="method"&&record.companyId===null&&record.clientId===null;
    if(!same&&!generic)return [];
    const applicable=d.lines.filter(l=>wanted.has(l.medium));if(!applicable.length)return [];
    const knownSpend=d.completeBudget!==false&&d.lines.every(l=>l.spendUsd!==null),total=knownSpend?d.lines.reduce((n,l)=>n+l.spendUsd!,0):0;
    const duration=(Date.parse(d.periodEnd)-Date.parse(d.periodStart))/86400000+1;
    const briefDuration=validDate(brief.startDate)&&validDate(brief.endDate)?(Date.parse(brief.endDate)-Date.parse(brief.startDate))/86400000+1:30;
    const scale=total>0&&brief.budgetUsd!=null?(brief.budgetUsd/Math.max(1,briefDuration))/(total/duration):null;
    const media=MEDIA.filter(m=>applicable.some(l=>l.medium===m)).map(medium=>{
      const rows=applicable.filter(l=>l.medium===medium),providers=new Set(rows.flatMap(l=>l.provider?[normalized(l.provider)]:[]));
      const providerCount=rows.every(l=>l.provider!==null)?new Set(rows.map(providerIdentity)).size:null;
      // Same-client preferences may point to current authorized SKUs. Generic
      // case studies never copy another account's providers or prices.
      const preferredCandidateIds=same?candidates.filter(c=>c.medium===medium&&providers.has(normalized(c.provider))&&rows.some(l=>l.provider&&normalized(l.provider)===normalized(c.provider)&&l.marketKeys.some(k=>(c.coverageKeys??c.marketKeys??[]).some(t=>territoriesOverlap(k,t))))).slice(0,12).map(c=>c.id):[];
      const formats=[...new Set(rows.map(l=>l.format))];
      const executionPatterns=formats.map(format=>{
        const group=rows.filter(l=>l.format===format),providerCount=group.every(l=>l.provider!==null)?new Set(group.map(providerIdentity)).size:null;
        // Counts are purchase units in the documented format, never historical
        // audience results. Current SKUs still own every price and availability.
        const units=group.every(l=>l.quantity!==null)?group.reduce((n,l)=>n+l.quantity!,0):null;
        const insertion=["television","radio"].includes(medium)&&["broadcast_spot","broadcast_mention","news","rotative"].includes(format);
        return {format,providerCount,unitsPerCampaign:units,unitsPer30Days:units==null||!insertion?null:Math.round(units/duration*30*100)/100,unitsPerProviderPer30Days:units==null||!providerCount||!insertion?null:Math.round(units/providerCount/duration*30*100)/100};
      });
      return {medium,investmentSharePct:knownSpend&&total>0?Math.round(rows.reduce((n,l)=>n+l.spendUsd!,0)/total*10000)/100:null,providerCount,formats,territoryCount:new Set(rows.flatMap(l=>l.marketKeys.map(normalized))).size,preferredCandidateIds,executionPatterns};
    });
    const marketFit=applicable.some(l=>l.marketKeys.some(k=>markets.some(m=>territoriesOverlap(k,m))));
    const categoryFit=d.categoryKeywords.some(k=>category.includes(normalized(k)));
    const score=(same?1000:0)+Math.min(24,d.approvedMonths.length)*5+(d.basis==="executed_plan"?5:0)+media.length*10+(marketFit?8:0)+(categoryFit?12:0)+(scale!=null?Math.max(0,10-Math.abs(Math.log2(Math.max(.001,scale)))*3):0);
    return [{record,score,periodEnd:d.periodEnd,context:{id:"",relationship:same?"same_client":"structural_reference",basis:d.basis,approvedMonthCount:d.approvedMonths.length,clientApprovedMonthCount:same?approvedMonths.size:0,durationDays:duration,budgetScale:scale==null?null:Math.round(scale*100)/100,media} as PlanningCaseContext}];
  }).sort((a,b)=>b.score-a.score||b.periodEnd.localeCompare(a.periodEnd)||a.record.id.localeCompare(b.record.id));
  const structural=brief.selectedMedia.length>1?ranked.find(r=>r.context.relationship==="structural_reference"&&r.context.media.length>1):undefined;
  const selected=structural?[...ranked.filter(r=>r!==structural).slice(0,3),structural]:ranked.slice(0,4);
  return selected.map((r,i)=>({...r.context,id:`case-${i+1}`}));
}
