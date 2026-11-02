import { catalogAccess } from "@/lib/catalog-access-server";
import { oohPhotoPathAllowed } from "@/lib/ooh-catalog";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[a-z0-9-]{1,150}$/.test(id)) return new Response(null, { status: 404, headers });
    const { db } = await catalogAccess();
    const { data: asset, error } = await db.from("ooh_catalog_assets").select("photo_path").eq("id", id).eq("active", true).maybeSingle();
    if (error || !asset?.photo_path || !oohPhotoPathAllowed(asset.photo_path)) return new Response(null, { status: 404, headers });
    const { data, error: downloadError } = await db.storage.from("ooh-catalog").download(asset.photo_path);
    if (downloadError || !data) return new Response(null, { status: 404, headers });
    const extension = asset.photo_path.split(".").pop();
    const type = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
    return new Response(data, { headers: { ...headers, "Content-Type": type } });
  } catch { return new Response(null, { status: 503, headers }); }
}
