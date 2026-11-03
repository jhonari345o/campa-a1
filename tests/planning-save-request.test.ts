import assert from "node:assert/strict";
import test from "node:test";
import { handlePlanSaveRequest } from "../lib/planning-save-request";

const url = "https://one.example/api/planning/save";
const body = { brief: { brand: "Synthetic", selectedMedia: ["radio"], budgetUsd: 1000 }, fingerprint: "a".repeat(64), requireAi: true };
const request = (value: unknown = body, origin: string | null = "https://one.example") => new Request(url, { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(value) });

test("save sends only brief and expected revision to authenticated reconstruction", async () => {
  let calls = 0;
  const response = await handlePlanSaveRequest(request(), async input => {
    calls++; assert.deepEqual(input, body);
    return { ok: true, id: "private-draft" };
  });
  assert.equal(calls, 1);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { ok: true, id: "private-draft" });
});

test("cross-origin, oversized and browser-supplied financial results cannot invoke persistence", async () => {
  const save = async () => assert.fail("Persistence must not be invoked");
  for (const origin of [null, "https://attacker.example"]) assert.equal((await handlePlanSaveRequest(request(body, origin), save)).status, 403);
  for (const value of [null, [], { ...body, plan: { amount: 1 } }, { ...body, fingerprint: "" }, { ...body, requireAi: "false" }, { ...body, brief: null }]) {
    assert.equal((await handlePlanSaveRequest(request(value), save)).status, 400);
  }
  assert.equal((await handlePlanSaveRequest(request({ ...body, brief: { brand: "x".repeat(33_000) } }), save)).status, 413);
  const invalidType = new Request(url, { method: "POST", headers: { origin: "https://one.example", "content-type": "text/plain" }, body: "ignored" });
  assert.equal((await handlePlanSaveRequest(invalidType, save)).status, 415);
});

test("the canonical site origin is supported behind the hosting proxy", async () => {
  const proxied = new Request("https://internal/api/planning/save", { method: "POST", headers: { origin: "https://one.example", "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await handlePlanSaveRequest(proxied, async () => ({ ok: false, error: "Tu rol no permite guardar planes." }), "https://one.example");
  assert.equal(result.status, 200);
  assert.equal((await result.json()).error, "Tu rol no permite guardar planes.");
});

test("a persistence failure is never automatically retried or exposed as a definite non-save", async () => {
  let calls = 0;
  const result = await handlePlanSaveRequest(request(), async () => { calls++; throw new Error("private credentials"); });
  assert.equal(calls, 1);
  assert.equal(result.status, 503);
  const message = await result.text();
  assert.match(message, /Revisa tus planes/);
  assert.doesNotMatch(message, /private credentials/);
});

test("the handler waits for the actual write result rather than racing a response timeout", async () => {
  let finish!: () => void;
  const write = new Promise<void>(resolve => { finish = resolve; });
  let responded = false;
  const response = handlePlanSaveRequest(request(), async () => { await write; return { ok: true, id: "saved-once" }; }).then(value => { responded = true; return value; });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(responded, false);
  finish();
  assert.deepEqual(await (await response).json(), { ok: true, id: "saved-once" });
});
