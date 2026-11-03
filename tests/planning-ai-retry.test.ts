import test from "node:test";
import assert from "node:assert/strict";
import {completeWithFreeAiRetry,failedFreeModelIds} from "../lib/planning-ai-retry";

test("one persisted free-model failure gets one continuation and returns its validated result",async()=>{
 let calls=0;
 const validated={ok:true,plan:{strategy:{aiState:"validated"}}};
 const result=await completeWithFreeAiRetry(async()=>++calls===1?{ok:true,plan:{strategy:{aiState:"unavailable",aiRetryable:true}}}:validated);
 assert.equal(calls,2);assert.equal(result,validated);
 calls=0;
 const failure={ok:true,plan:{strategy:{aiState:"rejected",aiRetryable:true}}};
 assert.equal(await completeWithFreeAiRetry(async()=>{calls++;return failure;}),failure);
 assert.equal(calls,2,"a second failure cannot cause an unbounded loop");
});

test("unknown transport outcomes, quota, authentication and successful results never replay",async()=>{
 for(const result of [{ok:false},{ok:true,plan:{strategy:{aiState:"quota",aiRetryable:true}}},{ok:true,plan:{strategy:{aiState:"unavailable"}}},{ok:true,plan:{strategy:{aiState:"validated",aiRetryable:true}}},{ok:true,plan:{strategy:{aiState:"cached"}}}]){
  let calls=0;assert.equal(await completeWithFreeAiRetry(async()=>{calls++;return result;}),result);assert.equal(calls,1);
 }
 let calls=0;
 await assert.rejects(completeWithFreeAiRetry(async()=>{calls++;throw new Error("NETWORK_UNKNOWN_OUTCOME");}));
 assert.equal(calls,1);
});

test("retry routing reads only bounded free model identifiers from server diagnostics",()=>{
 assert.deepEqual(failedFreeModelIds({_diagnostic:{attemptedModels:["vendor/one:free","vendor/two:free","vendor/one:free","vendor/paid","https://example.com?q=private",123],routedModel:"vendor/actual:free"},prompt:"private"}),["vendor/one:free","vendor/two:free","vendor/actual:free"]);
 assert.deepEqual(failedFreeModelIds({_diagnostic:{attemptedModels:"private",routedModel:{key:"private"}}}),[]);
 assert.deepEqual(failedFreeModelIds(null),[]);
 assert.equal(failedFreeModelIds({_diagnostic:{attemptedModels:Array.from({length:20},(_,i)=>`vendor/model-${i}:free`)}}).length,12);
});
