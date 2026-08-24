import { NextResponse } from "next/server";
import { confirmPayPhonePayment } from "@/lib/payments/payphone";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  const clientTransactionId = url.searchParams.get("clientTransactionId") ?? "";
  if (!Number.isSafeInteger(id) || id <= 0 || !/^ADM-[0-9a-f-]{36}$/i.test(clientTransactionId)) {
    return redirectToPautar("invalid", undefined, "PayPhone devolvio identificadores invalidos.");
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "El servidor no puede confirmar el pago. Actualiza esta pagina para reintentar." },
      { status: 503 },
    );
  }

  const { data: payment } = await admin
    .from("campaign_payments")
    .select("id, job_id, company_id, status, currency, total_cents")
    .eq("client_transaction_id", clientTransactionId)
    .maybeSingle();
  if (!payment) {
    return redirectToPautar("invalid", undefined, "La orden asociada al pago no existe.");
  }

  if (payment.status === "paid") {
    return redirectToPautar("success", payment.job_id);
  }

  const confirmationKey = `${id}:${clientTransactionId}`;
  const { data: previous } = await admin
    .from("campaign_payment_confirmations")
    .select("id, processed_at")
    .eq("provider_confirmation_id", confirmationKey)
    .maybeSingle();
  const { data: confirmationRow } = previous
    ? { data: previous }
    : await admin
        .from("campaign_payment_confirmations")
        .insert({
          provider_confirmation_id: confirmationKey,
          client_transaction_id: clientTransactionId,
          payment_id: payment.id,
        })
        .select("id, processed_at")
        .single();

  if (!confirmationRow) {
    return NextResponse.json(
      { error: "No se pudo registrar la confirmacion. Actualiza esta pagina para reintentar." },
      { status: 503 },
    );
  }

  try {
    const result = await confirmPayPhonePayment(id, clientTransactionId);
    const identityMatches =
      result.transactionId === id && result.clientTransactionId === clientTransactionId;
    const amountMatches =
      result.amount === payment.total_cents && result.currency?.toUpperCase() === "USD";

    if (!identityMatches || !amountMatches) {
      await Promise.all([
        admin
          .from("campaign_payments")
          .update({ status: "requires_attention" })
          .eq("id", payment.id),
        admin
          .from("campaign_jobs")
          .update({ status: "error", log: "La confirmacion PayPhone no coincide con la orden." })
          .eq("id", payment.job_id),
        admin
          .from("campaign_payment_confirmations")
          .update({
            transaction_status: result.transactionStatus,
            processed_at: new Date().toISOString(),
            error: "Identificador, monto o moneda no coinciden.",
          })
          .eq("id", confirmationRow.id),
      ]);
      return redirectToPautar(
        "attention",
        payment.job_id,
        "El pago requiere revision manual; la pauta no fue habilitada.",
      );
    }

    if (result.statusCode === 3 && result.transactionStatus === "Approved") {
      const now = new Date().toISOString();
      const { data: job } = await admin
        .from("campaign_jobs")
        .select("spec")
        .eq("id", payment.job_id)
        .single();
      await Promise.all([
        admin
          .from("campaign_payments")
          .update({
            status: "paid",
            paid_at: now,
            provider_transaction_id: String(result.transactionId),
            authorization_code: result.authorizationCode ?? null,
            metadata: {
              transaction_status: result.transactionStatus,
              card_brand: result.cardBrand ?? null,
              last_digits: result.lastDigits ?? null,
              region_iso: result.regionIso ?? null,
            },
          })
          .eq("id", payment.id),
        admin
          .from("campaign_jobs")
          .update({
            status: "lista_para_publicar",
            log: "Pago confirmado por PayPhone. Lista para crear el borrador pausado en Meta.",
            spec: {
              ...asRecord(job?.spec),
              pago: "payphone_confirmado",
              total_pagado_usd: payment.total_cents / 100,
              payphone_confirmado_at: now,
            },
          })
          .eq("id", payment.job_id),
        admin.from("campaign_deliveries").upsert(
          {
            job_id: payment.job_id,
            company_id: payment.company_id,
            provider: "meta",
            status: "ready",
          },
          { onConflict: "job_id,provider", ignoreDuplicates: true },
        ),
        admin
          .from("campaign_payment_confirmations")
          .update({
            transaction_status: result.transactionStatus,
            processed_at: now,
            error: null,
          })
          .eq("id", confirmationRow.id),
      ]);
      return redirectToPautar("success", payment.job_id);
    }

    const cancelled = result.statusCode === 2 || result.transactionStatus === "Canceled";
    await Promise.all([
      admin
        .from("campaign_payments")
        .update({
          status: cancelled ? "cancelled" : "failed",
          provider_transaction_id: String(result.transactionId),
        })
        .eq("id", payment.id),
      admin
        .from("campaign_jobs")
        .update({
          status: cancelled ? "cancelada" : "error",
          log: cancelled ? "El pago fue cancelado en PayPhone." : "PayPhone no aprobo el pago.",
        })
        .eq("id", payment.job_id),
      admin
        .from("campaign_payment_confirmations")
        .update({
          transaction_status: result.transactionStatus,
          processed_at: new Date().toISOString(),
          error: result.message ?? null,
        })
        .eq("id", confirmationRow.id),
    ]);
    return redirectToPautar(cancelled ? "cancelled" : "failed", payment.job_id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PayPhone no pudo confirmar la transaccion.";
    await admin
      .from("campaign_payment_confirmations")
      .update({ error: message.slice(0, 500) })
      .eq("id", confirmationRow.id);
    // PayPhone revierte si no se confirma en cinco minutos. Conservamos esta
    // URL para que el usuario pueda actualizar y reintentar inmediatamente.
    return NextResponse.json(
      { error: "No se pudo confirmar con PayPhone. Actualiza esta pagina de inmediato para reintentar." },
      { status: 502 },
    );
  }
}

function redirectToPautar(result: string, jobId?: string, detail?: string) {
  const site = getSiteOrigin();
  const destination = new URL("/pautar", site);
  destination.searchParams.set("checkout", result);
  if (jobId) destination.searchParams.set("job", jobId);
  if (detail) destination.searchParams.set("detail", detail.slice(0, 240));
  return NextResponse.redirect(destination);
}

function getSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) throw new Error("Falta NEXT_PUBLIC_SITE_URL.");
  const url = new URL(raw);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
    throw new Error("NEXT_PUBLIC_SITE_URL no es seguro.");
  }
  return url.origin;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

