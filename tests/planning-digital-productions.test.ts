import test from "node:test";
import assert from "node:assert/strict";
import type { CatalogProduct } from "../lib/catalog-shopping";
import { buildStrategyEvidence } from "../lib/media-strategy-evidence";
import { applyStrategyPlan, buildStrategyReport, customizeStrategyPlan, digitalProductionSpend, type StrategyAdvice } from "../lib/media-strategy";
import { buildMediaPlan } from "../lib/planner";
import { buildDetailedMediaRecommendation } from "../lib/detailed-plan";
import { DIGITAL_PRODUCTIONS_LABEL } from "../lib/media-groups";
import { strategyBrief, strategyCatalogs, strategyResearch } from "./media-strategy-fixture";

const product:CatalogProduct={key:"digital:production:synthetic:monthly",kind:"digital",provider:"Programa sintético",name:"Paquete mensual",format:"Patrocinio",unit:"mes",billingPeriod:"month",priceCents:250000,taxIncluded:false,location:"Ecuador",marketKeys:["nacional"],reference:"",conditions:"",image:null,source:{standingPrice:true,defaultPrice:true},validFrom:"2026-11-01",validTo:null,digitalProduction:{id:"synthetic",network:"Canal sintético",description:"Entrevistas",rights:["Cuatro programas"],programsPerPeriod:4}};
async function setup(budget=10000,end="2026-11-30",select=true){
 const brief=strategyBrief({selectedMedia:["digital"],budgetUsd:budget,endDate:end,digitalPlatforms:["Meta","Google Ads"]}),catalogs=strategyCatalogs();
 catalogs.workspaceProducts=[product,{...product,key:"digital:production:synthetic:premium",name:"Premium",priceCents:400000}];
 const bundle=buildStrategyEvidence(brief,strategyResearch,catalogs,"2026-11-03"),base=await buildMediaPlan({...brief,research:strategyResearch});
 const advice:StrategyAdvice={summary:"Combina medios digitales.",allocations:[{medium:"digital",weight:10000,rationale:"Combina contenidos y pauta.",candidateIds:select?bundle.candidates.map(c=>c.id):[],evidenceIds:["category-investment"]}],questions:[]};
 const report=buildStrategyReport(brief,bundle,base,{advice,aiState:"validated",fingerprint:"synthetic",generatedAt:"2026-11-03"});
 return {brief,bundle,report,plan:applyStrategyPlan(base,report,brief)};
}
test("a monthly programme is bought once per campaign month and its spend is subtracted from platforms",async()=>{
 const {brief,bundle,report,plan}=await setup();
 assert.equal(bundle.candidates[0].maximumUnits,1);
 assert.equal(report.allocations[0].executions?.length,1,"one package variant per programme");
 assert.equal(report.allocations[0].executions![0].units,1);
 assert.equal(digitalProductionSpend(report.allocations[0]),2500);
 assert.deepEqual(plan.plan.map(r=>[r.label,r.amount]),[["Meta — Facebook e Instagram",3750],["Google Ads",3750],[DIGITAL_PRODUCTIONS_LABEL,2500]]);
 assert.equal(plan.plan.reduce((n,r)=>n+r.amount!,0),10000);
 const detail=await buildDetailedMediaRecommendation(brief,plan);
 const production=detail.channelPlans.find(r=>r.label===DIGITAL_PRODUCTIONS_LABEL)!;
 assert.equal(production.executions[0].provider,product.provider);
 assert.equal(production.executions[0].estimatedUnits,1);
 assert.equal(production.executions[0].budgetUsd,2500);
 assert.equal(detail.channelPlans.reduce((n,r)=>n+r.budgetUsd!,0),10000);
});
test("monthly rights cover the full duration using the current account price",async()=>{
 const {report,plan}=await setup(10000,"2026-12-31");
 assert.equal(report.allocations[0].executions![0].units,2);
 assert.equal(digitalProductionSpend(report.allocations[0]),5000);
 assert.equal(plan.plan.find(r=>r.label===DIGITAL_PRODUCTIONS_LABEL)?.amount,5000);
 const low=await setup(3000,"2026-12-31");
 assert.equal(low.report.allocations[0].executions?.length,0);
 assert.equal(low.plan.plan.reduce((n,r)=>n+r.amount!,0),3000);
});
test("unselected or unaffordable programmes never remove the platform budget",async()=>{
 for(const [budget,select] of [[10000,false],[1000,true]] as const){
  const {report,plan}=await setup(budget,"2026-11-30",select);
  assert.equal(report.allocations[0].candidate,null);
  assert.equal(report.allocations[0].executions?.length,0);
  assert.equal(plan.plan.some(r=>r.label===DIGITAL_PRODUCTIONS_LABEL),false);
  assert.equal(plan.plan.reduce((n,r)=>n+r.amount!,0),budget);
 }
});
test("personalization recalculates packages and the remaining platform investment without double counting",async()=>{
 const {plan}=await setup();
 for(const budget of [1000,6000,20000]){
  const revised=customizeStrategyPlan(plan,plan.plan,budget);
  assert.equal(revised.plan.reduce((n,r)=>n+r.amount!,0),budget);
  assert.equal(revised.strategy?.reserveUsd,0);
  assert.equal(revised.strategy?.evaluation.budgetConserved,true);
  assert.equal(digitalProductionSpend(revised.strategy!.allocations[0]),budget*.25<2500?0:2500);
 }
});

test("removing the programme allocation does not restore it from the previous recommendation",async()=>{
 const {plan}=await setup();
 const revised=customizeStrategyPlan(plan,plan.plan.filter(r=>r.label!==DIGITAL_PRODUCTIONS_LABEL),10000);
 assert.equal(revised.strategy!.allocations[0].candidate,null);
 assert.equal(revised.strategy!.allocations[0].units,null);
 assert.equal(revised.strategy!.allocations[0].executions!.length,0);
 assert.equal(revised.plan.some(r=>r.label===DIGITAL_PRODUCTIONS_LABEL),false);
 assert.equal(revised.plan.reduce((n,r)=>n+r.amount!,0),10000);
});
