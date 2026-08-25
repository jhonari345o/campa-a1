import assert from "node:assert/strict";
import test from "node:test";
import {
  isAgentAutomationEnabled,
  isAiAssistantEnabled,
  isCommercialPaymentsEnabled,
  isMetaPausedDraftsEnabled,
  isMetaRealSpendEnabled,
} from "../lib/commercial";
import { canCompanyRole } from "../lib/permissions";
import { filterPlanByMedia, mediaGroupForLabel } from "../lib/planner";

test("las operaciones economicas permanecen deshabilitadas por defecto", () => {
  delete process.env.COMMERCIAL_PAYMENTS_ENABLED;
  delete process.env.META_PAUSED_DRAFTS_ENABLED;
  delete process.env.META_REAL_SPEND_ENABLED;
  delete process.env.AGENT_AUTOMATION_ENABLED;
  delete process.env.AI_ASSISTANT_ENABLED;

  assert.equal(isCommercialPaymentsEnabled(), false);
  assert.equal(isMetaPausedDraftsEnabled(), false);
  assert.equal(isMetaRealSpendEnabled(), false);
  assert.equal(isAgentAutomationEnabled(), false);
  assert.equal(isAiAssistantEnabled(), false);
});

test("solo el valor true explicito habilita un interruptor", () => {
  process.env.COMMERCIAL_PAYMENTS_ENABLED = "TRUE";
  assert.equal(isCommercialPaymentsEnabled(), true);
  process.env.COMMERCIAL_PAYMENTS_ENABLED = "1";
  assert.equal(isCommercialPaymentsEnabled(), false);
  delete process.env.COMMERCIAL_PAYMENTS_ENABLED;
});

test("un lector no puede crear ni aprobar campanas", () => {
  assert.equal(canCompanyRole("viewer", "campaign:create"), false);
  assert.equal(canCompanyRole("viewer", "campaign:approve"), false);
  assert.equal(canCompanyRole("planner", "campaign:create"), true);
  assert.equal(canCompanyRole("approver", "campaign:approve"), true);
});

test("el plan respeta los medios seleccionados y conserva el presupuesto", () => {
  const rows = [
    { label: "TV abierta", pct: 0.4, amount: 400 },
    { label: "Radio", pct: 0.2, amount: 200 },
    { label: "Meta — Facebook e Instagram", pct: 0.4, amount: 400 },
  ];
  const filtered = filterPlanByMedia(rows, ["television", "digital"], 1000);

  assert.deepEqual(filtered.map((row) => mediaGroupForLabel(row.label)), ["television", "digital"]);
  assert.equal(Math.round(filtered.reduce((sum, row) => sum + row.pct, 0) * 100), 100);
  assert.equal(filtered.reduce((sum, row) => sum + Number(row.amount), 0), 1000);
});
