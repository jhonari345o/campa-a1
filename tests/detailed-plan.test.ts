import test from "node:test";
import assert from "node:assert/strict";
import { buildDetailedMediaRecommendation } from "../lib/detailed-plan";
import { buildMediaPlan } from "../lib/planner";
import { applyStrategyPlan, buildStrategyReport } from "../lib/media-strategy";
import { buildStrategyEvidence, scopePlanningResearch } from "../lib/media-strategy-evidence";
import { strategyBrief, strategyCatalogs, strategyResearch } from "./media-strategy-fixture";

async function examplePlan() {
  const brief = strategyBrief({ startDate: "2026-11-04", endDate: "2026-11-26", selectedMedia: ["television", "digital"], budgetUsd: 10000 });
  const catalogs = strategyCatalogs();
  catalogs.broadcast.tv.push({ ...catalogs.broadcast.tv[0], id: "synthetic-program-two", title: "Segundo programa sintético", priceUsd: 80 });
  const evidence = buildStrategyEvidence(brief, strategyResearch, catalogs, "2026-11-03");
  const base = await buildMediaPlan({ ...brief, research: scopePlanningResearch(strategyResearch, evidence) });
  const report = buildStrategyReport(brief, evidence, base, { aiState: "not_configured", fingerprint: "synthetic", generatedAt: "2026-11-03" });
  return { brief, plan: applyStrategyPlan(base, report, brief) };
}

test("execution dates use the campaign brief while source periods and costs remain intact", async () => {
  const { brief, plan } = await examplePlan();
  const original = JSON.stringify(plan);
  const detail = await buildDetailedMediaRecommendation(brief, plan);
  const executions = detail.channelPlans.flatMap(channel => channel.executions);
  assert.ok(executions.length > 1);
  assert.ok(detail.channelPlans.some(channel => channel.kind === "television"));
  assert.ok(detail.channelPlans.some(channel => channel.kind === "digital"));
  for (const execution of executions) {
    assert.equal(execution.schedule, "04/11/2026 – 26/11/2026");
    assert.equal(execution.scheduleLabel, "Fechas de campaña");
    if (execution.estimatedUnits != null && execution.referenceUnitPriceUsd != null) assert.equal(execution.budgetUsd, Math.round(execution.estimatedUnits * execution.referenceUnitPriceUsd * 100) / 100);
  }
  assert.equal(JSON.stringify(plan), original);
  assert.ok(plan.strategy!.sources.some(source => source.period.includes("2026-09")));
});

test("a saved plan without campaign dates labels a source period as a reference", async () => {
  const { brief, plan } = await examplePlan();
  const detail = await buildDetailedMediaRecommendation({ ...brief, startDate: undefined, endDate: undefined }, plan);
  const television = detail.channelPlans.find(channel => channel.kind === "television")!.executions;
  assert.ok(television.length);
  assert.ok(television.every(execution => execution.scheduleLabel === "Período de referencia"));
});
