import { validDate } from "./broadcast-catalog";
import type { CatalogProduct } from "./catalog-shopping";

/** Open-ended prices require an explicit account agreement or owner authorization. */
export function catalogPriceCoversDates(product: CatalogProduct, start?: string, end?: string) {
  if (!validDate(start) || !validDate(end) || end < start) return false;
  const from = product.validFrom, to = product.validTo;
  if (!validDate(from ?? "") || from! > start) return false;
  if (validDate(to ?? "")) return to! >= end;
  return !to && Boolean(product.source.agreementId || product.source.standingPrice);
}

/** Whole calendar rental periods: January 1–31 is one month, not two. */
export function campaignRentalMonths(start: string, end: string) {
  if (!validDate(start) || !validDate(end) || end < start) return null;
  const first = new Date(`${start}T00:00:00Z`), until = Date.parse(`${end}T00:00:00Z`) + 86_400_000;
  const anniversary = (months: number) => {
    const month = first.getUTCMonth() + months;
    const last = new Date(Date.UTC(first.getUTCFullYear(), month + 1, 0)).getUTCDate();
    return Date.UTC(first.getUTCFullYear(), month, Math.min(first.getUTCDate(), last));
  };
  let months = Math.max(1, (Number(end.slice(0, 4)) - first.getUTCFullYear()) * 12 + Number(end.slice(5, 7)) - first.getUTCMonth() - 1);
  while (anniversary(months) < until) months++;
  return months;
}

export function planningProductPrice(product: CatalogProduct, start?: string, end?: string) {
  const cents = product.priceCents;
  if (product.referenceOnly || cents == null || !Number.isSafeInteger(cents) || cents <= 0 || !catalogPriceCoversDates(product, start, end)) return null;
  let periods = 1, unit = product.unit;
  let rental: { monthlyPriceUsd: number; months: number } | undefined;
  if (product.kind === "ooh" && start && end) {
    const period = product.billingPeriod ?? product.unit.toLowerCase();
    const monthsPerPeriod = /12_months|año|anual|year/.test(period) ? 12 : /6_months|6 meses|semestr/.test(period) ? 6 : /3_months|3 meses|trimestr|quarter/.test(period) ? 3 : /month|mes|mensual/.test(period) ? 1 : null;
    if (monthsPerPeriod) {
      periods = Math.ceil(campaignRentalMonths(start, end)! / monthsPerPeriod);
      const months = periods * monthsPerPeriod;
      rental = { monthlyPriceUsd: cents / 100 / monthsPerPeriod, months };
      unit = `contratación de ${months} ${months === 1 ? "mes" : "meses"}${product.unit.includes(" · ") ? ` · ${product.unit.split(" · ").slice(1).join(" · ")}` : ""}`;
    }
  }
  if (!Number.isSafeInteger(cents * periods)) return null;
  return { priceUsd: cents * periods / 100, unit, periods, ...(rental ? { rental } : {}) };
}
