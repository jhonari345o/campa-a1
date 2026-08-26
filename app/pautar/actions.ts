"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { getMyCompanies } from "@/lib/company";
import { computeCharge } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDlocalCheckout, getDlocalCredentials } from "@/lib/payments/dlocal";
import { getMaxMetaBudgetUsd } from "@/lib/ads/config";
import { isCommercialPaymentsEnabled } from "@/lib/commercial";
import { canCompanyRole } from "@/lib/permissions";

export type PautaInput = {
  red: string; // instagram | facebook | tiktok
  postUrl: string;
  geo: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  targetScope: "radius" | "country";
  presupuesto: number;
  objetivo?: string;
};

export type PautaResult =
  | { ok: true; id: string; checkoutUrl: string }
  | { ok: false; error: string };

/**
 * Crea una orden y prepara el Checkout estándar alojado de dLocal Go. La orden
 * queda fuera de la cola de publicación hasta conciliarla con la API oficial.
 */
export async function crearPauta(input: PautaInput): Promise<PautaResult> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, error: "Debes iniciar sesion." };
  if (!isCommercialPaymentsEnabled()) {
    return {
      ok: false,
      error:
        "El cobro esta bloqueado mientras se completan seguridad, respaldo, conciliacion y aprobaciones. Puedes preparar el plan, pero todavia no pagar.",
    };
  }

  const companies = await getMyCompanies(profile.id);
  const company = companies[0];
  if (!company || company.status !== "activa") {
    return { ok: false, error: "Solo una cuenta de empresa puede pautar." };
  }
  if (!canCompanyRole(company.role, "campaign:create")) {
    return { ok: false, error: "Tu rol no permite crear una orden de pauta." };
  }

  const presupuesto = Number(input.presupuesto);
  const red = input.red.toLowerCase();
  if (red !== "instagram" && red !== "facebook") {
    return {
      ok: false,
      error: "La pauta real esta habilitada primero para Instagram y Facebook mediante Meta.",
    };
  }
  if (!isAllowedMetaPostUrl(input.postUrl, red)) {
    return { ok: false, error: "Usa un enlace HTTPS de Facebook o Instagram que coincida con la red elegida." };
  }
  const maxBudget = getMaxMetaBudgetUsd();
  if (!Number.isFinite(presupuesto) || presupuesto < 5 || presupuesto > maxBudget) {
    return {
      ok: false,
      error: `El presupuesto debe estar entre $5 y $${maxBudget.toFixed(2)}.`,
    };
  }
  if (!input.geo?.trim() || input.geo.trim().length > 160) {
    return { ok: false, error: "Indica la ubicacion donde quieres pautar." };
  }
  if ((input.objetivo?.length ?? 0) > 240) {
    return { ok: false, error: "Resume el objetivo en un maximo de 240 caracteres." };
  }
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  const radiusKm = Number(input.radiusKm);
  const targetScope = input.targetScope === "country" ? "country" : "radius";
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -6.2 ||
    latitude > 2.7 ||
    longitude < -93.5 ||
    longitude > -74.2
  ) {
    return { ok: false, error: "Selecciona un punto valido dentro del mapa de Ecuador." };
  }
  if (targetScope === "radius" && (!Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 200)) {
    return { ok: false, error: "El radio de geolocalizacion debe estar entre 1 y 200 km." };
  }

  const charge = computeCharge(presupuesto);
  const siteUrl = getSiteUrl();
  if (!siteUrl) {
    return { ok: false, error: "Falta configurar NEXT_PUBLIC_SITE_URL para regresar desde dLocal Go." };
  }
  try {
    getDlocalCredentials();
  } catch {
    return { ok: false, error: "dLocal Go aún no está configurado en el servidor." };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Falta la configuracion segura de Supabase en el servidor." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_jobs")
    .insert({
      company_id: company.id,
      platform: "meta",
      status: "esperando_pago",
      created_by: profile.id,
      spec: {
        tipo: "pauta",
        red,
        post_url: input.postUrl.trim(),
        geo: input.geo.trim(),
        geo_target: {
          country: "EC",
          mode: targetScope,
          center: { latitude, longitude },
          radius_km: targetScope === "radius" ? radiusKm : null,
        },
        presupuesto_usd: charge.base,
        // Modelo de monetizacion calculado en servidor.
        impuestos_pct: charge.taxPct,
        impuestos_usd: charge.tax,
        comision_pct: charge.feePct,
        comision_usd: charge.fee,
        total_a_pagar_usd: charge.total,
        pago: "dlocal_pendiente",
        objetivo: input.objetivo?.trim() || "Promocionar publicacion",
      },
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "No se pudo crear la orden de pauta." };
  }

  const amounts = {
    baseCents: toCents(charge.base),
    taxCents: toCents(charge.tax),
    feeCents: toCents(charge.fee),
  };
  const clientTransactionId = `ADM-${data.id}`;
  const { data: payment, error: paymentError } = await admin
    .from("campaign_payments")
    .insert({
      job_id: data.id,
      company_id: company.id,
      provider: "dlocal",
      client_transaction_id: clientTransactionId,
      status: "payment_preparing",
      currency: "usd",
      base_cents: amounts.baseCents,
      tax_cents: amounts.taxCents,
      fee_cents: amounts.feeCents,
      total_cents: amounts.baseCents + amounts.taxCents + amounts.feeCents,
      metadata: { red, created_by: profile.id },
    })
    .select("id")
    .single();

  if (paymentError || !payment) {
    await admin
      .from("campaign_jobs")
      .update({ status: "error", log: "No se pudo inicializar el registro seguro del pago." })
      .eq("id", data.id);
    return { ok: false, error: "No se pudo inicializar el pago. Intenta nuevamente." };
  }

  try {
    const checkout = await createDlocalCheckout({
      jobId: data.id,
      orderId: clientTransactionId,
      amountCents: amounts.baseCents + amounts.taxCents + amounts.feeCents,
      red,
      successUrl: `${siteUrl}/api/payments/dlocal/return?job=${encodeURIComponent(data.id)}`,
      backUrl: `${siteUrl}/pautar?checkout=cancelled&job=${encodeURIComponent(data.id)}`,
      notificationUrl: `${siteUrl}/api/payments/dlocal/notifications`,
    });

    const { error: checkoutSaveError } = await admin
      .from("campaign_payments")
      .update({
        provider_payment_id: checkout.id,
        checkout_url: checkout.redirect_url,
        status: "payment_open",
        metadata: {
          red,
          created_by: profile.id,
          dlocal_environment: process.env.DLOCALGO_ENV?.toLowerCase() === "live" ? "live" : "sandbox",
          dlocal_status: checkout.status,
        },
      })
      .eq("id", payment.id);
    if (checkoutSaveError) {
      throw new Error("No se pudo guardar la referencia segura del checkout dLocal Go.");
    }

    revalidatePath("/campanas");
    return {
      ok: true,
      id: data.id,
      checkoutUrl: checkout.redirect_url!,
    };
  } catch (checkoutError) {
    const detail = checkoutError instanceof Error ? checkoutError.message : "Error desconocido de dLocal Go";
    await Promise.all([
      admin
        .from("campaign_payments")
        .update({ status: "failed", metadata: { red, dlocal_error: detail.slice(0, 500) } })
        .eq("id", payment.id),
      admin
        .from("campaign_jobs")
        .update({ status: "error", log: "dLocal Go no pudo abrir la página de pago." })
        .eq("id", data.id),
    ]);
    return { ok: false, error: "No fue posible abrir dLocal Go. No se realizó ningún cobro." };
  }
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function getSiteUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function isAllowedMetaPostUrl(raw: string, red: string): boolean {
  if (!raw || raw.length > 2048) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const hostname = url.hostname.toLowerCase();
    const facebook = hostname === "facebook.com" || hostname.endsWith(".facebook.com");
    const instagram = hostname === "instagram.com" || hostname.endsWith(".instagram.com");
    return red === "facebook" ? facebook : red === "instagram" ? instagram : false;
  } catch {
    return false;
  }
}
