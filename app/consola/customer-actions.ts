"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCustomerInput } from "@/lib/customer-access";
import { domainAllows } from "@/lib/portal-access";

export type CustomerResult = { ok: false; error: string } |
  { ok: true; email: string; companyName: string; role: string; temporaryPassword: string };

export async function crearUsuarioCliente(_previous: CustomerResult | null, form: FormData): Promise<CustomerResult> {
  const actor = await getSessionProfile();
  if (!actor?.is_platform_admin) return { ok: false, error: "Solo un administrador de plataforma puede dar de alta usuarios." };
  const input = parseCustomerInput(form);
  if (!input || form.get("confirm_scope") !== "yes") return { ok: false, error: "Revisa la empresa, el correo y los permisos del acceso." };
  const admin = createAdminClient();
  // Fail closed: never create credentials before tenant guards have been migrated.
  const { data: ready, error: readinessError } = await admin.rpc("portal_access_ready");
  if (readinessError || ready !== "0029") return { ok: false, error: "El alta de clientes está bloqueada hasta aplicar y validar la migración de seguridad 0029 en Supabase." };
  const { data: company, error: companyError } = await admin.from("companies")
    .select("id,name,status,portal_kind,client_planning_enabled,allowed_email_domains").eq("id", input.companyId).single();
  if (companyError || company?.status !== "activa") return { ok: false, error: "Selecciona una empresa activa." };
  if (company.allowed_email_domains?.length && !domainAllows(input.email, company.allowed_email_domains)) return { ok: false, error: "Ese dominio no está autorizado para este espacio." };
  if (company.portal_kind === "client" && input.role !== "viewer" && !company.client_planning_enabled) return { ok: false, error: "Los accesos de cliente son de consulta." };
  const temporaryPassword = `${randomBytes(24).toString("base64url")}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email, password: temporaryPassword, email_confirm: true,
    user_metadata: { full_name: input.fullName }, app_metadata: { access_scope: "customer", must_change_password: true },
  });
  if (error || !data.user) return { ok: false, error: "No se creó la cuenta. Comprueba si ese correo ya tiene acceso; no se reemplazan usuarios ni contraseñas existentes." };
  const userId = data.user.id;
  // Atomic profile + membership + seat limit + audit, service-role only.
  const { error: membershipError } = await admin.rpc("provision_customer_membership", {
    p_actor_id: actor.id, p_user_id: userId, p_company_id: input.companyId,
    p_full_name: input.fullName, p_email: input.email, p_role: input.role,
  });
  if (membershipError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(userId);
    if (cleanupError) {
      // The incomplete account has no membership and no credential is delivered.
      await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    }
    return { ok: false, error: "No se habilitó el acceso. Revisa los cupos y la configuración de la empresa en Supabase." };
  }
  revalidatePath("/consola");
  return { ok: true, email: input.email, companyName: company.name, role: input.role, temporaryPassword };
}
