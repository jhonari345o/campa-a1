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
  for(const [available,expected] of [[8000,8000],[38000,25000]]){
    let budget=0;
    const {deps}=dependencies({persist:async(_value,diagnostic)=>{budget=diagnostic.budgetMs;return true;}});
    assert.equal((await resolveStrategyAi(brief,bundle,"{}",available,deps)).state,"validated");
    assert.equal(budget,expected);
    assert.ok(budget<30000);
  }
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
