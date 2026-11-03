import test from "node:test";
import assert from "node:assert/strict";
import { combineMediaDelivery, deliverySelectionKey, reachAtGrps, projectContactThresholds, type DeliverySelection, type DeliveryObservation } from "../lib/media-delivery";
import { projectPlanningDelivery, type PlanningCurveModel, type RatedDeliveryLine } from "../lib/planning-delivery";
import type { BroadcastBrief } from "../lib/broadcast-catalog";
const selection:DeliverySelection={context:{startDate:"2026-11-03",endDate:"2026-11-30",audience:"18+",geography:"quito,guayaquil"},media:[{medium:"television",items:[{id:"tv-a",quantity:30,amountCents:10000}]},{medium:"radio",items:[{id:"radio-a",quantity:40,amountCents:3000}]}]};
const observation=(medium:"television"|"radio",reach:number):DeliveryObservation=>({medium,selectionKey:deliverySelectionKey(selection,medium),universeId:"same",universe:100000,targetId:"adults",geographyId:"cities",periodId:"november",reach1Pct:reach,reach2Pct:reach*.5,reach3Pct:reach*.25,impressions:100000,evidenceId:"private",approved:true});
test("multimedia reach deduplicates across media and derives frequency from gross impressions",()=>{
 const {summary,issues}=combineMediaDelivery(selection,[observation("television",30),observation("radio",40)]);
 assert.equal(issues.length,0);assert.ok(Math.abs(summary.reach1Pct!-58)<1e-8);assert.equal(summary.people,58000);
 assert.equal(summary.grps,200);assert.ok(Math.abs(summary.frequency!-200000/58000)<1e-8);
 assert.ok(summary.reach3Pct!<=summary.reach2Pct!&&summary.reach2Pct!<=summary.reach1Pct!);
});
test("missing, stale, contradictory or different-population evidence never gives a plan-wide total",()=>{
 const a=observation("television",30),b=observation("radio",40);
 for(const rows of [[a],[a,a,b],[a,{...b,universe:90000}],[a,{...b,reach2Pct:50}],[a,{...b,approved:false}],[a,{...b,selectionKey:"old"}]])assert.equal(combineMediaDelivery(selection,rows).summary.reach1Pct,null);
 const changed={...selection,context:{...selection.context,endDate:"2026-12-01"}};
 assert.equal(combineMediaDelivery(changed,[a,b]).summary.media.length,0);
});
test("curve interpolation is bounded, rejects invalid shapes and models nested contact thresholds",()=>{
 const curve={medium:"television" as const,points:[{grps:10,reachPct:8},{grps:20,reachPct:14}]};
 assert.equal(reachAtGrps(curve,15),11);assert.equal(reachAtGrps(curve,1000),14);assert.equal(reachAtGrps(curve,-1),null);
 assert.equal(reachAtGrps({...curve,points:[{grps:10,reachPct:11}]},10),null);
 for(const [r,g] of [[0,0],[1,1],[10,20],[40,400],[.001,10000]]){
  const p=projectContactThresholds(r,g)!;assert.ok(p.reach3Pct<=p.reach2Pct&&p.reach2Pct<=r);assert.ok(Number.isFinite(p.reach3Pct));
 }
 assert.equal(projectContactThresholds(30,20),null);assert.equal(projectContactThresholds(0,20),null);
});
const model:PlanningCurveModel={universe:100000,marketKeys:["guayaquil","quito"],marketWeights:{guayaquil:.6,quito:.4},target:{ageMin:18,ageMax:99,sex:"all",nse:"all"},curves:[{medium:"television",points:[{grps:20,reachPct:15},{grps:400,reachPct:80}]},{medium:"radio",points:[{grps:20,reachPct:10},{grps:400,reachPct:50}]}]};
const brief:BroadcastBrief={startDate:"2026-11-03",endDate:"2026-11-30",geography:"Guayaquil, Quito",audienceType:"B2C",ageRange:"Personas 18+",sex:"Todas las personas",socioeconomic:"Todos los NSE"};
const line=(medium:"television"|"radio"):RatedDeliveryLine=>({id:medium,medium,quantity:20,amountCents:1000,ratingPct:1,ratingMarketKeys:["guayaquil","quito"],studyEnd:"2026-10-02"});
test("all measured media add deduplicated reach while contact frequency keeps its own denominator",()=>{
 const all:DeliverySelection={...selection,media:[...selection.media,{medium:"ooh",items:[{id:"ooh",quantity:1,amountCents:10000}]},{medium:"press",items:[{id:"press",quantity:1,amountCents:2000}]}]};
 const observations:DeliveryObservation[]=[observation("television",30),observation("radio",40),{...observation("radio",20),medium:"ooh",selectionKey:deliverySelectionKey(all,"ooh"),reach2Pct:undefined,reach3Pct:undefined,impressions:undefined},{...observation("radio",10),medium:"press",selectionKey:deliverySelectionKey(all,"press"),reach2Pct:undefined,reach3Pct:undefined,impressions:undefined}];
 const result=combineMediaDelivery(all,observations).summary;
 assert.ok(Math.abs(result.reach1Pct!-(1-.7*.6*.8*.9)*100)<1e-8);
 assert.equal(result.media.length,4);assert.ok(Math.abs(result.frequency!-200000/58000)<1e-8);
 assert.deepEqual(result.contactMedia?.map(m=>m.medium),["television","radio"]);
 assert.equal(result.grps,200);assert.equal(result.reach2Pct,null);
});
test("projections use current GRPs and preserve target, measured city scope and incomplete media",()=>{
 const result=projectPlanningDelivery(brief,[line("television"),line("radio")],model)!;
 assert.ok(Math.abs(result.reach1Pct!-23.5)<1e-8);assert.equal(result.grps,40);
 assert.equal(projectPlanningDelivery({...brief,ageRange:"18-34"},[line("television")],model),null);
 assert.equal(projectPlanningDelivery({...brief,geography:"Cuenca"},[line("television")],model),null);
 assert.equal(projectPlanningDelivery(brief,[{...line("television"),studyEnd:"2026-11-10"}],model),null);
 const partial=projectPlanningDelivery(brief,[line("television"),{...line("radio"),medium:"ooh",ratingPct:null}],model)!;
 assert.equal(partial.media.length,1);assert.ok(Math.abs(partial.reach1Pct!-15)<1e-8);assert.deepEqual(partial.geographicComplements,["ooh"]);
 const withPress=projectPlanningDelivery(brief,[line("television"),{...line("radio"),medium:"press",ratingPct:null}],model)!;
 assert.equal(withPress.reach1Pct,partial.reach1Pct);assert.equal(withPress.grps,20);
 const missingRadio=projectPlanningDelivery(brief,[line("television"),{...line("radio"),ratingPct:null}],model)!;
 assert.equal(missingRadio.reach1Pct,partial.reach1Pct);
 const local=projectPlanningDelivery(brief,[{...line("television"),quantity:10000,ratingMarketKeys:["quito"]}],model)!;
 assert.ok(local.reach1Pct!<=40);
 assert.equal(projectPlanningDelivery({...brief,geography:"Guayaquil"},[line("television")],model),null);
 const city=projectPlanningDelivery({...brief,geography:"Guayaquil"},[{...line("television"),ratingMarketKeys:["guayaquil"]}],model)!;
 assert.equal(city.people,9000);assert.equal(city.scopeLabel,"Personas de 18 años o más · Guayaquil");
});
test("OOH and unranked press in other cities retain measured reach without widening its population",()=>{
 const measured=[line("television"),line("radio")],base=projectPlanningDelivery(brief,measured,model)!;
 const wider={...brief,geography:"Guayas, Pichincha, Azuay"};
 const extra:RatedDeliveryLine[]=[{id:"outside-ooh",medium:"ooh",quantity:2,amountCents:200000,ratingPct:null,ratingMarketKeys:[],studyEnd:null},{id:"unranked-press",medium:"press",quantity:1,amountCents:10000,ratingPct:null,ratingMarketKeys:[],studyEnd:null}];
 const result=projectPlanningDelivery(wider,[...measured,...extra],model)!;
 for(const metric of ["reach1Pct","reach2Pct","reach3Pct","people","frequency","grps"] as const)assert.equal(result[metric],base[metric]);
 assert.equal(result.scopeLabel,"Personas de 18 años o más · Guayaquil y Quito");
 assert.deepEqual(result.geographicComplements,["ooh","press"]);
 assert.equal(projectPlanningDelivery(wider,extra,model),null);
 // A radio observation outside the calibration still cannot be added to it.
 const outsideRadio={...line("radio"),id:"cuenca-radio",ratingMarketKeys:["cuenca"]};
 assert.equal(projectPlanningDelivery(wider,[...measured,outsideRadio,...extra],model)?.reach1Pct,base.reach1Pct);
});

test("national coverage keeps measured cities and unmeasured radio without inventing a national universe",()=>{
 const measured=[line("television"),line("radio")];
 const base=projectPlanningDelivery(brief,measured,model)!;
 const local={...line("radio"),id:"tulcan",ratingPct:null,ratingMarketKeys:["tulcan"]};
 const national=projectPlanningDelivery({...brief,geography:"Todo Ecuador"},[...measured,local],model)!;
 assert.equal(national.people,base.people);assert.equal(national.reach1Pct,base.reach1Pct);assert.equal(national.scopeLabel,base.scopeLabel);
 assert.equal(projectPlanningDelivery(brief,[...measured,{...local,ratingPct:NaN}],model),null);
 const stale={...line("radio"),studyEnd:"2024-01-01"};
 assert.ok(Math.abs(projectPlanningDelivery(brief,[line("television"),stale],model)!.reach1Pct!-15)<1e-8);
 const bad=observation("radio",40);bad.reach1Pct=NaN;
 assert.equal(combineMediaDelivery(selection,[observation("television",30),bad],{allowGeographicComplements:true}).summary.reach1Pct,null);
});
