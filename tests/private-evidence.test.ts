import assert from "node:assert/strict";
import test from "node:test";
import { servePrivateEvidence } from "../lib/private-evidence";

const asset = ["test-campaign", "08-evidence.webp"];
const admin = async () => ({ is_platform_admin: true });

test("private evidence denies anonymous and non-admin users before reading files", async () => {
  let reads = 0;
  for (const [profile, status] of [[null, 401], [{ is_platform_admin: false }, 403]] as const) {
    const response = await servePrivateEvidence(asset, {
      getProfile: async () => profile,
      readAsset: async () => { reads++; return new Uint8Array(); },
    });
    assert.equal(response.status, status);
    assert.match(response.headers.get("Cache-Control") ?? "", /private, no-store/);
    assert.equal(await response.text(), "");
  }
  assert.equal(reads, 0);
});

test("private evidence rejects traversal and non-generated paths", async () => {
  let reads = 0;
  for (const path of [["..", "secret.webp"], ["campaign", "../secret.webp"], ["campaign", "%2e%2e.webp"], ["campaign", "file.svg"], ["campaign", "nested", "file.webp"], ["campaign", "file.webp/extra"], []]) {
    const response = await servePrivateEvidence(path, {
      getProfile: admin,
      readAsset: async () => { reads++; return new Uint8Array(); },
    });
    assert.equal(response.status, 404);
  }
  assert.equal(reads, 0);
});

test("private evidence serves an admin's file without shared caching", async () => {
  const response = await servePrivateEvidence(asset, {
    getProfile: admin,
    readAsset: async (path) => { assert.equal(path, asset.join("/")); return new Uint8Array([82, 73, 70, 70]); },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/webp");
  assert.match(response.headers.get("Cache-Control") ?? "", /private, no-store/);
  assert.equal(response.headers.get("Vary"), "Cookie");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([82, 73, 70, 70]));
});

test("private evidence fails closed on authentication or storage failures", async () => {
  let reads = 0;
  const authFailure = await servePrivateEvidence(asset, {
    getProfile: async () => { throw new Error("unavailable"); },
    readAsset: async () => { reads++; return new Uint8Array(); },
  });
  assert.equal(authFailure.status, 503);
  assert.equal(reads, 0);
  const missing = await servePrivateEvidence(asset, {
    getProfile: admin,
    readAsset: async () => { throw Object.assign(new Error("private path"), { code: "ENOENT" }); },
  });
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), "");
});
