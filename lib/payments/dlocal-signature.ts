import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_HEADER = /^V2-HMAC-SHA256,\s*Signature:\s*([a-f0-9]{64})$/i;

/** Verifica el cuerpo crudo exactamente como dLocal Go lo firmó. */
export function verifyDlocalNotificationSignature(
  rawBody: string,
  authorizationHeader: string | null,
  apiKey: string,
  secretKey: string,
): boolean {
  const match = authorizationHeader?.trim().match(SIGNATURE_HEADER);
  if (!match || !apiKey || !secretKey) return false;
  const expected = createHmac("sha256", secretKey).update(`${apiKey}${rawBody}`, "utf8").digest();
  const received = Buffer.from(match[1], "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

