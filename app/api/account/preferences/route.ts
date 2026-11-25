import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readPreferences } from "@/lib/account-preferences";
export const dynamic = "force-dynamic";
export async function GET() {
  const db = await createClient(), { data: { user } } = await db.auth.getUser();
  if (!user || user.app_metadata?.must_change_password === true) return NextResponse.json({ error: "Acceso requerido" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const { data } = await db.from("account_preferences").select("display_name,avatar_key,avatar_tone,reduced_motion,avatar_image_path,use_custom_avatar").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({ preferences: readPreferences(data) }, { headers: { "Cache-Control": "private, no-store" } });
}
