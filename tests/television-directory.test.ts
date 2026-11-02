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
