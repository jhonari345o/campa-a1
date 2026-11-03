import test from "node:test";
import assert from "node:assert/strict";
import { televisionChannels, televisionEdition, televisionMarkets } from "../lib/television-directory";
import type { CatalogProduct } from "../lib/catalog-shopping";

const product = (patch: Partial<CatalogProduct> = {}): CatalogProduct => ({ key: "tv:synthetic", kind: "tv", provider: "TC Televisión", name: "Programa sintético", format: "Rotativo", unit: "cuña de 20 s", priceCents: 1700, taxIncluded: false, location: "Guayaquil", reference: "Edición sintética", image: null, conditions: "", source: {}, ...patch });
test("channel navigation retains the same products and account prices", () => {
  const gye = product(), uio = product({ key: "tv:synthetic-uio", location: "Quito", priceCents: 2400, provider: "TC Televisión · edición sintética" });
  const channels = televisionChannels([gye, uio]);
  const tc = channels.find(channel => channel.key === "tc-television")!;
  assert.equal(tc.products.length, 2); assert.equal(tc.products[0], gye); assert.equal(tc.products[1], uio);
  assert.equal(tc.logo, "/providers/tv/tc-television.png");
  assert.deepEqual(televisionMarkets(gye), ["Guayaquil"]); assert.deepEqual(televisionMarkets(uio), ["Quito"]);
});
test("unknown and national commercial coverage never becomes a city-specific tariff", () => {
  assert.deepEqual(televisionMarkets(product({ location: "Nacional" })), ["Nacional"]);
  assert.deepEqual(televisionMarkets(product({ location: "Guayaquil + Quito" })), ["Guayaquil", "Quito"]);
  assert.deepEqual(televisionMarkets(product({ location: "" })), ["Otras plazas"]);
  assert.deepEqual(televisionMarkets(product({ location: "Guayas" })), ["Guayaquil"]);
  assert.deepEqual(televisionMarkets(product({ marketKeys:["pichincha"] })), ["Quito"]);
  assert.deepEqual(televisionMarkets(product({ location: "GYE", marketKeys: ["quito"] })), ["Quito"]);
  assert.equal(televisionEdition(product({ source: { workspaceProductId: "synthetic-private" } }), { sources: [], tv: [], radio: [] }).key, "account");
});

test("programme lists include account defaults alongside broadcast editions and isolate each plaza", async () => {
  const { televisionPrograms } = await import("../lib/television-directory");
  const morning = product({ key:"tv:default:morning-gye",provider:"Ecuavisa GYE",name:"Televistazo en la comunidad",format:"Lunes a viernes · 07:30",source:{defaultPrice:true,standingPrice:true} });
  const noon = product({ ...morning,key:"tv:default:noon-uio",provider:"Ecuavisa UIO",name:"Televistazo II",location:"Quito" });
  const show = product({ key:"tv:source:show",provider:"Ecuavisa",name:"Programa sintético",source:{sourceId:"edition"} });
  const catalog = {sources:[],tv:[],radio:[]};
  const ecuavisa = televisionChannels([morning,noon,show]).find(channel=>channel.key==="ecuavisa")!;
  assert.equal(ecuavisa.products.length,3);
  assert.deepEqual(new Set(televisionPrograms(ecuavisa.products,catalog,"Guayaquil").map(row=>row.key)),new Set([morning.key,show.key]));
  assert.deepEqual(televisionPrograms(ecuavisa.products,catalog,"Quito","televistazo"),[noon]);
  assert.deepEqual(televisionPrograms(ecuavisa.products,catalog,"Guayaquil","","account"),[morning]);
});

test("an expired edition cannot become the initial buying list ahead of the current account programmes", async () => {
  const { activeTelevisionProducts } = await import("../lib/television-directory");
  const old=product({key:"tv:archive",validFrom:"2026-06-01",validTo:"2026-06-30"});
  const active=product({key:"tv:default:news",validFrom:"2026-11-02",validTo:null,source:{defaultPrice:true,standingPrice:true}});
  const future=product({key:"tv:next",validFrom:"2026-12-01",validTo:"2026-12-31"});
  assert.deepEqual(activeTelevisionProducts([old,active,future],"2026-11-02"),[active]);
  assert.deepEqual(activeTelevisionProducts([old,active,future],"2026-12-01"),[active,future]);
});
