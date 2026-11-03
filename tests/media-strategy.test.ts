import assert from "node:assert/strict";
import test from "node:test";
import { buildMediaPlan } from "../lib/planner";
import { buildStrategyEvidence, scopePlanningResearch, tvAudienceApplies } from "../lib/media-strategy-evidence";
import { allocateStrategyBudget, allowedStrategyMedia, applyStrategyPlan, buildStrategyReport, customizeStrategyPlan, excludedMedia, parseStrategyAdvice, referenceQuantity, strategyAiPayload, strategyCandidatePool } from "../lib/media-strategy";
import type { MediaGroup } from "../lib/media-groups";
import { mediaGroupForLabel } from "../lib/media-groups";
import { projectResearch } from "../lib/infomedia";
import { strategyBrief, strategyCatalogs, strategyResearch, tvSource, tvStudy } from "./media-strategy-fixture";
import { buildCurrentCampaigns } from "../lib/campaigns";
import type { OohAsset } from "../lib/ooh-catalog";

const date="2026-10-31";
test("a large TV tariff cannot remove all programmes in another requested city",()=>{
  const catalogs=strategyCatalogs();
  catalogs.broadcast.sources=[{...tvSource,id:"large-gye",market:"Guayaquil",marketKeys:["guayaquil"]},tvSource];
  catalogs.broadcast.tv.unshift(...Array.from({length:110},(_,i)=>({...catalogs.broadcast.tv[0],id:`gye-${i}`,sourceId:"large-gye"})));
  catalogs.tvAudience=[];
  const brief=strategyBrief({selectedMedia:["television"],coverage:undefined,geography:"Guayaquil, Quito"});
  const bundle=buildStrategyEvidence(brief,strategyResearch,catalogs,date);
  assert.equal(bundle.candidates.length,100);
  assert.ok(bundle.candidates.some(c=>c.market==="Guayaquil"));
  assert.ok(bundle.candidates.some(c=>c.market==="Quito"));
});
test("TV recommendations retain each applicable plaza and study in the bounded AI selection",async()=>{
  const brief=strategyBrief({selectedMedia:["television"],priority:"Eficiencia"}),bundle=buildStrategyEvidence(brief,strategyResearch,strategyCatalogs(),date);
  const sample=bundle.candidates[0];
  bundle.candidates=[];
  for(const [cohort,market,period,rating] of [["gye","Guayaquil","2026-10-02",2],["uio","Quito","2026-10-02",9],["prior","Guayaquil y Quito","2026-09-27",1]] as const){
    const sourceId=`tv-audience:${cohort}`;
    bundle.sources.push({id:sourceId,kind:"rating",label:"Estudio sintético",period,market,target:"Adultos",use:"comparable",note:""});
    for(let i=0;i<10;i++)bundle.candidates.push({...sample,id:`${cohort}:${i}`,cohort,market,sourceIds:[sourceId],unitPriceUsd:10+i,metrics:[{label:"Rating",value:rating,unit:"puntos",sourceId}]});
  }
  const pool=strategyCandidatePool(bundle,"television",brief);
  assert.equal(pool.length,30);
  assert.deepEqual(pool.slice(0,6).map(c=>c.id),["gye:0","uio:0","prior:0","gye:1","uio:1","prior:1"]);
  const baseline=await buildMediaPlan({...brief,research:strategyResearch});
  const payload=strategyAiPayload(brief,bundle,baseline);
  assert.equal(payload.evidence.candidates.length,8);
  assert.deepEqual(new Set(payload.evidence.candidates.map(c=>c.market)),new Set(["Guayaquil","Quito","Guayaquil y Quito"]));
  const advice={summary:"Combina las plazas solicitadas.",allocations:[{medium:"television",weight:10000,rationale:"Conserva presencia en ambas ciudades.",evidenceIds:["tv-audience:gye","tv-audience:uio"],candidateIds:["gye:0","uio:0"]}]};
  assert.ok(parseStrategyAdvice(JSON.stringify(advice),brief,bundle));
});
test("account TV prices retain current programme ratings without an undiscounted duplicate",()=>{
  const catalogs=strategyCatalogs();
  const key=`tv:${tvSource.id}:synthetic-program`;
  catalogs.workspaceProducts=[{key,kind:"tv",provider:"Canal sintético",name:"Programa sintético",format:"Lunes a viernes · 12:00",unit:"cuña de 30 s",priceCents:32123,taxIncluded:false,location:"Quito",marketKeys:["quito"],conditions:"",reference:"",image:null,validFrom:"2026-11-01",validTo:null,source:{defaultPrice:true,standingPrice:true,offerId:"synthetic-program"}}];
  const bundle=buildStrategyEvidence(strategyBrief({selectedMedia:["television"]}),strategyResearch,catalogs,date);
  const candidates=bundle.candidates.filter(c=>c.medium==="television");
  assert.equal(candidates.length,1);
  assert.equal(candidates[0].catalogKey,key);
  assert.equal(candidates[0].unitPriceUsd,321.23);
  assert.equal(candidates[0].metrics.find(m=>m.label==="Rating")?.value,2.5);
  assert.equal(bundle.gaps.some(g=>g.startsWith("TV:")),false);
  catalogs.workspaceProducts[0].source={agreementId:"client-agreement",offerId:"synthetic-program"};
  catalogs.workspaceProducts[0].priceCents=28000;
  assert.equal(buildStrategyEvidence(strategyBrief(),strategyResearch,catalogs,date).candidates.find(c=>c.catalogKey===key)?.unitPriceUsd,280);
});
test("channel share keeps the original study total and population instead of normalizing selected channels",()=>{
  const catalogs=strategyCatalogs();
  catalogs.tvShares=[{channel:"Canal A",sharePct:16.2,periodStart:"2026-09-01",periodEnd:"2026-09-30"},{channel:"Canal B",sharePct:10.4,periodStart:"2026-09-01",periodEnd:"2026-09-30"}];
  const brief=strategyBrief({coverage:undefined,geography:"Guayaquil, Quito"});
  assert.deepEqual(buildStrategyEvidence(brief,strategyResearch,catalogs,date).channelShares?.map(c=>c.sharePct),[16.2,10.4]);
  for(const patch of [{sex:"Mujeres"},{geography:"Quito"},{startDate:"2026-08-01"}])assert.deepEqual(buildStrategyEvidence({...brief,...patch},strategyResearch,catalogs,date).channelShares,[]);
});
const photographedAsset = (patch: Partial<OohAsset> = {}): OohAsset => ({
  id:"synthetic-ooh",providerSlug:"synthetic",provinces:["Pichincha"],name:"Circuito sintético",code:"S-01",city:"Quito",address:"Ubicación sintética",format:"Circuito",dimensions:"Medidas sintéticas",brand:"Proveedor sintético",latitude:null,longitude:null,recordType:"inventory",rates:[{amount:1000,period:"mes",basis:"circuito de cinco",component:"Pauta"}],rateLabel:"",reference:"Catálogo sintético",taxLabel:"",photo:true,photoKind:"format",dailySpots:null,spotSeconds:null,...patch,
});
test("OOH recommendations link only a documented asset photo, including scoped agreement products",()=>{
  const catalogs=strategyCatalogs();
  catalogs.ooh.assets=[photographedAsset(),photographedAsset({id:"source-without-photo",photo:false})];
  catalogs.workspaceProducts=[{key:"ooh:workspace:photo",kind:"ooh",provider:"Proveedor sintético",name:"Circuito contratado",format:"Circuito",unit:"mes",priceCents:100000,taxIncluded:false,location:"Quito",marketKeys:["quito"],reference:"",conditions:"",image:null,validFrom:"2026-11-01",validTo:"2026-11-30",source:{workspaceProductId:"synthetic-photo-agreement",assetId:"synthetic-ooh"}}];
  const bundle=buildStrategyEvidence(strategyBrief({selectedMedia:["ooh"]}),strategyResearch,catalogs,date);
  assert.deepEqual(bundle.candidates.find(c=>c.id==="ooh:synthetic-ooh")?.oohPhoto,{assetId:"synthetic-ooh",kind:"format"});
  assert.equal(bundle.candidates.find(c=>c.id==="ooh:source-without-photo")?.oohPhoto,undefined);
  assert.deepEqual(bundle.candidates.find(c=>c.id==="workspace:ooh:workspace:photo")?.oohPhoto,{assetId:"synthetic-ooh",kind:"format"});
});
test("OOH chooses a priced photographed circuit before an unpriced alphabetic placeholder without treating the reference as a quote",()=>{
  const catalogs=strategyCatalogs();
  catalogs.ooh.assets=[photographedAsset({id:"aaa-no-price",rates:[]}),photographedAsset({id:"zzz-priced"})];
  const brief=strategyBrief({selectedMedia:["ooh"]}),bundle=buildStrategyEvidence(brief,strategyResearch,catalogs,date);
  const first=strategyCandidatePool(bundle,"ooh",brief)[0];
  assert.equal(first.id,"ooh:zzz-priced");assert.equal(first.referencePriceUsd,1000);assert.equal(first.unitPriceUsd,null);
  assert.deepEqual(referenceQuantity(first,5000),{units:null,spend:null,remainder:null});
});
test("source-backed plans keep creative templates separate from measured analysis",async()=>{
  const b=strategyBrief({selectedMedia:["digital"]}),bundle=buildStrategyEvidence(b,strategyResearch,strategyCatalogs(),date),base=await buildMediaPlan({...b,research:scopePlanningResearch(strategyResearch,bundle)});
  const plan=applyStrategyPlan(base,buildStrategyReport(b,bundle,base,{aiState:"not_configured",fingerprint:"test",generatedAt:date}),b);
  const campaigns=await buildCurrentCampaigns({keyword:b.keyword,audience:b.audience,objective:b.objective},plan);
  assert.ok(campaigns.length>0);
  assert.ok(campaigns.every(c=>c.templateOnly&&c.insight.basis==="datos"&&!c.insight.sources.length&&!/Señal (?:creativa )?a validar/.test(c.copy)));
});
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
  assert.equal(bundle.audienceReferences.length,0);assert.equal(bundle.sources.find(s=>s.kind==="rating"),undefined);
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
  assert.equal(p.baseline.reduce((n,r)=>n+r.weight,0),10000);
  assert.ok(p.baseline.every(r=>Number.isInteger(r.weight)));
  for(const option of p.allocationOptions){
    assert.ok(option.evidenceIds.every(id=>bundle.sources.some(s=>s.id===id&&s.use!=="unavailable")));
    assert.ok(option.candidateIds.every(id=>p.evidence.candidates.some(c=>c.id===id&&c.medium===option.medium)));
  }
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
  const pool=strategyCandidatePool(bundle,"radio");assert.deepEqual(pool.map(c=>c.id),["one","two"]);assert.deepEqual(pool.map(c=>c.metrics[0].sourceId),["radio-study:one","radio-study:two"]);
});
test("a consolidated radio ranking preserves actual provincial signals and rejects incomplete feasible coverage",async()=>{
 const brief=strategyBrief({selectedMedia:["radio"],coverage:undefined,geography:"Guayas, Pichincha",budgetUsd:1000});
 const bundle=buildStrategyEvidence(strategyBrief(),strategyResearch,strategyCatalogs(),date),sample=bundle.candidates[0],sid="radio-study:combined";
 bundle.sources.push({id:sid,kind:"ranking",label:"Estudio sintético",period:"2026-08-01 – 2026-08-31",market:"Guayaquil · Quito",target:"Adultos",use:"comparable",note:""});
 bundle.candidates=Array.from({length:12},(_,i)=>({...sample,id:`radio-${i}`,medium:"radio" as const,market:"Guayaquil · Quito",marketKeys:["guayaquil","quito"],stationCoverage:[i<10?"Guayas":"Pichincha"],sourceIds:[sid],unitPriceUsd:10,minimumSpendUsd:10,metrics:[{label:"Rating",value:20-i,unit:"puntos",sourceId:sid}]}));
 const pool=strategyCandidatePool(bundle,"radio",brief).slice(0,8);
 assert.deepEqual(pool.slice(0,2).map(c=>c.id),["radio-0","radio-10"]);
 assert.ok(pool.every(c=>c.market==="Guayaquil · Quito"&&c.metrics[0].sourceId===sid));
 const advice={summary:"Cobertura en las plazas solicitadas.",allocations:[{medium:"radio",weight:10000,rationale:"Combina señales de ambas provincias.",evidenceIds:[sid],candidateIds:["radio-0"]}],questions:[]};
 let rejected="";
 assert.equal(parseStrategyAdvice(JSON.stringify(advice),brief,bundle,code=>{rejected=code;}),null);assert.equal(rejected,"RADIO_GEOGRAPHY");
 advice.allocations[0].candidateIds.push("radio-10");
 assert.ok(parseStrategyAdvice(JSON.stringify(advice),brief,bundle));
 const baseline=await buildMediaPlan({...brief,research:strategyResearch});
 const report=buildStrategyReport(brief,bundle,baseline,{aiState:"unavailable",fingerprint:"synthetic",generatedAt:date});
 assert.deepEqual(report.allocations[0].executions?.map(e=>e.candidate.stationCoverage?.[0]),["Guayas","Pichincha"]);
 assert.equal(report.allocations[0].executions?.reduce((total,e)=>total+(e.referenceSpendUsd??0),0),1000);
 // A genuinely national signal may cover both; an unaffordable extra market is
 // not a requirement to invent money or replace the user's requested budget.
 bundle.candidates[0].stationCoverage=["Nacionales"];
 advice.allocations[0].candidateIds=["radio-0"];
 assert.ok(parseStrategyAdvice(JSON.stringify(advice),brief,bundle));
 bundle.candidates[0].stationCoverage=["Guayas"];
 assert.ok(parseStrategyAdvice(JSON.stringify(advice),{...brief,budgetUsd:10},bundle));
});

test('workspace rates enter recommendations with their own package unit, geography and validity without inventing audiences',()=>{
 const catalogs=strategyCatalogs();catalogs.workspaceProducts=[{key:'ooh:workspace:synthetic',kind:'ooh',provider:'Synthetic provider',name:'Special package',format:'Five totems',formatGroup:'totem_special',unit:'package of five',priceCents:173245,taxIncluded:null,location:'Ecuador',marketKeys:['nacional'],reference:'',conditions:'',image:null,validFrom:'2026-10-01',validTo:'2026-12-31',source:{workspaceProductId:'synthetic'}}];
 const b=strategyBrief({selectedMedia:['ooh']});
 const bundle=buildStrategyEvidence(b,strategyResearch,catalogs,date),candidate=bundle.candidates.find(c=>c.id.startsWith('workspace:'));
 assert.equal(candidate?.unit,'package of five');assert.equal(candidate?.referencePriceUsd,1732.45);assert.deepEqual(candidate?.metrics,[]);
 const outside=buildStrategyEvidence({...b,startDate:'2027-01-01',endDate:'2027-01-31'},strategyResearch,catalogs,date).candidates.find(c=>c.id.startsWith('workspace:'));assert.equal(outside?.unitPriceUsd,null);
});

test("radio account rates remain usable without borrowing a mismatched ranking",()=>{
 const catalogs=strategyCatalogs();
 catalogs.workspaceProducts=[{key:"radio:workspace:synthetic",kind:"radio",provider:"Radio sintética",name:"Horario rotativo",format:"Cuña de 20 s",unit:"cuña de 20 s",priceCents:1900,taxIncluded:false,location:"Quito",marketKeys:["quito"],reference:"",conditions:"",image:null,validFrom:"2026-11-01",validTo:null,source:{workspaceProductId:"synthetic",agreementId:"synthetic-agreement"}}];
 const brief=strategyBrief({selectedMedia:["radio"]});
 const bundle=buildStrategyEvidence(brief,strategyResearch,catalogs,date);
 const pool=strategyCandidatePool(bundle,"radio",brief);
 assert.equal(pool.length,1);assert.equal(pool[0].unitPriceUsd,19);assert.deepEqual(pool[0].metrics,[]);
 assert.equal(referenceQuantity(pool[0],190).units,10);
 assert.equal(bundle.gaps.some(g=>g.includes("tarifa vigente")),false);
 const mismatched=buildStrategyEvidence({...brief,geography:"Guayaquil",coverage:[{key:"city:guayaquil:guayas",kind:"city",label:"Guayaquil",context:"Guayas"}]},strategyResearch,catalogs,date);
 assert.equal(strategyCandidatePool(mismatched,"radio").length,0);
});

test("large catalogs preserve account-priced assets and cost the campaign without duplicating one physical location",()=>{
 const catalogs=strategyCatalogs();
 catalogs.ooh.assets=Array.from({length:900},(_,i)=>photographedAsset({id:`synthetic-${i}`,recordType:"asset"}));
 catalogs.workspaceProducts=[{key:"ooh:synthetic-899:0",kind:"ooh",provider:"Proveedor sintético",name:"Pantalla sintética",format:"Pantalla",unit:"mes · por pantalla",billingPeriod:"month",priceCents:123400,taxIncluded:false,location:"Quito",marketKeys:["pichincha"],reference:"",conditions:"",image:null,validFrom:"2026-11-01",validTo:null,source:{assetId:"synthetic-899",agreementId:"synthetic-standing-agreement"}}];
 const brief=strategyBrief({selectedMedia:["ooh"],startDate:"2026-11-01",endDate:"2026-12-31",budgetUsd:10000});
 const bundle=buildStrategyEvidence(brief,strategyResearch,catalogs,date);
 const candidate=strategyCandidatePool(bundle,"ooh",brief)[0];
 assert.equal(candidate.id,"workspace:ooh:synthetic-899:0");assert.equal(candidate.unitPriceUsd,2468);
 assert.equal(candidate.maximumUnits,1);assert.deepEqual(referenceQuantity(candidate,10000),{units:1,spend:2468,remainder:7532});
 assert.equal(candidate.oohPhoto?.assetId,"synthetic-899");
 assert.ok(candidate.sourceIds.every(id=>bundle.sources.some(s=>s.id===id)));
 assert.ok(bundle.candidates.length<=100);assert.deepEqual(candidate.metrics,[]);
});
