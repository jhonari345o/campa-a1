import assert from "node:assert/strict";
import test from "node:test";
import { projectTgi, restoreTgi, tgiUsage } from "../lib/tgi";
import { projectResearch, restoreResearch } from "../lib/infomedia";
import { buildMediaPlan } from "../lib/planner";
// Synthetic observations only. No licensed numbers in the repository.
const source = { study: "Synthetic study", period: "Synthetic wave", indicators: [
  { id: "open-tv", label: "TV", role: "media", total: 50, youngAdults: 25, adults35Plus: 75 },
  { id: "radio", label: "Radio", role: "media", total: 40, youngAdults: 80, adults35Plus: 20 },
  { id: "internet", label: "Internet", role: "media", total: 70, youngAdults: 90, adults35Plus: 60 },
] };
const target = { ageRange: "15-34", sex: "Todas las personas", socioeconomic: "Todos los NSE", audienceType: "B2C", geography: "Todo Ecuador" };
test("TGI preserves actual columns and never relabels 18–34 as 15–34", () => {
  assert.equal(projectTgi(source, target)?.relationship, "age_matched");
  assert.equal(tgiUsage("television", projectTgi(source, target)), 25);
  const contextual = projectTgi(source, { ...target, ageRange: "18-34" });
  assert.equal(contextual?.relationship, "context_only");
  assert.equal(tgiUsage("television", contextual), 50);
  assert.equal(tgiUsage("radio", projectTgi(source, { ...target, ageRange: "35+" })), 20);
});
test("sex, NSE, B2B and geography mismatches remain contextual", () => {
  for (const patch of [{ sex: "Mujeres" }, { socioeconomic: "A/B" }, { audienceType: "B2B" }, { geography: "Guayas" }, { geography: "" }]) {
    assert.equal(projectTgi(source, { ...target, ...patch })?.relationship, "context_only");
  }
});
test("invalid and missing observations remain missing, never zero or made-up reach", () => {
  const corrupt = projectTgi({ ...source, indicators: [
    { ...source.indicators[0], youngAdults: -1 }, { ...source.indicators[1], youngAdults: 101 },
    { ...source.indicators[2], youngAdults: "90" }, { ...source.indicators[0], id: "secret" },
  ] }, target);
  assert.equal(corrupt, undefined);
  assert.equal(tgiUsage("press", projectTgi(source, target)), null);
  assert.equal(tgiUsage("influencers", projectTgi(source, target)), null);
  assert.equal(restoreTgi({ ...projectTgi(source, target), values: [{ id: "radio", role: "media", value: Infinity }] }), undefined);
});
const category = { id: "im_0123456789abcdef01234567", label: "Synthetic category" };
const research = projectResearch(category, { periods: [{ year: 2026, periodLabel: "Synthetic period", sourceTarget: "Reference target", totals: {}, mediaMix: [
  { media: "TV", estimatedInvestment: 100, share: .5 }, { media: "Radio", estimatedInvestment: 100, share: .5 },
], brands: [], pressureContexts: [] }] }, "2026-01-01");
test("audience consumption changes the recommended mix while preserving budget and periods", async () => {
  const make = (ageRange: string) => buildMediaPlan({ keyword: category.label, research: { ...research, tgi: projectTgi(source, { ...target, ageRange }) }, selectedMedia: ["television", "radio"], budgetUsd: 1234 });
  const young = await make("15-34"), older = await make("35+");
  assert.ok(young.plan.find((row) => row.label === "Radio")!.pct > older.plan.find((row) => row.label === "Radio")!.pct);
  assert.ok(Math.abs(young.plan.reduce((sum, row) => sum + (row.amount || 0), 0) - 1234) < 1e-8);
  assert.equal(young.referencePeriod, "Synthetic period");
  assert.equal(young.evidence?.find((row) => row.group === "radio")?.tgiUsage, 80);
});
test("TGI can support a medium absent from observed investment without fabricating category share", async () => {
  const plan = await buildMediaPlan({ keyword: category.label, research: { ...research, tgi: projectTgi(source, target) }, selectedMedia: ["digital", "influencers"], budgetUsd: 500 });
  assert.ok(plan.plan.length > 0);
  assert.equal(plan.evidence?.find((row) => row.group === "digital")?.categoryShare, null);
  assert.equal(plan.evidence?.find((row) => row.group === "influencers")?.score, 0);
  assert.equal(plan.plan.some((row) => row.label === "Influenciadores"), false);
});
test("saved research retains the displayed TGI source, period and target", () => {
  const saved = { ...research, tgi: projectTgi(source, target) };
  assert.deepEqual(restoreResearch(JSON.parse(JSON.stringify(saved)))?.tgi, saved.tgi);
});
