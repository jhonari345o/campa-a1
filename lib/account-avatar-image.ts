import sharp from "sharp";
import { AVATAR_MIME_TYPES, MAX_AVATAR_UPLOAD_BYTES } from "./account-avatar";

export class AvatarImageError extends Error {}
function imageSignature(bytes: Buffer): "jpeg" | "png" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}
/** Decode verified raster signatures, enforce a pixel limit and omit all source metadata. */
export async function normalizeAvatarImage(input: Uint8Array, mime: string): Promise<Buffer> {
  if (!input.length || input.length > MAX_AVATAR_UPLOAD_BYTES) throw new AvatarImageError("La imagen no se pudo preparar. Elige otra foto e inténtalo nuevamente.");
  if (!AVATAR_MIME_TYPES.includes(mime as typeof AVATAR_MIME_TYPES[number])) throw new AvatarImageError("Usa una imagen JPG, PNG o WebP.");
  const bytes = Buffer.from(input), format = imageSignature(bytes);
  if (!format || mime !== `image/${format}`) throw new AvatarImageError("El archivo no es una imagen JPG, PNG o WebP válida.");
  try {
    const image = sharp(bytes, { limitInputPixels: 20_000_000, failOn: "error", animated: false });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width < 16 || metadata.height < 16 || (metadata.pages ?? 1) > 1 || !["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new Error("Unsupported raster");
    const output = await image.rotate().resize(512, 512, { fit: "cover", withoutEnlargement: true }).webp({ quality: 86 }).timeout({ seconds: 8 }).toBuffer();
    if (output.length > MAX_AVATAR_UPLOAD_BYTES) throw new Error("Output too large");
    return output;
  } catch { throw new AvatarImageError("No pudimos procesar esa imagen. Prueba con otra foto JPG, PNG o WebP."); }
}
