"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export type RegistroResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

// Antifuerza bruta: máximo de intentos por IP dentro de la ventana.
const MAX_INTENTOS = 10;
const VENTANA_MIN = 10;

/** Traduce el error crudo de la redención a un mensaje claro para el usuario. */
function mensajeCodigo(raw: string | undefined): string {
  const m = raw ?? "";
  if (m.includes("CODE_EXPIRED")) return "El codigo expiro. Solicita uno nuevo a Ad Mavericks.";
  if (m.includes("CODE_EXHAUSTED")) return "El codigo ya alcanzo su limite de uso.";
  if (m.includes("CODE_EMAIL_MISMATCH")) return "Este codigo esta asignado a otro correo.";
  return "Codigo invalido. Revisa que este bien escrito.";
}

/**
 * Activa la cuenta de un cliente a partir de un codigo de registro.
 * Crea el usuario, lo liga a su empresa (aislada) y consume el codigo.
 *
 * Seguridad:
 *  - La redención del codigo es ATÓMICA (RPC redeem_registration_code): dos
 *    registros simultáneos no pueden exceder los asientos.
 *  - Si el alta falla después de reservar el cupo, se libera (compensación) y,
 *    de ser necesario, se borra el usuario recién creado (sin huérfanos).
 *  - Rate limiting por IP contra la fuerza bruta de codigos.
 *  - Los errores internos se registran en el servidor, no se filtran al cliente.
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

  // 0. Rate limiting por IP (antifuerza bruta de codigos).
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
  const desde = new Date(Date.now() - VENTANA_MIN * 60_000).toISOString();
  const { count } = await admin
    .from("registration_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("at", desde);
  if ((count ?? 0) >= MAX_INTENTOS) {
    return { ok: false, error: "Demasiados intentos. Espera unos minutos e intentalo de nuevo." };
  }
  const registrarIntento = (ok: boolean) =>
    admin.from("registration_attempts").insert({ ip, code, ok });

  // 1. Redención ATÓMICA del codigo (valida + reserva un cupo en un solo paso).
  const { data: redeemed, error: redeemErr } = await admin.rpc("redeem_registration_code", {
    p_code: code,
    p_email: email,
  });
  const reg = Array.isArray(redeemed) ? redeemed[0] : redeemed;
  if (redeemErr || !reg) {
    await registrarIntento(false);
    return { ok: false, error: mensajeCodigo(redeemErr?.message) };
  }

  // 2. Crear el usuario (confirmado). Si falla, liberar el cupo reservado.
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (userErr || !created?.user) {
    await admin.rpc("release_registration_code", { p_id: reg.code_id });
    await registrarIntento(false);
    if (userErr?.message?.toLowerCase().includes("already")) {
      return { ok: false, error: "Ya existe una cuenta con ese correo. Intenta ingresar." };
    }
    console.error("registro: no se pudo crear el usuario", userErr);
    return { ok: false, error: "No se pudo crear la cuenta. Intentalo de nuevo o contacta a Ad Mavericks." };
  }
  const userId = created.user.id;

  // 3. Ligar el usuario a su empresa (aislada) con el rol del codigo.
  //    Si falla, deshacer: borrar el usuario y liberar el cupo (sin huérfanos).
  const { error: memberErr } = await admin.from("company_members").insert({
    company_id: reg.company_id,
    user_id: userId,
    role: reg.role,
  });
  if (memberErr) {
    console.error("registro: no se pudo vincular el miembro", memberErr);
    await admin.auth.admin.deleteUser(userId);
    await admin.rpc("release_registration_code", { p_id: reg.code_id });
    await registrarIntento(false);
    return { ok: false, error: "No se pudo completar el registro. Intentalo de nuevo." };
  }

  // 4. Auditoría + intento exitoso.
  await admin.from("audit_log").insert({
    actor_id: userId,
    action: "account.activated",
    entity: "company_members",
    entity_id: reg.company_id,
    metadata: { code, email },
  });
  await registrarIntento(true);

  return { ok: true, email };
}
