import { NextResponse } from "next/server";
import { reconcileDlocalPayment } from "@/lib/payments/dlocal-settlement";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("job") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
    return redirectToPautar("invalid", undefined, "La orden devuelta por dLocal Go no es válida.");
  }

  try {
    const admin = createAdminClient();
    const { data: payment } = await admin
      .from("campaign_payments")
      .select("status, provider_payment_id")
      .eq("job_id", jobId)
      .eq("provider", "dlocal")
      .maybeSingle();
    if (!payment?.provider_payment_id) {
      return redirectToPautar("invalid", jobId, "No se encontró el pago de esta orden.");
    }
    if (payment.status === "paid") return redirectToPautar("success", jobId);

    const result = await reconcileDlocalPayment(payment.provider_payment_id);
    return redirectToPautar(result.state, result.jobId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "No se pudo verificar el pago.";
    return redirectToPautar("attention", jobId, detail);
  }
}

function redirectToPautar(result: string, jobId?: string, detail?: string) {
  const destination = new URL("/pautar", getSiteOrigin());
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
