import assert from "node:assert/strict";
import test from "node:test";
import { handleStackAdaptRequest } from "../lib/ads/stackadapt-request";
import {
  inspectStackAdapt, readStackAdaptCampaigns, readStackAdaptReport, stackAdaptConfig,
  stackAdaptDateRange, stackAdaptReader, STACKADAPT_CAMPAIGNS_QUERY, STACKADAPT_CONNECTION_QUERY,
  STACKADAPT_ENDPOINT, STACKADAPT_REPORT_QUERY, type StackAdaptConnection, type StackAdaptRead,
} from "../lib/ads/stackadapt";

const config = { token: "synthetic-test-token-never-real", accountId: "test-account" };
const advertiser = { id: "test-advertiser", name: "Test advertiser", isArchived: false };
const pagination = (nodes: unknown[], endCursor: string | null = null, totalCount = nodes.length) => ({ nodes, pageInfo: { hasNextPage: !!endCursor, endCursor }, totalCount });
const connectionPayload = (nodes: unknown[] = [{ advertiser, scopes: ["READ"] }]) => ({
  account: { id: config.accountId, currency: "USD" },
  tokenInfo: { expiresAt: null as string | null, scopesByAdvertiser: pagination(nodes) },
});
const connection: StackAdaptConnection = { accountId: config.accountId, currency: "USD", checkedAt: "2026-01-01T00:00:00Z", expiresAt: null, advertisers: [{ ...advertiser, canWrite: false }] };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const reader = (data: Record<string, unknown>): StackAdaptRead => async () => data;

test("configuration is private, incomplete configuration stays pending and malformed credentials fail", () => {
  assert.equal(stackAdaptConfig({}), null);
  assert.equal(stackAdaptConfig({ STACKADAPT_API_TOKEN: config.token }), null);
  assert.deepEqual(stackAdaptConfig({ STACKADAPT_API_TOKEN: config.token, STACKADAPT_ACCOUNT_ID: config.accountId }), config);
  for (const token of ["secret\nheader", "secret token", "x".repeat(4097)]) assert.throws(() => stackAdaptConfig({ STACKADAPT_API_TOKEN: token, STACKADAPT_ACCOUNT_ID: config.accountId }));
  assert.throws(() => stackAdaptConfig({ STACKADAPT_API_TOKEN: config.token, STACKADAPT_ACCOUNT_ID: "https://other-host" }));
});

test("anonymous and client users cannot read configuration or call the provider", async () => {
  for (const profile of [null, { is_platform_admin: false }]) {
    let touched = false;
    const result = await handleStackAdaptRequest(profile, new URLSearchParams(), () => { touched = true; throw new Error("must not read"); });
    assert.equal(result.status, profile ? 403 : 401);
    assert.equal(touched, false);
  }
  assert.deepEqual(await handleStackAdaptRequest({ is_platform_admin: true }, new URLSearchParams(), () => null), { status: 200, body: { state: "unconfigured" } });
});

test("the transport sends only fixed queries to the official host with no cache or redirects", async () => {
  let count = 0;
  const read = stackAdaptReader(config, async (url, options) => {
    count++;
    assert.equal(url, STACKADAPT_ENDPOINT);
    assert.equal(options?.method, "POST");
    assert.equal(options?.redirect, "error");
    assert.equal(options?.cache, "no-store");
    assert.equal(new Headers(options?.headers).get("Authorization"), `Bearer ${config.token}`);
    assert.ok(options?.signal);
    const request = JSON.parse(String(options?.body));
    assert.equal(request.query, STACKADAPT_CONNECTION_QUERY);
    assert.doesNotMatch(request.query, /mutation/);
    return json({ data: connectionPayload() });
  });
  await read(STACKADAPT_CONNECTION_QUERY, { after: null });
  await assert.rejects(read("mutation { anything }", {}));
  assert.equal(count, 1);
});

test("provider errors, partial GraphQL responses, network failures and excessive payloads never leak secrets", async () => {
  const cases: Array<typeof fetch> = [
    async () => json({ error: config.token }, 401),
    async () => json({ error: config.token }, 403),
    async () => json({ error: config.token }, 429),
    async () => json({ error: config.token }, 500),
    async () => json({ data: connectionPayload(), errors: [{ message: config.token }] }),
    async () => json({ data: connectionPayload(), errors: { message: config.token } }),
    async () => json({ data: { text: "x".repeat(1_000_001) } }),
    async () => new Response("invalid json " + config.token),
    async () => { throw new Error(config.token); },
  ];
  for (const fetcher of cases) await assert.rejects(stackAdaptReader(config, fetcher)(STACKADAPT_CONNECTION_QUERY, {}), error => {
    assert.ok(error instanceof Error);
    assert.doesNotMatch(error.message, new RegExp(config.token));
    return true;
  });
});

test("verification traverses permissions and selects only readable nonarchived advertisers", async () => {
  let calls = 0;
  const result = await inspectStackAdapt(config, async (query, variables) => {
    assert.equal(query, STACKADAPT_CONNECTION_QUERY);
    assert.equal(variables.after, calls ? "page-2" : null);
    const data = connectionPayload(calls++ ? [
      { advertiser: { ...advertiser, id: "archived", isArchived: true }, scopes: ["READ"] },
      { advertiser: { ...advertiser, id: "write-only" }, scopes: ["WRITE"] },
      { advertiser: { ...advertiser, id: "full" }, scopes: ["READ", "WRITE"] },
    ] : undefined);
    if (calls === 1) data.tokenInfo.scopesByAdvertiser = pagination(data.tokenInfo.scopesByAdvertiser.nodes, "page-2", 4);
    return data;
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.advertisers.map(item => [item.id, item.canWrite]), [[advertiser.id, false], ["full", true]]);
  assert.equal(result.currency, "USD");
  assert.doesNotMatch(JSON.stringify(result), new RegExp(config.token));
});

test("wrong account, expired key, broken scope pages or missing currency cannot verify", async () => {
  const wrongAccount = connectionPayload(); wrongAccount.account.id = "another-account";
  const expired = connectionPayload(); expired.tokenInfo.expiresAt = "2000-01-01T00:00:00Z";
  const malformedExpiry = connectionPayload(); malformedExpiry.tokenInfo.expiresAt = "yesterday";
  const currency = connectionPayload(); currency.account.currency = "";
  const badScope = connectionPayload([{ advertiser, scopes: ["UNKNOWN"] }]);
  const loop = connectionPayload(); loop.tokenInfo.scopesByAdvertiser = pagination([], "repeated", 1);
  for (const data of [wrongAccount, expired, malformedExpiry, currency, badScope, loop, {}]) await assert.rejects(inspectStackAdapt(config, reader(data)));
});

test("campaign reads require a verified advertiser and reject cross-advertiser responses", async () => {
  let calls = 0;
  const campaign = { id: "campaign-1", name: "CTV test", advertiser: { id: advertiser.id }, channelType: "CTV", campaignStatus: { state: "PAUSED", status: "CAMPAIGN_PAUSED" } };
  const read: StackAdaptRead = async (query, variables) => {
    calls++; assert.equal(query, STACKADAPT_CAMPAIGNS_QUERY);
    assert.deepEqual(variables, { advertiserIds: [advertiser.id], after: "page-1" });
    return { campaigns: pagination([campaign], "page-2", 101) };
  };
  await assert.rejects(readStackAdaptCampaigns(read, connection, "forbidden", null));
  assert.equal(calls, 0);
  const result = await readStackAdaptCampaigns(read, connection, advertiser.id, "page-1");
  assert.equal(result.nextCursor, "page-2"); assert.equal(result.total, 101);
  assert.equal(result.campaigns[0].state, "PAUSED");
  campaign.advertiser.id = "other";
  await assert.rejects(readStackAdaptCampaigns(read, connection, advertiser.id, "page-1"));
});

test("report handling preserves monetary units and fractional conversions, distinguishes missing metrics and progress", async () => {
  const read: StackAdaptRead = async (query, variables) => {
    assert.equal(query, STACKADAPT_REPORT_QUERY);
    assert.deepEqual(variables, { advertiserIds: [advertiser.id], date: { from: "2025-10-01", to: "2025-10-31" } });
    return { campaignDelivery: { __typename: "CampaignDeliveryOutcome", totalStats: { cost: "100.57", impressionsBigint: "10000", clicksBigint: "0", conversions: 2.5, videoCompletionsBigint: null } } };
  };
  const result = await readStackAdaptReport(read, connection, advertiser.id, "2025-10-01", "2025-10-31");
  assert.deepEqual(result.metrics, { cost: 100.57, impressions: 10000, clicks: 0, conversions: 2.5, videoCompletions: null });
  for (const outcome of [{ __typename: "Progress" }, { __typename: "CampaignDeliveryOutcome", totalStats: null }]) {
    const data = await readStackAdaptReport(reader({ campaignDelivery: outcome }), connection, advertiser.id, "2025-10-01", "2025-10-31");
    assert.equal(data.metrics, null); assert.equal(data.state, outcome.__typename === "Progress" ? "processing" : "ready");
  }
  for (const value of ["9007199254740993", "bad", -1, false, ""]) await assert.rejects(readStackAdaptReport(reader({ campaignDelivery: { __typename: "CampaignDeliveryOutcome", totalStats: { impressionsBigint: value } } }), connection, advertiser.id, "2025-10-01", "2025-10-31"));
});

test("invalid dates or request modes fail before calling StackAdapt", async () => {
  for (const dates of [["2025-02-30", "2025-03-01"], ["2025-10-31", "2025-10-01"], ["2025-01-01", "2025-12-31"], ["2025-1-1", "2025-01-02"], ["2099-01-01", "2099-01-02"]]) assert.throws(() => stackAdaptDateRange(dates[0], dates[1]));
  for (const query of ["mode=activate", "mode=campaigns", "mode=report&advertiserId=test-advertiser&from=bad&to=bad"]) {
    let touched = false;
    const result = await handleStackAdaptRequest({ is_platform_admin: true }, new URLSearchParams(query), () => { touched = true; return config; });
    assert.equal(result.status, 400); assert.equal(touched, false);
  }
});

test("the API checks advertiser authorization and does not expose unexpected internal errors", async () => {
  const result = await handleStackAdaptRequest({ is_platform_admin: true }, new URLSearchParams("mode=campaigns&advertiserId=forbidden"), () => config, () => reader(connectionPayload()));
  assert.equal(result.status, 403);
  const failed = await handleStackAdaptRequest({ is_platform_admin: true }, new URLSearchParams(), () => { throw new Error(config.token); });
  assert.equal(failed.status, 502);
  assert.doesNotMatch(JSON.stringify(failed), new RegExp(config.token));
});
