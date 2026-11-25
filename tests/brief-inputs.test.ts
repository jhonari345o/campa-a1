import test from "node:test";
import assert from "node:assert/strict";
import { displayCampaignPeriod, displayPlanDate, formatBudgetInput, parseBudgetInput, parsePlanDate, validPlanPeriod } from "../lib/brief-inputs";

test("Spanish dates preserve the ISO day and reject impossible or reversed periods", () => {
  assert.equal(displayPlanDate("2026-11-02"), "02/11/2026");
  assert.equal(parsePlanDate("02/11/2026"), "2026-11-02");
  for (const value of ["31/02/2026", "29/02/2026", "11/31/2026", "2026-11-02"]) assert.equal(parsePlanDate(value), "");
  assert.equal(parsePlanDate("29/02/2028"), "2028-02-29");
  assert.equal(validPlanPeriod("2026-11-02", "2026-11-02"), true);
  assert.equal(validPlanPeriod("2026-12-31", "2026-11-02"), false);
  assert.equal(validPlanPeriod("", "2026-11-02"), false);
});
test("campaign dates preserve the brief days across months and do not invent missing dates", () => {
  assert.equal(displayCampaignPeriod("2026-11-04", "2026-11-30"), "04/11/2026 – 30/11/2026");
  assert.equal(displayCampaignPeriod("2026-12-31", "2027-01-02"), "31/12/2026 – 02/01/2027");
  assert.equal(displayCampaignPeriod("2028-02-29", "2028-02-29"), "29/02/2028");
  for (const [start, end] of [[undefined, undefined], ["2026-11-04", ""], ["2026-11-04", "2026-11-03"], ["2026-02-29", "2026-03-01"]]) assert.equal(displayCampaignPeriod(start, end), null);
});
test("local currency input keeps cents and never treats a decimal dot as thousands silently", () => {
  for (const value of ["100000", "100.000", "100.000,00", "$ 100.000,00"]) assert.equal(parseBudgetInput(value), 100000);
  assert.equal(parseBudgetInput("3.000,50"), 3000.5);
  assert.equal(parseBudgetInput("0,01"), .01);
  assert.equal(formatBudgetInput(100000), "100.000,00");
  assert.equal(formatBudgetInput(3000.5), "3.000,50");
  for (const value of ["3.00", "3,000.50", "3000.50", "1,234", "-17", "0", "NaN", "1e6", "10.000.000,01"]) assert.equal(parseBudgetInput(value), null);
  for (const value of [.01, 17, 357, 576, 100000.99, 10000000]) assert.equal(parseBudgetInput(formatBudgetInput(value)), value);
});
