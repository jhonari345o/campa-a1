import assert from "node:assert/strict";
import test from "node:test";
import { allocateStrategyExecutions, buildStrategyReport, customizeStrategyPlan, parseStrategyAdvice, strategyAiPayload, STARTING_MEDIA_MIX } from "../lib/media-strategy";
import { buildStrategyEvidence, type StrategyCandidate, type StrategyEvidenceBundle } from "../lib/media-strategy-evidence";
import type { MediaPlan } from "../lib/planner";
import type { MediaGroup } from "../lib/media-groups";
import { strategyBrief, strategyCatalogs, strategyResearch } from "./media-strategy-fixture";
import { parseOohAsset } from "../lib/ooh-catalog";

const baseline:MediaPlan={matched:0,totalRef:0,basis:"infomedia",benchmark:[],profileLabel:"",strategySummary:"",plan:[]};
const options={aiState:"unavailable" as const,fingerprint:"synthetic",generatedAt:"2026-11-02"};
const candidate=(id:string,medium:MediaGroup,price:number,coverage:string[],patch:Partial<StrategyCandidate>={}):StrategyCandidate=>({id,catalogKey:id,medium,provider:id,product:"Formato sintético",market:coverage.join(" · "),coverageKeys:coverage,target:"",period:"",sourceIds:["category-investment"],sourceUse:"comparable",unit:"unidad",unitPriceUsd:price,referencePriceUsd:price,minimumSpendUsd:price,minimumUnits:1,metrics:[],note:"",...patch});
const evidence=(candidates:StrategyCandidate[]):StrategyEvidenceBundle=>({...buildStrategyEvidence(strategyBrief(),strategyResearch,strategyCatalogs(),"2026-11-02"),candidates,categoryMix:[]});

test("all six media start from the approved mix, while evidence may justify a different final allocation",()=>{
  const media=Object.keys(STARTING_MEDIA_MIX) as MediaGroup[];
  const brief=strategyBrief({selectedMedia:media,budgetUsd:100000});
  const bundle=evidence([...media.map(m=>candidate(m,m,1,["Quito"])),candidate("television-other","television",1,["Quito"],{provider:"television",product:"Segundo programa sintético"})]);
  // No source-derived prior overrides the owner's starting policy.
  const plan={...baseline,plan:[{label:"Televisión",pct:.95,amount:95000},{label:"Digital",pct:.05,amount:5000}]};
  const payload=strategyAiPayload(brief,bundle,plan);
  assert.deepEqual(Object.fromEntries(payload.baseline.map(r=>[r.medium,r.weight])),Object.fromEntries(media.map(m=>[m,STARTING_MEDIA_MIX[m]*100])));
  assert.equal(payload.mixPolicy.adjustable,true);
  const weights={...STARTING_MEDIA_MIX,television:20,digital:40};
  const advice=parseStrategyAdvice(JSON.stringify({summary:"Prioriza la audiencia y las plazas de la campaña.",allocations:media.map(m=>({medium:m,weight:weights[m]*100,rationale:"Responde al objetivo y a la cobertura seleccionada.",evidenceIds:["category-investment"],candidateIds:[]})),questions:[]}),brief,bundle);
  assert.ok(advice);
  const report=buildStrategyReport(brief,bundle,plan,{...options,aiState:"validated",advice});
  assert.equal(report.allocations.find(a=>a.medium==="digital")?.amountUsd,40000);
  assert.equal(report.allocations.find(a=>a.medium==="television")?.amountUsd,20000);
  assert.ok(report.evaluation.budgetConserved);
  const restricted={...brief,restrictions:"Sin televisión"};
  assert.ok(strategyAiPayload(restricted,bundle,plan).baseline.every(r=>r.medium!=="television"));
});

test("a fixed asset cannot retain budget that another execution can actually use",()=>{
  const rows=allocateStrategyExecutions([candidate("fixed","ooh",1500,["Quito"],{maximumUnits:1}),candidate("circuit","ooh",100,["Quito"])],10000);
  assert.equal(rows[0].amountUsd,1500);assert.equal(rows[0].units,1);
  assert.equal(rows[1].amountUsd,8500);assert.equal(rows[1].units,85);
  assert.equal(rows.reduce((n,r)=>n+r.referenceSpendUsd!,0),10000);
});

test("OOH uses additional unique inventory instead of assigning an unusable envelope to two locations",()=>{
  const brief=strategyBrief({selectedMedia:["ooh"],budgetUsd:9000});
  const bundle=evidence(Array.from({length:6},(_,i)=>candidate(`fixed-${i}`,"ooh",1500,["Quito"],{maximumUnits:1})));
  const report=buildStrategyReport(brief,bundle,baseline,options);
  const rows=report.allocations[0].executions!;
  assert.equal(rows.length,6);assert.ok(rows.every(r=>r.units===1&&r.amountUsd===1500));
  assert.equal(report.reserveUsd,0);assert.ok(report.evaluation.budgetConserved);
  const limited=buildStrategyReport({...brief,budgetUsd:12000},bundle,baseline,options);
  assert.equal(limited.allocations[0].amountUsd,9000);assert.equal(limited.reserveUsd,3000);
  assert.ok(limited.evaluation.budgetConserved);
  const reduced=customizeStrategyPlan({...baseline,strategy:report},[{label:"Vía pública",pct:1,amount:9000}],1000);
  assert.equal(reduced.strategy?.allocations[0].amountUsd,0);
  assert.equal(reduced.strategy?.reserveUsd,1000);
  assert.equal(reduced.plan[0].amount,0);
});

test("radio expands station selection before planning dozens of insertions per station per day",()=>{
  const brief=strategyBrief({selectedMedia:["radio"],budgetUsd:12000,startDate:"2026-11-01",endDate:"2026-11-30"});
  const bundle=evidence(Array.from({length:8},(_,i)=>candidate(`workspace:station-${i}`,"radio",10,["Nacional"],{stationId:`station-${i}`,stationCoverage:["Nacionales"]})));
  const report=buildStrategyReport(brief,bundle,baseline,options),rows=report.allocations[0].executions!;
  assert.equal(rows.length,8);assert.ok(rows.every(r=>r.units!<=120));
  assert.equal(new Set(rows.map(r=>r.candidate.stationId)).size,rows.length);
  assert.equal(rows.reduce((n,r)=>n+r.referenceSpendUsd!,0),9600);
  assert.equal(report.reserveUsd,2400);
});

test("a nationwide movable format can serve a canton but does not cover all requested places with one unit",()=>{
  const catalogs=strategyCatalogs();
  const asset=parseOohAsset({id:"synthetic-movable",provider_slug:"synthetic",provinces:["Nacional"],details:{name:"Valla móvil sintética",city:"Ecuador",recordType:"format",rates:[]}})!;
  catalogs.ooh.assets=[asset];
  catalogs.workspaceProducts=[{key:"ooh:synthetic-movable:0",kind:"ooh",provider:"Proveedor sintético",name:asset.name,format:"Valla móvil",unit:"salida",priceCents:100000,taxIncluded:false,location:"Ecuador",marketKeys:["nacional"],reference:"",conditions:"",image:null,validFrom:"2026-11-01",validTo:null,source:{assetId:asset.id,standingPrice:true}}];
  const brief=strategyBrief({selectedMedia:["ooh"],budgetUsd:2000,geography:"Tulcán, Quito",coverage:[{key:"city:tulcan:carchi",kind:"city",label:"Tulcán",context:"Carchi"},{key:"city:quito:pichincha",kind:"city",label:"Quito",context:"Pichincha"}]});
  const bundle=buildStrategyEvidence(brief,strategyResearch,catalogs,"2026-11-02");
  assert.ok(bundle.candidates.some(c=>c.id.startsWith("workspace:")&&c.unitPriceUsd===1000));
  const report=buildStrategyReport(brief,bundle,baseline,options),rows=report.allocations[0].executions!;
  assert.deepEqual(rows.map(r=>r.candidate.planningTerritory),["Tulcán","Quito"]);
  assert.ok(rows.every(r=>r.units===1&&r.candidate.metrics.length===0));
  assert.equal(rows.reduce((n,r)=>n+r.referenceSpendUsd!,0),2000);
});
