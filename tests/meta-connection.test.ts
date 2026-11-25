import assert from "node:assert/strict";
import test from "node:test";
import { assertMetaConnectionReady, inspectMetaConnection, REQUIRED_META_PERMISSIONS } from "../lib/ads/meta-connection";

const config = { adAccountId: "act_111", pageId: "222", instagramUserId: "333", apiVersion: "v25.0" };
const permissions = [...REQUIRED_META_PERMISSIONS, "instagram_basic"].map((permission) => ({ permission, status: "granted" }));
function fixture(patch: Record<string, unknown> = {}) {
  const calls: { path: string; params: Record<string, string> }[] = [];
  const responses: Record<string, unknown> = {
    me: { id: "444" },
    act_111: { id: "act_111", account_status: 1, currency: "USD" },
    "222": { id: "222", instagram_business_account: { id: "333" } },
    "333": { id: "333" },
    "me/permissions": { data: permissions },
    ...patch,
  };
  const read = async <T>(path: string, params: Record<string, string>): Promise<T> => {
    calls.push({ path, params });
    assert.ok(Object.hasOwn(responses, path), "Only the expected assets may be read");
    return responses[path] as T;
  };
  return { read, calls };
}

test("Meta verifies an active USD account and linked Instagram without disclosing asset IDs", async () => {
  const { read, calls } = fixture();
  const status = await inspectMetaConnection(config, read);
  assert.equal(status.connected, true);
  assert.equal(status.facebookReady, true);
  assert.equal(status.instagramReady, true);
  assert.deepEqual(status.issues, []);
  assert.deepEqual(status.missingPermissions, []);
  assert.doesNotThrow(() => assertMetaConnectionReady(status));
  assert.deepEqual(new Set(calls.map((call) => call.path)), new Set(["me", "act_111", "222", "333", "me/permissions"]));
  assert.doesNotMatch(JSON.stringify(status), /act_111|222|333|444/);
});

test("an accessible account is not ready when disabled, currency differs or required fields are absent", async () => {
  for (const account of [
    { id: "act_111", account_status: 2, currency: "USD" },
    { id: "act_111", account_status: 1, currency: "EUR" },
    { id: "act_111", account_status: 1 },
    { id: "act_111", currency: "USD" },
    { id: "act_999", account_status: 1, currency: "USD" },
    {},
  ]) {
    const status = await inspectMetaConnection(config, fixture({ act_111: account }).read);
    assert.equal(status.connected, false);
    assert.equal(status.facebookReady, false);
    assert.ok(status.issues.length > 0);
    assert.throws(() => assertMetaConnectionReady(status));
  }
});

test("Instagram must be accessible and actually linked to the configured Facebook page", async () => {
  for (const patch of [
    { "222": { id: "222" } },
    { "222": { id: "222", instagram_business_account: { id: "999" } } },
    { "333": { id: "999" } },
    { "333": {} },
  ]) {
    const status = await inspectMetaConnection(config, fixture(patch).read);
    assert.equal(status.connected, false);
    assert.equal(status.instagramReady, false);
    assert.ok(status.issues.length > 0);
    assert.throws(() => assertMetaConnectionReady(status));
  }
});

test("missing or declined permissions and an unidentified actor never yield a ready connection", async () => {
  for (const permission of [...REQUIRED_META_PERMISSIONS, "instagram_basic"]) {
    const status = await inspectMetaConnection(config, fixture({
      "me/permissions": { data: permissions.map((item) => item.permission === permission ? { ...item, status: "declined" } : item) },
    }).read);
    assert.equal(status.connected, false);
    assert.deepEqual(status.missingPermissions, [permission]);
  }
  for (const patch of [{ me: {} }, { "222": { id: "999", instagram_business_account: { id: "333" } } }, { "me/permissions": {} }]) {
    assert.equal((await inspectMetaConnection(config, fixture(patch).read)).connected, false);
  }
});

test("Facebook-only connections do not request or imply Instagram access", async () => {
  const { read, calls } = fixture({ "222": { id: "222" }, "me/permissions": { data: permissions.filter((item) => item.permission !== "instagram_basic") } });
  const status = await inspectMetaConnection({ ...config, instagramUserId: undefined }, read);
  assert.equal(status.connected, true);
  assert.equal(status.instagramReady, false);
  assert.equal(calls.some((call) => call.path === "333"), false);
  assert.equal(calls.find((call) => call.path === "222")?.params.fields, "id");
});

test("a failed API request cannot be interpreted as a verified connection", async () => {
  await assert.rejects(inspectMetaConnection(config, async () => { throw new Error("API unavailable"); }), /API unavailable/);
});
