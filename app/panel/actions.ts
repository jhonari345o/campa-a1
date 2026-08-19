"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth";

export type AddUserResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

const ALLOWED_ROLES = ["planner", "analyst", "viewer", "admin"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

/**
 * Permite al ADMIN de una empresa dar de alta a su propio equipo (hasta el
 * numero de cupos contratados). El nuevo usuario queda ligado SOLO a esa
 * empresa, asi que solo ve su informacion. Corre en el servidor con la
 * service_role (salta RLS), por eso validamos aqui que quien llama sea
 * realmente admin de esa empresa.
 */
export async function agregarUsuario(
  _prev: AddUserResult | null,
  formData: FormData,
): Promise<AddUserResult> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, error: "Debes iniciar sesion." };

  const companyId = String(formData.get("company_id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("role") ?? "viewer").trim();
  const role: AllowedRole = (ALLOWED_ROLES as readonly string[]).includes(roleRaw)
    ? (roleRaw as AllowedRole)
    : "viewer";

  if (!companyId) return { ok: false, error: "Falta la empresa." };
  if (!email) return { ok: false, error: "Ingresa el correo del nuevo usuario." };
  if (password.length < 8) {
    return { ok: false, error: "La contrasena debe tener al menos 8 caracteres." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "El servicio no esta disponible. Contacta a Ad Mavericks." };
  }

  // 1. Verificar que quien llama sea ADMIN de esa empresa (o staff de Ad Mavericks).
  if (!profile.is_platform_admin) {
    const { data: membership } = await admin
      .from("company_members")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", profile.id)
      .single();
    if (!membership || membership.role !== "admin") {
      return { ok: false, error: "Solo el administrador de la empresa puede agregar usuarios." };
    }
  }

  // 2. Controlar los cupos (seats) contratados.
  const { data: company } = await admin
    .from("companies")
    .select("seats, name")
    .eq("id", companyId)
    .single();
  if (!company) return { ok: false, error: "No se encontro la empresa." };

  const { count } = await admin
    .from("company_members")
    .select("user_id", { count: "exact", head: true })
    .eq("company_id", companyId);
  const used = count ?? 0;
  if (used >= company.seats) {
    return {
      ok: false,
      error: `Ya usaste todos los cupos (${company.seats}). Contacta a Ad Mavericks para ampliar tu plan.`,
    };
  }

  // 3. Crear el usuario (confirmado) o reutilizar si ya existe.
  let userId: string | null = null;
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (created?.user) {
    userId = created.user.id;
  } else if (userErr?.message?.toLowerCase().includes("already")) {
    // Ya existe en Auth: lo buscamos para poder ligarlo a esta empresa.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    userId = list?.users?.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (!userId) {
      return { ok: false, error: "Ese correo ya tiene cuenta pero no se pudo vincular. Contacta a Ad Mavericks." };
    }
  } else {
    return { ok: false, error: `No se pudo crear la cuenta: ${userErr?.message ?? "desconocido"}` };
  }

  // 4. Ligar a la empresa (idempotente: si ya estaba, no duplica).
  const { error: memberErr } = await admin
    .from("company_members")
    .upsert({ company_id: companyId, user_id: userId, role }, { onConflict: "company_id,user_id" });
  if (memberErr) {
    return { ok: false, error: `No se pudo vincular al equipo: ${memberErr.message}` };
  }

  // 5. Auditoria.
  await admin.from("audit_log").insert({
    actor_id: profile.id,
    action: "member.added",
    entity: "company_members",
    entity_id: companyId,
    metadata: { email, role, company: company.name },
  });

  revalidatePath("/panel");
  return { ok: true, email };
}
