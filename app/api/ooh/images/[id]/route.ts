import { catalogAccess } from "@/lib/catalog-access-server";
import { oohPhotoPathAllowed } from "@/lib/ooh-catalog";
import { oohPhotoPresentation } from "@/lib/ooh-photo";
import sharp from "sharp";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[a-z0-9-]{1,150}$/.test(id)) return new Response(null, { status: 404, headers });
    const { db } = await catalogAccess();
    const { data: asset, error } = await db.from("ooh_catalog_assets").select("photo_path,details").eq("id", id).eq("active", true).maybeSingle();
    if (error || !asset?.photo_path || !oohPhotoPathAllowed(asset.photo_path)) return new Response(null, { status: 404, headers });
    const presentation = oohPhotoPresentation(asset.details?.photoPresentation);
    if (presentation && presentation.kind !== "photo") return new Response(null, { status: 404, headers });
    const { data, error: downloadError } = await db.storage.from("ooh-catalog").download(asset.photo_path);
    if (downloadError || !data) return new Response(null, { status: 404, headers });
    if (presentation?.kind === "photo" && presentation.crop) {
      const crop = presentation.crop, bytes = Buffer.from(await data.arrayBuffer());
      const image = sharp(bytes, { limitInputPixels: 40_000_000 }), metadata = await image.metadata();
      if (metadata.width !== crop.sourceWidth || metadata.height !== crop.sourceHeight) return new Response(null, { status: 404, headers });
      const photo = await image.extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height }).jpeg({ quality: 92 }).toBuffer();
      return new Response(new Uint8Array(photo), { headers: { ...headers, "Content-Type": "image/jpeg" } });
    }
    const extension = asset.photo_path.split(".").pop();
    const type = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
    return new Response(data, { headers: { ...headers, "Content-Type": type } });
  } catch { return new Response(null, { status: 503, headers }); }
}
