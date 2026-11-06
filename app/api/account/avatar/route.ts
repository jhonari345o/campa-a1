import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AVATAR_BUCKET, ownsAvatarPath } from "@/lib/account-avatar";
export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
export async function GET() {
  const db = await createClient(), { data: { user } } = await db.auth.getUser();
  if (!user || user.app_metadata?.must_change_password === true) return NextResponse.json({ error: "Acceso requerido" }, { status: 401, headers: privateHeaders });
  const { data: preferences } = await db.from("account_preferences").select("avatar_image_path").eq("user_id", user.id).maybeSingle();
  if (!ownsAvatarPath(preferences?.avatar_image_path, user.id)) return NextResponse.json({ error: "Imagen no disponible" }, { status: 404, headers: privateHeaders });
  const { data, error } = await db.storage.from(AVATAR_BUCKET).download(preferences.avatar_image_path);
  if (error || !data) return NextResponse.json({ error: "Imagen no disponible" }, { status: 404, headers: privateHeaders });
  return new NextResponse(await data.arrayBuffer(), { headers: { ...privateHeaders, "Content-Type": "image/webp", "Content-Disposition": 'inline; filename="avatar.webp"' } });
}
