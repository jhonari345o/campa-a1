/**
 * Modelo de monetizacion de Ad Mavericks.
 *
 * El cliente recarga X dolares para pautar. Sobre esa recarga cobramos una
 * comision de servicio (nuestra ganancia). El monto de la recarga se acredita
 * completo a la pauta; la comision es adicional.
 *
 *   total_a_pagar = recarga + recarga * COMISION
 *   ganancia      = recarga * COMISION
 *
 * Ej.: recarga $200, comision 25% -> paga $250, van $200 a ads, ganamos $50.
 */
export const SERVICE_FEE_PCT = 0.25; // 25% — cambiar aqui si se ajusta el modelo

/** Etiqueta que VE EL CLIENTE en el muro de pago (no revela el %). */
export const SERVICE_FEE_LABEL = "Servicio y gestion de campana";

export type Charge = {
  base: number; // recarga que va a la pauta (ads)
  feePct: number; // % de comision
  fee: number; // ganancia Ad Mavericks
  total: number; // lo que paga el cliente
};

export function computeCharge(base: number, feePct: number = SERVICE_FEE_PCT): Charge {
  const b = Math.max(0, Math.round(base * 100) / 100);
  const fee = Math.round(b * feePct * 100) / 100;
  const total = Math.round((b + fee) * 100) / 100;
  return { base: b, feePct, fee, total };
}

export const money = (n: number) =>
  new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
