import assert from "node:assert/strict";
import test from "node:test";
import {handlePlanningRequest} from "../lib/planning-request";

const url="https://one.example/api/planning";
const request=(body:unknown,origin:string|null="https://one.example")=>new Request(url,{method:"POST",headers:{"content-type":"application/json",...(origin?{origin}:{})},body:JSON.stringify(body)});
test("planning transport retains repeated brief fields and returns only the opaque preparation",async()=>{
  const response=await handlePlanningRequest(request({phase:"prepare",fields:[["selectedMedia","television"],["selectedMedia","radio"],["brand","Synthetic"]]}),{
    prepare:async form=>{assert.deepEqual(form.getAll("selectedMedia"),["television","radio"]);return {ok:true,preparation:"opaque-owner-bound-value"};},
    complete:async()=>assert.fail("unexpected completion"),
  });
  assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"private, no-store");
  assert.deepEqual(await response.json(),{ok:true,preparation:"opaque-owner-bound-value"});
});
test("a completion still passes the encrypted token to the authenticated owner check",async()=>{
  const token="x".repeat(80);
  const response=await handlePlanningRequest(request({phase:"complete",preparation:token}),{
    prepare:async()=>assert.fail("unexpected preparation"),
    complete:async actual=>{assert.equal(actual,token);return {ok:false,error:"Acceso requerido"};},
  });
  assert.deepEqual(await response.json(),{ok:false,error:"Acceso requerido"});
});
test("cross-origin, malformed and oversized planning calls cannot invoke either stage",async()=>{
  const deps={prepare:async()=>assert.fail("not authorized"),complete:async()=>assert.fail("not authorized")};
  for(const origin of [null,"https://attacker.example"])assert.equal((await handlePlanningRequest(request({phase:"prepare",fields:[]},origin),deps)).status,403);
  for(const body of [{phase:"unknown"},{phase:"complete",preparation:"plaintext-source-data"},{phase:"prepare",fields:[["brand",{}]]},{phase:"prepare",fields:[["brand","x".repeat(41_000)]]}])assert.equal((await handlePlanningRequest(request(body),deps)).status,400);
  assert.equal((await handlePlanningRequest(request({phase:"complete",preparation:"x".repeat(650_000)}),deps)).status,413);
  const internal=new Request("https://internal-amplify/api/planning",{method:"POST",headers:{origin:"https://one.example","content-type":"application/json"},body:'{"phase":"unknown"}'});
  assert.equal((await handlePlanningRequest(internal,deps,"https://one.example")).status,400);
});
test("request deadlines and internal failures remain structured without disclosing internals",async()=>{
  for(const prepare of [async()=>{throw new Error("private-key-and-source");},()=>new Promise(()=>{})]){
    const response=await handlePlanningRequest(request({phase:"prepare",fields:[]}),{prepare,complete:async()=>null},undefined,5);
    assert.equal(response.status,503);const body=await response.text();assert.ok(body.includes('"ok":false'));assert.ok(!body.includes("private-key"));
  }
});
