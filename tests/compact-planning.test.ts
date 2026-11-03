import assert from "node:assert/strict";
import test from "node:test";
import {televisionStudyMatches,disjointTelevisionStudies} from "../lib/television-measurement";
import {televisionPrograms} from "../lib/television-directory";
import {strategyProviderGroups} from "../lib/strategy-groups";
import {projectResearch,restoreResearch} from "../lib/infomedia";
import type {CatalogProduct} from "../lib/catalog-shopping";
import type {TvAudienceObservation,StrategyCandidate} from "../lib/media-strategy-evidence";
import type {StrategyAllocation} from "../lib/media-strategy";
const product:CatalogProduct={key:"new-grid:channel:news",kind:"tv",provider:"Canal Prueba",name:"Noticias II",format:"Lunes a viernes · 13:00",unit:"cuña de 30 s",priceCents:10000,taxIncluded:false,location:"Nacional",marketKeys:["nacional"],reference:"",image:null,conditions:"",source:{standingPrice:true}};
const observation:TvAudienceObservation={id:"old-measurement",study:"Synthetic",periodStart:"2026-09-01",periodEnd:"2026-09-30",market:"Guayaquil",marketKeys:["guayaquil"],target:"Personas 18+",ageMin:18,ageMax:99,sex:"all",nse:"all",channel:"Canal Prueba",program:"NOTICIAS II · 13:00",basis:"period_average",offerIds:["old-tariff-key"],ratingPct:2,reachPct:null};
test("new TV tariff IDs retain exact scheduled programme measurements",()=>{
 assert.equal(televisionStudyMatches(product,observation),true);
 for(const change of [{channel:"Other channel"},{program:"Noticias I · 13:00"},{program:"Noticias II · 19:00"},{program:"Noticias II"},{program:"Noticias II · Domingo · 13:00"}])assert.equal(televisionStudyMatches(product,{...observation,...change}),false);
 assert.equal(televisionStudyMatches({...product,marketKeys:["quito"]},observation),false);
 assert.equal(televisionStudyMatches({...product,marketKeys:["guayas"]},observation),true);
});
test("national TV uses disjoint city measurements, never duplicate populations",()=>{
 const q={...observation,id:"q",marketKeys:["quito"]},both={...observation,id:"both",marketKeys:["guayaquil","quito"]};
 assert.deepEqual(disjointTelevisionStudies([observation,q,both],["guayaquil","quito"]).map(s=>s.id),["both"]);
 assert.deepEqual(disjointTelevisionStudies([observation,q],["guayaquil","quito"]).map(s=>s.id).sort(),["old-measurement","q"]);
 assert.deepEqual(disjointTelevisionStudies([both,q],["quito"]).map(s=>s.id),["q"]);
});
test("TV list orders early, afternoon and late programmes before unscheduled packages",()=>{
 const rows=[{...product,key:"1",name:"A",format:"23h30"},{...product,key:"2",name:"Z",format:"06:00"},{...product,key:"3",name:"B",format:"Paquete"},product];
 const empty={sources:[],tv:[],radio:[]};
 assert.deepEqual(televisionPrograms(rows,empty,"Nacional").map(r=>r.name),["Z","Noticias II","A","B"]);
});
test("provider cards sum actual execution cost and spots without merging channels",()=>{
 const candidate={id:"1",provider:"ECUAVISA GYE",product:"News",note:"13:00"} as StrategyCandidate;
 const allocation={medium:"television",executions:[{candidate,units:10,amountUsd:1200,referenceSpendUsd:1000,remainderUsd:200},{candidate:{...candidate,id:"2",provider:"Ecuavisa",product:"Morning",note:"06:00"},units:20,amountUsd:2000,referenceSpendUsd:1900,remainderUsd:100},{candidate:{...candidate,id:"3",provider:"Other"},units:5,amountUsd:500,referenceSpendUsd:500,remainderUsd:0}]} as StrategyAllocation;
 const groups=strategyProviderGroups(allocation);
 assert.equal(groups.length,2);assert.equal(groups[0].spots,30);assert.equal(groups[0].spend,2900);assert.equal(groups[0].rows[0].candidate.product,"Morning");
});
test("competition preserves own brand and keeps SOV in its measured context",()=>{
 const brands=Array.from({length:13},(_,i)=>({brand:`Brand ${i}`,estimatedInvestment:100-i,soi:.1,secret:"private"}));
 const research=projectResearch({id:"test",label:"Synthetic"},{periods:[{year:2026,brands,pressureContexts:[{media:"Televisión",market:"Guayaquil",brands:brands.map(b=>({brand:b.brand,grps:20,sov:.1}))}]}]},"2026-10-01","Brand 12");
 assert.equal(research.periods[0].pressureContexts[0].topBrands.at(-1)?.brand,"Brand 12");
 assert.equal(JSON.stringify(research).includes("private"),false);
 assert.equal(restoreResearch(research)?.periods[0].focusBrand?.brand,"Brand 12");
 assert.equal(restoreResearch(research)?.periods[0].pressureContexts[0].market,"Guayaquil");
});

test("Ecuavisa's named Contacto Directo segment retains only its matching hour",()=>{
 const p={...product,provider:"Ecuavisa",name:"Contacto Directo en Televistazo",format:"Lunes a viernes · 07:00"};
 const study={...observation,channel:"Ecuavisa GYE",program:"Contacto directo · 07:00"};
 assert.equal(televisionStudyMatches(p,study),true);
 assert.equal(televisionStudyMatches({...p,format:"Lunes a viernes · 08:00"},study),false);
});

import {strategyDeliveryPicks} from "../lib/strategy-delivery-picks";
test("proposal and analysis measure the exact catalog quantities, not allocated budgets",()=>{
 const candidate={id:"sample",catalogKey:"tv:news"} as StrategyCandidate;
 const rows=[{candidate,units:12},{candidate,units:18},{candidate:{...candidate,catalogKey:"radio:spot"},units:30},{candidate:{...candidate,catalogKey:null},units:10},{candidate:{...candidate,catalogKey:"invalid:fraction"},units:1.5},{candidate:{...candidate,catalogKey:"invalid:negative"},units:-2}];
 const allocations=[{medium:"television",executions:rows,candidate,units:1000},{medium:"radio",executions:[],candidate:{...candidate,catalogKey:"radio:spot"},units:10}] as StrategyAllocation[];
 assert.deepEqual(strategyDeliveryPicks({allocations}),[{productKey:"tv:news",quantity:30},{productKey:"radio:spot",quantity:40}]);
});
