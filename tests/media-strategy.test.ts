import assert from "node:assert/strict";
import test from "node:test";
import { buildMediaPlan } from "../lib/planner";
import { buildStrategyEvidence, scopePlanningResearch, tvAudienceApplies } from "../lib/media-strategy-evidence";
import { allocateStrategyBudget, allowedStrategyMedia, applyStrategyPlan, buildStrategyReport, customizeStrategyPlan, excludedMedia, parseStrategyAdvice, referenceQuantity, strategyAiPayload, strategyCandidatePool } from "../lib/media-strategy";
import type { MediaGroup } from "../lib/media-groups";
import { mediaGroupForLabel } from "../lib/media-groups";
import { projectResearch } from "../lib/infomedia";
import { strategyBrief, strategyCatalogs, strategyResearch, tvSource, tvStudy } from "./media-strategy-fixture";

const date="2026-10-31";
test("TV ratings require the exact audience, market, observation date and measurement basis",()=>{
  const b=strategyBrief();assert.equal(tvAudienceApplies(tvStudy,b,date),true);
  for(const patch of [{sex:"Mujeres"},{ageRange:"18-34"},{socioeconomic:"A/B"},{audienceType:"B2B"},{geography:"Guayaquil",coverage:[]},{startDate:"2026-08-01"},{startDate:"2028-01-01"}])assert.equal(tvAudienceApplies(tvStudy,strategyBrief(patch),date),false);
  assert.equal(tvAudienceApplies({...tvStudy,basis:"premiere"},b,date),false);
  assert.equal(tvAudienceApplies({...tvStudy,ageMin:null,ageMax:null,target:"Target especial"},b,date),false);
  assert.equal(tvAudienceApplies({...tvStudy,periodEnd:"2026-11-10"},strategyBrief({startDate:"2026-12-01"}),date),false);
});
test("future category data and mismatched consumption do not enter numeric planning weights",()=>{
  const b=strategyBrief({startDate:"2026-06-01"}),r={...strategyResearch,tgi:{study:"Sintético",period:"2025",targetLabel:"Personas 15-34",geography:"Nacional",relationship:"context_only" as const,note:"Contextual",values:[{id:"internet",label:"Internet",role:"media" as const,value:99}]}};
  const bundle=buildStrategyEvidence(b,r,strategyCatalogs(),date),scoped=scopePlanningResearch(r,bundle);
  assert.equal(bundle.competitionAvailable,false);assert.deepEqual(bundle.categoryMix,[]);assert.deepEqual(scoped.periods[0].mediaMix,[]);assert.equal(scoped.tgi,undefined);
  assert.equal(bundle.consumption[0].comparable,false);
});
test("declared competitors outside the top ten are resolved from the original category and kept separate from own brand",()=>{
  const brands=Array.from({length:15},(_,i)=>({brand:`Marca sintética ${i}`,estimatedInvestment:100-i,soi:.02}));
  const r=projectResearch(strategyResearch.category,{periods:[{...strategyResearch.periods[0],brands}]},"2026-07-31","Marca sintética 0",["Marca sintética 14"]);
  const bundle=buildStrategyEvidence(strategyBrief({brand:"Marca sintética 0",competitors:"Marca sintética 14"}),r,strategyCatalogs(),date);
  assert.equal(bundle.competition.find(b=>b.brand==="Marca sintética 14")?.declared,true);
  assert.equal(bundle.competition.some(b=>b.brand==="Marca sintética 0"),false);
});
test("expired, unlocated and unmeasured sources never become applicable quotes or target ratings",()=>{
  const catalogs=strategyCatalogs();catalogs.broadcast.sources=[{...tvSource,marketKeys:[]}];catalogs.tvAudience=[{...tvStudy,target:"Público especial",ageMin:null,basis:"premiere"}];
  const bundle=buildStrategyEvidence(strategyBrief(),strategyResearch,catalogs,date);
  assert.equal(bundle.candidates.filter(c=>c.medium==="television").length,0);
  assert.equal(bundle.audienceReferences.length,1);assert.equal(bundle.sources.find(s=>s.kind==="rating")?.use,"context");
  assert.ok(bundle.gaps.some(g=>g.includes("ratings")));
});
test("integer cent allocation conserves budgets for every permitted combination",()=>{
  const groups:MediaGroup[]=["television","radio","ooh","press","digital","influencers"];
  for(let mask=1;mask<64;mask++)for(const budget of [.01,.03,1,99.99,1234.57,1e7])for(const scale of [.001,1,999]){
    const weights=groups.filter((_,i)=>mask&(1<<i)).map((medium,i)=>({medium,weight:(i+1)*scale}));
    const rows=allocateStrategyBudget(weights,budget);
    assert.equal(rows.reduce((n,r)=>n+Math.round(r.amountUsd!*100),0),Math.round(budget*100));
    assert.ok(rows.every(r=>r.amountUsd!>0&&Number.isFinite(r.pct)));
    assert.ok(Math.abs(rows.reduce((n,r)=>n+r.pct,0)-1)<1e-10);
    assert.deepEqual(allocateStrategyBudget([...weights].reverse(),budget),rows);
  }
});
test("documented units cannot overspend a medium, including fractional and tiny unit prices",()=>{
  const bundle=buildStrategyEvidence(strategyBrief(),strategyResearch,strategyCatalogs(),date),c=bundle.candidates[0];
  for(const budget of [0,.01,5,100,1234.57])for(const price of [.001,.01,.333,1,101.03,10000]){
    const result=referenceQuantity({...c,unitPriceUsd:price},budget);
    assert.ok(result.units!>=0&&Number.isInteger(result.units));assert.ok(result.spend!<=budget+.00001);assert.ok(result.remainder!>=0);
  }
});
test("explicit exclusions are respected and an unaffordable medium is not forced into a purchase",async()=>{
  const b=strategyBrief({budgetUsd:1,restrictions:"Sin televisión",selectedMedia:["television","digital"]}),bundle=buildStrategyEvidence(b,strategyResearch,strategyCatalogs(),date);
  assert.deepEqual(excludedMedia(b),["television"]);assert.deepEqual(allowedStrategyMedia(b,bundle),["digital"]);
  const base=await buildMediaPlan({...b,research:scopePlanningResearch(strategyResearch,bundle)});
  const report=buildStrategyReport(b,bundle,base,{aiState:"not_configured",fingerprint:"test",generatedAt:"2026-10-31"});
  assert.equal(report.allocations.length,1);assert.equal(report.allocations[0].amountUsd,1);assert.equal(report.evaluation.budgetConserved,true);
});
test("AI cannot introduce a provider, incompatible candidate, source, metric or excluded medium",()=>{
  const b=strategyBrief({selectedMedia:["television","digital"]}),bundle=buildStrategyEvidence(b,strategyResearch,strategyCatalogs(),date);
  const advice={summary:"Se prioriza una combinación respaldada por las fuentes disponibles.",allocations:[{medium:"television",weight:4000,rationale:"Aporta presencia audiovisual en la plaza solicitada.",evidenceIds:["category-investment"],candidateIds:[bundle.candidates[0].id]},{medium:"digital",weight:6000,rationale:"Complementa la cobertura con una activación medible.",evidenceIds:["category-investment"],candidateIds:[]}],questions:[]};
  assert.ok(parseStrategyAdvice(JSON.stringify(advice),b,bundle));
  for(const mutate of [(v:typeof advice)=>{v.allocations[0].candidateIds=["invented-provider"];},(v:typeof advice)=>{v.allocations[0].evidenceIds=["unknown"];},(v:typeof advice)=>{v.allocations[0].medium="radio";},(v:typeof advice)=>{v.allocations[0].weight=-1;},(v:typeof advice)=>{v.summary="Se garantizan ventas";},(v:typeof advice)=>{v.summary="Llegaremos al 90% del público";}]){
    const bad=structuredClone(advice);mutate(bad);assert.equal(parseStrategyAdvice(JSON.stringify(bad),b,bundle),null);
  }
});
test("the complete brief and only canonical source fields are sent to the strategy adapter",async()=>{
  const b=strategyBrief({audience:"Necesidad específica",competitors:"Competidor sintético",restrictions:"No usar prensa",learnings:"Aprendizaje sintético"}),bundle=buildStrategyEvidence(b,strategyResearch,strategyCatalogs(),date);
  const base=await buildMediaPlan({...b,research:scopePlanningResearch(strategyResearch,bundle)});
  const p=strategyAiPayload(b,bundle,base);
  assert.equal(p.brief.audience,b.audience);assert.equal(p.brief.learnings,b.learnings);assert.equal(p.brief.restrictions,b.restrictions);assert.equal(p.brief.competitors,b.competitors);
  assert.ok(p.evidence.candidates.every(c=>bundle.candidates.some(s=>s.id===c.id)));
});
test("digital budget honors explicit platform choices and is never assigned to WhatsApp as media",async()=>{
  const b=strategyBrief({selectedMedia:["digital"],digitalPlatforms:["Programmatic / DV360","Retail Media"]}),bundle=buildStrategyEvidence(b,strategyResearch,strategyCatalogs(),date),base=await buildMediaPlan({...b,research:scopePlanningResearch(strategyResearch,bundle)});
  const report=buildStrategyReport(b,bundle,base,{aiState:"not_configured",fingerprint:"test",generatedAt:date}),plan=applyStrategyPlan(base,report,b);
  assert.equal(plan.plan.length,2);assert.ok(plan.plan.some(r=>r.label.startsWith("Retail media")));assert.ok(plan.plan.every(r=>mediaGroupForLabel(r.label)==="digital"&&!/whatsapp/i.test(r.label)));
  assert.equal(plan.plan.reduce((n,r)=>n+Math.round(r.amount!*100),0),123457);
});
test("personalizing the mix recomputes source quantities instead of reusing the original spend",async()=>{
  const b=strategyBrief({selectedMedia:["television","digital"]}),bundle=buildStrategyEvidence(b,strategyResearch,strategyCatalogs(),date),base=await buildMediaPlan({...b,research:scopePlanningResearch(strategyResearch,bundle)});
  const plan=applyStrategyPlan(base,buildStrategyReport(b,bundle,base,{aiState:"not_configured",fingerprint:"test",generatedAt:date}),b);
  const requested=plan.plan.map(r=>({...r,pct:mediaGroupForLabel(r.label)==="television"?.01:.99/(plan.plan.length-1)}));
  const revised=customizeStrategyPlan(plan,requested,b.budgetUsd);
  assert.equal(revised.strategy?.customized,true);assert.equal(revised.strategy?.allocations.find(a=>a.medium==="television")?.units,0);
  assert.equal(revised.plan.reduce((n,r)=>n+Math.round(r.amount!*100),0),123457);
});
test("radio candidates from separate dayparts remain separate cohorts",()=>{
  const bundle=buildStrategyEvidence(strategyBrief(),strategyResearch,strategyCatalogs(),date),c=bundle.candidates[0];
  bundle.sources.push({id:"radio-study:one",kind:"ranking",label:"Estudio",period:"2026-01-01 – 2026-07-31",market:"Quito",target:"Adultos",use:"comparable",note:"Franja uno"},{id:"radio-study:two",kind:"ranking",label:"Estudio",period:"2026-01-01 – 2026-07-31",market:"Quito",target:"Adultos",use:"comparable",note:"Franja dos"});
  bundle.candidates.push({...c,id:"one",medium:"radio",sourceIds:["radio-study:one"],metrics:[{label:"Rating",value:1,unit:"puntos",sourceId:"radio-study:one"}]},{...c,id:"two",medium:"radio",sourceIds:["radio-study:two"],metrics:[{label:"Rating",value:99,unit:"puntos",sourceId:"radio-study:two"}]});
  const pool=strategyCandidatePool(bundle,"radio");assert.equal(pool.length,1);assert.equal(pool[0].id,"one");
});
