import test from "node:test";
import assert from "node:assert/strict";
import {openPlanningPreparation,sealPlanningPreparation} from "../lib/planning-preparation";

const secret="synthetic-key-only-for-unit-tests",owner="synthetic-owner",now=1793649600000;
const prepared={brief:{budget:10000},sources:[{price:17,privateMarker:"synthetic-private-source"}]};
test("planning handoff is encrypted, authenticated, owner-bound and short-lived",()=>{
  const token=sealPlanningPreparation(prepared,owner,secret,now);
  assert.deepEqual(openPlanningPreparation(token,owner,secret,now),prepared);
  assert.equal(Buffer.from(token,"base64url").includes(Buffer.from("synthetic-private-source")),false);
  assert.notEqual(token,sealPlanningPreparation(prepared,owner,secret,now));
  assert.throws(()=>openPlanningPreparation(token,"another-owner",secret,now));
  assert.throws(()=>openPlanningPreparation(token,owner,"rotated-key",now));
  assert.throws(()=>openPlanningPreparation(token,owner,secret,now+300000));
  const changed=Buffer.from(token,"base64url");changed[changed.length-1]^=1;
  assert.throws(()=>openPlanningPreparation(changed.toString("base64url"),owner,secret,now));
});
test("planning handoff rejects missing keys and oversized or malformed input",()=>{
  assert.throws(()=>sealPlanningPreparation(prepared,owner,"",now));
  assert.throws(()=>sealPlanningPreparation({text:"x".repeat(1000000)},owner,secret,now));
  for(const input of ["", "x".repeat(600001), "not.a.valid.token"])assert.throws(()=>openPlanningPreparation(input,owner,secret,now));
});
