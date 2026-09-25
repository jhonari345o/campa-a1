"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth";
import { companySlug } from "@/lib/codes";
import { getPlan } from "@/lib/plans";

export type CrearClienteResult =
  | { ok: true; companyName: string; planName?: string }
  | { ok: false; error: string };

/**
 * Da de alta un cliente: crea la empresa (tenant) y deja constancia en la
 * auditoria. Los usuarios se agregan despues desde la consola local.
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
    metadata: { name, seats, plan: plan?.id ?? null, user_provisioning: "local_console" },
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
