import "server-only";

export type DlocalEnvironment = "sandbox" | "live";
export type DlocalPaymentStatus = "PENDING" | "PAID" | "REJECTED" | "CANCELLED" | "EXPIRED";

export type DlocalCheckoutInput = {
  jobId: string;
  orderId: string;
  amountCents: number;
  successUrl: string;
  backUrl: string;
  notificationUrl: string;
  red: "facebook" | "instagram";
};

export type DlocalPayment = {
  id: string;
  amount: number;
  currency: string;
  country: string;
  order_id: string;
  status: DlocalPaymentStatus;
  redirect_url?: string;
  balance_amount?: number;
  balance_fee?: number;
  balance_currency?: string;
  payment_method_type?: string;
  rejected_reason?: string;
};

type DlocalError = {
  message?: string;
  error?: string;
  code?: string | number;
};

/** Crea un Checkout estándar alojado por dLocal Go; la app nunca recibe la tarjeta. */
export async function createDlocalCheckout(input: DlocalCheckoutInput): Promise<DlocalPayment> {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("El total del pago dLocal no es válido.");
  }
  const result = await dlocalRequest<DlocalPayment>("/v1/payments", {
    method: "POST",
    body: JSON.stringify({
      country: "EC",
      currency: "USD",
      amount: input.amountCents / 100,
      order_id: input.orderId,
      description: `Pauta ${input.red} · Ad Mavericks ${input.jobId.slice(0, 8)}`,
      success_url: input.successUrl,
      back_url: input.backUrl,
      notification_url: input.notificationUrl,
      expiration_type: "HOURS",
      expiration_value: 24,
      payment_type: "CREDIT_CARD,DEBIT_CARD,BANK_TRANSFER",
    }),
  });
  if (!isDlocalPaymentId(result.id) || !isOfficialCheckoutUrl(result.redirect_url)) {
    throw new Error("dLocal Go no devolvió un checkout válido.");
  }
  if (result.order_id !== input.orderId || dollarsToCents(result.amount) !== input.amountCents) {
    throw new Error("dLocal Go devolvió un pago que no coincide con la orden.");
  }
  return result;
}

export async function retrieveDlocalPayment(paymentId: string): Promise<DlocalPayment> {
  if (!isDlocalPaymentId(paymentId)) throw new Error("El identificador de dLocal Go no es válido.");
  const result = await dlocalRequest<DlocalPayment>(`/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
  });
  if (result.id !== paymentId) throw new Error("dLocal Go devolvió otro identificador de pago.");
  return result;
}

export function getDlocalCredentials() {
  const apiKey = process.env.DLOCALGO_API_KEY?.trim();
  const secretKey = process.env.DLOCALGO_SECRET_KEY?.trim();
  const environment = dlocalEnvironment();
  if (!apiKey || !secretKey) {
    throw new Error("dLocal Go no está configurado: faltan API Key o Secret Key.");
  }
  return { apiKey, secretKey, environment };
}

export function isDlocalConfigured(): boolean {
  return Boolean(process.env.DLOCALGO_API_KEY?.trim() && process.env.DLOCALGO_SECRET_KEY?.trim());
}

export function dollarsToCents(value: unknown): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function dlocalEnvironment(): DlocalEnvironment {
  return process.env.DLOCALGO_ENV?.trim().toLowerCase() === "live" ? "live" : "sandbox";
}

function apiOrigin(environment: DlocalEnvironment): string {
  return environment === "live" ? "https://api.dlocalgo.com" : "https://api-sbx.dlocalgo.com";
}

async function dlocalRequest<T>(path: string, init: { method: "GET" | "POST"; body?: string }): Promise<T> {
  const { apiKey, secretKey, environment } = getDlocalCredentials();
  const target = new URL(path, apiOrigin(environment));
  const expectedHost = new URL(apiOrigin(environment)).hostname;
  if (target.protocol !== "https:" || target.hostname !== expectedHost) {
    throw new Error("La dirección de dLocal Go no está permitida.");
  }
  const response = await fetch(target, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${apiKey}:${secretKey}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const result = (await response.json()) as T & DlocalError;
  if (!response.ok) {
    const code = result.code == null ? "" : ` (${String(result.code)})`;
    throw new Error(`dLocal Go rechazó la operación${code}: ${result.message || result.error || "error desconocido"}`);
  }
  return result;
}

function isDlocalPaymentId(value: unknown): value is string {
  return typeof value === "string" && /^DP-[A-Za-z0-9_-]{1,96}$/.test(value);
}

function isOfficialCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["checkout.dlocalgo.com", "checkout-sbx.dlocalgo.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

