import assert from "node:assert/strict";
import test from "node:test";
import {catalogKindsFor} from "../lib/catalog-loading";

test("changing catalogue keeps products in the cart available without loading every medium",()=>{
  const picks=[{productKey:"radio:workspace:synthetic"},{productKey:"digital:budget:synthetic"}];
  assert.deepEqual(catalogKindsFor("media","influencers",picks),["radio","digital","influencer"]);
  assert.deepEqual(catalogKindsFor("media","tv",[{productKey:"creator:synthetic"}]),["tv","influencer"]);
  assert.deepEqual(catalogKindsFor("media","press",[]),["press"]);
});
test("DIY retains all media while brief and saved plans avoid catalogue loading",()=>{
  assert.equal(catalogKindsFor("diy","",[]).length,6);
  assert.deepEqual(catalogKindsFor("planner","radio",[{productKey:"radio:synthetic"}]),[]);
  assert.deepEqual(catalogKindsFor("plans","tv",[]),[]);
});
