import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPagoPluxWebhookCredentials } from "@/lib/payments/pagoplux";
import { settlePagoPluxTransaction } from "@/lib/payments/pagoplux-settlement";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > 64_000) return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413 });
  let credentials: ReturnType<typeof getPagoPluxWebhookCredentials>;
  try { credentials = getPagoPluxWebhookCredentials(); }
  catch { return NextResponse.json({ error: "Integración no configurada." }, { status: 503 }); }

  const authorization = request.headers.get("authentication") || request.headers.get("authorization");
  if (!validBasicAuth(authorization, credentials.clientId, credentials.secret)) {
    return NextResponse.json({ error: "Autenticación inválida." }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(rawBody) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const transactionId = String(payload.id_transaccion ?? "").trim();
  const state = String(payload.state ?? payload.status ?? "").trim().toUpperCase();
  const amountCents = dollarsToCents(payload.amount);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(transactionId) || !state || amountCents == null) {
    return NextResponse.json({ error: "Confirmación incompleta." }, { status: 400 });
  }

  const admin = createAdminClient();
  const fingerprint = createHash("sha256").update(rawBody, "utf8").digest("hex");
  const { error } = await admin.from("campaign_payment_confirmations").upsert({
    provider: "pagoplux",
    provider_confirmation_id: transactionId,
    client_transaction_id: `PAGOPLUX:${transactionId}`,
    transaction_status: state,
    amount_cents: amountCents,
    payload_fingerprint: fingerprint,
  }, { onConflict: "provider_confirmation_id" });
  if (error) return NextResponse.json({ error: "No se pudo registrar la confirmación." }, { status: 503 });

  try {
    const settlement = await settlePagoPluxTransaction(transactionId);
    return NextResponse.json({ received: true, state: settlement.state });
  } catch {
    return NextResponse.json({ error: "No se pudo conciliar el pago." }, { status: 503 });
  }
}

function validBasicAuth(value: string | null, clientId: string, secret: string) {
  if (!value?.startsWith("Basic ")) return false;
  const expected = Buffer.from(`${clientId}:${secret}`, "utf8").toString("base64");
  const received = value.slice(6).trim();
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function dollarsToCents(value: unknown) {
  const amount = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}
