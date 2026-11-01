import assert from "node:assert/strict";
import test from "node:test";
import { parsePreferences, readPreferences, DEFAULT_PREFERENCES } from "../lib/account-preferences";
import { changeOwnPassword } from "../lib/account-security";

const sample = { currentPassword: "synthetic-current-phrase", password: "synthetic-new-phrase", confirm: "synthetic-new-phrase", closeOthers: true };
test("preferences accept only the five local avatars and known palettes; never retain a supplied target or privilege", () => {
  const form = new FormData(); form.set("displayName", "  María José  "); form.set("avatarKey", "iguana"); form.set("avatarTone", "forest"); form.set("user_id", "other-person"); form.set("is_platform_admin", "true");
  assert.deepEqual(parsePreferences(form), { displayName: "María José", avatarKey: "iguana", avatarTone: "forest", reducedMotion: false });
  for (const avatar of ["https://example.test/tracker.svg", "<svg onload=alert(1)>", "../admin", ""]) { form.set("avatarKey", avatar); assert.equal(parsePreferences(form), null); }
  form.set("avatarKey", "crab"); form.set("avatarTone", "custom-url"); assert.equal(parsePreferences(form), null);
  form.set("avatarTone", "mangrove"); form.set("displayName", "bad\nname"); assert.equal(parsePreferences(form), null);
});
test("corrupt display settings fall back without loading a URL or arbitrary avatar", () => {
  assert.deepEqual(readPreferences({ avatar_key: "javascript:alert(1)", avatar_tone: "untrusted", reduced_motion: "true" }), DEFAULT_PREFERENCES);
});
test("a wrong current password cannot reach an update or session revocation", async () => {
  const calls: string[] = [];
  const result = await changeOwnPassword(sample, { verifyCurrent: async () => { calls.push("verify"); return false; }, updatePassword: async () => { calls.push("update"); return true; }, closeOtherSessions: async () => { calls.push("close"); return true; } });
  assert.equal(result.ok, false); assert.deepEqual(calls, ["verify"]); assert.ok(!JSON.stringify(result).includes(sample.currentPassword));
});
test("password confirmation and length are validated before any auth request", async () => {
  const fail = async () => { throw new Error("No auth request expected"); };
  for (const input of [{ ...sample, currentPassword: "" }, { ...sample, password: "short", confirm: "short" }, { ...sample, confirm: "different" }, { ...sample, password: sample.currentPassword, confirm: sample.currentPassword }]) {
    assert.equal((await changeOwnPassword(input, { verifyCurrent: fail, updatePassword: fail, closeOtherSessions: fail })).ok, false);
  }
});
test("a verified change forwards the current password, then closes only other sessions when requested", async () => {
  const calls: string[] = [];
  const result = await changeOwnPassword(sample, { verifyCurrent: async value => { assert.equal(value, sample.currentPassword); calls.push("verify"); return true; }, updatePassword: async (value, current) => { assert.equal(value, sample.password); assert.equal(current, sample.currentPassword); calls.push("update"); return true; }, closeOtherSessions: async () => { calls.push("others"); return true; } });
  assert.equal(result.ok, true); assert.deepEqual(calls, ["verify", "update", "others"]); assert.ok(!JSON.stringify(result).includes(sample.password));
});
test("a failed password update leaves sessions alone and does not report success", async () => {
  const result = await changeOwnPassword(sample, { verifyCurrent: async () => true, updatePassword: async () => false, closeOtherSessions: async () => { throw new Error("Do not revoke"); } });
  assert.equal(result.ok, false);
});
test("session cleanup failure reports the already-saved password truthfully without repeating the change", async () => {
  let updates = 0;
  const result = await changeOwnPassword(sample, { verifyCurrent: async () => true, updatePassword: async () => { updates++; return true; }, closeOtherSessions: async () => false });
  assert.equal(result.ok, true); assert.equal(updates, 1); assert.match(result.message, /No se pudo completar/);
});
test("a session-revocation network error cannot relabel a completed password change as failed", async () => {
  const result = await changeOwnPassword(sample, { verifyCurrent: async () => true, updatePassword: async () => true, closeOtherSessions: async () => { throw new Error("Synthetic network failure"); } });
  assert.equal(result.ok, true); assert.match(result.message, /Contraseña actualizada/);
});
