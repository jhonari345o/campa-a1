import type { RadioTariff } from "./radio-station";

const formatKey = (label: string) => label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/\b(?:20|30)\s*(?:s|segundos?)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const special = (label: string) => /mencion|paquete|presentacion|despedida|bonificacion|canje/.test(formatKey(label));

/** Only individual spots share a duration ratio. Packages and live mentions keep their own units. */
export function radioSpotDurations(tariff: RadioTariff, rateIndex: number): { seconds: number; amountUsd: number | null; proportionalFrom?: number }[] {
  const rate = tariff.rates[rateIndex];
  if (!rate) return [];
  if (tariff.unit === "second") return [10, 15, 20, 30, 45, 60].map(seconds => ({ seconds, amountUsd: rate.amountUsd == null ? null : Math.round(rate.amountUsd * 100 * seconds) / 100 }));
  const seconds = rate.seconds ?? 0;
  const rows: ReturnType<typeof radioSpotDurations> = [{ seconds, amountUsd: rate.amountUsd }];
  if (![20, 30].includes(seconds) || special(rate.label)) return rows;
  const other = seconds === 20 ? 30 : 20;
  if (tariff.rates.some(candidate => candidate.seconds === other && formatKey(candidate.label) === formatKey(rate.label))) return rows;
  const cents = rate.amountUsd == null ? null : Math.round(rate.amountUsd * 100);
  rows.push({ seconds: other, amountUsd: cents == null ? null : Math.round(cents * other / seconds) / 100, proportionalFrom: seconds });
  return rows.sort((a, b) => a.seconds - b.seconds);
}
