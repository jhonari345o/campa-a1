import "server-only";

const PAYPHONE_API = "https://pay.payphonetodoesposible.com/api/button";
const PAYPHONE_HOST = "pay.payphonetodoesposible.com";

export type PayPhonePrepareInput = {
  jobId: string;
  clientTransactionId: string;
  customerEmail?: string | null;
  red: "facebook" | "instagram";
  baseCents: number;
  taxCents: number;
  feeCents: number;
  responseUrl: string;
  cancellationUrl: string;
  latitude: number;
  longitude: number;
};

export type PayPhonePaymentLinks = {
  paymentId: string;
  payWithPayPhone: string;
  payWithCard: string;
};

export type PayPhoneConfirmation = {
  amount: number;
  clientTransactionId: string;
  statusCode: number;
  transactionStatus: string;
  authorizationCode?: string | null;
  transactionId: number;
  currency: string;
  regionIso?: string | null;
  cardBrand?: string | null;
  lastDigits?: string | null;
  message?: string | null;
};

type PayPhoneError = {
  message?: string;
  errorCode?: number;
  errors?: Array<{ errorDescriptions?: string[] }>;
};

/** Prepara el Boton de Pago alojado por PayPhone; la web nunca recibe la tarjeta. */
export async function preparePayPhonePayment(
  input: PayPhonePrepareInput,
): Promise<PayPhonePaymentLinks> {
  const { token, storeId } = getCredentials();
  const amount = input.baseCents + input.taxCents + input.feeCents;
  const response = await fetch(`${PAYPHONE_API}/Prepare`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      amountWithoutTax: 0,
      amountWithTax: input.baseCents,
      tax: input.taxCents,
      service: input.feeCents,
      tip: 0,
      clientTransactionId: input.clientTransactionId,
      reference: `Pauta ${input.red} · Ad Mavericks ${input.jobId.slice(0, 8)}`,
      storeId,
      currency: "USD",
      responseUrl: input.responseUrl,
      cancellationUrl: input.cancellationUrl,
      timeZone: -5,
      lat: input.latitude.toFixed(6),
      lng: input.longitude.toFixed(6),
      email: input.customerEmail || null,
      optionalParameter: input.jobId,
    }),
    cache: "no-store",
  });
  const body = (await response.json()) as PayPhonePaymentLinks & PayPhoneError;
  if (!response.ok) throw payPhoneError(body, "PayPhone no pudo preparar el pago.");
  if (!body.paymentId || !isOfficialPaymentUrl(body.payWithPayPhone) || !isOfficialPaymentUrl(body.payWithCard)) {
    throw new Error("PayPhone no devolvio enlaces de pago validos.");
  }
  return body;
}

/** Confirma con PayPhone el resultado que llego por la URL de respuesta. */
export async function confirmPayPhonePayment(
  id: number,
  clientTransactionId: string,
): Promise<PayPhoneConfirmation> {
  const { token } = getCredentials();
  const response = await fetch(`${PAYPHONE_API}/V2/Confirm`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, clientTxId: clientTransactionId }),
    cache: "no-store",
  });
  const body = (await response.json()) as PayPhoneConfirmation & PayPhoneError;
  if (!response.ok) throw payPhoneError(body, "PayPhone no pudo confirmar la transaccion.");
  if (!Number.isInteger(body.statusCode) || !body.clientTransactionId || !Number.isInteger(body.transactionId)) {
    throw new Error("PayPhone devolvio una confirmacion incompleta.");
  }
  return body;
}

function getCredentials() {
  const token = process.env.PAYPHONE_TOKEN?.trim();
  const storeId = process.env.PAYPHONE_STORE_ID?.trim();
  if (!token || !storeId) {
    throw new Error("PayPhone no esta configurado (faltan PAYPHONE_TOKEN o PAYPHONE_STORE_ID)." );
  }
  return { token, storeId };
}

function isOfficialPaymentUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === PAYPHONE_HOST;
  } catch {
    return false;
  }
}

function payPhoneError(body: PayPhoneError, fallback: string): Error {
  const details = body.errors
    ?.flatMap((item) => item.errorDescriptions ?? [])
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
  const code = body.errorCode ? ` (${body.errorCode})` : "";
  return new Error(`${body.message || fallback}${code}${details ? `: ${details}` : ""}`);
}

