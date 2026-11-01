"use server";
import { revalidatePath } from "next/cache";
import { createClient as createPublicClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { parsePreferences } from "@/lib/account-preferences";
import { changeOwnPassword, type SecurityResult } from "@/lib/account-security";

export async function guardarPreferencias(_previous: SecurityResult | null, form: FormData): Promise<SecurityResult> {
  const input = parsePreferences(form);
  if (!input) return { ok: false, message: "Revisa el nombre y el avatar seleccionado." };
  const db = await createClient(), { data: { user } } = await db.auth.getUser();
  if (!user || user.app_metadata?.must_change_password === true) return { ok: false, message: "Inicia sesión con tu contraseña personal para continuar." };
  const { error } = await db.rpc("save_my_account_preferences", { p_name: input.displayName, p_avatar: input.avatarKey, p_tone: input.avatarTone, p_reduced_motion: input.reducedMotion });
  if (error) return { ok: false, message: "No se guardaron los cambios. Vuelve a intentarlo." };
  revalidatePath("/cuenta/configuracion");
  return { ok: true, message: "Tu perfil se actualizó." };
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
