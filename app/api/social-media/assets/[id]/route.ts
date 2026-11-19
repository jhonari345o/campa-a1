import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/social-media";
import { SOCIAL_ASSET_BUCKET } from "@/lib/social-media-assets";
export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid(id)) return new NextResponse(null, { status: 404, headers: privateHeaders });
  const db = await createClient(), { data: { user } } = await db.auth.getUser();
  if (!user || user.app_metadata?.must_change_password === true) return new NextResponse(null, { status: 401, headers: privateHeaders });
  const { data: asset } = await db.from("social_assets").select("kind,mime,storage_path").eq("id", id).maybeSingle();
  if (!asset) return new NextResponse(null, { status: 404, headers: privateHeaders });
  const { data, error } = await db.storage.from(SOCIAL_ASSET_BUCKET).download(asset.storage_path);
  if (error || !data) return new NextResponse(null, { status: 404, headers: privateHeaders });
  const ext = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf" } as Record<string, string>)[asset.mime];
  return new NextResponse(await data.arrayBuffer(), { headers: { ...privateHeaders, "Content-Type": asset.mime, "Content-Disposition": `${asset.kind === "manual" ? "attachment" : "inline"}; filename="${asset.kind}.${ext}"`, "Content-Security-Policy": "default-src 'none'; sandbox" } });
}
