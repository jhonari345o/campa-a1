import assert from "node:assert/strict";
import test from "node:test";
import { resolveStrategyAi } from "../lib/media-strategy-ai";
import { buildStrategyEvidence } from "../lib/media-strategy-evidence";
import { strategyBrief,strategyCatalogs,strategyResearch } from "./media-strategy-fixture";
const brief=strategyBrief({selectedMedia:["digital"]}),bundle=buildStrategyEvidence(brief,strategyResearch,strategyCatalogs(),"2026-10-31");
const advice={summary:"Se prioriza una alternativa respaldada por las fuentes disponibles.",allocations:[{medium:"digital",weight:10000,rationale:"Responde al objetivo y permite preparar la medición.",evidenceIds:["category-investment"],candidateIds:[]}],questions:[]};
function dependencies(patch:Partial<Parameters<typeof resolveStrategyAi>[4]>={}) {
  const count={claim:0,invoke:0,persist:0};
  const deps={enabled:true,allowRequest:true,cacheAvailable:true,cached:null,claim:async()=>{count.claim++;return true;},invoke:async()=>{count.invoke++;return JSON.stringify(advice);},persist:async()=>{count.persist++;return true;},...patch};
  return {deps,count};
}
test("disabled, read-only, quota and missing-cache paths never invoke a model",async()=>{
  for(const [patch,state] of [[{enabled:false},"not_configured"],[{allowRequest:false},"unavailable"],[{cacheAvailable:false},"unavailable"],[{claim:async()=>false},"quota"]] as const){
    const {deps,count}=dependencies(patch);assert.equal((await resolveStrategyAi(brief,bundle,"{}",2000,deps)).state,state);assert.equal(count.invoke,0);
  }
});
test("an owner-scoped cached answer is revalidated and reused without consuming quota",async()=>{
  const {deps,count}=dependencies({cached:advice});const result=await resolveStrategyAi(brief,bundle,"{}",2000,deps);
  assert.equal(result.state,"cached");assert.equal(count.claim,0);assert.equal(count.invoke,0);assert.ok(result.advice);
});
test("a valid inference is applied only after persistence succeeds",async()=>{
  const {deps,count}=dependencies();assert.equal((await resolveStrategyAi(brief,bundle,"{}",2000,deps)).state,"validated");assert.deepEqual(count,{claim:1,invoke:1,persist:1});
  const failed=dependencies({persist:async()=>false});const result=await resolveStrategyAi(brief,bundle,"{}",2000,failed.deps);assert.equal(result.state,"unavailable");assert.equal(result.advice,null);
});
test("free structured-output repair revalidates every field and persists only the final answer",async()=>{
  let calls=0;const corrections:(string|undefined)[]=[],persisted:unknown[]=[];
  const malformed={...advice,allocations:[{...advice.allocations[0],candidateIds:["invented"]}]};
  const {deps}=dependencies({allowRepair:true,invoke:async(_payload,_signal,correction)=>{corrections.push(correction);return JSON.stringify(++calls===1?malformed:advice);},persist:async(value,info)=>{persisted.push([value,info]);return true;}});
  const result=await resolveStrategyAi(brief,bundle,"{}",19000,deps);
  assert.equal(result.state,"validated");assert.equal(calls,2);assert.deepEqual(corrections,[undefined,"CANDIDATE_UNKNOWN"]);
  assert.equal(persisted.length,1);assert.equal((persisted[0] as [unknown,{attempts:number}])[1].attempts,2);
  assert.deepEqual((persisted[0] as [unknown,{attemptCodes:string[]}])[1].attemptCodes,["OUTPUT_CANDIDATE_UNKNOWN","VALIDATED"]);
});
test("repair never accepts invented candidates and stays inside the original inference deadline",async()=>{
  let calls=0;const signals:AbortSignal[]=[];
  const {deps}=dependencies({allowRepair:true,invoke:async(_payload,signal)=>{calls++;signals.push(signal);return JSON.stringify({...advice,allocations:[{...advice.allocations[0],candidateIds:["invented"]}]});}});
  assert.equal((await resolveStrategyAi(brief,bundle,"{}",19000,deps)).state,"rejected");assert.equal(calls,2);assert.equal(signals[0],signals[1]);
  calls=0;assert.equal((await resolveStrategyAi(brief,bundle,"{}",7000,deps)).state,"rejected");assert.equal(calls,1);
});
test("optional follow-up text cannot discard a valid allocation or bypass source checks",async()=>{
  for(const questions of [undefined,null,"",{},["Consulta breve sin cifras", "El alcance es 99%", "https://example.com"]]){
    const {deps}=dependencies({invoke:async()=>JSON.stringify({...advice,questions})});
    const result=await resolveStrategyAi(brief,bundle,"{}",2000,deps);
    assert.equal(result.state,"validated");
    assert.deepEqual(result.advice?.questions,Array.isArray(questions)?["Consulta breve sin cifras"]:[]);
  }
  const {deps}=dependencies({invoke:async()=>JSON.stringify({...advice,questions:null,allocations:[{...advice.allocations[0],evidenceIds:["invented"]}]})});
  assert.equal((await resolveStrategyAi(brief,bundle,"{}",2000,deps)).state,"rejected");
});
test("planning reserves an inference window within the single-flight lease",async()=>{
  for(const [available,expected] of [[8000,6500],[38000,19000]]){
    let budget=0;
    const {deps}=dependencies({persist:async(_value,diagnostic)=>{budget=diagnostic.budgetMs;return true;}});
    assert.equal((await resolveStrategyAi(brief,bundle,"{}",available,deps)).state,"validated");
    assert.ok(budget<=expected&&budget>=expected-100);
    assert.ok(budget<30000);
  }
});
test("quota latency is deducted before inference and persistence",async()=>{
  const original=Date.now;let now=10000,budget=0;
  Date.now=()=>now;
  try{
    const {deps}=dependencies({claim:async()=>{now+=1000;return true;},persist:async(_value,diagnostic)=>{budget=diagnostic.budgetMs;return true;}});
    assert.equal((await resolveStrategyAi(brief,bundle,"{}",8000,deps)).state,"validated");
    assert.equal(budget,5500);
  }finally{Date.now=original;}
});
test("invalid or failed provider output falls back to data, with no retry or alternate provider",async()=>{
  const invalid=dependencies({invoke:async()=>'{"summary":"invented","allocations":[],"questions":[]}'});
  assert.equal((await resolveStrategyAi(brief,bundle,"{}",2000,invalid.deps)).state,"rejected");
  let calls=0;const failure=dependencies({invoke:async()=>{calls++;throw new Error("unavailable");}});
  const result=await resolveStrategyAi(brief,bundle,"{}",2000,failure.deps);assert.equal(result.state,"unavailable");assert.equal(result.advice,null);assert.equal(calls,1);
});
test("oversized prompts, insufficient time and forged cached sources are rejected before paid inference",async()=>{
  const large=dependencies();assert.equal((await resolveStrategyAi(brief,bundle,"a".repeat(96001),2000,large.deps)).state,"rejected");assert.equal(large.count.claim,0);
  const time=dependencies();assert.equal((await resolveStrategyAi(brief,bundle,"{}",999,time.deps)).state,"unavailable");assert.equal(time.count.invoke,0);
  const cached=structuredClone(advice);cached.allocations[0].evidenceIds=["forged-source"];
  const forged=dependencies({cached,allowRequest:false});assert.equal((await resolveStrategyAi(brief,bundle,"{}",2000,forged.deps)).advice,null);
});
test("failed inference persists only bounded diagnostic metadata, never provider detail or raw output",async()=>{
  for(const [message,expected] of [["PROVIDER_HTTP_429","PROVIDER_HTTP_429"],["account-private-secret","PROVIDER_UNAVAILABLE"]]){
    let diagnostic:unknown;
    const {deps}=dependencies({invoke:async()=>{throw new Error(message);},persist:async(value,info)=>{assert.equal(value,null);diagnostic=info;return true;}});
    const result=await resolveStrategyAi(brief,bundle,"{}",2000,deps);
    assert.equal(result.state,"unavailable");
    assert.equal((diagnostic as {code:string}).code,expected);
    assert.equal(JSON.stringify(diagnostic).includes("account-private-secret"),false);
  }
  let code="";
  const invalid=dependencies({invoke:async()=>JSON.stringify({...advice,allocations:[{...advice.allocations[0],weight:100}]}),persist:async(value,info)=>{assert.equal(value,null);code=info.code;return true;}});
  assert.equal((await resolveStrategyAi(brief,bundle,"{}",2000,invalid.deps)).state,"rejected");
  assert.equal(code,"OUTPUT_WEIGHT_TOTAL");
});

test("unsafe explanatory copy is replaced without losing a validated selection or exposing claims",async()=>{
  for(const unsafe of ["Garantiza las ventas", "Alcanzaremos el 90%", "https://example.com", "<script>alert('x')</script>", "".padEnd(1500,"x")]){
    let info:Record<string,unknown>={},persisted=0;
    const {deps}=dependencies({allowRepair:true,invoke:async()=>JSON.stringify({...advice,summary:unsafe,allocations:[{...advice.allocations[0],rationale:unsafe}]}),persist:async(value,diagnostic)=>{assert.ok(value);persisted++;info=diagnostic;return true;}});
    const result=await resolveStrategyAi(brief,bundle,"{}",19000,deps);
    assert.equal(result.state,"validated");
    assert.equal(result.advice?.allocations[0].weight,10000);
    assert.deepEqual(result.advice?.allocations[0].evidenceIds,["category-investment"]);
    assert.notEqual(result.advice?.summary,unsafe);
    assert.notEqual(result.advice?.allocations[0].rationale,unsafe);
    assert.equal(info.safeTextUsed,true);
    assert.equal(info.attempts,1);
    assert.equal(persisted,1);
    assert.equal(JSON.stringify(result).includes(unsafe),false);
  }
});

test("safe copy fallback never rehabilitates forged sources, candidates or budgets",async()=>{
  for(const patch of [{evidenceIds:["forged"]},{candidateIds:["forged"]},{weight:9999},{medium:"radio"}]){
    const {deps}=dependencies({invoke:async()=>JSON.stringify({...advice,summary:"Garantiza el 99%",allocations:[{...advice.allocations[0],...patch,rationale:"Garantiza todas las ventas"}]})});
    const result=await resolveStrategyAi(brief,bundle,"{}",2000,deps);
    assert.equal(result.state,"rejected");assert.equal(result.advice,null);
  }
});
