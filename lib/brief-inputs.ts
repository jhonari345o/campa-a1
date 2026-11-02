import { validDate } from "./broadcast-catalog";

export function validPlanPeriod(start: string, end: string) {
  return validDate(start) && validDate(end) && end >= start;
}
export function displayPlanDate(iso: string) {
  return validDate(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";
}
export function parsePlanDate(display: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : "";
  return validDate(iso) ? iso : "";
}
/** Spanish input: dots group thousands; a comma separates at most two decimals. */
export function parseBudgetInput(display: string): number | null {
  const value = display.trim().replace(/^\$\s*/, "");
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value)) return null;
  const amount = Number(value.replaceAll(".", "").replace(",", "."));
  return Number.isFinite(amount) && amount > 0 && amount <= 10_000_000 ? amount : null;
}
export function formatBudgetInput(value: number): string {
  if (!Number.isFinite(value)) return "";
  const [integer, decimal] = value.toFixed(2).split(".");
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimal}`;
}
