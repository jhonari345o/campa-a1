import { NextResponse } from "next/server";
import { getDlocalCredentials } from "@/lib/payments/dlocal";
import { reconcileDlocalPayment } from "@/lib/payments/dlocal-settlement";
import { verifyDlocalNotificationSignature } from "@/lib/payments/dlocal-signature";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let credentials: ReturnType<typeof getDlocalCredentials>;
  try {
    credentials = getDlocalCredentials();
  } catch {
    return NextResponse.json({ error: "Integración no configurada." }, { status: 503 });
  }

  if (
    !verifyDlocalNotificationSignature(
      rawBody,
      request.headers.get("authorization"),
      credentials.apiKey,
      credentials.secretKey,
    )
  ) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  let paymentId = "";
  try {
    const payload = JSON.parse(rawBody) as { payment_id?: unknown };
    paymentId = typeof payload.payment_id === "string" ? payload.payment_id : "";
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!/^DP-[A-Za-z0-9_-]{1,96}$/.test(paymentId)) {
    return NextResponse.json({ error: "payment_id inválido." }, { status: 400 });
  }

  try {
    const result = await reconcileDlocalPayment(paymentId);
    return NextResponse.json({ received: true, state: result.state });
  } catch {
    // No se devuelve el detalle del proveedor. El 503 hace que dLocal reintente.
    return NextResponse.json({ error: "No se pudo conciliar el pago." }, { status: 503 });
  }
}
