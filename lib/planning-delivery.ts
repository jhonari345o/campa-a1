import { briefMarketKeys, normalized, validDate, type BroadcastBrief } from "./broadcast-catalog";
import type { MediaGroup } from "./media-groups";
import { combineMediaDelivery, deliverySelectionKey, projectContactThresholds, reachAtGrps, type DeliveryObservation, type DeliverySelection, type DeliverySummary, type ReachCurve } from "./media-delivery";

export type PlanningCurveModel = {
  universe: number; marketKeys: string[]; marketWeights: Record<string, number>;
  target: {ageMin:number;ageMax:number;sex:string;nse:string}; curves: ReachCurve[];
  programs?: {key:string;provider:string;program:string;hour:string;ratings:Record<string,number>;productKeys:string[];offerIds:string[]}[];
  channelShares?: {channel:string;sharePct:number;periodStart:string;periodEnd:string}[];
};
export type RatedDeliveryLine = {id:string;medium:MediaGroup;quantity:number;amountCents:number;ratingPct:number|null;ratingMarketKeys:string[];studyEnd:string|null};

/** Project an authorized selection using current compatible ratings and the supplied historical calibration. */
export function projectPlanningDelivery(brief:BroadcastBrief,lines:RatedDeliveryLine[],model:PlanningCurveModel):DeliverySummary|null {
  if(!validDate(brief.startDate)||!validDate(brief.endDate)||brief.endDate<brief.startDate||!Number.isFinite(model.universe)||model.universe<=0)return null;
  if(model.target.ageMin!==18||model.target.ageMax!==99||model.target.sex!=="all"||model.target.nse!=="all"||!["18","18 99","personas 18"].includes(normalized(brief.ageRange??""))||normalized(brief.sex??"")!=="todas las personas"||normalized(brief.socioeconomic??"")!=="todos los nse"||brief.audienceType!=="B2C")return null;
  const keys=[...new Set(briefMarketKeys(brief).map(key=>key.replace(/^provincia de /, "")).map(key=>key==="guayas"?"guayaquil":key==="pichincha"?"quito":key))].sort();
  // Province briefs retain the narrower city label of the calibration.
  if(!keys.length||keys.some(key=>!model.marketKeys.includes(key)))return null;
  const scopeWeight=keys.reduce((sum,key)=>sum+(model.marketWeights[key]??0),0);
  if(!Number.isFinite(scopeWeight)||scopeWeight<=0||scopeWeight>1.000001)return null;
  const universe=model.universe*scopeWeight;
  const media=[...new Set(lines.map(l=>l.medium))];
  if(!media.length)return null;
  const geography=keys.join(",");
  const selection:DeliverySelection={context:{startDate:brief.startDate,endDate:brief.endDate,geography,audience:"18+|all|all"},media:media.map(medium=>({medium,items:lines.filter(l=>l.medium===medium).map(({id,quantity,amountCents})=>({id,quantity,amountCents}))}))};
  const observations:DeliveryObservation[]=[];
  for(const medium of media){
    const curve=model.curves.find(c=>c.medium===medium),selected=lines.filter(l=>l.medium===medium);
    if(!curve||selected.some(l=>l.ratingPct==null||!Number.isFinite(l.ratingPct)||l.ratingPct<0||l.ratingPct>100||!Number.isSafeInteger(l.quantity)||l.quantity<1||!validDate(l.studyEnd??"")||l.studyEnd!>brief.startDate!||Date.parse(brief.startDate!)-Date.parse(l.studyEnd!)>366*86400000))continue;
    let grps=0,compatible=true;const covered=new Set<string>();
    for(const line of selected){
      const scope=[...new Set(line.ratingMarketKeys.map(normalized))].sort();
      const sameScope=scope.join(",")===geography;
      const weight=sameScope?1:scope.length===1&&keys.includes(scope[0])?model.marketWeights[scope[0]]/scopeWeight:undefined;
      if(weight==null||!Number.isFinite(weight)||weight<=0||weight>1){compatible=false;break;}
      scope.forEach(key=>covered.add(key));
      grps+=line.quantity*line.ratingPct!*weight;
    }
    if(!compatible)continue;
    const modeledReach=reachAtGrps(curve,grps);
    const cap=Math.min(100,[...covered].reduce((sum,key)=>sum+(model.marketWeights[key]??0),0)/scopeWeight*100);
    const reach=modeledReach==null?null:Math.min(cap,modeledReach),thresholds=reach==null?null:projectContactThresholds(reach,grps);
    if(reach==null||!thresholds)continue;
    observations.push({medium,selectionKey:deliverySelectionKey(selection,medium),universe,universeId:`planning-adults-${geography}`,targetId:"18+|all|all",geographyId:geography,periodId:`${brief.startDate}/${brief.endDate}`,reach1Pct:reach,...thresholds,impressions:grps*universe/100,evidenceId:"owner-authorized-historical-curve-projection",approved:true});
  }
  const {summary}=combineMediaDelivery(selection,observations);
  return summary.media.length?{...summary,scopeLabel:`Personas de 18 años o más · ${keys.map(key=>key==="guayaquil"?"Guayaquil":"Quito").join(" y ")}`}:null;
}
