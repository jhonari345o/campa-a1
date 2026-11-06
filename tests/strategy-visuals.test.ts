import test from "node:test";
import assert from "node:assert/strict";
import { mixSegments, providerLogo } from "../lib/strategy-visuals";
test("partial allocations keep the real reserve instead of silently filling the chart", () => {
  const rows = mixSegments([{ medium: "radio", pct: .3, amountUsd: 300 }, { medium: "television", pct: .2, amountUsd: 200 }], 1000);
  assert.equal(rows[0].share, .3); assert.equal(rows[1].offset, .3); assert.deepEqual(rows[2], { key: "unassigned", share: .5, offset: .5, amountUsd: 500, color: "#dce5dd" });
});
test("invalid or duplicated allocations cannot become a plausible chart", () => {
  assert.deepEqual(mixSegments([{ medium: "radio", pct: 1.5, amountUsd: 1000 }], 1000), []);
  assert.deepEqual(mixSegments([{ medium: "radio", pct: .5, amountUsd: 500 }, { medium: "radio", pct: .5, amountUsd: 500 }], 1000), []);
  assert.deepEqual(mixSegments([{ medium: "digital", pct: NaN, amountUsd: null }], null), []);
});
test("logos come only from known local assets and preserve the medium", () => {
  assert.equal(providerLogo("ECUAVISA · Tarifario", "television"), "/providers/tv/ecuavisa.png");
  assert.equal(providerLogo("Diario El Universo", "press"), "/providers/press/el-universo.png");
  assert.equal(providerLogo("https://tracker.test/ecuavisa.png", "television"), null);
  assert.equal(providerLogo("El Universo", "radio"), null);
});
