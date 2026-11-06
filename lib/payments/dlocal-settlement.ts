import "server-only";

import { dollarsToCents, retrieveDlocalPayment, type DlocalPaymentStatus } from "@/lib/payments/dlocal";
import { createAdminClient } from "@/lib/supabase/admin";

export type DlocalReconciliationResult = {
  jobId: string;
  state: "success" | "pending" | "cancelled" | "failed" | "attention";
  status: DlocalPaymentStatus;
};

type PaymentRow = {
  id: string;
  job_id: string;
  company_id: string;
  client_transaction_id: string;
  provider_payment_id: string | null;
  currency: string;
  total_cents: number;
  metadata: Record<string, unknown> | null;
};

/**
 * Concilia siempre contra la API de dLocal Go. El webhook y el retorno del
 * navegador comparten esta ruta para evitar confiar en datos del cliente.
 */
export async function reconcileDlocalPayment(paymentId: string): Promise<DlocalReconciliationResult> {
  const remote = await retrieveDlocalPayment(paymentId);
  const admin = createAdminClient();
  const { data, error: paymentLookupError } = await admin
    .from("campaign_payments")
    .select(
      "id, job_id, company_id, client_transaction_id, provider_payment_id, currency, total_cents, metadata",
    )
    .eq("provider", "dlocal")
    .eq("provider_payment_id", paymentId)
    .maybeSingle();
  if (paymentLookupError) throw new Error("No se pudo consultar la orden local del pago.");
  const payment = data as PaymentRow | null;
  if (!payment) throw new Error("No existe una orden local para este pago de dLocal Go.");

  const confirmationKey = `${remote.id}:${remote.status}`;
  const { error: confirmationError } = await admin.from("campaign_payment_confirmations").upsert(
    {
      provider: "dlocal",
      provider_confirmation_id: confirmationKey,
      client_transaction_id: payment.client_transaction_id,
      payment_id: payment.id,
      transaction_status: remote.status,
    },
    { onConflict: "provider_confirmation_id", ignoreDuplicates: true },
  );
  if (confirmationError) throw new Error("No se pudo registrar la conciliación del pago.");

  const identityMatches =
    remote.id === payment.provider_payment_id && remote.order_id === payment.client_transaction_id;
  const amountMatches = dollarsToCents(remote.amount) === payment.total_cents;
  const currencyMatches = remote.currency?.toUpperCase() === payment.currency.toUpperCase();
  const countryMatches = remote.country?.toUpperCase() === "EC";
  if (!identityMatches || !amountMatches || !currencyMatches || !countryMatches) {
    const now = new Date().toISOString();
    const results = await Promise.all([
      admin.from("campaign_payments").update({ status: "requires_attention" }).eq("id", payment.id),
      admin
        .from("campaign_jobs")
        .update({ status: "error", log: "La conciliación dLocal Go no coincide con la orden esperada." })
        .eq("id", payment.job_id),
      admin
        .from("campaign_payment_confirmations")
        .update({
          processed_at: now,
          error: "Identificador, orden, monto, moneda o país no coinciden.",
        })
        .eq("provider_confirmation_id", confirmationKey),
    ]);
    ensureDatabaseWrites(results, "No se pudo bloquear la orden discrepante.");
    return { jobId: payment.job_id, state: "attention", status: remote.status };
  }

  if (remote.status === "PAID") {
    const now = new Date().toISOString();
    const { data: job, error: jobLookupError } = await admin
      .from("campaign_jobs")
      .select("spec")
      .eq("id", payment.job_id)
      .single();
    if (jobLookupError || !job) throw new Error("No se pudo consultar la campaña asociada al pago.");
    const providerNetCents = dollarsToCents(remote.balance_amount);
    const providerFeeCents = dollarsToCents(remote.balance_fee);
    const results = await Promise.all([
      admin
        .from("campaign_payments")
        .update({
          status: "paid",
          paid_at: now,
          provider_transaction_id: remote.id,
          provider_net_cents: providerNetCents,
          provider_fee_cents: providerFeeCents,
          provider_balance_currency: remote.balance_currency?.toLowerCase() ?? null,
          metadata: {
            ...asRecord(payment.metadata),
            dlocal_status: remote.status,
            payment_method_type: remote.payment_method_type ?? null,
            reconciled_at: now,
          },
        })
        .eq("id", payment.id),
      admin
        .from("campaign_jobs")
        .update({
          status: "lista_para_publicar",
          log: "Pago conciliado por dLocal Go. Lista para crear el borrador pausado en Meta.",
          spec: {
            ...asRecord(job?.spec),
            pago: "dlocal_confirmado",
            total_pagado_usd: payment.total_cents / 100,
            dlocal_confirmado_at: now,
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
        .update({ processed_at: now, error: null })
        .eq("provider_confirmation_id", confirmationKey),
    ]);
    ensureDatabaseWrites(results, "No se pudo completar la conciliación del pago.");
    return { jobId: payment.job_id, state: "success", status: remote.status };
  }

  if (remote.status === "PENDING") {
    const now = new Date().toISOString();
    const results = await Promise.all([
      admin.from("campaign_payments").update({ status: "payment_open" }).eq("id", payment.id),
      admin
        .from("campaign_payment_confirmations")
        .update({ processed_at: now, error: null })
        .eq("provider_confirmation_id", confirmationKey),
    ]);
    ensureDatabaseWrites(results, "No se pudo guardar el estado pendiente del pago.");
    return { jobId: payment.job_id, state: "pending", status: remote.status };
  }

  const cancelled = remote.status === "CANCELLED" || remote.status === "EXPIRED";
  const now = new Date().toISOString();
  const results = await Promise.all([
    admin
      .from("campaign_payments")
      .update({
        status: cancelled ? "cancelled" : "failed",
        provider_transaction_id: remote.id,
        metadata: {
          ...asRecord(payment.metadata),
          dlocal_status: remote.status,
          rejected_reason: remote.rejected_reason?.slice(0, 300) ?? null,
          reconciled_at: now,
        },
      })
      .eq("id", payment.id),
    admin
      .from("campaign_jobs")
      .update({
        status: cancelled ? "cancelada" : "error",
        log: cancelled ? "El pago fue cancelado o expiró en dLocal Go." : "dLocal Go rechazó el pago.",
      })
      .eq("id", payment.job_id),
    admin
      .from("campaign_payment_confirmations")
      .update({ processed_at: now, error: remote.rejected_reason?.slice(0, 500) ?? null })
      .eq("provider_confirmation_id", confirmationKey),
  ]);
  ensureDatabaseWrites(results, "No se pudo guardar el estado final del pago.");
  return {
    jobId: payment.job_id,
    state: cancelled ? "cancelled" : "failed",
    status: remote.status,
  };
}

function ensureDatabaseWrites(
  results: Array<{ error: { message?: string } | null }>,
  message: string,
): void {
  if (results.some((result) => result.error)) throw new Error(message);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
