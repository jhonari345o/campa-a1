import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { EMPTY_BRAND, EMPTY_BRIEF, effectivePostStatus, parseBrandProfile, parseSocialCaptions, parseSocialPeriod, socialCalendarCsv, socialCaptionMessages, validSocialDate, type SocialPeriod } from "../lib/social-media";
import { validateSocialAsset } from "../lib/social-media-assets";
const company = "10000000-0000-4000-8000-000000000001", client = "20000000-0000-4000-8000-000000000001";
function fixture(): SocialPeriod { return { id: "30000000-0000-4000-8000-000000000001", companyId: company, clientId: client, name: "Noviembre", start: "2026-11-01", end: "2026-11-30", brief: { ...EMPTY_BRIEF, objective: "Dar a conocer el servicio" }, version: 1, posts: [{ id: "40000000-0000-4000-8000-000000000001", title: "Servicio", date: "2026-11-04", time: "12:30", channel: "Instagram", format: "Carrusel", pillar: "Educación", direction: "Explicar los beneficios confirmados", caption: "Conoce el servicio", cta: "Escríbenos", status: "approved", approvedBrandVersion: 2 }] }; }

test("calendar rejects dates outside the period, invalid channels and corrupt or excessive posts", () => {
  assert.ok(parseSocialPeriod(fixture()));
  for (const mutate of [
    (p: SocialPeriod) => { p.posts[0].date = "2026-12-01"; },
    (p: SocialPeriod) => { p.posts[0].time = "24:00"; },
    (p: SocialPeriod) => { p.posts[0].channel = "Facebook"; },
    (p: SocialPeriod) => { p.end = "2026-10-31"; },
    (p: SocialPeriod) => { p.posts.push({ ...p.posts[0] }); },
    (p: SocialPeriod) => { p.posts[0].caption = "a".repeat(4001); },
    (p: SocialPeriod) => { p.brief.channels = []; },
    (p: SocialPeriod) => { p.brief.channels = ["Instagram", "Instagram"]; },
    (p: SocialPeriod) => { p.version = -1; },
  ]) { const p = fixture(); mutate(p); assert.equal(parseSocialPeriod(p), null); }
  assert.equal(validSocialDate("2026-02-30"), false);
  assert.equal(validSocialDate("2028-02-29"), true);
  assert.equal(validSocialDate("invalid"), false);
  assert.equal(parseSocialPeriod(null), null);
});
test("brand references must be asset UUIDs; changing brand version makes an older approval require review", () => {
  assert.deepEqual(parseBrandProfile(EMPTY_BRAND), EMPTY_BRAND);
  assert.equal(parseBrandProfile({ ...EMPTY_BRAND, logoAssetId: "https://another-site/logo.png" }), null);
  assert.equal(parseBrandProfile({ ...EMPTY_BRAND, rules: null }), null);
  assert.equal(effectivePostStatus(fixture().posts[0], 2), "approved");
  assert.equal(effectivePostStatus(fixture().posts[0], 3), "review");
});
test("caption generation carries the selected brand and briefing without claiming to read attachments", () => {
  const p = fixture(), messages = socialCaptionMessages("Cliente sintético", { ...EMPTY_BRAND, tone: "Cercano", rules: "No ofrecer descuentos", forbidden: "gratis" }, p, p.posts[0]);
  const data = JSON.parse(messages[1].content);
  assert.equal(data.brand.tone, "Cercano"); assert.equal(data.brand.rules, "No ofrecer descuentos"); assert.equal(data.brand.forbidden, "gratis");
  assert.equal(data.period.brief.objective, p.brief.objective); assert.equal(data.post.channel, "Instagram");
  assert.equal(data.brand.logoAssetId, undefined);
  assert.match(messages[0].content, /no han sido leídos/);
  assert.equal(parseSocialCaptions('{"captions":["Uno","Dos","Tres"]}')?.length, 3);
  for (const raw of ['{"captions":["Uno","Uno","Tres"]}', '{"captions":["Uno"]}', '{"captions":["Uno","Dos",null]}', 'not json']) assert.equal(parseSocialCaptions(raw), null);
});
test("CSV preserves caption line breaks, neutralizes spreadsheet formulas and reports stale approvals as review", () => {
  const p = fixture(); p.posts[0].title = '=HYPERLINK("https://example.com")'; p.posts[0].caption = 'Primera línea\n"Segunda"';
  const csv = socialCalendarCsv("Cliente", p, 3);
  assert.ok(csv.startsWith("\uFEFF")); assert.match(csv, /'=HYPERLINK/); assert.match(csv, /Primera línea\n""Segunda""/);
  assert.match(csv, /En revisión/); assert.doesNotMatch(csv, /Aprobado/);
});
test("uploads accept original static raster logos and reject spoofed MIME, animation and oversized files", async () => {
  const bytes = await sharp({ create: { width: 30, height: 20, channels: 4, background: "#006633" } }).png().toBuffer(), original = Buffer.from(bytes);
  assert.equal(await validateSocialAsset(bytes, "image/png", "logo"), null);
  assert.deepEqual(bytes, original);
  assert.ok(await validateSocialAsset(bytes, "image/jpeg", "logo"));
  assert.ok(await validateSocialAsset(Buffer.from('<svg onload="alert(1)"/>'), "image/png", "logo"));
  assert.ok(await validateSocialAsset(new Uint8Array(12 * 1024 * 1024 + 1), "image/png", "logo"));
  assert.ok(await validateSocialAsset(Buffer.from("not a pdf"), "application/pdf", "manual"));
  assert.equal(await validateSocialAsset(Buffer.from("%PDF-1.7\nexample\n%%EOF"), "application/pdf", "manual"), null);
});
