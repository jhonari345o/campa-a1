import test from "node:test";
import assert from "node:assert/strict";
import { pressReachForProduct, projectPressEditionReach, type PressEditionReach } from "../lib/press-delivery";
import { projectPlanningDelivery, type PlanningCurveModel, type RatedDeliveryLine } from "../lib/planning-delivery";
import type { PressAudience } from "../lib/atl-audience";
import type { CatalogProduct } from "../lib/catalog-shopping";
import type { BroadcastBrief } from "../lib/broadcast-catalog";

const brief:BroadcastBrief={startDate:"2026-11-10",endDate:"2026-11-30",audienceType:"B2C",ageRange:"Personas 18+",sex:"Todas las personas",socioeconomic:"Todos los NSE",geography:"Guayas, Pichincha"};
const study:PressAudience={id:"synthetic-edition",provider:"Diario sintético",sex:"all",ageMin:18,ageMax:99,nse:"all",universe:120000,audience:14400,reachPct:12,exclusiveReachPct:8,rank:1,periodStart:"2026-08-01",periodEnd:"2026-08-31",marketKeys:["guayaquil","quito"],row:1,derived:false};
const product:CatalogProduct={key:"press:synthetic:edition:page",kind:"press",provider:study.provider,name:"Página completa",format:"Impreso",unit:"inserción",priceCents:10000,taxIncluded:false,location:"Guayaquil + Quito",marketOptions:[["guayaquil","quito"]],reference:"",image:null,conditions:"",source:{publicationId:"press-synthetic"}};
const model:PlanningCurveModel={universe:100000,marketKeys:["guayaquil","quito"],marketWeights:{guayaquil:.6,quito:.4},target:{ageMin:18,ageMax:99,sex:"all",nse:"all"},curves:[{medium:"radio",points:[{grps:20,reachPct:10}]}]};
const reach=():PressEditionReach=>pressReachForProduct(product,[study],brief,"2026-11-03")!;
const line=():RatedDeliveryLine=>({id:product.key,medium:"press",quantity:1,amountCents:10000,ratingPct:null,ratingMarketKeys:[],studyEnd:null,pressReach:reach()});

test("per-edition reach resolves actual print editions and excludes digital or unrelated publications",()=>{
 assert.equal(reach().reachPct,12);
 for(const patch of [{kind:"digital" as const},{unit:"CPM"},{unit:"paquete"},{provider:"Otro diario"},{name:"Revista del diario"},{name:"Suplemento"},{format:"Banner web"},{key:"press:synthetic:quote"}])assert.equal(pressReachForProduct({...product,...patch},[study],brief,"2026-11-03"),undefined);
 assert.ok(pressReachForProduct({...product,name:"Banner horizontal de portada"},[study],brief,"2026-11-03"));
});

test("an edition must purchase all study cities; ambiguous alternatives are not a combined edition",()=>{
 for(const marketOptions of [[["quito"]],[["guayaquil"]],[["quito"],["guayaquil"]],[["cuenca"]]])assert.equal(pressReachForProduct({...product,marketOptions},[study],brief,"2026-11-03"),undefined);
 assert.ok(pressReachForProduct({...product,marketOptions:[["quito","guayaquil","cuenca"]]},[study],{...brief,geography:"Nacional"},"2026-11-03"));
 assert.ok(pressReachForProduct({...product,marketOptions:undefined,marketKeys:["guayas","pichincha"]},[study],brief,"2026-11-03"));
 assert.ok(pressReachForProduct({...product,marketOptions:undefined,location:"Edición general"},[study],brief,"2026-11-03"));
 assert.equal(pressReachForProduct(product,[study],{...brief,geography:"Guayaquil"},"2026-11-03"),undefined);
 for(const patch of [{sex:"Mujeres"},{ageRange:"Personas 25-34"},{socioeconomic:"NSE Alto"}])assert.equal(pressReachForProduct(product,[study],{...brief,...patch},"2026-11-03"),undefined);
});

test("repeated insertions and formats never multiply one publication's readers",()=>{
 const once=projectPlanningDelivery(brief,[line()],model)!;
 const many=projectPlanningDelivery(brief,[{...line(),quantity:30},{...line(),id:"press:other-format",quantity:10}],model)!;
 assert.ok(Math.abs(once.reach1Pct!-12)<1e-8);
 assert.equal(many.reach1Pct,once.reach1Pct);assert.equal(many.people,12000);
 assert.equal(many.reach2Pct,null);assert.equal(many.reach3Pct,null);assert.equal(many.frequency,null);assert.equal(many.grps,null);
 // Source readership is a rate calibrated to a common universe, not 14,400
 // readers from another population silently added to the 100,000 base.
 assert.equal(once.media[0].people,12000);
});

test("distinct titles combine with measured broadcast reach and preserve broadcast contact frequency",()=>{
 const radio:RatedDeliveryLine={id:"radio:test",medium:"radio",quantity:20,amountCents:10000,ratingPct:1,ratingMarketKeys:["guayaquil","quito"],studyEnd:"2026-08-31"};
 const pressB={...line(),id:"press:another-title",pressReach:{...reach(),publicationKey:"another title",reachPct:20,evidenceId:"another-source"}};
 const result=projectPlanningDelivery(brief,[line(),pressB,radio],model)!;
 assert.ok(Math.abs(result.media.find(r=>r.medium==="press")!.reachPct-(1-.88*.8)*100)<1e-8);
 assert.ok(Math.abs(result.reach1Pct!-(1-.88*.8*.9)*100)<1e-8);
 assert.equal(result.contactMedia?.length,1);assert.equal(result.contactMedia?.[0].medium,"radio");
 assert.ok(Math.abs(result.frequency!-2)<1e-8);assert.equal(result.grps,20);assert.equal(result.reach2Pct,null);
});

test("per-edition projection cannot widen geography, use stale evidence or accept malformed counts",()=>{
 const project=(s:PressEditionReach,quantity=1)=>projectPressEditionReach([{quantity,pressReach:s}],model.marketKeys,model.marketWeights,brief.startDate!);
 assert.equal(project({...reach(),periodEnd:"2028-01-01"}),null);
 assert.equal(project({...reach(),periodEnd:"2024-01-01"}),null);
 assert.equal(project({...reach(),marketKeys:["cuenca"]}),null);
 assert.equal(project({...reach(),reachPct:101}),null);
 assert.equal(project(reach(),1.5),null);
 const local=project({...reach(),marketKeys:["quito"],reachPct:10});assert.ok(Math.abs(local!-4)<1e-8);
 assert.equal(projectPressEditionReach([{quantity:1,pressReach:reach()}],["quito"],model.marketWeights,brief.startDate!),null);
 const ooh={...line(),medium:"ooh" as const,pressReach:undefined};
 assert.equal(projectPlanningDelivery(brief,[ooh],model),null);
});
