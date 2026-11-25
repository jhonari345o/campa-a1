import test from "node:test";
import assert from "node:assert/strict";
import { digitalBriefEditable, parseDigitalCampaignBrief } from "../lib/digital-campaign-brief";
test("campaign configuration accepts only campaign fields and safe destination links", () => {
  assert.deepEqual(parseDigitalCampaignBrief({ campaignName: " Prueba ", destination: "https://example.test/", startDate: "2026-11-01", endDate: "2026-12-01" }), { campaignName: "Prueba", destination: "https://example.test/", startDate: "2026-11-01", endDate: "2026-12-01" });
  for (const invalid of [{ companyId: "other" }, { budget: "1" }, { status: "approved" }, { audience: "a".repeat(4001) }, { destination: "javascript:alert(1)" }, { destination: "https://user:password@example.test" }, { startDate: "2026-02-31" }, { startDate: "2026-12-01", endDate: "2026-11-01" }]) assert.throws(() => parseDigitalCampaignBrief(invalid));
});
test("digital configuration opens after approval with a known budget, never at checkout", () => {
  assert.equal(digitalBriefEditable("approved", 100000), true);
  assert.equal(digitalBriefEditable("in_execution", 100000), true);
  for (const status of ["pending_review", "quoting", "awaiting_client", "cancelled", "completed"]) assert.equal(digitalBriefEditable(status, 100000), false);
  assert.equal(digitalBriefEditable("approved", null), false);
});
