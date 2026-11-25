import { webcrypto } from "node:crypto";

const SIGNATURE_HEADER = /^V2-HMAC-SHA256,\s*Signature:\s*([a-f0-9]{64})$/i;

/** Verifica el cuerpo crudo exactamente como dLocal Go lo firmó. */
export async function verifyDlocalNotificationSignature(
  rawBody: string,
  authorizationHeader: string | null,
  apiKey: string,
  secretKey: string,
): Promise<boolean> {
  const match = authorizationHeader?.trim().match(SIGNATURE_HEADER);
  if (!match || !apiKey || !secretKey) return false;
  // This is protocol authentication, not password storage. Preserve dLocal Go's
  // HMAC-SHA256 over API key + exact UTF-8 body; never derive a password hash here.
  // A non-extractable, verify-only key delegates MAC comparison to Web Crypto.
  const key = await webcrypto.subtle.importKey(
    "raw", Buffer.from(secretKey, "utf8"),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  );
  return webcrypto.subtle.verify(
    "HMAC", key, Buffer.from(match[1], "hex"), Buffer.from(`${apiKey}${rawBody}`, "utf8"),
  );
}

