import test from "node:test";
import assert from "node:assert/strict";
import {buildStrategyEvidence} from "../lib/media-strategy-evidence";
import {applyStrategyPlan,buildStrategyReport,customizeStrategyPlan} from "../lib/media-strategy";
import {buildMediaPlan} from "../lib/planner";
import {buildDetailedMediaRecommendation} from "../lib/detailed-plan";
import {strategyBrief,strategyCatalogs,strategyResearch} from "./media-strategy-fixture";

test("proposal costs equal whole insertions at current prices, with the unused cents accounted separately",async()=>{
 const brief=strategyBrief({selectedMedia:["television"],budgetUsd:1000});
 const catalogs=strategyCatalogs();
 catalogs.broadcast.tv.push({...catalogs.broadcast.tv[0],id:"synthetic-second",title:"Otro programa sintético",priceUsd:127.14});
 const bundle=buildStrategyEvidence(brief,strategyResearch,catalogs,"2026-11-03");
 const base=await buildMediaPlan({...brief,research:strategyResearch});
 const report=buildStrategyReport(brief,bundle,base,{aiState:"not_configured",fingerprint:"synthetic",generatedAt:"2026-11-03"});
 const plan=applyStrategyPlan(base,report,brief);
 for(const current of [plan,customizeStrategyPlan(plan,plan.plan,1456.78)]){
  const detail=await buildDetailedMediaRecommendation(brief,current),channel=detail.channelPlans[0];
  assert.ok(channel.executions.length>0);
  for(const execution of channel.executions){
   assert.ok(execution.estimatedUnits!>0);
   assert.equal(execution.budgetUsd,Math.round(execution.estimatedUnits!*execution.referenceUnitPriceUsd!*100)/100);
  }
  assert.ok(channel.unallocatedUsd!>0);
  assert.equal(Math.round((channel.executions.reduce((n,e)=>n+e.budgetUsd!,0)+channel.unallocatedUsd!)*100),Math.round(channel.budgetUsd!*100));
 }
});

test("radio proposal location shows the purchased signal while keeping the measured study scope intact",async()=>{
 const brief=strategyBrief({selectedMedia:["radio"],budgetUsd:1000,geography:"Guayas · Pichincha",coverage:[{key:"province:guayas",kind:"province",label:"Guayas"},{key:"province:pichincha",kind:"province",label:"Pichincha"}]});
 const bundle=buildStrategyEvidence(brief,strategyResearch,strategyCatalogs(),"2026-11-03");
 bundle.sources=[{id:"radio-study:synthetic",kind:"ranking",label:"Estudio sintético",period:"2026-10",market:"Guayaquil + Quito",target:"Personas 18+",use:"comparable",note:""}];
 bundle.candidates=[{id:"synthetic-radio",medium:"radio",provider:"Emisora sintética",product:"Rotativo",market:"Guayaquil + Quito",stationCoverage:["Guayas"],coverageKeys:["guayas"],target:"Personas 18+",period:"2026-10",sourceIds:["radio-study:synthetic"],sourceUse:"comparable",unit:"cuña de 20 s",unitPriceUsd:10,referencePriceUsd:10,minimumUnits:1,minimumSpendUsd:10,metrics:[],note:""}];
 const base=await buildMediaPlan({...brief,research:strategyResearch});
 const report=buildStrategyReport(brief,bundle,base,{aiState:"not_configured",fingerprint:"synthetic",generatedAt:"2026-11-03"});
 const detail=await buildDetailedMediaRecommendation(brief,applyStrategyPlan(base,report,brief));
 const execution=detail.channelPlans[0].executions[0];
 assert.equal(execution.location,"Guayas");
 assert.match(execution.evidence,/Guayaquil \+ Quito/);
 assert.equal(report.allocations[0].executions![0].candidate.market,"Guayaquil + Quito");
});
