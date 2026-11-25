import test from "node:test";
import assert from "node:assert/strict";
import { oohPhotoPresentation } from "../lib/ooh-photo";
import { parseOohAsset } from "../lib/ooh-catalog";

test("verified photo crops are bounded to their exact source image", () => {
  const crop = { left: 20, top: 40, width: 200, height: 140, sourceWidth: 640, sourceHeight: 360 };
  assert.deepEqual(oohPhotoPresentation({ kind: "photo", crop }), { kind: "photo", crop });
  for (const patch of [{ left: -1 }, { width: 1000 }, { height: 0 }, { top: 0.5 }, { sourceHeight: 40_000 }]) assert.deepEqual(oohPhotoPresentation({ kind: "photo", crop: { ...crop, ...patch } }), { kind: "document" });
});
test("a map or technical document never becomes the element photograph", () => {
  for (const kind of ["map", "document"]) {
    assert.equal(parseOohAsset({ id: "synthetic-asset", provider_slug: "provider", photo_path: "a".repeat(64) + ".jpg", details: { name: "Elemento", photoPresentation: { kind } } })?.photo, false);
  }
});
