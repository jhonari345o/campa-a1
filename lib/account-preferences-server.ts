import { createClient } from "@/lib/supabase/server";
import { readPreferences } from "./account-preferences";

export async function getAccountPreferences(userId: string) {
  const db = await createClient();
  const { data, error } = await db.from("account_preferences").select("display_name,avatar_key,avatar_tone,reduced_motion,avatar_image_path,use_custom_avatar").eq("user_id", userId).maybeSingle();
  return { preferences: readPreferences(data), available: !error };
}
