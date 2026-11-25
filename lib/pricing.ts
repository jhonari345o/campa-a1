/**
 * Modelo de monetizacion de Ad Mavericks.
 *
 * El cliente recarga X dolares para pautar. Sobre esa recarga se agregan
 * impuestos/costos regulatorios y una comision de servicio (nuestra ganancia).
 * El monto de la recarga se acredita completo a la pauta; ambos cargos son
 * adicionales y se calculan sobre la inversion base.
 *
 *   total_a_pagar = recarga + recarga * IMPUESTOS + recarga * COMISION
 *   ganancia      = recarga * COMISION
 *
 * Ej.: recarga $200, impuestos 22% y comision 25% -> paga $294.
 */
export const SERVICE_FEE_PCT = 0.25; // 25% — cambiar aqui si se ajusta el modelo
export const TAX_PCT = 0.22; // 22% — impuestos y costos regulatorios

/** Etiqueta que VE EL CLIENTE en el muro de pago (no revela el %). */
export const SERVICE_FEE_LABEL = "Servicio y gestion de campana";
export const TAX_LABEL = "Impuestos y costos regulatorios (22%)";

export type Charge = {
  base: number; // recarga que va a la pauta (ads)
  taxPct: number; // % de impuestos/costos regulatorios
  tax: number; // impuestos/costos regulatorios
  feePct: number; // % de comision
  fee: number; // ganancia Ad Mavericks
  total: number; // lo que paga el cliente
};

export function computeCharge(
  base: number,
  feePct: number = SERVICE_FEE_PCT,
  taxPct: number = TAX_PCT,
): Charge {
  const b = Math.max(0, Math.round(base * 100) / 100);
  const tax = Math.round(b * taxPct * 100) / 100;
  const fee = Math.round(b * feePct * 100) / 100;
  const total = Math.round((b + tax + fee) * 100) / 100;
  return { base: b, taxPct, tax, feePct, fee, total };
}

export const money = (n: number) =>
  new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
