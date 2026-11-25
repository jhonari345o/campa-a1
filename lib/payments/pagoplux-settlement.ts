import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type PaymentRow = {
  id: string;
  job_id: string;
  company_id: string;
  client_transaction_id: string;
  total_cents: number;
  status: string;
  metadata: Record<string, unknown> | null;
};

export async function settlePagoPluxTransaction(transactionId: string) {
  const admin = createAdminClient();
  const [{ data: payment }, { data: confirmation }] = await Promise.all([
    admin.from("campaign_payments")
      .select("id, job_id, company_id, client_transaction_id, total_cents, status, metadata")
      .eq("provider", "pagoplux")
      .eq("provider_transaction_id", transactionId)
      .maybeSingle(),
    admin.from("campaign_payment_confirmations")
      .select("id, transaction_status, amount_cents, processed_at")
      .eq("provider", "pagoplux")
      .eq("provider_confirmation_id", transactionId)
      .maybeSingle(),
  ]);
  if (!payment || !confirmation) return { state: "pending" as const };
  const local = payment as PaymentRow;
  const paid = normalizeState(confirmation.transaction_status) === "PAGADO";
  const amountMatches = Number(confirmation.amount_cents) === Number(local.total_cents);
  const now = new Date().toISOString();
  if (!paid || !amountMatches) {
    await Promise.all([
      admin.from("campaign_payments").update({ status: paid ? "requires_attention" : "payment_open" }).eq("id", local.id),
      admin.from("campaign_payment_confirmations").update({
        processed_at: now,
        error: paid && !amountMatches ? "El monto confirmado no coincide con la orden." : null,
        payment_id: local.id,
        client_transaction_id: local.client_transaction_id,
      }).eq("id", confirmation.id),
    ]);
    return { state: paid ? "attention" as const : "pending" as const };
  }
  if (local.status === "paid") return { state: "success" as const, jobId: local.job_id };

  const { data: job } = await admin.from("campaign_jobs").select("spec").eq("id", local.job_id).single();
  const writes = await Promise.all([
    admin.from("campaign_payments").update({
      status: "paid",
      paid_at: now,
      metadata: { ...asRecord(local.metadata), pagoplux_state: "PAGADO", reconciled_at: now },
    }).eq("id", local.id),
    admin.from("campaign_jobs").update({
      status: "lista_para_publicar",
      log: "Pago conciliado por PagoPlux. Lista para crear el borrador pausado en Meta.",
      spec: { ...asRecord(job?.spec), pago: "pagoplux_confirmado", total_pagado_usd: local.total_cents / 100, pagoplux_confirmado_at: now },
    }).eq("id", local.job_id),
    admin.from("campaign_deliveries").upsert({
      job_id: local.job_id,
      company_id: local.company_id,
      provider: "meta",
      status: "ready",
    }, { onConflict: "job_id,provider", ignoreDuplicates: true }),
    admin.from("campaign_payment_confirmations").update({
      payment_id: local.id,
      client_transaction_id: local.client_transaction_id,
      processed_at: now,
      error: null,
    }).eq("id", confirmation.id),
  ]);
  if (writes.some((write) => write.error)) throw new Error("No se pudo conciliar el pago PagoPlux.");
  return { state: "success" as const, jobId: local.job_id };
}

function normalizeState(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
