import geography from "./ecuador-geography.json";
import { normalized, validDate } from "./broadcast-catalog";

export type PressOffer = {
  id: string; group: string; name: string; specs: string; market: string;
  marketOptions: string[][]; target: string; unit: "inserción" | "paquete" | "CPM" | "creatividad";
  priceUsd: number | null; duration: string; notes: string;
};
export type PressEdition = {
  id: string; label: string; period: string; validFrom: string | null; validTo: string | null;
  taxIncluded: boolean | null; conditions: string[]; offers: PressOffer[];
};
export type PressEntry = {
  id: string; name: string; regionKeys: string[]; city: string | null; description: string;
  logoPath: string | null; website: string | null; coverage: string; editions: PressEdition[];
};
export type PressCatalog = { entries: PressEntry[]; error?: string; asOfDate?: string };
export const pressRegions = [{ key: "national", label: "Nacionales" }, ...geography.filter(item => item.kind === "province").map(item => ({ key: item.key.replace(/^province:/, ""), label: item.label })).sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }))];
const regionKeys = new Set(pressRegions.map(region => region.key));
const text = (value: unknown, max = 180) => typeof value === "string" ? value.trim().slice(0, max) : "";
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown, max: number) => Array.isArray(value) ? value.slice(0, max) : [];
const strings = (value: unknown, count = 25, length = 180) => list(value, count).map(value => text(value, length)).filter(Boolean);
const identifier = (value: unknown) => /^[a-z0-9-]{1,150}$/.test(text(value, 150)) ? text(value, 150) : "";

export function pressEntriesForRegion(catalog: PressCatalog, key: string) {
  return regionKeys.has(key) ? catalog.entries.filter(entry => entry.regionKeys.includes(key)).sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })) : [];
}
export function pressMatches(entry: PressEntry, query: string) {
  const haystack = normalized([entry.name, entry.city].filter(Boolean).join(" "));
  return normalized(query).split(" ").filter(Boolean).every(term => haystack.includes(term));
}
export function pressOfferMatches(offer: PressOffer, query: string) {
  const text = normalized(`${offer.name} ${offer.specs}`);
  return normalized(query).split(" ").filter(Boolean).every(term => text.includes(term));
}
/** Licensed prices stay in the private table; only these display fields reach authenticated catalog users. */
export function projectPressCatalog(value: unknown): PressEntry[] {
  const result = new Map<string, PressEntry>();
  for (const item of list(value, 10_000)) {
    const row = object(item), id = identifier(row.id), name = text(row.name);
    const keys = [...new Set(strings(row.region_keys).filter(key => regionKeys.has(key)))];
    if (!id || !name || !keys.length) continue;
    const editions: PressEdition[] = [];
    for (const item of list(row.editions, 30)) {
      const edition = object(item), editionId = identifier(edition.id);
      if (!editionId || !text(edition.label) || !text(edition.period)) continue;
      const validFrom = validDate(text(edition.validFrom)) ? text(edition.validFrom) : null;
      const validTo = validDate(text(edition.validTo)) ? text(edition.validTo) : null;
      if ((edition.validFrom && !validFrom) || (edition.validTo && !validTo) || (validFrom && validTo && validTo < validFrom)) continue;
      const offers = new Map<string, PressOffer>();
      for (const item of list(edition.offers, 2000)) {
        const offer = object(item), offerId = identifier(offer.id), offerName = text(offer.name);
        if (!offerId || !offerName || !text(offer.market) || !["inserción", "paquete", "CPM", "creatividad"].includes(String(offer.unit))) continue;
        const price = typeof offer.priceUsd === "number" && Number.isFinite(offer.priceUsd) && offer.priceUsd >= 0 && offer.priceUsd <= 10_000_000 ? offer.priceUsd : null;
        offers.set(offerId, { id: offerId, name: offerName, group: text(offer.group) || "Formatos", specs: text(offer.specs, 600), market: text(offer.market, 300), marketOptions: list(offer.marketOptions, 25).map(keys => [...new Set(strings(keys, 25, 80))]), target: text(offer.target) || "No segmentado en la fuente", unit: offer.unit as PressOffer["unit"], priceUsd: price, duration: text(offer.duration), notes: text(offer.notes, 900) });
      }
      editions.push({ id: editionId, label: text(edition.label), period: text(edition.period), validFrom, validTo, taxIncluded: typeof edition.taxIncluded === "boolean" ? edition.taxIncluded : null, conditions: strings(edition.conditions, 20, 600), offers: [...offers.values()] });
    }
    const logo = text(row.logo_path);
    let website: string | null = null;
    try { const url = new URL(text(row.website, 500)); if (url.protocol === "https:" && !url.username && !url.password) website = url.href; } catch { /* No verified official URL. */ }
    result.set(id, { id, name, regionKeys: keys, city: text(row.city) || null, description: text(row.description, 700), coverage: text(row.coverage, 700), website, logoPath: /^\/providers\/press\/[a-z0-9-]+\.(png|webp|jpe?g)$/.test(logo) ? logo : null, editions });
  }
  return [...result.values()];
}
export function pressValidity(edition: PressEdition, start?: string, end = start) {
  return validDate(edition.validFrom ?? "") && validDate(edition.validTo ?? "") && validDate(start) && validDate(end) && start <= end && edition.validFrom! <= start && edition.validTo! >= end;
}
export function pressEditionStatus(edition: PressEdition, asOf: string) {
  if (!validDate(asOf) || !validDate(edition.validFrom ?? "") || !validDate(edition.validTo ?? "")) return "Vigencia no declarada";
  return asOf < edition.validFrom! ? "Próxima vigencia" : asOf > edition.validTo! ? "Vencida" : "Vigente";
}
export function pressMarketMatches(offer: PressOffer, geographies: string[]) {
  const requested = [...new Set(geographies.map(normalized))].sort();
  return requested.length > 0 && offer.marketOptions.some(option => {
    const market = [...new Set(option.map(normalized))].sort();
    return market.length > 0 && JSON.stringify(market) === JSON.stringify(requested);
  });
}
export type PressPlanPick = { slug: string; outletId?: string; editionId?: string; offerId?: string; name: string; format: string; quantity: number; market?: string; unit?: PressOffer["unit"]; unitPrice?: number | null; referencePriceUsd?: number | null; context?: string; };
/** Browser prices are discarded. Unknown dates/territory remain a request, never an applicable quote. */
export function validatePressPicks(catalog: PressCatalog, input: unknown, brief: { startDate?: string; endDate?: string; geographies: string[] }): { ok: true; picks: PressPlanPick[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length > 100) return { ok: false, error: "Reduce la selección de prensa a 100 formatos." };
  if (input.length && catalog.error) return { ok: false, error: catalog.error };
  const picks: PressPlanPick[] = [];
  for (const value of input) {
    const pick = object(value), quantity = pick.quantity;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 10_000) return { ok: false, error: "Revisa las cantidades de prensa." };
    const entry = catalog.entries.find(entry => entry.id === pick.outletId);
    if (!entry) {
      // An older saved request can be reviewed without trusting its old label or price.
      if (typeof pick.slug === "string" && !pick.outletId) {
        const legacySlug = pick.slug;
        const legacy = catalog.entries.find(entry => legacySlug.startsWith(entry.id.replace(/^press-/, "") + "-"));
        if (legacy && text(pick.format, 200)) { picks.push({ slug: text(pick.slug, 180), outletId: legacy.id, name: legacy.name, format: text(pick.format, 200), quantity, unitPrice: null, referencePriceUsd: null }); continue; }
      }
      return { ok: false, error: "Selecciona nuevamente la cabecera desde el catálogo de prensa." };
    }
    if (!pick.editionId && !pick.offerId) {
      const format = text(pick.format, 200);
      if (!format) return { ok: false, error: "Indica el formato solicitado para prensa." };
      picks.push({ slug: `${entry.id}-request-${picks.length}`, outletId: entry.id, name: entry.name, format, quantity, unitPrice: null, referencePriceUsd: null }); continue;
    }
    const edition = entry.editions.find(edition => edition.id === pick.editionId);
    const offer = edition?.offers.find(offer => offer.id === pick.offerId);
    if (!edition || !offer) return { ok: false, error: "El formato de prensa ya no está disponible en esa edición." };
    const dated = validDate(edition.validFrom ?? "") && validDate(edition.validTo ?? "");
    if (dated && !pressValidity(edition, brief.startDate, brief.endDate)) return { ok: false, error: `${entry.name}: el tarifario no cubre las fechas del plan.` };
    const scoped = pressMarketMatches(offer, brief.geographies);
    picks.push({ slug: `${entry.id}-${edition.id}-${offer.id}`, outletId: entry.id, editionId: edition.id, offerId: offer.id, name: entry.name, format: offer.name, quantity, market: offer.market, unit: offer.unit, unitPrice: dated && scoped ? offer.priceUsd : null, referencePriceUsd: scoped ? offer.priceUsd : null, context: `${edition.period} · ${offer.market} · ${offer.unit}` });
  }
  return { ok: true, picks };
}
