import test from "node:test";
import assert from "node:assert/strict";
import { parseOohAsset, oohProvinceGroups, oohMatches, oohPhotoPathAllowed, oohRateUnit, OOH_UNLOCATED } from "../lib/ooh-catalog";
const row = { id: "test-asset", provider_slug: "test-provider", provinces: ["Guayas"], details: { name: "Pantalla de prueba", city: "Guayaquil", address: "Avenida de prueba", rates: [] }, photo_path: null };
test("grouping deduplicates aliases without losing multi-province assets", () => {
  const a = parseOohAsset({ ...row, provinces: ["Manabí", "Manabi", "Guayas"] })!;
  const b = parseOohAsset({ ...row, id: "test-two", provinces: [] })!;
  const groups = oohProvinceGroups([a, b]);
  assert.deepEqual(groups.map(g => g.name), ["Guayas", "Manabí", OOH_UNLOCATED]);
  assert.equal(groups[1].assets.length, 1);
  assert.equal(groups[2].assets[0].id, "test-two");
});
test("provider scope stays intact and accent-insensitive search uses location and code", () => {
  const a = parseOohAsset(row)!;
  const b = parseOohAsset({ ...row, id: "another-provider", provider_slug: "other", details: { ...row.details, code: "XYZ-42" } })!;
  assert.equal(oohProvinceGroups([a, b].filter(x => x.providerSlug === "test-provider"))[0].assets.length, 1);
  assert.ok(oohMatches(a, "avenída"));
  assert.ok(oohMatches(b, "xyz-42"));
  assert.ok(!oohMatches(a, "xyz-42"));
});
test("rates preserve zero, contract duration and circuit basis; absent rates remain absent", () => {
  assert.deepEqual(parseOohAsset(row)!.rates, []);
  const rates = parseOohAsset({ ...row, details: { rates: [{ amount: 0, period: "one_time", basis: "producción" }, { amount: -1 }, { amount: "100" }, { amount: 100, period: "3_months", basis: "circuit_5" }] } })!.rates;
  assert.equal(rates.length, 2); assert.equal(rates[0].amount, 0);
  assert.equal(oohRateUnit(rates[1]), "3 meses · circuito completo de 5 columnas");
});
test("photo paths cannot leave the private bucket and invalid coordinates cannot create maps", () => {
  assert.ok(oohPhotoPathAllowed("a".repeat(64) + ".jpg"));
  for (const value of ["../../private.jpg", "https://example.com/a.jpg", "x.svg", "a".repeat(64) + ".html"]) assert.ok(!oohPhotoPathAllowed(value));
  const a = parseOohAsset({ ...row, photo_path: "https://example.com/a.jpg", details: { latitude: 120, longitude: -79 } })!;
  assert.equal(a.photo, false); assert.equal(a.latitude, null);
  assert.equal(parseOohAsset({ ...row, id: "../escape" }), null);
});
