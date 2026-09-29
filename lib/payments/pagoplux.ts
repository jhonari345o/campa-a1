import "server-only";

export type PagoPluxEnvironment = "sandbox" | "live";

export type PagoPluxPaybox = {
  paymentId: string;
  jobId: string;
  merchantEmail: string;
  merchantName: string;
  payerEmail: string;
  payerName: string;
  payerIdentification: string;
  payerPhone: string;
  payerAddress: string;
  base0: string;
  base12: string;
  description: string;
  environment: PagoPluxEnvironment;
  scriptUrl: string;
};

export function getPaymentProvider(): "pagoplux" | "dlocal" {
  return process.env.PAYMENT_PROVIDER?.trim().toLowerCase() === "dlocal" ? "dlocal" : "pagoplux";
}

export function getPagoPluxPublicConfig() {
  const merchantEmail = process.env.NEXT_PUBLIC_PAGOPLUX_MERCHANT_EMAIL?.trim();
  const merchantName = process.env.NEXT_PUBLIC_PAGOPLUX_MERCHANT_NAME?.trim();
  const environment: PagoPluxEnvironment = process.env.NEXT_PUBLIC_PAGOPLUX_ENV?.trim().toLowerCase() === "live" ? "live" : "sandbox";
  if (!merchantEmail || !isEmail(merchantEmail) || !merchantName) {
    throw new Error("PagoPlux no está configurado: faltan comercio y correo registrados.");
  }
  return {
    merchantEmail,
    merchantName,
    environment,
    scriptUrl: environment === "live"
      ? "https://paybox.pagoplux.com/paybox/index_angular.js"
      : "https://sandbox-paybox.pagoplux.com/paybox/index_angular.js",
  };
}

export function getPagoPluxWebhookCredentials() {
  const clientId = process.env.PAGOPLUX_WEBHOOK_CLIENT_ID?.trim();
  const secret = process.env.PAGOPLUX_WEBHOOK_SECRET?.trim();
  if (!clientId || !secret) throw new Error("Webhook PagoPlux no configurado.");
  return { clientId, secret };
}

export function isPagoPluxConfigured(): boolean {
  try {
    getPagoPluxPublicConfig();
    return Boolean(process.env.PAGOPLUX_WEBHOOK_CLIENT_ID?.trim() && process.env.PAGOPLUX_WEBHOOK_SECRET?.trim());
  } catch {
    return false;
  }
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}
