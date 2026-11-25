import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, randomUUID } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

const purpose = "ad-mavericks-one:planning-private-draft:v1";
const lifetimeMs = 2 * 60 * 60_000;
const maxBytes = 1_500_000, maxToken = 600_000;
const validId = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function key(secret: string) {
  if (!secret) throw new Error("PLANNING_KEY_MISSING");
  return Buffer.from(hkdfSync("sha256", secret, "", purpose, 32));
}

/** Binds a server-built draft to the current identity and role, not to browser-supplied prices. */
export function planningDraftScope(profile: { id: string; is_platform_admin: boolean; workspace?: { companyId: string; role: string } | null }): string {
  return JSON.stringify([profile.id, profile.is_platform_admin, profile.workspace?.companyId ?? null, profile.workspace?.role ?? null]);
}

export function sealPlanningDraft(data: unknown, scope: string, secret: string, now = Date.now()): string {
  const plain = Buffer.from(JSON.stringify({ version: 1, id: randomUUID(), expiresAt: now + lifetimeMs, data }));
  if (plain.length > maxBytes) throw new Error("PLANNING_DRAFT_TOO_LARGE");
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(purpose + ":" + scope));
  const encrypted = Buffer.concat([cipher.update(gzipSync(plain)), cipher.final()]);
  const token = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
  if (token.length > maxToken) throw new Error("PLANNING_DRAFT_TOO_LARGE");
  return token;
}

export function openPlanningDraft<T>(token: string, scope: string, secret: string, now = Date.now()): { id: string; data: T } {
  if (typeof token !== "string" || token.length < 40 || token.length > maxToken || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error("INVALID_PLANNING_DRAFT");
  try {
    const bytes = Buffer.from(token, "base64url"), decipher = createDecipheriv("aes-256-gcm", key(secret), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(purpose + ":" + scope));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const value = JSON.parse(gunzipSync(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]), { maxOutputLength: maxBytes }).toString());
    if (value.version !== 1 || !validId.test(value.id) || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= now || value.expiresAt > now + lifetimeMs) throw new Error("EXPIRED");
    return { id: value.id, data: value.data as T };
  } catch { throw new Error("INVALID_PLANNING_DRAFT"); }
}
