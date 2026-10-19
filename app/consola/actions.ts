"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth";
import { companySlug } from "@/lib/codes";
import { getPlan } from "@/lib/plans";

export type CrearClienteResult =
  | { ok: true; companyName: string; planName?: string }
  | { ok: false; error: string };

export type CrearAdministradorResult =
  | { ok: true; email: string; temporaryPassword: string }
  | { ok: false; error: string };

/**
 * Crea un administrador de plataforma desde la consola web.
 * La service_role permanece en el servidor y solo un administrador existente
 * puede ejecutar esta accion. La clave temporal se muestra una sola vez.
 */
export async function crearAdministrador(
  _prev: CrearAdministradorResult | null,
  formData: FormData,
): Promise<CrearAdministradorResult> {
  const actor = await getSessionProfile();
  if (!actor) return { ok: false, error: "Debes iniciar sesion." };
  if (!actor.is_platform_admin) {
    return { ok: false, error: "Solo un administrador de plataforma puede crear otro administrador." };
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const confirmed = formData.get("confirm_admin") === "yes";
  if (fullName.length < 2 || fullName.length > 120) {
    return { ok: false, error: "Escribe el nombre completo del administrador." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Escribe un correo electronico valido." };
  }
  if (!confirmed) {
    return { ok: false, error: "Confirma que esta persona tendra acceso administrativo total." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Falta configurar la clave de servicio de Supabase." };
  }

  const temporaryPassword = `${randomBytes(12).toString("base64url")}Aa1!`;
  const { data, error: authError } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { access_scope: "platform_admin" },
  });
  const user = data.user;
  if (authError || !user) {
    const duplicate = authError?.message?.toLowerCase().includes("already") || authError?.message?.toLowerCase().includes("registered");
    return { ok: false, error: duplicate ? "Ese correo ya tiene una cuenta." : `No se pudo crear el administrador: ${authError?.message ?? "error desconocido"}` };
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    email,
    full_name: fullName,
    is_platform_admin: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
    return { ok: false, error: `No se pudo asignar el acceso administrativo: ${profileError.message}` };
  }

  const { error: auditError } = await admin.from("audit_log").insert({
    actor_id: actor.id,
    action: "platform_admin.created",
    entity: "profiles",
    entity_id: user.id,
    metadata: { email, full_name: fullName, provisioning: "web_admin_console" },
  });
  if (auditError) {
    await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
    return { ok: false, error: "No se creo la cuenta porque no se pudo registrar la auditoria." };
  }

  revalidatePath("/consola");
  return { ok: true, email, temporaryPassword };
}

/**
 * Da de alta un cliente: crea la empresa (tenant) y deja constancia en la
 * auditoria. Los accesos se agregan despues desde la consola administrativa.
 */
export async function crearCliente(
  _prev: CrearClienteResult | null,
  formData: FormData,
): Promise<CrearClienteResult> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, error: "Debes iniciar sesion." };
  if (!profile.is_platform_admin) {
    return { ok: false, error: "Solo el equipo de Ad Mavericks puede dar de alta clientes." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const legalId = String(formData.get("legal_id") ?? "").trim() || null;
  // El plan define los cupos. Si no viene plan, se usa el campo de usuarios.
  const plan = getPlan(String(formData.get("plan") ?? "").trim());
  const seatsRaw = String(formData.get("seats") ?? "5").trim();
  const seats = plan
    ? plan.seats
    : Math.max(1, Math.min(500, Number.parseInt(seatsRaw, 10) || 5));

  if (name.length < 2) {
    return { ok: false, error: "Escribe el nombre del cliente." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      error:
        "Falta la clave secreta de Supabase (SUPABASE_SERVICE_ROLE_KEY). Agregala en el entorno para habilitar la Consola.",
    };
  }

  // 1. Crear la empresa (tenant).
  const { data: company, error: companyErr } = await admin
    .from("companies")
    .insert({
      name,
      slug: companySlug(name),
      legal_id: legalId,
      seats,
      status: "activa",
      created_by: profile.id,
    })
    .select("id, name")
    .single();

  if (companyErr || !company) {
    return { ok: false, error: `No se pudo crear la empresa: ${companyErr?.message ?? "desconocido"}` };
  }

  // 2. Auditoria: quien dio de alta a quien y cuando.
  await admin.from("audit_log").insert({
    actor_id: profile.id,
    action: "company.created",
    entity: "companies",
    entity_id: company.id,
    metadata: { name, seats, plan: plan?.id ?? null, user_provisioning: "web_admin_console" },
  });

  revalidatePath("/consola");
  return { ok: true, companyName: company.name, planName: plan?.name };
}

/** Cierra la sesion del usuario actual. */
export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/consola");
}
