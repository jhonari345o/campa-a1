import test from "node:test";
import assert from "node:assert/strict";
import { oohEstimateFromDailyImpacts, oohReachForProduct, projectOohSectorReach, type OohDailyImpactCalibration, type OohSectorReachEstimate } from "../lib/ooh-delivery";
import { projectPlanningDelivery, type PlanningCurveModel, type RatedDeliveryLine } from "../lib/planning-delivery";
import type { CatalogProduct } from "../lib/catalog-shopping";

const startDate="2026-11-10",endDate="2026-11-30";
const weights={guayaquil:.6,quito:.4},markets=["guayaquil","quito"],universe=100000;
const estimate=(assetId:string,people=10000,patch:Partial<OohSectorReachEstimate>={}):OohSectorReachEstimate=>({
  assetId,people,city:"Guayaquil",overlapGroup:"sector cercano",universe:60000,
  targetId:"18+|all|all",validFrom:"2026-11-03",validTo:null,accumulation:"fixed_audience",evidenceId:"synthetic-reviewed-forecast",
  basis:"modeled_unique_people",...patch,
});
const row=(s:OohSectorReachEstimate,quantity=1)=>({quantity,oohReach:s});
const project=(rows:ReturnType<typeof row>[])=>projectOohSectorReach(rows,markets,weights,universe,startDate,endDate);
const close=(actual:number|null,expected:number)=>assert.ok(actual!=null&&Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
const line=(s:OohSectorReachEstimate,quantity=1):RatedDeliveryLine=>({id:s.assetId,medium:"ooh",quantity,amountCents:10000,ratingPct:null,ratingMarketKeys:[],studyEnd:null,oohReach:s});
const model:PlanningCurveModel={universe,marketKeys:markets,marketWeights:weights,target:{ageMin:18,ageMax:99,sex:"all",nse:"all"},curves:[{medium:"radio",points:[{grps:20,reachPct:10}]}]};
const brief={startDate,endDate,audienceType:"B2C",ageRange:"Personas 18+",sex:"Todas las personas",socioeconomic:"Todos los NSE",geography:"Guayas, Pichincha"};

test("approved two-contact scenario reduces gross daily contacts before nearby and multimedios overlap",()=>{
  const a=oohEstimateFromDailyImpacts({...estimate("a"),dailyImpacts:20000,impactPeriod:"day",impactTargetId:"18+|all|all"})!;
  const b=oohEstimateFromDailyImpacts({...estimate("b"),dailyImpacts:16000,impactPeriod:"day",impactTargetId:"18+|all|all"})!;
  assert.equal(a.basis,"modeled_unique_people");
  close(project([row(a),row(b)]),13.2);
  // More billing months do not invent daily accumulation or add repeat people.
  close(projectOohSectorReach([row(a,3),row(b,3)],markets,weights,universe,"2026-12-01","2027-02-28"),13.2);
  const radio:RatedDeliveryLine={id:"radio",medium:"radio",quantity:20,amountCents:10000,ratingPct:1,ratingMarketKeys:markets,studyEnd:"2026-08-31"};
  const result=projectPlanningDelivery(brief,[line(a),line(b),radio],model)!;
  assert.equal(result.people,21880);
  assert.equal(result.contactMedia?.length,1);
  assert.equal(result.contactMedia?.[0].medium,"radio");
});

test("daily contacts require matching audience, explicit daily period and reviewed physical asset",()=>{
  const input:OohDailyImpactCalibration={...estimate("a"),dailyImpacts:20000,impactPeriod:"day",impactTargetId:"18+|all|all"};
  for(const patch of [
    {dailyImpacts:NaN},{dailyImpacts:Infinity},{dailyImpacts:-1},{assetId:""},{evidenceId:""},
    {impactTargetId:"all ages"},{targetId:"all ages",impactTargetId:"all ages"},
    {impactPeriod:"unspecified" as "day"},{impactPeriod:"month" as "day"},
  ])assert.equal(oohEstimateFromDailyImpacts({...input,...patch}),undefined);
  assert.equal(oohEstimateFromDailyImpacts({...input,dailyImpacts:0})?.people,0);
  assert.equal(oohEstimateFromDailyImpacts({...input,dailyImpacts:200000})?.people,60000);
});

test("60% overlap retains the largest audience plus 40% of other nearby assets",()=>{
  const a=row(estimate("a",10000)),b=row(estimate("b",8000));
  close(project([a,b]),13.2);
  close(project([b,a]),13.2);
  close(project([a,b,row(estimate("c",5000))]),15.2);
  // The first element is not penalized as if it overlapped itself.
  close(project([a]),10);
});

test("duplicate products, billing periods and quantity cannot multiply one physical audience",()=>{
  const a=row(estimate("a",10000));
  close(project([a,{...a,quantity:30}]),10);
  close(project([{...a,quantity:3}]),10);
  assert.equal(project([a,row(estimate("a",15000))]),null);
  assert.equal(project([a,row(estimate("a",10000,{overlapGroup:"another sector"}))]),null);
});

test("independent groups overlap inside each city; cities are disjoint population bases",()=>{
  const a=row(estimate("a",10000)),b=row(estimate("b",8000,{overlapGroup:"distant sector"}));
  close(project([a,b]),(1-(1-10000/60000)*(1-8000/60000))*60);
  const q=row(estimate("q",8000,{city:"Quito",universe:40000}));
  close(project([a,q]),18);
  close(projectOohSectorReach([a,q],["guayaquil"],weights,universe,startDate,endDate),10000/60000*100);
});

test("adding an asset never reduces reach and cannot exceed its city or common universe",()=>{
  const rows:ReturnType<typeof row>[]=[];let previous=0;
  for(let i=0;i<70;i++){
    rows.push(row(estimate(`asset-${i}`,1000+(i*7919)%59000,{overlapGroup:`fixed-sector-${i%7}`})));
    const result=project(rows)!;assert.ok(result+1e-9>=previous);assert.ok(result<=60+1e-9);previous=result;
    close(project(rows.slice().reverse()),result);
  }
});

test("unknown populations, invalid quantities, wrong periods and gross impacts cannot become reach",()=>{
  for(const patch of [
    {people:NaN},{people:Infinity},{people:-1},{people:60001},{universe:50000},
    {targetId:"all ages"},{basis:"gross_impacts" as OohSectorReachEstimate["basis"]},{overlapGroup:""},
  ])assert.equal(project([row(estimate("bad",10000,patch))]),null);
  assert.equal(project([row(estimate("bad"),1.5)]),null);
  assert.equal(project([row(estimate("old",10000,{validFrom:"2025-01-01",validTo:"2025-01-31"}))]),null);
  close(projectOohSectorReach([row(estimate("a"))],markets,weights,universe,"2026-12-01","2027-02-28"),10);
  assert.equal(project([row(estimate("outside",10000,{city:"Tulcán"}))]),null);
});

test("server resolver requires the exact purchased asset and unambiguous campaign forecast",()=>{
  const s=estimate("asset-a");
  const product:CatalogProduct={key:"ooh:asset-a:0",kind:"ooh",provider:"Synthetic provider",name:"Synthetic billboard",format:"Valla fija",unit:"mes",priceCents:200000,taxIncluded:false,location:"Guayaquil",reference:"",image:null,conditions:"",source:{assetId:"asset-a"}};
  assert.equal(oohReachForProduct(product,[s],startDate,endDate),s);
  assert.equal(oohReachForProduct(product,undefined,startDate,endDate),undefined);
  assert.equal(oohReachForProduct(product,[estimate("nearby-other-asset")],startDate,endDate),undefined);
  assert.equal(oohReachForProduct(product,[s,s],startDate,endDate),undefined);
  assert.equal(oohReachForProduct({...product,kind:"digital"},[s],startDate,endDate),undefined);
});

test("OOH joins multimedios while frequency and GRPs stay with compatible broadcast media",()=>{
  const radio:RatedDeliveryLine={id:"radio-test",medium:"radio",quantity:20,amountCents:10000,ratingPct:1,ratingMarketKeys:markets,studyEnd:"2026-08-31"};
  const result=projectPlanningDelivery(brief,[line(estimate("a")),line(estimate("b",8000)),radio],model)!;
  close(result.media.find(m=>m.medium==="ooh")?.reachPct??null,13.2);
  close(result.reach1Pct,(1-.868*.9)*100);
  assert.equal(result.people,21880);
  assert.equal(result.contactMedia?.length,1);assert.equal(result.contactMedia?.[0].medium,"radio");
  close(result.frequency,2);close(result.grps,20);
  assert.equal(result.reach2Pct,null);assert.equal(result.reach3Pct,null);
});
