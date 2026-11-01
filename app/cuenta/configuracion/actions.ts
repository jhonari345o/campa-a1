"use server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { AVATAR_BUCKET, MAX_AVATAR_UPLOAD_BYTES, avatarVersion, ownsAvatarPath, type AvatarUploadResult } from "@/lib/account-avatar";
import { AvatarImageError, normalizeAvatarImage } from "@/lib/account-avatar-image";
import { createClient as createPublicClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { parsePreferences } from "@/lib/account-preferences";
import { changeOwnPassword, type SecurityResult } from "@/lib/account-security";

export async function guardarPreferencias(_previous: SecurityResult | null, form: FormData): Promise<AvatarUploadResult> {
  const input = parsePreferences(form);
  if (!input) return { ok: false, message: "Revisa el nombre y el avatar seleccionado." };
  const db = await createClient(), { data: { user } } = await db.auth.getUser();
  if (!user || user.app_metadata?.must_change_password === true) return { ok: false, message: "Inicia sesión con tu contraseña personal para continuar." };
  const { data: previous } = await db.from("account_preferences").select("avatar_image_path").eq("user_id", user.id).maybeSingle();
  const file = form.get("image");
  if (file instanceof File && file.size > 0) {
    if (!input.useCustomAvatar || file.size > MAX_AVATAR_UPLOAD_BYTES) return { ok: false, message: "Selecciona una imagen de perfil válida." };
    const { data: permitted, error: limitError } = await db.rpc("reserve_my_avatar_upload");
    if (limitError) return { ok: false, message: "No se pudo preparar la carga. Vuelve a intentarlo." };
    if (!permitted) return { ok: false, message: "Ya realizaste varias cargas. Inténtalo de nuevo más tarde." };
    try {
      const image = await normalizeAvatarImage(new Uint8Array(await file.arrayBuffer()), file.type);
      const path = user.id + "/" + randomUUID() + ".webp";
      const admin = createAdminClient(AbortSignal.timeout(20_000));
      const { error: uploadError } = await admin.storage.from(AVATAR_BUCKET).upload(path, image, { contentType: "image/webp", cacheControl: "0", upsert: false });
      if (uploadError) return { ok: false, message: "No se pudo guardar tu imagen. Vuelve a intentarlo." };
      // One metadata write commits the appearance fields and the new photo together.
      const { error } = await db.from("account_preferences").upsert({ user_id: user.id, display_name: input.displayName, avatar_key: input.avatarKey, avatar_tone: input.avatarTone, reduced_motion: input.reducedMotion, avatar_image_path: path, use_custom_avatar: true }, { onConflict: "user_id" });
      if (error) { await admin.storage.from(AVATAR_BUCKET).remove([path]); return { ok: false, message: "No se guardaron los cambios de tu perfil. Vuelve a intentarlo." }; }
      if (ownsAvatarPath(previous?.avatar_image_path, user.id) && previous.avatar_image_path !== path) await admin.storage.from(AVATAR_BUCKET).remove([previous.avatar_image_path]).catch(() => {});
      revalidatePath("/cuenta/configuracion");
      return { ok: true, message: "Tu perfil se actualizó.", version: avatarVersion(path) };
    } catch (error) { return { ok: false, message: error instanceof AvatarImageError ? error.message : "No se pudo completar la carga. Vuelve a intentarlo." }; }
  }
  const { error } = await db.rpc("save_my_account_profile", { p_name: input.displayName, p_avatar: input.avatarKey, p_tone: input.avatarTone, p_reduced_motion: input.reducedMotion, p_use_photo: input.useCustomAvatar });
  if (error) return { ok: false, message: "No se guardaron los cambios. Vuelve a intentarlo." };
  revalidatePath("/cuenta/configuracion");
  return { ok: true, message: "Tu perfil se actualizó.", version: avatarVersion(previous?.avatar_image_path) };
}

export async function cambiarMiContrasena(_previous: SecurityResult | null, form: FormData): Promise<SecurityResult> {
  const db = await createClient(), { data: { user } } = await db.auth.getUser();
  if (!user?.email || user.app_metadata?.must_change_password === true) return { ok: false, message: "Inicia sesión con tu contraseña personal para continuar." };
  try {
    return await changeOwnPassword({ currentPassword: String(form.get("currentPassword") ?? ""), password: String(form.get("password") ?? ""), confirm: String(form.get("confirm") ?? ""), closeOthers: form.get("closeOthers") === "on" }, {
      verifyCurrent: async password => {
        // Isolated public-auth verifier: never replaces the browser session or its MFA assurance.
        const verifier = createPublicClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        try {
          const { data, error } = await verifier.auth.signInWithPassword({ email: user.email!, password });
          return !error && data.user?.id === user.id;
        } finally { await verifier.auth.signOut({ scope: "local" }); }
      },
      updatePassword: async (password, currentPassword) => !(await db.auth.updateUser({ password, current_password: currentPassword })).error,
      closeOtherSessions: async () => !(await db.auth.signOut({ scope: "others" })).error,
    });
  } catch { return { ok: false, message: "No se pudo completar la solicitud. Revisa tu conexión e intenta nuevamente." }; }
}

export async function cerrarOtrasSesiones(_previous: SecurityResult | null, form: FormData): Promise<SecurityResult> {
  if (form.get("confirmOtherSessions") !== "on") return { ok: false, message: "Confirma que quieres cerrar tus otras sesiones." };
  const db = await createClient(), { data: { user } } = await db.auth.getUser();
  if (!user || user.app_metadata?.must_change_password === true) return { ok: false, message: "Inicia sesión con tu contraseña personal para continuar." };
  const { error } = await db.auth.signOut({ scope: "others" });
  return error ? { ok: false, message: "No se pudo solicitar el cierre de sesiones. Intenta nuevamente." } : { ok: true, message: "Se solicitó el cierre de tus otras sesiones. Puedes seguir trabajando aquí." };
}
