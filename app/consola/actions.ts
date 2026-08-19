"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth";
import { companySlug, generateRegistrationCode } from "@/lib/codes";
import { getPlan } from "@/lib/plans";

export type CrearClienteResult =
  | { ok: true; code: string; companyName: string; planName?: string }
  | { ok: false; error: string };

/**
 * Da de alta un cliente: crea la empresa (tenant), genera un codigo de
 * registro unico y deja constancia en la auditoria. Solo para el equipo
 * Ad Mavericks (platform admin).
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
  const email = String(formData.get("email") ?? "").trim() || null;
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

  // 2. Generar el codigo de registro unico.
  let code = generateRegistrationCode(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error: codeErr } = await admin.from("registration_codes").insert({
      code,
      company_id: company.id,
      email,
      role: "admin",
      max_uses: seats,
      created_by: profile.id,
    });
    if (!codeErr) break;
    if (codeErr.code === "23505") {
      // colision de codigo unico: reintentar con otro sufijo
      code = generateRegistrationCode(name);
      continue;
    }
    return { ok: false, error: `No se pudo generar el codigo: ${codeErr.message}` };
  }

  // 3. Auditoria: quien dio de alta a quien y cuando.
  await admin.from("audit_log").insert({
    actor_id: profile.id,
    action: "company.created",
    entity: "companies",
    entity_id: company.id,
    metadata: { name, code, seats, plan: plan?.id ?? null },
  });

  revalidatePath("/consola");
  return { ok: true, code, companyName: company.name, planName: plan?.name };
}

/** Cierra la sesion del usuario actual. */
export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/consola");
}
