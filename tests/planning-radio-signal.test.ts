import test from "node:test";
import assert from "node:assert/strict";
import {radioCommercialCoverage} from "../lib/planning-market";
import {buildStrategyEvidence} from "../lib/media-strategy-evidence";
import {strategyBrief,strategyCatalogs,strategyResearch} from "./media-strategy-fixture";

test("radio commercial coverage is the intersection of the purchased tariff and real signal",()=>{
  assert.deepEqual(radioCommercialCoverage(["Nacional"],["guayas"]),["guayas"]);
  assert.deepEqual(radioCommercialCoverage(["Quito"],["national"]),["quito"]);
  assert.deepEqual(radioCommercialCoverage(["Nacional"],["national"]),["nacional"]);
  assert.deepEqual(radioCommercialCoverage(["Quito"],["pichincha"]),["quito"]);
  assert.deepEqual(radioCommercialCoverage(["Pichincha"],["quito"]),["quito"]);
  assert.deepEqual(radioCommercialCoverage(["Guayas"],["pichincha"]),[]);
  assert.deepEqual(radioCommercialCoverage(["Nacional"],["guayas","pichincha"]),["guayas","pichincha"]);
});

test("a national rate label cannot recommend a local station outside its actual coverage",()=>{
  const catalogs=strategyCatalogs();
  catalogs.radio.stations=[{id:"synthetic-local",name:"Emisora sintética",regionKeys:["guayas"],city:"Guayaquil",dial:null,genres:[],description:"",logoPath:null,reviewedAt:null,profile:{coverage:"Guayas",website:null,tariffs:[],rankingLinks:[]}}];
  catalogs.workspaceProducts=[{key:"radio:workspace:synthetic",kind:"radio",provider:"Emisora sintética",name:"Horario rotativo",format:"Cuña de 20 s",unit:"cuña de 20 s",priceCents:1300,taxIncluded:false,location:"Nacional",marketKeys:["nacional"],reference:"",conditions:"",image:null,validFrom:"2026-11-01",validTo:null,source:{stationId:"synthetic-local",workspaceProductId:"synthetic",agreementId:"synthetic-agreement"}}];
  const evidence=(geography:string)=>buildStrategyEvidence(strategyBrief({selectedMedia:["radio"],coverage:undefined,geography}),strategyResearch,catalogs,"2026-11-03");
  assert.equal(evidence("Quito").candidates.length,0);
  const local=evidence("Guayas").candidates[0];
  assert.equal(local.unitPriceUsd,13,"keep the current account price");
  assert.equal(local.market,"Guayas");
  assert.deepEqual(local.coverageKeys,["guayas"]);
  assert.deepEqual(local.stationCoverage,["Guayas"]);
  assert.deepEqual(local.metrics,[],"commercial coverage is not audience measurement");
  assert.deepEqual(evidence("Nacional").candidates[0].coverageKeys,["guayas"]);
  catalogs.radio.stations[0].regionKeys=["national"];
  catalogs.workspaceProducts[0].marketKeys=["quito"];
  assert.equal(evidence("Guayas").candidates.length,0,"a local tariff cannot buy the whole national signal");
  assert.deepEqual(evidence("Quito").candidates[0].coverageKeys,["quito"]);
});
