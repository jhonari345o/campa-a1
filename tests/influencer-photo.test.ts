import test from "node:test";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {resolve} from "node:path";
import {INFLUENCER_PHOTOS,influencerPhoto} from "../lib/media-catalog";
test("every reviewed portrait resolves to a bundled photograph",()=>{
  for(const [slug,path] of Object.entries(INFLUENCER_PHOTOS)) {
    assert.equal(influencerPhoto(slug),path);
    assert.match(path,/^\/providers\/influencers\/[a-z0-9-]+\.(jpg|webp)$/);
    assert.equal(existsSync(resolve("public",path.slice(1))),true,slug);
  }
});
test("unknown and malicious photo identifiers cannot become paths or external requests",()=>{
  for(const id of ["unknown","../private","https://external.test/photo","__proto__","constructor"])
    assert.equal(influencerPhoto(id),null);
});
