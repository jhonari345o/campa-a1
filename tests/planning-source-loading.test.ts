import assert from "node:assert/strict";
import test from "node:test";
import {PlanningSourcesUnavailable,requirePlanningSources,prepareWithSourceRetry,type PlanningPreparationResult} from "../lib/planning-source-loading";

test("source loading preserves the complete catalog and rejects failures instead of inventing an empty catalog",async()=>{
  const catalog={radio:[{id:"local-signal",price:1200}],tv:[{id:"programme",price:80}]};
  assert.equal(await requirePlanningSources(async()=>catalog,100),catalog);
  await assert.rejects(requirePlanningSources(async()=>{throw new Error("private database error");},100),PlanningSourcesUnavailable);
  await assert.rejects(requirePlanningSources(()=>new Promise(()=>{}),1),PlanningSourcesUnavailable);
});

test("a transient catalog timeout is retried once before inference",async()=>{
  let reads=0,aiCalls=0;
  const prepared=await prepareWithSourceRetry(async()=>++reads===1?{ok:false,retryable:true,error:"Temporary load failure"}:{ok:true,preparation:"complete-server-owned-sources"});
  if(prepared.ok)aiCalls++;
  assert.deepEqual(prepared,{ok:true,preparation:"complete-server-owned-sources"});
  assert.equal(reads,2);assert.equal(aiCalls,1);
});

test("persistent source failures stop before inference, while authorization failures are not retried",async()=>{
  let reads=0,aiCalls=0;
  const result=await prepareWithSourceRetry(async()=>{reads++;return {ok:false,retryable:true,error:"Unavailable"};});
  if(result.ok)aiCalls++;
  assert.equal(reads,2);assert.equal(aiCalls,0);assert.equal(result.ok,false);
  for(const failure of [{ok:false,error:"Access denied"},{ok:false,error:"Invalid brief"}] satisfies PlanningPreparationResult[]){
    reads=0;
    assert.equal(await prepareWithSourceRetry(async()=>{reads++;return failure;}),failure);
    assert.equal(reads,1);
  }
});
