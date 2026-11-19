import assert from "node:assert/strict";
import { createPausedMetaCampaign, getMetaAdInsights, pauseMetaCampaign } from "../../lib/ads/meta";
import { parseMetaClientBindings } from "../../lib/ads/meta-client-binding";
import type { MetaClientConfig } from "../../lib/ads/meta-client-config";
import { REQUIRED_META_PERMISSIONS } from "../../lib/ads/meta-connection";

async function run() {
  const clients = [1, 2].map((n): MetaClientConfig => {
    const binding = parseMetaClientBindings(JSON.stringify([{
      id: `client-${n}`, name: `Client ${n}`, active: true, version: 1,
      companyId: `10000000-0000-4000-8000-00000000000${n}`, clientId: null,
      adAccountId: `act_10${n}`, pageId: `20${n}`, credentialEnv: `META_CLIENT_TOKEN_TEST_${n}`,
    }]))[0];
    return { ...binding, binding, accessToken: `fixture-client-${n}`, apiVersion: "v25.0" };
  });
  type Call = { client: number; path: string; method: string; body: URLSearchParams };
  const calls: Call[] = [];
  let reject = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://graph.facebook.com");
    const headers = new Headers(init?.headers);
    const client = clients.findIndex((config) => headers.get("authorization") === `Bearer ${config.accessToken}`);
    assert.notEqual(client, -1, "No global or unrelated credential may be used");
    const config = clients[client];
    const path = url.pathname.replace(/^\/v25\.0\//, "");
    const method = init?.method ?? "GET";
    const body = new URLSearchParams(String(init?.body ?? ""));
    calls.push({ client, path, method, body });
    if (reject) return Response.json({ error: { message: "reflected-secret-from-provider", code: 190 } }, { status: 400 });
    if (method === "POST") return Response.json({ id: `${client + 1}${calls.length}99` });
    if (path === "me") return Response.json({ id: "900" });
    if (path === "me/permissions") return Response.json({ data: REQUIRED_META_PERMISSIONS.map((permission) => ({ permission, status: "granted" })) });
    if (path === config.adAccountId) return Response.json({ id: config.adAccountId, currency: "USD", account_status: 1 });
    if (path === config.pageId || path === `${config.pageId}_1234`) return Response.json({ id: path });
    if (path.endsWith("/insights")) return Response.json({ data: [{ impressions: "100", reach: "80", clicks: "4", spend: "1.5" }] });
    assert.fail(`Unexpected request: ${path}`);
  };
  // These historical variables must have no effect on publication or metrics.
  process.env.META_ACCESS_TOKEN = "wrong-global-token";
  process.env.META_AD_ACCOUNT_ID = "act_999";
  process.env.META_PAGE_ID = "999";
  try {
    for (const [index, config] of clients.entries()) {
      const ids = await createPausedMetaCampaign(config, {
        jobId: `10000000-0000-4000-8000-00000000000${index + 1}`,
        red: "facebook", postUrl: "https://www.facebook.com/example/posts/1234",
        latitude: -2.2, longitude: -79.9, radiusKm: 5, targetScope: "radius", budgetCents: 1000,
      });
      const created = calls.filter((call) => call.client === index && call.method === "POST");
      assert.deepEqual(created.map((call) => call.path), ["campaigns", "adsets", "adcreatives", "ads"].map((path) => `${config.adAccountId}/${path}`));
      assert.ok(created.filter((call) => !call.path.endsWith("/adcreatives")).every((call) => call.body.get("status") === "PAUSED"));
      assert.equal(created[2].body.get("page_id"), config.pageId);
      assert.equal(created[2].body.get("object_story_id"), `${config.pageId}_1234`);
      const metrics = await getMetaAdInsights(config, ids.adId);
      assert.equal(metrics.alcance, 80);
      assert.equal(calls.at(-1)?.client, index);
      await pauseMetaCampaign(config, ids);
      assert.ok(calls.slice(-3).every((call) => call.client === index && call.body.get("status") === "PAUSED"));
    }
    reject = true;
    await assert.rejects(() => getMetaAdInsights(clients[0], "123"), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /190/);
      assert.doesNotMatch(error.message, /reflected-secret/);
      return true;
    });
  } finally { globalThis.fetch = originalFetch; }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
