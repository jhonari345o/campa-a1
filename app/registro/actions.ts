"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type RegistroResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

/**
 * Activa la cuenta de un cliente a partir de un codigo de registro.
 * Crea el usuario, lo liga a su empresa (aislada) y consume el codigo.
 */
export async function activarCuenta(
  _prev: RegistroResult | null,
  formData: FormData,
): Promise<RegistroResult> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!code) return { ok: false, error: "Ingresa tu codigo de registro." };
  if (!email) return { ok: false, error: "Ingresa tu correo." };
  if (password.length < 8) return { ok: false, error: "La contrasena debe tener al menos 8 caracteres." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "El registro no esta disponible todavia. Contacta a Ad Mavericks." };
  }

  // 1. Validar el codigo.
  const { data: reg } = await admin
    .from("registration_codes")
    .select("id, company_id, role, max_uses, uses, expires_at, email")
    .eq("code", code)
    .single();

  if (!reg) return { ok: false, error: "Codigo invalido. Revisa que este bien escrito." };
  if (reg.expires_at && new Date(reg.expires_at) < new Date()) {
    return { ok: false, error: "El codigo expiro. Solicita uno nuevo a Ad Mavericks." };
  }
  if (reg.uses >= reg.max_uses) {
    return { ok: false, error: "El codigo ya alcanzo su limite de uso." };
  }
  if (reg.email && reg.email.toLowerCase() !== email) {
    return { ok: false, error: "Este codigo esta asignado a otro correo." };
  }

  // 2. Crear el usuario (confirmado).
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (userErr || !created?.user) {
    const already = userErr?.message?.toLowerCase().includes("already");
    return {
      ok: false,
      error: already
        ? "Ya existe una cuenta con ese correo. Intenta ingresar."
        : `No se pudo crear la cuenta: ${userErr?.message ?? "desconocido"}`,
    };
  }
  const userId = created.user.id;

  // 3. Ligar el usuario a su empresa (aislada) con el rol del codigo.
  const { error: memberErr } = await admin.from("company_members").insert({
    company_id: reg.company_id,
    user_id: userId,
    role: reg.role,
  });
  if (memberErr) {
    return { ok: false, error: `No se pudo vincular la cuenta: ${memberErr.message}` };
  }

  // 4. Consumir el codigo + auditoria.
  await admin.from("registration_codes").update({ uses: reg.uses + 1 }).eq("id", reg.id);
  await admin.from("audit_log").insert({
    actor_id: userId,
    action: "account.activated",
    entity: "company_members",
    entity_id: reg.company_id,
    metadata: { code, email },
  });

  return { ok: true, email };
}
