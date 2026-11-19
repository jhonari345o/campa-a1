import test from "node:test";
import assert from "node:assert/strict";
import {diversifyRadio,diversifyTelevision,planningDaypart} from "../lib/planning-broadcast";
import {allocateStrategyExecutions} from "../lib/media-strategy";
import type {StrategyCandidate} from "../lib/media-strategy-evidence";
import {strategyBrief} from "./media-strategy-fixture";
const c=(id:string,patch:Partial<StrategyCandidate>={}):StrategyCandidate=>({id,medium:"radio",provider:id,product:id,market:"Quito",target:"Personas 18+",period:"2026-11",sourceIds:[],sourceUse:"comparable",unit:"cuña",unitPriceUsd:15,referencePriceUsd:15,minimumUnits:1,minimumSpendUsd:15,metrics:[],note:"",coverageKeys:["quito"],...patch});
test("monthly radio budgets produce ten or more distinct stations with bounded station spend",()=>{
  const pool=Array.from({length:20},(_,i)=>c(`station-${i}`,{stationId:`station-${i}`}));
  const brief=strategyBrief({budgetUsd:20000,selectedMedia:["radio"]});
  const selected=diversifyRadio(pool,pool.slice(0,2),brief,20000,25),rows=allocateStrategyExecutions(selected,20000);
  assert.ok(rows.length>=10);assert.ok(rows.every(r=>r.amountUsd!>=1000&&r.amountUsd!<=2000));
  assert.equal(new Set(rows.map(r=>r.candidate.stationId)).size,rows.length);
  assert.equal(rows.reduce((n,r)=>n+Math.round(r.amountUsd!*100),0),2000000);
  const short=diversifyRadio(pool,[],{...brief,endDate:"2026-11-15"},10000,25);
  assert.ok(allocateStrategyExecutions(short,10000).every(r=>r.amountUsd!<=1000));
});
test("television includes multiple programmes and planning bands per channel, weighted by comparable channel share",()=>{
  const pool=["channel-a","channel-b","channel-c"].flatMap(provider=>(["A","AA","AAA","Late"] as const).map(band=>c(`${provider}-${band}`,{medium:"television",provider,product:`Programa ${band}`,unitPriceUsd:100,minimumSpendUsd:100,planningDaypart:band})));
  const shares=pool.filter(c=>c.planningDaypart==="A").map((c,i)=>({provider:c.provider,sharePct:[50,30,20][i],period:"2026-10",market:"Quito",target:"Personas 18+"}));
  const brief=strategyBrief({selectedMedia:["television"],budgetUsd:60000});
  const rows=allocateStrategyExecutions(diversifyTelevision(pool,[pool[0]],brief,60000,shares,25),60000);
  assert.equal(rows.length,9);assert.ok(rows.every(r=>r.candidate.planningDaypart!=="Late"));
  const sums=shares.map(s=>rows.filter(r=>r.candidate.provider===s.provider).reduce((n,r)=>n+r.amountUsd!,0));
  assert.ok(sums[0]>sums[1]&&sums[1]>sums[2]);assert.equal(sums.reduce((a,b)=>a+b),60000);
  for(const {provider} of shares)assert.equal(new Set(rows.filter(r=>r.candidate.provider===provider).map(r=>r.candidate.product)).size,3);
  assert.ok(diversifyTelevision(pool,[],{...brief,audience:"Público adulto nocturno"},60000,shares,25).some(c=>c.planningDaypart==="Late"));
  assert.ok(diversifyTelevision(pool,[],{...brief,ageRange:"Personas 12–17",audience:"Público adulto"},60000,shares,25).every(c=>c.planningDaypart!=="Late"));
  assert.equal(diversifyTelevision([pool[0]],[],brief,60000,shares,25).length,0);
});
test("time bands do not mistake Spanish prepositions for a supplier band",()=>{
  assert.equal(planningDaypart("Lunes a viernes · 20:00"),"AAA");
  assert.equal(planningDaypart("08:30"),"A");assert.equal(planningDaypart("13:00"),"AA");assert.equal(planningDaypart("23:30"),"Late");
  assert.equal(planningDaypart("Franja AA"),"AA");assert.equal(planningDaypart("Horario por definir"),undefined);
});
test("the same programme in Guayaquil and Quito retains both commercial editions",()=>{
  const pool=["Guayaquil","Quito"].flatMap(market=>["Ecuavisa","RTS"].flatMap(provider=>(["A","AA","AAA"] as const).map(band=>c(`${market}-${provider}-${band}`,{medium:"television",provider,product:`Programa ${band}`,market,coverageKeys:[market],unitPriceUsd:100,minimumSpendUsd:100,planningDaypart:band}))));
  const brief=strategyBrief({selectedMedia:["television"],geography:"Guayas, Pichincha",budgetUsd:60000});
  const selected=diversifyTelevision(pool,[],brief,60000,[],25);
  assert.equal(selected.length,12);
  for(const market of ["Guayaquil","Quito"])for(const provider of ["Ecuavisa","RTS"])assert.equal(selected.filter(c=>c.market===market&&c.provider===provider).length,3);
  const limited=diversifyTelevision(pool,[],brief,400,[],25);
  assert.equal(limited.length,4);assert.equal(new Set(limited.map(c=>c.market)).size,2);
});
