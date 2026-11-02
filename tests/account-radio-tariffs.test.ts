import test from "node:test";
import assert from "node:assert/strict";
import { accountRadioGroups, radioProviderKey, radioRatePreference } from "../lib/account-radio-tariffs";
import { scopeCatalogProducts, type AgreedCatalogRate } from "../lib/catalog-pricing";
import { catalogCartSummary, type CatalogProduct } from "../lib/catalog-shopping";

const product = (key: string, seconds = 20): CatalogProduct => ({ key, kind: "radio", provider: "Example Station", name: "Rotativo", format: `Rotativo · ${seconds} s`, unit: `cuña de ${seconds} s`, location: "Example city", priceCents: null, taxIncluded: false, reference: "", conditions: "", image: null, source: { workspaceProductId: key, seconds } });
const rate = (key: string, origin: "client" | "fallback", observedOn: string, cents: number): AgreedCatalogRate => ({ productKey: key, agreementId: `agreement-${key}`, priceCents: cents, taxIncluded: false, conditions: "", validFrom: "2026-01-01", validTo: "2026-12-31", radioPreference: { origin, observedOn, clientSpecific: true } });

test("one account station tariff prioritizes its negotiation over the fallback without changing duration or money", () => {
  const own = product("radio:workspace:own"), fallback = product("radio:workspace:fallback", 30);
  const rates = [rate(own.key, "client", "2026-05-01", 4100), rate(fallback.key, "fallback", "2026-10-01", 2800)];
  const rows = scopeCatalogProducts([fallback, own], rates, "2026-11-01", false);
  assert.equal(rows.length, 1); assert.equal(rows[0].key, own.key); assert.equal(rows[0].unit, "cuña de 20 s"); assert.equal(rows[0].priceCents, 4100);
  assert.equal(catalogCartSummary([{ productKey: own.key, quantity: 3 }], rows).totalCents, 12300);
  assert.equal(catalogCartSummary([{ productKey: fallback.key, quantity: 3 }], rows).unavailable, 1);
});

test("latest confirmed reference wins without becoming a firm quote or extending an expired period", () => {
  const old = product("radio:workspace:old"), confirmed = { ...product("radio:workspace:confirmed"), referenceOnly: true, referenceLabel: "Vigencia no declarada" };
  const rates = [{ ...rate(old.key, "client", "2026-02-01", 3900), validTo: "2026-03-31" }, { ...rate(confirmed.key, "client", "2026-11-01", 4300), validFrom: "2025-02-01", validTo: "2025-02-01" }];
  for (const input of [[old, confirmed], [confirmed, old]]) {
    const rows = scopeCatalogProducts(input, rates, "2026-11-01", false);
    assert.equal(rows.length, 1); assert.equal(rows[0].key, confirmed.key); assert.equal(rows[0].priceCents, null); assert.equal(rows[0].referencePriceCents, 4300); assert.equal(rows[0].validTo, "2025-02-01"); assert.equal(rows[0].source.agreementId, undefined);
  }
});

test("equally supported conflicting account tariffs do not select the cheapest or silently create a quote", () => {
  const a = product("radio:workspace:a"), b = product("radio:workspace:b");
  const rows = scopeCatalogProducts([a, b], [rate(a.key, "client", "2026-10-01", 3200), rate(b.key, "client", "2026-10-01", 4700)], "2026-11-01", false);
  assert.equal(rows.length, 1); assert.equal(rows[0].priceCents, null); assert.equal(rows[0].referencePriceCents, null); assert.equal(rows[0].source.agreementId, undefined);
});

test("separate account projections keep separate prices while administrators retain the complete history", () => {
  const a = product("radio:workspace:a"), b = product("radio:workspace:b");
  assert.equal(scopeCatalogProducts([a], [rate(a.key, "client", "2026-10-01", 3100)], "2026-11-01", false)[0].priceCents, 3100);
  assert.equal(scopeCatalogProducts([a], [rate(a.key, "client", "2026-10-01", 5200)], "2026-11-01", false)[0].priceCents, 5200);
  assert.deepEqual(scopeCatalogProducts([a, b], [], "2026-11-01", true), [a, b]);
});

test("linked names and unlinked spelling variants share one station tariff; other media are untouched", () => {
  const a = { ...product("radio:workspace:a"), provider: "Radio Example Station", source: { workspaceProductId: "a", stationId: "station-a" } };
  const b = { ...product("radio:workspace:b"), provider: "Example Station" };
  const c = { ...product("radio:station-a:30", 30), provider: "Another verified name", source: { stationId: "station-a", seconds: 30 } };
  const press = { ...product("press:workspace:test"), kind: "press" as const };
  const rows = scopeCatalogProducts([a, b, c, press], [rate(a.key, "client", "2026-09-01", 4000), rate(b.key, "client", "2026-10-01", 4400)], "2026-11-01", false);
  assert.equal(rows.filter(p => p.kind === "radio").length, 1); assert.equal(rows.find(p => p.kind === "radio")!.key, b.key); assert.ok(rows.some(p => p.key === press.key));
  assert.equal(rows.find(p => p.kind === "radio")!.source.stationId,"station-a");
});
test("a directory frequency does not split the account tariff from the station detail", () => {
  const directory = { ...product("radio:station-a:quote"), provider: "Radio Example Station 104.5 FM", source: { stationId: "station-a" } };
  const negotiated = product("radio:workspace:negotiated");
  const rows = scopeCatalogProducts([directory,negotiated], [rate(negotiated.key,"client","2026-10-01",3800)], "2026-11-01", false);
  assert.equal(rows.length,1);assert.equal(rows[0].key,negotiated.key);assert.equal(rows[0].source.stationId,"station-a");assert.equal(rows[0].priceCents,3800);
  assert.equal(radioProviderKey("i99 98.9 FM"),"i99");assert.notEqual(radioProviderKey("104.5 FM"),radioProviderKey("105.7 FM"));
});

test("private evidence becomes bounded selection hints and cannot appear in the customer projection", () => {
  const p = product("radio:workspace:a");
  const preference = radioRatePreference({ priority: "Client plan", source: { file: "private-evidence.xlsx", sent_on: "2026-03-01", clarification: { confirmed_on: "2026-11-01" }, email: "private@example.invalid" } }, true);
  assert.deepEqual(preference, { origin: "client", observedOn: "2026-11-01", clientSpecific: true });
  const rows = scopeCatalogProducts([p], [{ ...rate(p.key, "client", "2026-03-01", 4400), radioPreference: preference }], "2026-11-01", false);
  const json = JSON.stringify(rows); assert.ok(!json.includes("private-evidence")); assert.ok(!json.includes("private@example")); assert.ok(!json.includes("radioPreference"));
});
test("different programs in the same selected tariff edition stay in one station group with their exact units and prices", () => {
  const morning = { ...product("radio:workspace:morning"), name: "Morning program" }, evening = { ...product("radio:workspace:evening"), name: "Evening program" };
  const rows = scopeCatalogProducts([morning, evening], [rate(morning.key, "fallback", "2026-10-01", 3500), rate(evening.key, "fallback", "2026-10-01", 4600)], "2026-11-01", false);
  const groups = accountRadioGroups(rows); assert.equal(groups.length, 1); assert.equal(groups[0].length, 2);
  assert.deepEqual(rows.map(p => p.priceCents), [3500, 4600]);
});
