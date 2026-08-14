"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, error: "Debes iniciar sesion." };
  if (!profile.is_platform_admin) {
    return { ok: false, error: "Solo el equipo Ad Mavericks puede cargar datos." };
  }
  return { ok: true };
}

function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function revalidate() {
  revalidatePath("/mercado");
  revalidatePath("/mercado/cargar");
}

export async function crearAnunciante(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Escribe el nombre del anunciante." };

  const supabase = await createClient();
  const { error } = await supabase.from("advertisers").insert({
    name,
    legal_id: String(formData.get("legal_id") ?? "").trim() || null,
    sector: String(formData.get("sector") ?? "").trim() || null,
    province: String(formData.get("province") ?? "").trim() || null,
    status: formData.get("status") === "verificado" ? "verificado" : "pendiente",
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, message: `Anunciante "${name}" agregado.` };
}

export async function crearMedio(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const name = String(formData.get("name") ?? "").trim();
  const media_type = String(formData.get("media_type") ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Escribe el nombre del medio." };
  if (!media_type) return { ok: false, error: "Elige el tipo de medio." };

  const supabase = await createClient();
  const { error } = await supabase.from("media_channels").insert({
    name,
    media_type,
    owner: String(formData.get("owner") ?? "").trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, message: `Medio "${name}" agregado.` };
}

export async function crearInversion(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const advertiser_id = String(formData.get("advertiser_id") ?? "").trim();
  const period_year = num(formData.get("period_year"));
  if (!advertiser_id) return { ok: false, error: "Elige el anunciante." };
  if (!period_year) return { ok: false, error: "Indica el anio del periodo." };

  const supabase = await createClient();
  const { error } = await supabase.from("ad_investments").insert({
    advertiser_id,
    media_type: String(formData.get("media_type") ?? "").trim() || null,
    period_year,
    period_month: num(formData.get("period_month")),
    amount_usd: num(formData.get("amount_usd")),
    status: formData.get("status") === "verificado" ? "verificado" : "pendiente",
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, message: "Inversion registrada." };
}

export async function crearMetrica(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const advertiser_id = String(formData.get("advertiser_id") ?? "").trim();
  const platform = String(formData.get("platform") ?? "").trim();
  const period_year = num(formData.get("period_year"));
  if (!advertiser_id) return { ok: false, error: "Elige el anunciante." };
  if (!platform) return { ok: false, error: "Elige la plataforma." };
  if (!period_year) return { ok: false, error: "Indica el anio del periodo." };

  const supabase = await createClient();
  const { error } = await supabase.from("digital_metrics").insert({
    advertiser_id,
    platform,
    period_year,
    period_month: num(formData.get("period_month")),
    impressions: num(formData.get("impressions")),
    clicks: num(formData.get("clicks")),
    spend_usd: num(formData.get("spend_usd")),
    conversions: num(formData.get("conversions")),
    status: formData.get("status") === "verificado" ? "verificado" : "pendiente",
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, message: "Metrica registrada." };
}
