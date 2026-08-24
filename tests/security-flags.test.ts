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
