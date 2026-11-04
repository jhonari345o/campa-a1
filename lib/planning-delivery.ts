import { briefMarketKeys, normalized, validDate, type BroadcastBrief } from "./broadcast-catalog";
import type { MediaGroup } from "./media-groups";
import { projectPressEditionReach, type PressEditionReach } from "./press-delivery";
import { combineMediaDelivery, deliverySelectionKey, projectContactThresholds, reachAtGrps, type DeliveryObservation, type DeliverySelection, type DeliverySummary, type ReachCurve } from "./media-delivery";

export type PlanningCurveModel = {
  universe: number; marketKeys: string[]; marketWeights: Record<string, number>;
  target: {ageMin:number;ageMax:number;sex:string;nse:string}; curves: ReachCurve[];
  programs?: {key:string;provider:string;program:string;hour:string;ratings:Record<string,number>;productKeys:string[];offerIds:string[]}[];
  channelShares?: {channel:string;sharePct:number;periodStart:string;periodEnd:string}[];
};
export type RatedDeliveryLine = {id:string;medium:MediaGroup;quantity:number;amountCents:number;ratingPct:number|null;ratingMarketKeys:string[];studyEnd:string|null;providerKey?:string;programmeKey?:string;pressReach?:PressEditionReach};

/** A campaign-wide curve cannot establish a single channel's or programme's reach.
 * Requiring a varied schedule is an applicability guard, not a duplication model. */
export function matchesCurveScope(curve:ReachCurve, lines:RatedDeliveryLine[]):boolean {
  if(curve.scope!=="multi_channel")return true;
  const channels=new Map<string,Set<string>>();
  for(const line of lines){
    if(!line.providerKey||!line.programmeKey)return false;
    const programmes=channels.get(line.providerKey)??new Set<string>();
    programmes.add(line.programmeKey);channels.set(line.providerKey,programmes);
  }
  // Additional channels may have only one measured programme. They must not
  // erase a qualifying diversified schedule already present in the purchase.
  return [...channels.values()].filter(programmes=>programmes.size>=2).length>=2;
}

/** Project an authorized selection using current compatible ratings and the supplied historical calibration. */
export function projectPlanningDelivery(brief:BroadcastBrief,lines:RatedDeliveryLine[],model:PlanningCurveModel):DeliverySummary|null {
  if(!validDate(brief.startDate)||!validDate(brief.endDate)||brief.endDate<brief.startDate||!Number.isFinite(model.universe)||model.universe<=0)return null;
  if(model.target.ageMin!==18||model.target.ageMax!==99||model.target.sex!=="all"||model.target.nse!=="all"||!["18","18 99","personas 18"].includes(normalized(brief.ageRange??""))||normalized(brief.sex??"")!=="todas las personas"||normalized(brief.socioeconomic??"")!=="todos los nse"||brief.audienceType!=="B2C")return null;
  const requested=[...new Set(briefMarketKeys(brief).map(key=>key.replace(/^provincia de /, "")).map(key=>key==="guayas"?"guayaquil":key==="pichincha"?"quito":key))].sort();
  // Geographic complements can sit outside the calibrated cities. Keep the
  // measured population and its visible scope label; never expand the universe.
  const keys=requested.includes("nacional")?model.marketKeys.slice().sort():requested.filter(key=>model.marketKeys.includes(key));
  if(!keys.length)return null;
  const scopeWeight=keys.reduce((sum,key)=>sum+(model.marketWeights[key]??0),0);
  if(!Number.isFinite(scopeWeight)||scopeWeight<=0||scopeWeight>1.000001)return null;
  const universe=model.universe*scopeWeight;
  const media=[...new Set(lines.map(l=>l.medium))];
  if(!media.length)return null;
  const geography=keys.join(",");
  const selection:DeliverySelection={context:{startDate:brief.startDate,endDate:brief.endDate,geography,audience:"18+|all|all"},media:media.map(medium=>({medium,items:lines.filter(l=>l.medium===medium).map(({id,quantity,amountCents})=>({id,quantity,amountCents}))}))};
  const observations:DeliveryObservation[]=[];
  const contactsWithoutReach:NonNullable<DeliverySummary["contactMedia"]>=[];
  for(const medium of media){
    const curve=model.curves.find(c=>c.medium===medium),all=lines.filter(l=>l.medium===medium);
    if(medium==="press"){
      const reach=projectPressEditionReach(all,keys,model.marketWeights,brief.startDate);
      if(reach!=null)observations.push({medium,selectionKey:deliverySelectionKey(selection,medium),universe,universeId:`planning-adults-${geography}`,targetId:"18+|all|all",geographyId:geography,periodId:`${brief.startDate}/${brief.endDate}`,reach1Pct:reach,evidenceId:"press-per-edition-shared-universe-projection",approved:true});
      continue;
    }
    // Keep geographic purchases in the plan, without attributing contacts to
    // unsupported territories. A corrupt numeric observation is never a complement.
    if(all.some(l=>l.ratingPct!=null&&(!Number.isFinite(l.ratingPct)||l.ratingPct<0||l.ratingPct>100)))return null;
    const selected=all.filter(l=>l.ratingPct!=null&&l.ratingMarketKeys.length>0&&l.ratingMarketKeys.map(normalized).every(k=>keys.includes(k))&&validDate(l.studyEnd??"")&&l.studyEnd!<=brief.startDate!&&Date.parse(brief.startDate!)-Date.parse(l.studyEnd!)<=366*86400000);
    if(!curve||!selected.length||selected.some(l=>!Number.isSafeInteger(l.quantity)||l.quantity<1))continue;
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
    if(!matchesCurveScope(curve,selected)){
      if(medium==="television"||medium==="radio")contactsWithoutReach.push({medium,grps,impressions:grps*universe/100,frequency:null});
      continue;
    }
    const modeledReach=reachAtGrps(curve,grps);
    const cap=Math.min(100,[...covered].reduce((sum,key)=>sum+(model.marketWeights[key]??0),0)/scopeWeight*100);
    const reach=modeledReach==null?null:Math.min(cap,modeledReach),thresholds=reach==null?null:projectContactThresholds(reach,grps);
    if(reach==null||!thresholds)continue;
    observations.push({medium,selectionKey:deliverySelectionKey(selection,medium),universe,universeId:`planning-adults-${geography}`,targetId:"18+|all|all",geographyId:geography,periodId:`${brief.startDate}/${brief.endDate}`,reach1Pct:reach,...thresholds,impressions:grps*universe/100,evidenceId:"owner-authorized-historical-curve-projection",approved:true});
  }
  const {summary}=combineMediaDelivery(selection,observations,{allowGeographicComplements:true});
  if(contactsWithoutReach.length){
    // Retain valid gross contacts; do not substitute them for unique viewers or
    // present a partial-media figure as the complete plan's deduplicated reach.
    summary.contactMedia=[...(summary.contactMedia??[]),...contactsWithoutReach];
    summary.geographicComplements=summary.geographicComplements?.filter(medium=>!contactsWithoutReach.some(row=>row.medium===medium));
    summary.reach1Pct=null;summary.reach2Pct=null;summary.reach3Pct=null;summary.people=null;summary.frequency=null;
    summary.grps=summary.contactMedia.reduce((sum,row)=>sum+row.grps,0);
  }
  return summary.media.length||summary.contactMedia?.length?{...summary,scopeLabel:`Personas de 18 años o más · ${keys.map(key=>key==="guayaquil"?"Guayaquil":"Quito").join(" y ")}`}:null;
}
