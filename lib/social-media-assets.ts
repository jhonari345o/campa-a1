import sharp from "sharp";
export const SOCIAL_ASSET_BUCKET = "social-brand-assets";
export const MAX_SOCIAL_ASSET_BYTES = 4 * 1024 * 1024;
export async function validateSocialAsset(bytes: Uint8Array, mime: string, kind: "logo" | "manual"): Promise<string | null> {
  if (!bytes.length || bytes.length > MAX_SOCIAL_ASSET_BYTES) return "Usa un archivo de hasta 4 MB.";
  const b = Buffer.from(bytes);
  if (kind === "manual") return mime === "application/pdf" && /^%PDF-\d\.\d/.test(b.toString("ascii", 0, 8)) && b.subarray(-4096).includes(Buffer.from("%%EOF")) ? null : "El manual debe ser un PDF válido.";
  const signatures: Record<string, boolean> = {
    "image/png": b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/jpeg": b[0] === 255 && b[1] === 216 && b[2] === 255,
    "image/webp": b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  };
  if (!signatures[mime]) return "Usa el logo en PNG, JPG o WebP.";
  try {
    const image = sharp(b, { limitInputPixels: 40_000_000, failOn: "error", animated: false });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) return "Usa un logo estático válido.";
    // Decode to validate the original; the stored bytes remain exactly as uploaded.
    await image.resize({ width: 16, height: 16, fit: "inside" }).timeout({ seconds: 5 }).raw().toBuffer();
    return null;
  } catch { return "No se pudo leer el logo. Usa otro archivo PNG, JPG o WebP."; }
}
