import test from "node:test";
import assert from "node:assert/strict";
import {planningStudyBrief,radioTariffCoversStationStudy,commercialTerritoryFits,territoriesOverlap} from "../lib/planning-market";
import {sameMarket,radioCompatibility,type BroadcastSource} from "../lib/broadcast-catalog";
import {strategyCandidatePool,allocateStrategyExecutions,buildStrategyReport} from "../lib/media-strategy";
import {buildStrategyEvidence} from "../lib/media-strategy-evidence";
import {strategyBrief,strategyResearch,strategyCatalogs} from "./media-strategy-fixture";
import type {CatalogProduct} from "../lib/catalog-shopping";

const brief=strategyBrief({geography:"Guayas · Pichincha",coverage:[{kind:"province",key:"province:guayas",label:"Guayas"},{kind:"province",key:"province:pichincha",label:"Pichincha"}]});
test("local station prices cover its signal without splitting or relabeling a consolidated audience",()=>{
 const study=["guayaquil","quito"];
 assert.equal(radioTariffCoversStationStudy(["guayas"],study,["Guayas"]),true);
 assert.equal(radioTariffCoversStationStudy(["quito"],study,["Guayas"]),false);
 assert.equal(radioTariffCoversStationStudy(["guayas"],study,["Guayas","Pichincha"]),false);
 assert.equal(radioTariffCoversStationStudy(["nacional"],study,["Nacionales"]),true);
 assert.equal(radioTariffCoversStationStudy(["guayas"],study,["Nacionales"]),false);
 assert.equal(radioTariffCoversStationStudy(["guayas"],study,[]),false);
 assert.deepEqual(study,["guayaquil","quito"]);
});
test("multi-province planning uses local study scopes without relabelling them as provincial estimates",()=>{
  const local=planningStudyBrief(["guayaquil","quito"],brief)!;
  assert.equal(local.geography,"guayaquil, quito");
  assert.equal(local.coverage,undefined);
  assert.ok(planningStudyBrief(["guayaquil"],brief));
  assert.ok(planningStudyBrief(["quito"],brief));
  assert.equal(planningStudyBrief(["cuenca"],brief),null);
  assert.equal(planningStudyBrief([],brief),null);
  assert.equal(planningStudyBrief(["guayaquil","quito"],{...brief,coverage:brief.coverage!.slice(0,1)}),null);
  const source={marketKeys:["guayaquil","quito"]} as BroadcastSource;
  assert.equal(sameMarket(source,brief),false);
  assert.equal(sameMarket(source,local),true);
});
test("territorial containment never changes the study's audience requirements",()=>{
  const source={...strategyCatalogs().broadcast.sources[0],kind:"radio" as const,marketKeys:["guayaquil"],ageMin:18,ageMax:99,nse:"all",sex:"female",periodEnd:"2026-10-01"};
  const local=planningStudyBrief(source.marketKeys,brief)!;
  assert.notEqual(radioCompatibility(source,local),null);
  assert.equal(radioCompatibility(source,{...local,sex:"Mujeres"}),null);
});
test("DIY province labels resolve only their own measured cities",()=>{
  const diy={...brief,coverage:undefined,geography:"Provincia de Guayas, Pichincha"};
  assert.ok(planningStudyBrief(["guayaquil","quito"],diy));
  assert.equal(planningStudyBrief(["cuenca"],diy),null);
  assert.equal(planningStudyBrief(["quito"],{...diy,geography:"Guayas"}),null);
});
test("curated radio coverage and account prices join only the same station and study plaza",()=>{
  const catalogs=strategyCatalogs();
  const source={...catalogs.broadcast.sources[0],id:"synthetic-radio-study",kind:"radio" as const,market:"Guayaquil",marketKeys:["guayaquil"],ageMin:18,ageMax:99,nse:"all",sex:"all",periodStart:"2026-10-01",periodEnd:"2026-10-31",frequency:"FM",target:"Personas adultas"};
  catalogs.broadcast.sources=[source];
  catalogs.broadcast.radio=[{id:"synthetic-ranked-station",sourceId:source.id,name:"Radio sintética",genre:"",rating:2,share:3,audience:100,rank:1}];
  catalogs.radio.stations=[{id:"synthetic-station",name:"Radio sintética",regionKeys:["national","guayas"],city:"Guayaquil",dial:null,genres:[],description:"",logoPath:null,reviewedAt:null,profile:{coverage:"Nacional",website:null,tariffs:[],rankingLinks:[{sourceId:source.id,stationName:"Radio sintética",marketKeys:["guayaquil"],frequency:"FM"}]}}];
  const product:CatalogProduct={key:"radio:synthetic:account",kind:"radio",provider:"Radio sintética",name:"Rotativo",format:"Cuña de veinte segundos",unit:"cuña de 20 s",priceCents:1700,taxIncluded:false,location:"Guayaquil",marketKeys:["guayaquil"],reference:"",image:null,conditions:"Tarifa sintética",validFrom:"2026-11-01",validTo:"2026-11-30",source:{stationId:"synthetic-station",agreementId:"synthetic-agreement",seconds:20}};
  catalogs.workspaceProducts=[product,{...product,key:"radio:synthetic:other-plaza",priceCents:100,marketKeys:["quito"],location:"Quito"}];
  let bundle=buildStrategyEvidence({...brief,selectedMedia:["radio"]},strategyResearch,catalogs,"2026-11-02");
  let ranked=bundle.candidates.find(c=>c.id.startsWith("radio:"))!;
  assert.deepEqual(ranked.stationCoverage,["Nacionales","Guayas"]);
  assert.equal(ranked.market,"Guayaquil");
  assert.equal(ranked.unitPriceUsd,17);
  assert.equal(ranked.metrics.find(m=>m.label==="Rating")?.value,2);
  assert.ok(ranked.sourceIds.includes("workspace-tariff:radio:synthetic:account"));
  catalogs.workspaceProducts=[{...product,source:{...product.source,stationId:"other-station"}}];
  bundle=buildStrategyEvidence({...brief,selectedMedia:["radio"]},strategyResearch,catalogs,"2026-11-02");
  ranked=bundle.candidates.find(c=>c.id.startsWith("radio:"))!;
  assert.equal(ranked.unitPriceUsd,null);
});
test("radio candidates retain independent plazas and never sort their ratings against one another",()=>{
  const bundle=buildStrategyEvidence(brief,strategyResearch,strategyCatalogs(),"2026-11-02");
  const template=bundle.candidates[0]??{medium:"radio" as const,provider:"Synthetic",product:"Spot",market:"",target:"Personas 18+",period:"2026-10",sourceIds:[],sourceUse:"comparable" as const,unit:"spot",unitPriceUsd:null,referencePriceUsd:null,minimumUnits:1,minimumSpendUsd:null,metrics:[],note:""};
  bundle.sources=[...bundle.sources,...["Guayaquil","Quito"].map((market,i)=>({id:`radio-study:${i}`,kind:"ranking" as const,label:"Synthetic",period:"2026-10",market,target:"Personas 18+",use:"comparable" as const,note:""}))];
  bundle.candidates=[0,1,2,3].map(i=>({...template,id:`station-${i}`,medium:"radio" as const,coverageKeys:[i<2?"Guayaquil":"Quito"],market:i<2?"Guayaquil":"Quito",sourceIds:[`radio-study:${i<2?0:1}`],unitPriceUsd:10,minimumSpendUsd:10,metrics:[{label:"Rating",value:[5,4,90,80][i],unit:"puntos",sourceId:`radio-study:${i<2?0:1}`}]}));
  assert.deepEqual(strategyCandidatePool(bundle,"radio").map(c=>c.id),["station-0","station-2","station-1","station-3"]);
  const executions=allocateStrategyExecutions([bundle.candidates[0],bundle.candidates[2]],100.01);
  assert.deepEqual(executions.map(e=>e.amountUsd),[50.01,50]);
  assert.equal(executions.reduce((n,e)=>n+Math.round(e.amountUsd!*100),0),10001);
  assert.ok(executions.every(e=>e.referenceSpendUsd!<=e.amountUsd!));
  const report=buildStrategyReport({...brief,selectedMedia:["radio"],budgetUsd:100.01},bundle,{matched:0,totalRef:0,plan:[],basis:"infomedia",benchmark:[],profileLabel:"Synthetic",strategySummary:"Synthetic"},{aiState:"validated",advice:{summary:"Selección por plaza.",questions:[],allocations:[{medium:"radio",weight:10000,rationale:"Presencia local.",candidateIds:["station-0","station-2"],evidenceIds:["radio-study:0","radio-study:1"]}]},fingerprint:"test",generatedAt:"2026-11-02"});
  assert.deepEqual(report.allocations[0].executions?.map(e=>e.candidate.market),["Guayaquil","Quito"]);
});
test("a station's provincial CNE tariff joins its consolidated ranking without changing the measurement territory",()=>{
 const catalogs=strategyCatalogs(),study={...catalogs.broadcast.sources[0],id:"synthetic-consolidated",kind:"radio" as const,market:"Guayaquil + Quito",marketKeys:["guayaquil","quito"],ageMin:18,ageMax:99,nse:"all",sex:"all",periodStart:"2026-10-01",periodEnd:"2026-10-31",frequency:"FM",target:"Personas adultas"};
 catalogs.broadcast.sources=[study];catalogs.broadcast.radio=[{id:"synthetic-metric",sourceId:study.id,name:"Radio sintética",genre:"",rating:0.75,share:3,audience:100,rank:1}];
 catalogs.radio.stations=[{id:"synthetic-station",name:"Radio sintética",regionKeys:["guayas"],city:"Guayaquil",dial:null,genres:[],description:"",logoPath:null,reviewedAt:null,profile:{coverage:"Guayas",website:null,tariffs:[],rankingLinks:[{sourceId:study.id,stationName:"Radio sintética",marketKeys:study.marketKeys,frequency:"FM"}]}}];
 catalogs.workspaceProducts=[{key:`radio:cne:${"a".repeat(32)}`,kind:"radio",provider:"Radio sintética",name:"Rotativo",format:"Cuña de 20 s",unit:"cuña de 20 s",priceCents:1700,taxIncluded:false,location:"Guayas",marketKeys:["guayas"],reference:"",image:null,conditions:"",validFrom:"2026-11-02",validTo:null,source:{stationId:"synthetic-station",standingPrice:true,defaultPrice:true,seconds:20}}];
 const b={...brief,startDate:"2026-11-03",selectedMedia:["radio"] as const};
 const bundle=buildStrategyEvidence({...b,selectedMedia:[...b.selectedMedia]},strategyResearch,catalogs,"2026-11-02");
 const candidate=bundle.candidates.find(c=>c.id.startsWith("radio:"))!;
 assert.equal(candidate.unitPriceUsd,17);assert.equal(candidate.market,"Guayaquil + Quito");assert.deepEqual(candidate.marketKeys,["guayaquil","quito"]);
 assert.equal(candidate.metrics.find(m=>m.label==="Rating")?.value,0.75);
 assert.equal(candidate.catalogKey,catalogs.workspaceProducts[0].key);
 const local=buildStrategyEvidence({...b,selectedMedia:[...b.selectedMedia],coverage:brief.coverage!.slice(0,1)},strategyResearch,catalogs,"2026-11-02");
 assert.equal(local.candidates.some(c=>c.id.startsWith("radio:")),false);
});

test("commercial provincial coverage includes its canton without extrapolating a city study",()=>{
 const tulcan=strategyBrief({geography:"Tulcán",coverage:[{key:"city:tulcan:carchi",kind:"city",label:"Tulcán",context:"Carchi"}]});
 assert.equal(commercialTerritoryFits(["Carchi"],tulcan),true);
 assert.equal(commercialTerritoryFits(["Carchi","Imbabura"],tulcan),true);
 assert.equal(planningStudyBrief(["Carchi","Imbabura"],tulcan),null);
 assert.equal(commercialTerritoryFits(["Nacional"],tulcan),true);
 assert.equal(commercialTerritoryFits(["Ibarra"],tulcan),false);
 assert.equal(commercialTerritoryFits(["Imbabura"],tulcan),false);
 assert.equal(planningStudyBrief(["Quito"],tulcan),null);
 assert.equal(territoriesOverlap("Cuenca","Gualaceo"),false);
 assert.equal(territoriesOverlap("Azuay","Gualaceo"),true);
});

test("national radio reserves an effective cadence and expands provinces in the approved order",()=>{
 const national=strategyBrief({geography:"Todo Ecuador",coverage:[{key:"country:ecuador",kind:"country",label:"Todo Ecuador"}],selectedMedia:["radio"]});
 const base=buildStrategyEvidence(national,strategyResearch,strategyCatalogs(),"2026-11-02");
 const candidates=["Nacional","Guayas","Pichincha","Azuay","Manabí","Tungurahua","El Oro","Los Ríos","Carchi"].map((market,i)=>({id:`workspace:synthetic-regional-${i}`,catalogKey:`radio:synthetic-regional-${i}`,stationId:`synthetic-station-${i}`,medium:"radio" as const,provider:`Radio sintética ${i}`,product:"Rotativo",market,coverageKeys:[market],target:"",period:"",sourceIds:[],sourceUse:"comparable" as const,unit:"cuña de 20 s",unitPriceUsd:10,referencePriceUsd:10,minimumUnits:1,minimumSpendUsd:10,metrics:[],note:""}));
 const bundle={...base,candidates};
 const run=(budgetUsd:number)=>buildStrategyReport({...national,budgetUsd},bundle,{matched:0,totalRef:0,basis:"infomedia",benchmark:[],profileLabel:"",strategySummary:"",plan:[{label:"Radio",pct:1,amount:budgetUsd}]},{aiState:"unavailable",fingerprint:"synthetic",generatedAt:"2026-11-02"});
 const low=run(200).allocations[0].executions!;
 assert.deepEqual(low.map(e=>e.candidate.market),["Nacional"]);assert.equal(low[0].units,20);
 const medium=run(600).allocations[0].executions!;
 assert.deepEqual(medium.map(e=>e.candidate.market),["Nacional","Guayas","Pichincha"]);
 assert.ok(medium.every(e=>e.units!>=20));
 const high=run(2000).allocations[0].executions!;
 assert.deepEqual(high.map(e=>e.candidate.market),["Nacional","Guayas","Pichincha","Azuay","Manabí","Tungurahua","El Oro","Los Ríos","Carchi"]);
 assert.equal(high.reduce((n,e)=>n+Math.round(e.amountUsd!*100),0),200000);
 assert.ok(high.reduce((n,e)=>n+e.referenceSpendUsd!,0)<=2000);
});
