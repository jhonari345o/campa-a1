import assert from "node:assert/strict";
import test from "node:test";
import { diySelectionSummary, influencerRateFor, validateManualExtras } from "../lib/diy-workspace";
import { FALLBACK_OOH } from "../lib/diy-zones";
import { DIGITAL_PLATFORMS, type InfluencerProfile } from "../lib/media-catalog";
import type { OohAsset } from "../lib/ooh-catalog";
const asset: OohAsset = { id: "test-asset", providerSlug: "example", provinces: ["Guayas"], city: "Guayaquil", name: "Valla de prueba", code: "T01", address: "Referencia de prueba", format: "Valla", dimensions: "10 x 4 m", brand: "", latitude: null, longitude: null, recordType: "inventory", rates: [{ amount: 400, period: "month", basis: "per_asset", component: "Alquiler" }], rateLabel: "", reference: "Edición de prueba", taxLabel: "", photo: false, photoKind: "asset", dailySpots: null, spotSeconds: null };
const profile: InfluencerProfile = { id: "creator-1", slug: "test", category: "foodie", name: "Perfil de prueba", handle: null, platform: "Instagram", profileUrl: null, followers: null, avgViews: null, engagementPct: null, followerQualityPct: null, rates: [{ format: "Reel colaborativo", amountUsd: 300 }] };
const catalogs = { ooh: { assets: [asset] }, legacyOoh: FALLBACK_OOH, influencers: [profile] };
test("manual prices and labels are re-resolved from the actual OOH and creator products", () => {
  const result = validateManualExtras({ ...catalogs, selectedMedia: ["ooh", "influencers"], selections: { ooh: [{ id: asset.id, rateIndex: 0, units: 2, name: "Forged", rate: 900000 }], influencers: [{ id: "row", profileId: profile.id, name: "Forged", deliverable: "Reel colaborativo", quantity: 2, rate: 900000 }] } });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const rows = result.selections.ooh as { name: string; rate: number; unitLabel: string }[];
  assert.equal(rows[0].rate, 400);
  assert.equal(rows[0].name, "Valla de prueba");
  assert.match(rows[0].unitLabel, /mes/);
  assert.equal((result.selections.influencers as { rate: number }[])[0].rate, 300);
  assert.equal(influencerRateFor(profile, "Derecho de pauta"), null);
  assert.equal(influencerRateFor(profile, "Historia"), null);
});
test("unknown and malformed selections fail; prospective zones never inherit a browser price", () => {
  assert.equal(validateManualExtras({ ...catalogs, selectedMedia: ["ooh"], selections: { ooh: [{ id: "unknown", months: 1 }] } }).ok, false);
  assert.equal(validateManualExtras({ ...catalogs, selectedMedia: ["ooh"], selections: { ooh: { id: "bad" } } }).ok, false);
  const result = validateManualExtras({ ...catalogs, selectedMedia: ["ooh"], selections: { ooh: [{ id: FALLBACK_OOH[0].id, months: 1, rate: 99999 }] } });
  assert.equal(result.ok && (result.selections.ooh as { rate: number | null }[])[0].rate, null);
});
test("only included media enter the plan and digital shares must total 100 percent", () => {
  const slug = DIGITAL_PLATFORMS[0].slug;
  const invalid = validateManualExtras({ ...catalogs, selectedMedia: ["digital"], selections: { digital: [{ slug, pct: .4 }] } });
  assert.equal(invalid.ok, false);
  const result = validateManualExtras({ ...catalogs, selectedMedia: ["digital"], selections: { digital: [{ slug, name: "Forged", pct: 1 }], ooh: [{ id: "forged", rate: 999 }], press: [{ name: "hidden" }], influencers: [{ id: "forged" }] } });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.selections.ooh, []);
  assert.deepEqual(result.selections.influencers, []);
  assert.deepEqual(result.selections.press, []);
  assert.equal((result.selections.digital as { name: string }[])[0].name, DIGITAL_PLATFORMS[0].name);
});
test("the selection cart preserves quantities and source units, excludes disabled media and counts missing costs", () => {
  const result = diySelectionSummary(["ooh", "press", "radio"], { tv: [{ channel: "Excluded", unitPrice: 999, quantity: 1 }], ooh: [{ name: "Cartel", city: "Guayaquil", rate: 400, units: 2, unitLabel: "mes" }], press: [{ name: "Diario", format: "Banner", unit: "CPM", referencePriceUsd: 10, quantity: 5 }], radio: [{ name: "Emisora", spotsPerDay: 6, days: 20 }] });
  assert.equal(result.count, 3);
  assert.equal(result.referenceUsd, 850);
  assert.equal(result.pending, 1);
  assert.equal(result.rows.some(row => row.label === "Excluded"), false);
  assert.match(result.rows.find(row => row.medium === "press")!.detail, /5 miles de impresiones/);
});
