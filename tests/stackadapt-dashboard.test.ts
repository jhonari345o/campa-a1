import assert from "node:assert/strict";
import test from "node:test";
import { readStackAdaptDashboard, readStackAdaptBreakdowns } from "../lib/ads/stackadapt-dashboard";
import { deliveryRates } from "../lib/ads/stackadapt-metrics";
import { handleStackAdaptRequest } from "../lib/ads/stackadapt-request";
import { STACKADAPT_CAMPAIGN_SCOPE_QUERY, STACKADAPT_DASHBOARD_QUERY, STACKADAPT_BREAKDOWN_QUERY } from "../lib/ads/stackadapt-report-queries";
import { stackAdaptReader, type StackAdaptConnection, type StackAdaptRead } from "../lib/ads/stackadapt";

const connection: StackAdaptConnection = { accountId: "account", currency: "USD", checkedAt: "2026-01-01", expiresAt: null, advertisers: [{ id: "client-a", name: "Client A", canWrite: false }] };
const campaign = { id: "campaign-a", name: "Campaign A", channelType: "Native", advertiser: { id: "client-a" } };
const stats = { cost: "12.5", impressionsBigint: "1000", clicksBigint: "20", conversions: 2.5, videoCompletionsBigint: "0", uniqueImpressionsBigint: "300", frequency: 1000 / 300 };
const page = <T,>(nodes: T[], next: string | null = null, total = nodes.length) => ({ nodes, pageInfo: { hasNextPage: !!next, endCursor: next }, totalCount: total });
const payload = () => ({ summary: { __typename: "CampaignDeliveryOutcome", totalStats: stats, records: page([{ campaign, metrics: stats }]) }, daily: { __typename: "CampaignDeliveryOutcome", records: page([{ granularity: { time: "2026-01-02", type: "DAILY" }, metrics: stats }]) } });
const read = (value: Record<string, unknown>): StackAdaptRead => async () => value;

test("dashboard reconciles additive daily metrics, zero-fills only reconciled gaps and preserves period reach", async () => {
  const result = await readStackAdaptDashboard(read(payload()), connection, "client-a", "2026-01-01", "2026-01-03");
  assert.equal(result.dailyComplete, true);
  assert.deepEqual(result.daily.map(d => d.metrics?.impressions), [0, 1000, 0]);
  assert.equal(result.daily[0].metrics?.uniqueImpressions, null);
  assert.equal(result.metrics?.uniqueImpressions, 300);
  assert.equal(result.metrics?.conversions, 2.5);
  assert.equal(result.metrics?.cost, 12.5);
  assert.equal(result.metrics?.frequency, 1000 / 300);
});
test("missing or inconsistent daily delivery stays missing instead of inventing zeros", async () => {
  const value = payload(); value.daily.records.nodes[0].metrics = { ...stats, impressionsBigint: "900" };
  const result = await readStackAdaptDashboard(read(value), connection, "client-a", "2026-01-01", "2026-01-03");
  assert.equal(result.dailyComplete, false); assert.equal(result.daily[0].metrics, null);
  assert.equal(result.metrics?.impressions, 1000);
  const empty = await readStackAdaptDashboard(read({ summary: { __typename: "CampaignDeliveryOutcome", totalStats: null, records: page([]) }, daily: { __typename: "CampaignDeliveryOutcome", records: page([]) } }), connection, "client-a", "2026-01-01", "2026-01-03");
  assert.equal(empty.metrics, null); assert.equal(empty.daily[0].metrics, null);
});
test("reports validate advertiser and selected campaign before delivery queries and constrain every request", async () => {
  const calls: string[] = [];
  const valid: StackAdaptRead = async (query, variables) => {
    calls.push(query);
    if (query === STACKADAPT_CAMPAIGN_SCOPE_QUERY) { assert.equal(variables.id, campaign.id); return { campaign }; }
    assert.equal(query, STACKADAPT_DASHBOARD_QUERY);
    assert.deepEqual(variables.filter, { advertiserIds: ["client-a"], ids: ["campaign-a"] });
    return payload();
  };
  await assert.rejects(readStackAdaptDashboard(valid, connection, "client-b", "2026-01-01", "2026-01-03"));
  assert.equal(calls.length, 0);
  await readStackAdaptDashboard(valid, connection, "client-a", "2026-01-01", "2026-01-03", "campaign-a");
  assert.equal(calls.length, 2);
  for (const c of [null, { ...campaign, advertiser: { id: "client-b" } }, { ...campaign, id: "other" }]) {
    await assert.rejects(readStackAdaptDashboard(async query => { assert.equal(query, STACKADAPT_CAMPAIGN_SCOPE_QUERY); return { campaign: c }; }, connection, "client-a", "2026-01-01", "2026-01-03", "campaign-a"), { code: "campaign_forbidden" });
  }
});
test("paginated campaigns are complete, do not repeat daily reads and reject cross-client rows", async () => {
  let calls = 0;
  const result = await readStackAdaptDashboard(async (_, variables) => {
    const first = calls++ === 0;
    assert.equal(variables.includeDaily, first); assert.equal(variables.after, first ? null : "next");
    const p = payload();
    p.summary.records = first ? page([{ campaign, metrics: stats }], "next", 2) : page([{ campaign: { ...campaign, id: "campaign-b" }, metrics: stats }], null, 2);
    return p;
  }, connection, "client-a", "2026-01-01", "2026-01-03");
  assert.equal(result.campaigns.length, 2);
  const p = payload(); p.summary.records.nodes[0].campaign = { ...campaign, advertiser: { id: "client-b" } };
  await assert.rejects(readStackAdaptDashboard(read(p), connection, "client-a", "2026-01-01", "2026-01-03"));
});
test("incomplete, duplicate, out-of-range and unsafe results never become a finished dashboard", async () => {
  for (const mutate of [
    (p: ReturnType<typeof payload>) => { p.daily.records.nodes[0].granularity.time = "2025-12-31"; },
    (p: ReturnType<typeof payload>) => { p.daily.records.nodes.push(p.daily.records.nodes[0]); },
    (p: ReturnType<typeof payload>) => { p.summary.records.totalCount = 2; },
    (p: ReturnType<typeof payload>) => { p.daily.records.pageInfo.hasNextPage = true; p.daily.records.pageInfo.endCursor = "more"; },
    (p: ReturnType<typeof payload>) => { p.summary.totalStats = { ...stats, impressionsBigint: "9007199254740993" }; },
  ]) { const p = payload(); mutate(p); await assert.rejects(readStackAdaptDashboard(read(p), connection, "client-a", "2026-01-01", "2026-01-03")); }
  const pending = await readStackAdaptDashboard(read({ summary: { __typename: "Progress" } }), connection, "client-a", "2026-01-01", "2026-01-03");
  assert.equal(pending.state, "processing"); assert.deepEqual(pending.campaigns, []);
});
test("device and region aggregation combines only additive metrics within the selected advertiser", async () => {
  const result = await readStackAdaptBreakdowns(async (query, variables) => {
    assert.equal(query, STACKADAPT_BREAKDOWN_QUERY); assert.deepEqual(variables.filter, { advertiserIds: ["client-a"] });
    const attrs = { deviceType: "MOBILE_WEB", country: { code: "ec", name: "Ecuador" }, region: { code: "ec-g", name: "Guayas" } };
    return { campaignInsight: { __typename: "CampaignInsightOutcome", records: page([
      { campaign, attributes: attrs, metrics: { impressions: 100, clicks: 5 } },
      { campaign: { ...campaign, id: "campaign-b" }, attributes: attrs, metrics: { impressions: 200, clicks: 2 } },
    ]) } };
  }, connection, "client-a", "2026-01-01", "2026-01-03");
  assert.deepEqual(result.devices.rows, [{ id: "MOBILE_WEB", name: "Web móvil", impressions: 300, clicks: 7 }]);
  assert.deepEqual(result.regions.rows, [{ id: "ec:ec-g", name: "Guayas", impressions: 300, clicks: 7 }]);
  await assert.rejects(readStackAdaptBreakdowns(read({ campaignInsight: { __typename: "CampaignInsightOutcome", records: page([{ campaign: { ...campaign, advertiser: { id: "client-b" } }, attributes: {}, metrics: {} }]) } }), connection, "client-a", "2026-01-01", "2026-01-03"));
});
test("ratios use weighted totals, zero denominators are unavailable and null is not zero", () => {
  const m = { cost: 20, impressions: 1000, clicks: 25, conversions: null, videoCompletions: null, uniqueImpressions: null, frequency: null };
  assert.deepEqual(deliveryRates(m), { ctr: 2.5, cpm: 20, cpc: .8 });
  assert.deepEqual(deliveryRates({ ...m, impressions: 0, clicks: 0 }), { ctr: null, cpm: null, cpc: null });
  assert.equal(deliveryRates({ ...m, clicks: null }).ctr, null);
});
test("new report modes retain authorization gates and accept only fixed read queries", async () => {
  for (const mode of ["dashboard", "breakdowns"]) for (const profile of [null, { is_platform_admin: false }]) {
    let touched = false;
    const result = await handleStackAdaptRequest(profile, new URLSearchParams({ mode, advertiserId: "client-a", from: "2026-01-01", to: "2026-01-03" }), () => { touched = true; return null; });
    assert.equal(result.status, profile ? 403 : 401); assert.equal(touched, false);
  }
  let calls = 0;
  const transport = stackAdaptReader({ token: "synthetic", accountId: "account" }, async (_, options) => { calls++; assert.doesNotMatch(String(options?.body), /mutation/); return new Response(JSON.stringify({ data: {} })); });
  for (const query of [STACKADAPT_DASHBOARD_QUERY, STACKADAPT_BREAKDOWN_QUERY, STACKADAPT_CAMPAIGN_SCOPE_QUERY]) await transport(query, {});
  await assert.rejects(transport("query arbitrary { account { id } }", {})); assert.equal(calls, 3);
});
