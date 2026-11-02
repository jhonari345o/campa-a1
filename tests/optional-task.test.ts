import assert from "node:assert/strict";
import test from "node:test";
import { optionalWithinBudget } from "../lib/optional-task";

test("a stalled enrichment returns available evidence and cancels outstanding work", async () => {
  let received: AbortSignal | undefined;
  const evidence = { engine: "datos", amount: 100 };
  const result = await optionalWithinBudget((signal) => {
    received = signal;
    return new Promise<never>(() => {});
  }, () => evidence, 10);
  assert.equal(result, evidence);
  assert.equal(received?.aborted, true);
});

test("provider failure preserves the data-only result", async () => {
  const result = await optionalWithinBudget(async () => { throw new Error("provider unavailable"); }, () => "data", 100);
  assert.equal(result, "data");
});

test("successful enrichment wins and the expiry cannot replace it later", async () => {
  let fallbackCalls = 0;
  const result = await optionalWithinBudget(async () => "enriched", () => { fallbackCalls++; return "data"; }, 10);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(result, "enriched");
  assert.equal(fallbackCalls, 0);
});
