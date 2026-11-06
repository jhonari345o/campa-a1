import { AVATAR_MIME_TYPES, MAX_AVATAR_ORIGINAL_BYTES } from "./account-avatar";

/** The original stays in the browser; only the prepared avatar is uploaded. */
export async function prepareAvatarFile(file: File): Promise<File> {
  if (!AVATAR_MIME_TYPES.includes(file.type as typeof AVATAR_MIME_TYPES[number])) throw new Error("Usa una imagen JPG, PNG o WebP.");
  if (!file.size || file.size > MAX_AVATAR_ORIGINAL_BYTES) throw new Error("Elige una imagen de hasta 10 MB.");
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error("No pudimos abrir esa imagen. Elige otra foto."); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 20_000_000 || Math.min(bitmap.width, bitmap.height) < 16) throw new Error("Elige otra imagen de perfil.");
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("No pudimos preparar la imagen.");
    const side = Math.min(bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 512, 512);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", .88));
    if (!blob) throw new Error("No pudimos preparar la imagen.");
    return new File([blob], blob.type === "image/png" ? "avatar.png" : "avatar.webp", { type: blob.type });
  } finally { bitmap.close(); }
}
