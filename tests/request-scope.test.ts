import assert from "node:assert/strict";
import test from "node:test";
import {requestScoped,withRequestScope} from "../lib/request-scope";

test("concurrent users never share authentication or workspace context",async()=>{
  let reads=0;
  const run=(user:string)=>withRequestScope(async()=>{
    const read=async()=>{reads++;await new Promise(resolve=>setTimeout(resolve,1));return {user};};
    const [first,second]=await Promise.all([requestScoped("session-profile",read),requestScoped("session-profile",read)]);
    assert.equal(first,second);return first;
  });
  const result=await Promise.all([run("admin"),run("client"),run("provider")]);
  assert.deepEqual(result.map(r=>r.user),["admin","client","provider"]);assert.equal(reads,3);
  assert.notEqual(await run("admin"),result[0]);assert.equal(reads,4);
});
test("ordinary calls remain uncached and failed authentication never leaks a different result",async()=>{
  let reads=0;const read=async()=>++reads;
  assert.equal(await requestScoped("profile",read),1);assert.equal(await requestScoped("profile",read),2);
  await withRequestScope(async()=>{
    await assert.rejects(requestScoped("profile",async()=>{throw new Error("denied");}),/denied/);
    await assert.rejects(requestScoped("profile",read),/denied/);
  });
  assert.equal(await withRequestScope(()=>requestScoped("profile",read)),3);
});
