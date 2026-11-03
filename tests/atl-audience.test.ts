import assert from "node:assert/strict";
import test from "node:test";
import { parseAtlAudience, pressAudienceApplies, pressObservationFor, oohMarketReferences, type PressAudience, type OohObservation } from "../lib/atl-audience";
import { buildStrategyEvidence } from "../lib/media-strategy-evidence";
import { strategyAiPayload, parseStrategyAdvice, strategyCandidatePool } from "../lib/media-strategy";
import { strategyBrief, strategyCatalogs, strategyResearch } from "./media-strategy-fixture";
import type { MediaPlan } from "../lib/planner";

const press:PressAudience={id:"synthetic-press-1",provider:"Diario sintético",sex:"all",ageMin:18,ageMax:99,nse:"all",universe:100000,audience:12000,reachPct:12,exclusiveReachPct:8,rank:1,periodStart:"2026-08-01",periodEnd:"2026-08-31",marketKeys:["guayaquil","quito"],row:6,derived:true};
const ooh:OohObservation={id:"synthetic-ooh-1",city:"Quito",street:"Calle sintética",intersection:"Cruce sintético",sector:"Norte",provider:"Proveedor sintético",format:"Metálica",height:4,width:8,latitude:-.2,longitude:-78.5,observedOn:null,rank:1,score:80,circulation:10000,estimatedImpacts:7000,impactPeriod:"unspecified",originalImageCode:"SYNTHETIC",row:4};
const brief=()=>strategyBrief({selectedMedia:["press","ooh"],coverage:[{key:"province:guayas",kind:"province",label:"Guayas"},{key:"province:pichincha",kind:"province",label:"Pichincha"}],geography:"Guayas, Pichincha"});
const date="2026-11-02";
test("press keeps the entire measured geography, exact target and real observation period",()=>{
 assert.ok(pressAudienceApplies(press,brief(),date));
 for(const change of [{coverage:undefined,geography:"Guayaquil"},{ageRange:"Personas 25-34"},{sex:"Mujeres"},{socioeconomic:"NSE Alto"},{startDate:"2026-08-01"},{startDate:"2028-01-01"}])assert.equal(pressAudienceApplies(press,{...brief(),...change},date),false);
});
test("publication readership cannot be attached to a digital product",()=>{
 assert.equal(pressObservationFor(press.provider,"Página impresa",[press],brief(),date)?.id,press.id);
 assert.equal(pressObservationFor(press.provider,"Banner web CPM",[press],brief(),date),undefined);
 assert.equal(pressObservationFor("Otro diario","Página",[press],brief(),date),undefined);
});
test("imports reject mismatched universes, duplicate identities and unsafe coordinates",()=>{
 assert.equal(parseAtlAudience({version:1,medium:"press",rows:[press]},"press").length,1);
 for(const rows of [[{...press,reachPct:15}],[press,press],[{...press,exclusiveReachPct:20}]])assert.throws(()=>parseAtlAudience({version:1,medium:"press",rows},"press"));
 assert.equal(parseAtlAudience({version:1,medium:"ooh",rows:[ooh]},"ooh").length,1);
 assert.throws(()=>parseAtlAudience({version:1,medium:"ooh",rows:[{...ooh,latitude:200}]},"ooh"));
});
test("historical OOH stays geographical context with original impact units and deduplicated locations",()=>{
 const rows=[ooh,{...ooh,id:"synthetic-ooh-duplicate",rank:2},{...ooh,id:"synthetic-gye",city:"Guayaquil",observedOn:"2022-05-15",impactPeriod:"day" as const},{...ooh,id:"synthetic-future",observedOn:"2027-01-01"}];
 const result=oohMarketReferences(rows,brief(),date);
 assert.equal(result.length,2);assert.deepEqual(new Set(result.map(r=>r.impactPeriod)),new Set(["day","unspecified"]));
 assert.equal(oohMarketReferences(rows,{...brief(),coverage:undefined,geography:"Cuenca"},date).length,0);
});
test("AI receives press reach and OOH research without turning the study rows into purchasable assets",()=>{
 const c=strategyCatalogs();c.atlAudience={press:[press],ooh:[ooh]};
 c.workspaceProducts=[{key:"ooh:synthetic-stock",kind:"ooh",provider:"Inventario sintético",name:"Valla en Quito",format:"Valla fija",unit:"mes",priceCents:100000,location:"Quito",marketKeys:["quito"],reference:"",conditions:"",image:null,taxIncluded:false,validFrom:"2026-01-01",validTo:"2026-12-31",source:{workspaceProductId:"synthetic-stock"}}];
 const bundle=buildStrategyEvidence(brief(),strategyResearch,c,date);
 assert.equal(bundle.audienceReferences.find(r=>r.medium==="press")?.reachPct,12);
 assert.equal(bundle.audienceReferences.find(r=>r.medium==="press")?.rating,null);
 assert.equal(bundle.oohMarketReferences?.length,1);
 assert.equal(bundle.sources.find(s=>s.id==="ooh-study:quito")?.use,"context");
 assert.equal(bundle.candidates.filter(c=>c.medium==="ooh").length,1);assert.ok(bundle.candidates.every(c=>c.id!==ooh.id));
 const baseline={plan:[],matched:0,totalRef:0,basis:"infomedia",benchmark:[],profileLabel:"Sintético",strategySummary:""} as MediaPlan;
 const payload=strategyAiPayload(brief(),bundle,baseline);
 assert.equal(payload.evidence.oohMarketReferences?.[0].estimatedImpacts,7000);
 assert.ok(payload.allocationOptions.find(o=>o.medium==="ooh")?.evidenceIds.includes("ooh-study:quito"));
 const advice={summary:"Presencia en las zonas del brief.",allocations:[{medium:"ooh",weight:10000,rationale:"Complementa la cobertura territorial.",evidenceIds:["ooh-study:quito"],candidateIds:[]}],questions:[]};
 assert.ok(parseStrategyAdvice(JSON.stringify(advice),brief(),bundle));
});
test("unranked press remains selectable and publication variety survives a large tariff",()=>{
 const c=strategyCatalogs();c.atlAudience={press:[press],ooh:[]};
 c.workspaceProducts=Array.from({length:150},(_,i)=>({key:`press:synthetic-${i}`,kind:"press" as const,provider:i<148?press.provider:"Diario fuera del estudio",name:`Formato ${i}`,format:"Página impresa",formatGroup:"other" as const,unit:"inserción",priceCents:10000+i,location:"Guayaquil, Quito",marketKeys:["guayaquil","quito"],reference:"",conditions:"",image:null,taxIncluded:false,validFrom:"2026-01-01",validTo:"2026-12-31",source:{workspaceProductId:`synthetic-${i}`}}));
 const bundle=buildStrategyEvidence(brief(),strategyResearch,c,date);
 assert.ok(bundle.candidates.some(c=>c.provider==="Diario fuera del estudio"&&!c.metrics.length));
 const pool=strategyCandidatePool(bundle,"press",brief()).slice(0,8);
 assert.ok(pool.some(c=>c.provider==="Diario fuera del estudio"));
 assert.ok(pool.some(c=>c.metrics.some(m=>m.label==="Alcance de lectura"&&m.value===12)));
});
test("outdoor inventory outside the studied cities survives large catalogs for geographic coverage",()=>{
 const c=strategyCatalogs();c.atlAudience={press:[],ooh:[ooh]};
 c.workspaceProducts=Array.from({length:150},(_,i)=>({key:`ooh:synthetic-${i}`,kind:"ooh" as const,provider:"Inventario sintético",name:`Valla ${i}`,format:"Valla fija",unit:"mes",priceCents:100000+i,location:i<148?"Guayaquil":"Cuenca",marketKeys:[i<148?"guayaquil":"cuenca"],reference:"",conditions:"",image:null,taxIncluded:false,validFrom:"2026-01-01",validTo:"2026-12-31",source:{workspaceProductId:`synthetic-${i}`}}));
 const b={...brief(),coverage:undefined,geography:"Guayaquil, Cuenca"};
 const bundle=buildStrategyEvidence(b,strategyResearch,c,date),pool=strategyCandidatePool(bundle,"ooh",b).slice(0,8);
 assert.ok(pool.some(c=>c.market.includes("Cuenca")&&!c.metrics.length));
 assert.ok(pool.some(c=>c.market.includes("Guayaquil")));
 assert.equal(bundle.oohMarketReferences?.length,0);
});
test("province briefs retain documented city press offers without widening packages or inventing validity",()=>{
 const c=strategyCatalogs();
 const offers=[{id:"gye",market:"Guayaquil",marketOptions:[["guayaquil"]]},{id:"uio",market:"Quito",marketOptions:[["quito"]]},{id:"gye-uio",market:"Guayaquil y Quito",marketOptions:[["guayaquil","quito"]]},{id:"cuenca",market:"Cuenca",marketOptions:[["cuenca"]]},{id:"wide",market:"Paquete tres ciudades",marketOptions:[["guayaquil","quito","cuenca"]]},{id:"unknown",market:"Sin plaza documentada",marketOptions:[]}].map(o=>({...o,group:"Impreso",name:"Página impresa",specs:"",target:"General",unit:"inserción" as const,priceUsd:100,duration:"",notes:""}));
 c.press.entries=[{id:"synthetic-press",name:"Diario sintético",regionKeys:["guayas","pichincha"],city:null,description:"",logoPath:null,website:null,coverage:"",editions:[{id:"current",label:"Edición sintética",period:"2026",validFrom:"2026-01-01",validTo:"2026-12-31",taxIncluded:false,conditions:[],offers}]}];
 let bundle=buildStrategyEvidence(brief(),strategyResearch,c,date);
 assert.deepEqual(bundle.candidates.map(c=>c.id.split(":").at(-1)),["gye","uio","gye-uio"]);
 assert.ok(bundle.candidates.every(c=>c.unitPriceUsd===100));
 c.press.entries[0].editions[0].validTo=null;
 bundle=buildStrategyEvidence(brief(),strategyResearch,c,date);
 assert.equal(bundle.candidates.length,3);
 assert.ok(bundle.candidates.every(c=>c.unitPriceUsd===null&&c.referencePriceUsd===100));
 c.press.entries[0].editions[0].validTo="2025-12-31";
 assert.equal(buildStrategyEvidence(brief(),strategyResearch,c,date).candidates.length,0);
});
