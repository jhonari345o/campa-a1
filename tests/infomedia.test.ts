import assert from "node:assert/strict";
import test from "node:test";
import { projectBrandPage, projectResearch, resolveCategory, restoreResearch, searchCategories, withReferenceYear } from "../lib/infomedia";
import { parseResearchAdvice, researchAiEvidence } from "../lib/infomedia-ai";
import { buildMediaPlan } from "../lib/planner";
import { mediaGroupForLabel } from "../lib/media-groups";
// Entirely synthetic observations. No licensed source data in tests.
const category = { id: "im_0123456789abcdef01234567", label: "Categoría de prueba" };
const makePeriod = (year: number, mediaMix = [{ media: "Radio", estimatedInvestment: 1000, share: 1 }]) => ({
  year, periodLabel: year === 2026 ? "Enero–julio 2026" : "Enero–diciembre 2025", sourceTarget: "Target fuente",
  totals: { estimatedInvestment: 1000, grossInvestment: 2000, notices: 100, activeBrands: 15 },
  mediaMix, brands: Array.from({ length: 15 }, (_, index) => ({ brand: `Marca ${index}`, estimatedInvestment: 100 - index, notices: 10, soi: .1, soa: .1 })),
  pressureContexts: [],
});
const research = projectResearch(category, { periods: [makePeriod(2025), makePeriod(2026)], raw: "never expose" }, "2026-07-31", "Marca 14");
test("exact category resolution does not guess a broad sector or accept a forged ID", () => {
  assert.equal(resolveCategory([category], "", "categoria de prueba")?.id, category.id);
  assert.equal(resolveCategory([category], "", "Categoría"), undefined);
  assert.equal(resolveCategory([category], "forged", category.label), undefined);
  assert.deepEqual(searchCategories([category], "prueba categoria"), [category]);
  assert.equal(searchCategories(Array.from({ length: 100 }, (_, n) => ({ id: String(n), label: "Test" })), "").length, 30);
});
test("research preserves independent periods, bounds brands and still finds the selected brand outside top ten", () => {
  assert.equal(research.periods.length, 2);
  assert.equal(research.periods[0].year, 2026);
  assert.equal(research.periods[0].totals.estimatedInvestment, 1000);
  assert.equal(research.periods[0].topBrands.length, 10);
  assert.equal(research.periods[0].focusBrand?.brand, "Marca 14");
  assert.equal(JSON.stringify(research).includes("never expose"), false);
  assert.equal(projectResearch(category, { periods: [makePeriod(2026)] }, "", "Marca ausente").periods[0].focusBrand, null);
});
test("brand browsing returns all brands in bounded pages within the selected period", () => {
  const older = { ...makePeriod(2025), brands: [{ brand: "Histórica", estimatedInvestment: 900, soi: .4, soa: .2 }] };
  const payload = { periods: [older, makePeriod(2026)] };
  const first = projectBrandPage(payload, 2026);
  const second = projectBrandPage(payload, 2026, "", 2);
  assert.equal(first.total, 15);
  assert.equal(first.rows.length, 10);
  assert.equal(second.rows.length, 5);
  assert.equal(new Set([...first.rows, ...second.rows].map(row => row.brand)).size, 15);
  assert.equal(second.rows[4].brand, "Marca 14");
  assert.equal(projectBrandPage(payload, 2026, "", 999).page, 2);
  assert.equal(projectBrandPage(payload, 2025).rows[0].brand, "Histórica");
  assert.equal(projectBrandPage(payload, 2026, "Histórica").total, 0);
  assert.throws(() => projectBrandPage(payload, 2024), /REFERENCE_PERIOD_UNAVAILABLE/);
});
test("brand search preserves source shares, handles accents and strips private fields", () => {
  const payload = { internal: "private", periods: [{ ...makePeriod(2026), brands: [
    { brand: "Café Prueba", estimatedInvestment: 0, notices: 0, soi: .12, soa: .08, internal: "private" },
    { brand: "Otra marca", estimatedInvestment: 90, notices: 7, soi: .88, soa: .92 },
  ] }] };
  const page = projectBrandPage(payload, 2026, "prueba CAFE");
  assert.equal(page.total, 1);
  assert.deepEqual(page.rows[0], { brand: "Café Prueba", estimatedInvestment: 0, notices: 0, soi: .12, soa: .08 });
  assert.equal(JSON.stringify(page).includes("private"), false);
  assert.deepEqual(projectBrandPage(payload, 2026, "ausente").rows, []);
  for (const pageNumber of [0, -1, 1.5, Infinity, NaN]) {
    assert.throws(() => projectBrandPage(payload, 2026, "", pageNumber), /INVALID_BRAND_QUERY/);
  }
  assert.throws(() => projectBrandPage(payload, 2026, "a".repeat(101)), /INVALID_BRAND_QUERY/);
});
test("plan uses the exact category's observed mix even with fewer than three brands", async () => {
  const plan = await buildMediaPlan({ keyword: category.label, research, budgetUsd: 5000, selectedMedia: ["radio", "digital"] });
  assert.equal(plan.basis, "infomedia");
  assert.equal(plan.referencePeriod, "Enero–julio 2026");
  assert.equal(plan.plan.length, 1);
  assert.equal(plan.plan[0].label, "Radio");
  assert.equal(plan.plan[0].amount, 5000);
  assert.equal(plan.totalRef, 1000);
  assert.deepEqual(plan.unobservedMedia, ["Digital"]);
});
test("no evidence in selected media does not fall back to the whole market or invented shares", async () => {
  await assert.rejects(buildMediaPlan({ keyword: category.label, research, selectedMedia: ["digital"] }), /NO_CATEGORY_MEDIA_EVIDENCE/);
  await assert.rejects(buildMediaPlan({ keyword: "Other category", research }), /CATEGORY_RESEARCH_REQUIRED/);
});
test("digital subchannels conserve the full budget after splitting", async () => {
  const digital = projectResearch(category, { periods: [makePeriod(2026, [{ media: "Digital", estimatedInvestment: 1000, share: 1 }])] }, "");
  const plan = await buildMediaPlan({ keyword: category.label, research: digital, budgetUsd: 1234, selectedMedia: ["digital"] });
  assert.ok(Math.abs(plan.plan.reduce((sum, row) => sum + row.pct, 0) - 1) < 1e-10);
  assert.ok(Math.abs(plan.plan.reduce((sum, row) => sum + (row.amount || 0), 0) - 1234) < 1e-8);
  assert.equal(mediaGroupForLabel("VP"), "ooh");
  assert.equal(mediaGroupForLabel("Suplemento"), "press");
});
test("AI receives no brand or client data and cannot replace measured figures", () => {
  const evidence = JSON.stringify(researchAiEvidence(research, "Reconocimiento"));
  assert.equal(evidence.includes("Marca"), false);
  assert.equal(evidence.includes("estimatedInvestment"), false);
  assert.ok(parseResearchAdvice('{"emphasis":"La radio concentra la inversión observada.","questions":["¿Qué plaza se prioriza?"]}'));
  for (const text of ["Ganaremos 25%", "Visita https://example.com", "<script>", "Garantizamos ventas"]) {
    assert.equal(parseResearchAdvice(JSON.stringify({ emphasis: text, questions: [] })), null);
  }
});
test("the selected historical period drives the plan, saved research and AI evidence", async () => {
  const historical = withReferenceYear(research, 2025);
  const plan = await buildMediaPlan({ keyword: category.label, research: historical, selectedMedia: ["radio"] });
  assert.equal(plan.referencePeriod, "Enero–diciembre 2025");
  assert.equal(researchAiEvidence(historical, "Ventas").period, "Enero–diciembre 2025");
  assert.equal(restoreResearch(JSON.parse(JSON.stringify(historical)))?.referenceYear, 2025);
  assert.throws(() => withReferenceYear(research, NaN), /REFERENCE_PERIOD_UNAVAILABLE/);
  assert.throws(() => withReferenceYear(research, 2024), /REFERENCE_PERIOD_UNAVAILABLE/);
  assert.equal(restoreResearch({ ...research, referenceYear: 2024 }), undefined);
});
