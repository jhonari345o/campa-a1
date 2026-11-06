import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { normalizeAvatarImage } from "../lib/account-avatar-image";
import { avatarVersion, ownsAvatarPath, avatarImageUrl, MAX_AVATAR_UPLOAD_BYTES } from "../lib/account-avatar";
import { parsePreferences, readPreferences } from "../lib/account-preferences";
const owner = "11111111-1111-4111-8111-111111111111", version = "22222222-2222-4222-8222-222222222222";

test("avatar references are local versioned images scoped to the account owner", () => {
  assert.equal(ownsAvatarPath(owner + "/" + version + ".webp", owner), true);
  for (const path of ["https://tracker.test/picture.webp", "../other.webp", owner + "/../other.webp", version + "/" + version + ".webp"]) assert.equal(ownsAvatarPath(path, owner), false);
  assert.equal(avatarVersion(owner + "/" + version + ".webp"), version);
  assert.equal(avatarImageUrl(version), "/api/account/avatar?v=" + version);
  assert.equal(avatarImageUrl("https://tracker.test/a"), null);
});
test("profile inputs cannot supply an image path or photo URL", () => {
  const form = new FormData(); form.set("displayName", "Persona"); form.set("avatarKey", "photo"); form.set("avatarTone", "forest"); form.set("avatar_image_path", "another-person/private.webp");
  const input = parsePreferences(form);
  assert.deepEqual(input, { displayName: "Persona", avatarKey: null, avatarTone: "forest", reducedMotion: false, useCustomAvatar: true });
  const projection = readPreferences({ avatar_image_path: owner + "/" + version + ".webp", use_custom_avatar: true });
  assert.equal(projection.customAvatarVersion, version); assert.equal(projection.useCustomAvatar, true); assert.ok(!JSON.stringify(projection).includes(owner));
  assert.equal(readPreferences({ avatar_image_path: "https://tracker.test/a", use_custom_avatar: true }).useCustomAvatar, false);
});
test("uploaded rasters become bounded square WebP avatars with source metadata removed", async () => {
  const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#246b48" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  assert.ok((await sharp(jpeg).metadata()).exif);
  const output = await normalizeAvatarImage(jpeg, "image/jpeg"), metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp"); assert.equal(metadata.width, 512); assert.equal(metadata.height, 512); assert.equal(metadata.exif, undefined); assert.equal(metadata.orientation, undefined);
});
test("file extensions and claimed MIME types cannot admit SVG, corrupt images or oversized input", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="file:///private/test"/></svg>');
  await assert.rejects(normalizeAvatarImage(svg, "image/png"));
  await assert.rejects(normalizeAvatarImage(svg, "image/svg+xml"));
  await assert.rejects(normalizeAvatarImage(Buffer.from([137,80,78,71,13,10,26,10,0]), "image/png"));
  await assert.rejects(normalizeAvatarImage(Buffer.alloc(MAX_AVATAR_UPLOAD_BYTES + 1), "image/jpeg"));
  const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#246b48" } }).png().toBuffer();
  await assert.rejects(normalizeAvatarImage(png, "image/jpeg"));
});
test("tiny or abusive raster dimensions are rejected before storage", async () => {
  const tiny = await sharp({ create: { width: 1, height: 1, channels: 3, background: "#246b48" } }).png().toBuffer();
  await assert.rejects(normalizeAvatarImage(tiny, "image/png"));
  const excessive = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#246b48" } }).png().toBuffer();
  excessive.writeUInt32BE(100_000, 16); excessive.writeUInt32BE(100_000, 20);
  await assert.rejects(normalizeAvatarImage(excessive, "image/png"));
});
