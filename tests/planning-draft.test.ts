import assert from "node:assert/strict";
import test from "node:test";
import { openPlanningDraft, planningDraftScope, sealPlanningDraft } from "../lib/planning-draft";
import { sealPlanningPreparation } from "../lib/planning-preparation";

const secret = "synthetic-unit-test-key", now = 1_793_649_600_000;
const profile = { id: "owner", is_platform_admin: false, workspace: { companyId: "workspace", role: "planner" } };
const scope = planningDraftScope(profile);
const plan = { brief: { brand: "Synthetic" }, plan: { unitPrice: 17 }, privateEvidence: "private-test-only" };

test("server-built drafts are confidential, authenticated and replay to the same draft ID", () => {
  const token = sealPlanningDraft(plan, scope, secret, now);
  const draft = openPlanningDraft(token, scope, secret, now);
  assert.deepEqual(draft.data, plan);
  assert.deepEqual(openPlanningDraft(token, scope, secret, now + 60_000), draft);
  assert.notEqual(openPlanningDraft(sealPlanningDraft(plan, scope, secret, now), scope, secret, now).id, draft.id);
  assert.equal(Buffer.from(token, "base64url").includes(Buffer.from("private-test-only")), false);
  const modified = Buffer.from(token, "base64url"); modified[modified.length - 1] ^= 1;
  assert.throws(() => openPlanningDraft(modified.toString("base64url"), scope, secret, now));
});

test("a draft cannot cross accounts, workspaces, roles or admin status", () => {
  const token = sealPlanningDraft(plan, scope, secret, now);
  for (const changed of [
    { ...profile, id: "other" },
    { ...profile, is_platform_admin: true },
    { ...profile, workspace: { ...profile.workspace, companyId: "other" } },
    { ...profile, workspace: { ...profile.workspace, role: "viewer" } },
    { ...profile, workspace: null },
  ]) assert.throws(() => openPlanningDraft(token, planningDraftScope(changed), secret, now));
});

test("draft tokens expire after two hours and cannot be substituted with source-preparation tokens", () => {
  const token = sealPlanningDraft(plan, scope, secret, now);
  assert.throws(() => openPlanningDraft(token, scope, secret, now + 7_200_000));
  assert.throws(() => openPlanningDraft(token, scope, "different-key", now));
  assert.throws(() => openPlanningDraft(sealPlanningPreparation(plan, scope, secret, now), scope, secret, now));
  assert.throws(() => sealPlanningDraft(plan, scope, "", now));
  assert.throws(() => sealPlanningDraft({ text: "x".repeat(1_500_000) }, scope, secret, now));
  for (const value of ["", "x".repeat(600_001), "not.a.token"]) assert.throws(() => openPlanningDraft(value, scope, secret, now));
});
