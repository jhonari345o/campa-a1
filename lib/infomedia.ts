/** Public contracts only. Licensed observations are stored privately in Supabase. */
export type InfomediaCategory = { id: string; label: string; periods?: { year: number; label: string }[] };
export type ResearchBrand = { brand: string; estimatedInvestment: number; notices: number; soi: number; soa: number };
export type ResearchPeriod = {
  year: number;
  periodLabel: string;
  sourceTarget: string;
  totals: { estimatedInvestment: number; grossInvestment: number; notices: number; activeBrands: number };
  mediaMix: { media: string; estimatedInvestment: number; share: number }[];
  topBrands: ResearchBrand[];
  focusBrand: ResearchBrand | null;
  pressureContexts: {
    media: string; market: string; grps: number; activeBrands: number;
    topBrands: { brand: string; grps: number; sov: number }[];
  }[];
};
export type CategoryResearch = {
  category: InfomediaCategory;
  dataThrough: string;
  referenceYear?: number;
  periods: ResearchPeriod[];
};
export function lookupKey(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}
export function searchCategories(categories: InfomediaCategory[], query: string): InfomediaCategory[] {
  const terms = lookupKey(query).split(" ").filter(Boolean);
  return categories.filter((item) => terms.every((term) => lookupKey(item.label).includes(term))).slice(0, 30);
}
export function resolveCategory(categories: InfomediaCategory[], id: string, legacyLabel = ""): InfomediaCategory | undefined {
  // A declared ID must match exactly. Legacy labels migrate only on an exact canonical match.
  return id ? categories.find((item) => item.id === id)
    : categories.find((item) => lookupKey(item.label) === lookupKey(legacyLabel));
}

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const numeric = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
const text = (value: unknown) => typeof value === "string" ? value.slice(0, 180) : "";
function brand(value: unknown): ResearchBrand {
  const row = object(value);
  return { brand: text(row.brand), estimatedInvestment: numeric(row.estimatedInvestment), notices: numeric(row.notices), soi: numeric(row.soi), soa: numeric(row.soa) };
}
/** Whitelist and bound the selected category response; never return the private snapshot. */
export function projectResearch(category: InfomediaCategory, payload: unknown, dataThrough: string, focus = ""): CategoryResearch {
  const source = object(payload);
  const focusKey = lookupKey(focus);
  const periods = array(source.periods).slice(0, 10).map((value): ResearchPeriod => {
    const row = object(value), totals = object(row.totals);
    const brands = array(row.brands).map(brand);
    return {
      year: numeric(row.year), periodLabel: text(row.periodLabel), sourceTarget: text(row.sourceTarget),
      totals: { estimatedInvestment: numeric(totals.estimatedInvestment), grossInvestment: numeric(totals.grossInvestment), notices: numeric(totals.notices), activeBrands: numeric(totals.activeBrands) },
      mediaMix: array(row.mediaMix).slice(0, 20).map((value) => {
        const item = object(value);
        return { media: text(item.media), estimatedInvestment: numeric(item.estimatedInvestment), share: numeric(item.share) };
      }),
      topBrands: brands.sort((a, b) => b.estimatedInvestment - a.estimatedInvestment).slice(0, 10),
      focusBrand: focusKey ? brands.find((item) => lookupKey(item.brand) === focusKey) ?? null : null,
      pressureContexts: array(row.pressureContexts).slice(0, 12).map((value) => {
        const item = object(value);
        return {
          media: text(item.media), market: text(item.market), grps: numeric(item.grps), activeBrands: numeric(item.activeBrands),
          topBrands: array(item.brands).slice(0, 5).map((value) => {
            const b = object(value);
            return { brand: text(b.brand), grps: numeric(b.grps), sov: numeric(b.sov) };
          }),
        };
      }),
    };
  }).sort((a, b) => b.year - a.year);
  return { category, dataThrough: text(dataThrough), periods };
}

export function withReferenceYear(research: CategoryResearch, year: number): CategoryResearch {
  if (!Number.isInteger(year) || year < 0) throw new Error("REFERENCE_PERIOD_UNAVAILABLE");
  const period = year ? research.periods.find((item) => item.year === year) : research.periods[0];
  if (!period) throw new Error("REFERENCE_PERIOD_UNAVAILABLE");
  return { ...research, referenceYear: period.year };
}
export function restoreResearch(value: unknown): CategoryResearch | undefined {
  const saved = object(value), category = object(saved.category);
  if (typeof category.id !== "string" || typeof category.label !== "string" || !Array.isArray(saved.periods)) return undefined;
  const normalized = { periods: saved.periods.map((value) => {
    const period = object(value);
    return { ...period, brands: period.topBrands, pressureContexts: array(period.pressureContexts).map((value) => ({ ...object(value), brands: object(value).topBrands })) };
  }) };
  const restored = projectResearch({ id: category.id, label: category.label }, normalized, text(saved.dataThrough));
  if (!restored.periods.length) return undefined;
  try { return withReferenceYear(restored, numeric(saved.referenceYear)); } catch { return undefined; }
}
