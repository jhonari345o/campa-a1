import test from "node:test";
import assert from "node:assert/strict";
import { catalogReplacementOptions, replaceCatalogProduct } from "../lib/catalog-cart-replacements";
import type { CatalogProduct } from "../lib/catalog-shopping";
const product = (key: string, seconds: number, stationId = "station-one"): CatalogProduct => ({key,kind:"radio",provider:"Radio de prueba",name:"Rotativo",format:`Cuña de ${seconds} s`,unit:"cuña",priceCents:800,taxIncluded:false,location:"Provincia",reference:"",conditions:"",image:null,source:{stationId,seconds}});
test("replacement offers only priced formats of the same station in the resolved account catalog", () => {
  const twenty=product("radio:a",20),thirty=product("radio:b",30);
  const products=[twenty,thirty,product("radio:other",20,"station-two"),{...product("radio:unknown",20),priceCents:null},product("radio:mention",10)];
  assert.deepEqual(catalogReplacementOptions("radio:station-one:quote",products),[twenty,thirty]);
  assert.deepEqual(catalogReplacementOptions("radio:unrelated:quote",products),[]);
  assert.deepEqual(catalogReplacementOptions("tv:station-one:quote",products),[]);
});
test("an explicit duration selection preserves old quantity and all other media", () => {
  const items=[{productKey:"radio:station-one:quote",quantity:50},{productKey:"tv:news",quantity:3}];
  const result=replaceCatalogProduct(items,items[0].productKey,"radio:b",[product("radio:b",30)]);
  assert.deepEqual(result,[{productKey:"radio:b",quantity:50},{productKey:"tv:news",quantity:3}]);
  assert.equal(items[0].productKey,"radio:station-one:quote");
});
test("replacing merges an existing format without duplication and enforces quantity bounds", () => {
  const products=[product("radio:a",20)];
  assert.deepEqual(replaceCatalogProduct([{productKey:"radio:station-one:quote",quantity:50},{productKey:"radio:a",quantity:5}],"radio:station-one:quote","radio:a",products),[{productKey:"radio:a",quantity:55}]);
  assert.throws(()=>replaceCatalogProduct([{productKey:"radio:station-one:quote",quantity:10000},{productKey:"radio:a",quantity:1}],"radio:station-one:quote","radio:a",products));
  assert.throws(()=>replaceCatalogProduct([{productKey:"radio:station-one:quote",quantity:50}],"radio:station-one:quote","radio:other",products));
});
