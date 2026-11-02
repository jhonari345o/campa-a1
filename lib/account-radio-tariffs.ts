import type { CatalogProduct } from "./catalog-shopping";
import type { AgreedCatalogRate } from "./catalog-pricing";
import { validDate } from "./broadcast-catalog";

export type RadioRatePreference = { origin: "client" | "fallback" | "unspecified"; observedOn: string; clientSpecific: boolean };
const record = (value: unknown): Record<string, unknown> => value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const date = (value: unknown) => typeof value === "string" && validDate(value.slice(0, 10)) ? value.slice(0, 10) : "";

/** Private provenance is reduced to selection hints and never attached to a customer product. */
export function radioRatePreference(evidence: unknown, clientSpecific: boolean): RadioRatePreference {
  const row = record(evidence), source = record(row.source), clarification = record(source.clarification);
  const priority = typeof row.priority === "string" ? row.priority.trim() : "";
  return { origin: /cne\s+fallback/i.test(priority) ? "fallback" : priority ? "client" : "unspecified", observedOn: date(clarification.confirmed_on) || date(source.sent_on), clientSpecific };
}

export const radioProviderKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(radio|fm|am)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const originRank = { client: 3, unspecified: 2, fallback: 1 };

export function accountRadioGroups(products: CatalogProduct[]): CatalogProduct[][] {
  const aliases = new Map<string, string>();
  for (const p of products) if (p.kind === "radio" && p.source.stationId) {
    const key = radioProviderKey(p.provider) || p.key, previous = aliases.get(p.source.stationId);
    aliases.set(p.source.stationId, previous ? [previous, key].sort()[0] : key);
  }
  const names = new Map<string, string>();
  for (const p of products) if (p.kind === "radio" && p.source.stationId) names.set(radioProviderKey(p.provider), aliases.get(p.source.stationId)!);
  const groups = new Map<string, CatalogProduct[]>();
  for (const p of products.filter(p => p.kind === "radio")) {
    const key = names.get(radioProviderKey(p.provider)) || radioProviderKey(p.provider) || p.key;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.values()].map(rows => rows.sort((a, b) => a.name.localeCompare(b.name, "es") || a.key.localeCompare(b.key)));
}

/** Inputs have already been scoped to one company and, for an agency, its selected client. */
export function selectAccountRadioTariffs(products: CatalogProduct[], rates: AgreedCatalogRate[]): CatalogProduct[] {
  const preferences = new Map<string, RadioRatePreference>();
  for (const rate of rates) {
    const pref = rate.radioPreference;
    if (!pref) continue;
    const previous = preferences.get(rate.productKey);
    if (!previous || originRank[pref.origin] > originRank[previous.origin] || (pref.origin === previous.origin && pref.observedOn > previous.observedOn)) preferences.set(rate.productKey, pref);
  }
  const rank = (p: CatalogProduct): Array<number | string> => {
    const pref = preferences.get(p.key);
    const seconds = p.source.seconds ?? Number(p.unit.match(/cuña de\s+(\d+)\s*s/i)?.[1] ?? 0);
    return [p.source.workspaceProductId ? originRank[pref?.origin ?? "unspecified"] : 0, pref?.clientSpecific ? 1 : 0,
      pref?.observedOn || p.validFrom || "", p.validFrom || "",
      p.source.workspaceProductId ? 0 : seconds === 30 ? 3 : seconds === 20 ? 2 : seconds > 0 ? 1 : 0];
  };
  const compare = (a: CatalogProduct, b: CatalogProduct) => {
    const x = rank(a), y = rank(b);
    for (let i = 0; i < x.length; i++) { if (x[i] > y[i]) return -1; if (x[i] < y[i]) return 1; }
    return 0;
  };
  const selected = new Map<string, CatalogProduct>();
  for (const rows of accountRadioGroups(products)) {
    rows.sort((a, b) => compare(a, b) || a.key.localeCompare(b.key));
    const formats = new Map<string, CatalogProduct[]>();
    for (const p of rows.filter(p => compare(rows[0], p) === 0)) {
      const key = JSON.stringify([p.name, p.format, p.unit, p.location].map(s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()));
      formats.set(key, [...(formats.get(key) ?? []), p]);
    }
    for (const sameFormat of formats.values()) {
      const first = sameFormat[0], amount = (p: CatalogProduct) => p.priceCents ?? p.referencePriceCents ?? null;
      const conflict = sameFormat.some(p => amount(first) != null && amount(p) != null && amount(first) !== amount(p));
      if (conflict) {
        const { agreementId: _agreement, ...source } = first.source; void _agreement;
        selected.set(first.key, { ...first, source, priceCents: null, referencePriceCents: null, referenceOnly: true, referenceLabel: "Tarifa de la cuenta pendiente de definición" });
      } else selected.set(first.key, first);
    }
  }
  return products.flatMap(p => p.kind !== "radio" ? [p] : selected.has(p.key) ? [selected.get(p.key)!] : []);
}
