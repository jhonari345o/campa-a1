"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AVATAR_BUCKET, ownsAvatarPath, type AvatarUploadResult } from "@/lib/account-avatar";

export async function quitarMiImagen(): Promise<AvatarUploadResult> {
  const db = await createClient(), { data: { user } } = await db.auth.getUser();
  if (!user || user.app_metadata?.must_change_password === true) return { ok: false, message: "Inicia sesión con tu contraseña personal para continuar." };
  const { data: previous } = await db.from("account_preferences").select("avatar_image_path").eq("user_id", user.id).maybeSingle();
  const { error } = await db.from("account_preferences").update({ avatar_image_path: null, use_custom_avatar: false }).eq("user_id", user.id);
  if (error) return { ok: false, message: "No se pudo quitar tu imagen. Vuelve a intentarlo." };
  if (ownsAvatarPath(previous?.avatar_image_path, user.id)) {
    try { await createAdminClient(AbortSignal.timeout(20_000)).storage.from(AVATAR_BUCKET).remove([previous.avatar_image_path]); } catch { /* The account no longer references the image. */ }
  }
  revalidatePath("/cuenta/configuracion");
  return { ok: true, message: "Se quitó tu imagen de perfil.", version: null };
}
