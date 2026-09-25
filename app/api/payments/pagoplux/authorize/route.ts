import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { getMyCompanies } from "@/lib/company";
import { createAdminClient } from "@/lib/supabase/admin";
import { settlePagoPluxTransaction } from "@/lib/payments/pagoplux-settlement";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origen inválido." }, { status: 403 });
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const companies = await getMyCompanies(profile.id);
  const allowedCompanies = new Set(companies.map((company) => company.id));
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const paymentId = String(payload?.paymentId ?? "");
  const jobId = String(payload?.jobId ?? "");
  const transactionId = String(payload?.transactionId ?? "");
  const status = String(payload?.status ?? "").toLowerCase();
  const amountCents = Math.round(Number(payload?.amount) * 100);
  if (!isUuid(paymentId) || !isUuid(jobId) || !/^[A-Za-z0-9_-]{1,128}$/.test(transactionId) || !Number.isSafeInteger(amountCents)) {
    return NextResponse.json({ error: "Respuesta PagoPlux inválida." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: payment } = await admin.from("campaign_payments")
    .select("id, job_id, company_id, total_cents")
    .eq("id", paymentId).eq("job_id", jobId).eq("provider", "pagoplux").maybeSingle();
  if (!payment || (!profile.is_platform_admin && !allowedCompanies.has(payment.company_id))) {
    return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });
  }
  if (Number(payment.total_cents) !== amountCents) {
    await admin.from("campaign_payments").update({ status: "requires_attention" }).eq("id", paymentId);
    return NextResponse.json({ error: "El monto no coincide con la orden." }, { status: 409 });
  }

  const { error } = await admin.from("campaign_payments").update({
    provider_transaction_id: transactionId,
    status: status === "succeeded" ? "payment_open" : "failed",
  }).eq("id", paymentId);
  if (error) return NextResponse.json({ error: "No se pudo asociar la transacción." }, { status: 503 });
  const settlement = await settlePagoPluxTransaction(transactionId);
  return NextResponse.json({ ok: true, state: settlement.state });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const expected = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  try { return new URL(origin).origin === new URL(expected || request.url).origin; }
  catch { return false; }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
