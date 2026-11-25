import assert from "node:assert/strict";
import test from "node:test";
import { restorePlanBrief, restoreSavedPlanningResult, shouldCopySavedBrief } from "../lib/planning-restore";
import { buildMediaPlan } from "../lib/planner";
import { buildStrategyEvidence } from "../lib/media-strategy-evidence";
import { applyStrategyPlan, buildStrategyReport } from "../lib/media-strategy";
import { buildPlanAnalysis } from "../lib/plan-analysis";
import { strategyBrief, strategyCatalogs, strategyResearch } from "./media-strategy-fixture";
import type { SavedMediaPlan } from "../lib/media-workspace";

async function savedPlan(): Promise<SavedMediaPlan> {
  const brief = restorePlanBrief({ ...strategyBrief(), clientId: "synthetic-client", products: [{ name: "Producto", price: "15.50", margin: "30", capacity: "100", season: "regular", notes: "Prioritario" }], productMatrixApplies: true, competitors: "Competidor sintético", digitalPlatforms: ["Meta", "Google Ads"] });
  const base = await buildMediaPlan({ ...brief, research: strategyResearch });
  const evidence = buildStrategyEvidence(brief, strategyResearch, strategyCatalogs(), "2026-10-31");
  const strategy = buildStrategyReport(brief, evidence, base, { aiState: "validated", fingerprint: "synthetic-fingerprint", generatedAt: "2026-11-01" });
  const plan = applyStrategyPlan(base, strategy, brief);
  return JSON.parse(JSON.stringify({ id: "synthetic-plan", companyId: "synthetic-workspace", name: "Plan sintético", mode: "guiado", stage: "propuesta", status: "borrador", progress: 60, version: 1,
    brief, analysis: { ...buildPlanAnalysis(brief, plan), research: strategyResearch }, proposal: { ...plan }, selection: {}, updated_at: "2026-11-01" }));
}

test("a saved JSON proposal restores its interactive mix, evidence, brief and quantities without a new authorization token", async () => {
  const saved = await savedPlan(), original = JSON.stringify(saved);
  const restored = restoreSavedPlanningResult(saved);
  assert.ok(restored);
  assert.deepEqual(restored.plan.strategy, saved.proposal.strategy);
  assert.deepEqual(restored.plan.plan, saved.proposal.plan);
  assert.deepEqual(restored.brief.products, saved.brief.products);
  assert.deepEqual(restored.brief.digitalPlatforms, ["Meta", "Google Ads"]);
  assert.equal(restored.brief.clientId, "synthetic-client");
  assert.equal(restored.draftToken, undefined);
  assert.equal(restored.research.category.id, strategyResearch.category.id);
  assert.equal(JSON.stringify(saved), original);
});

test("plans saved by the previous release recover the report from analysis.strategy", async () => {
  const saved = await savedPlan();
  saved.proposal = { plan: saved.proposal.plan, campaigns: [], detail: {} };
  const restored = restoreSavedPlanningResult(saved);
  assert.ok(restored?.plan.strategy);
  assert.deepEqual(restored.plan.strategy, saved.analysis.strategy);
  saved.status = "aprobado"; saved.stage = "aprobado";
  assert.ok(restoreSavedPlanningResult(saved));
});

test("incomplete, corrupt or incompatible saved payloads keep the brief available instead of crashing the interactive view", async () => {
  const saved = await savedPlan();
  for (const mutate of [
    (value: SavedMediaPlan) => { value.analysis.research = null; },
    (value: SavedMediaPlan) => { value.proposal.plan = [{ label: "Radio", pct: Infinity, amount: 15 }]; },
    (value: SavedMediaPlan) => { (value.proposal.strategy as Record<string, unknown>).allocations = [{ executions: [null] }]; },
    (value: SavedMediaPlan) => { (value.proposal.strategy as Record<string, unknown>).sources = [null]; },
    (value: SavedMediaPlan) => { value.brief.selectedMedia = ["press"]; },
    (value: SavedMediaPlan) => { value.mode = "manual"; },
    (value: SavedMediaPlan) => { value.stage = "brief"; },
  ]) {
    const value = structuredClone(saved); mutate(value);
    assert.equal(restoreSavedPlanningResult(value), null);
    assert.equal(restorePlanBrief(value.brief).brand, saved.brief.brand);
  }
});

test("native FormData drafts retain single selections, false toggles and separate product values", () => {
  const brief = restorePlanBrief({ selectedMedia: "radio", digitalPlatforms: "Meta", measurementStack: "GA4", productMatrixApplies: "false", wowEnabled: "on", budget: "10000.50",
    productName: ["Uno", "Dos"], productPrice: ["17", "23.50"], productMargin: ["", "30"], productNotes: ["", "Prioritario"] });
  assert.deepEqual(brief.selectedMedia, ["radio"]);
  assert.deepEqual(brief.digitalPlatforms, ["Meta"]);
  assert.deepEqual(brief.measurementStack, ["GA4"]);
  assert.equal(brief.productMatrixApplies, false); assert.equal(brief.wowEnabled, true);
  assert.equal(brief.budgetUsd, 10000.5);
  assert.equal(brief.products[1].price, "23.50"); assert.equal(brief.products[1].notes, "Prioritario");
  assert.deepEqual(restorePlanBrief({ selectedMedia: [null, "bad", "radio"], products: [null] }).selectedMedia, ["radio"]);
});

test("saving an edited brief cannot overwrite a proposal or a submitted or approved plan", () => {
  assert.equal(shouldCopySavedBrief({ status: "borrador", analysis: {}, proposal: {} }), false);
  for (const current of [
    { status: "borrador", proposal: { plan: [] } },
    { status: "borrador", analysis: { research: {} } },
    { status: "revision" }, { status: "aprobado" }, { status: "archivado" },
  ]) assert.equal(shouldCopySavedBrief(current), true);
});
