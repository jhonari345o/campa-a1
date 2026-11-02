import { normalized, validDate, type BroadcastCatalog, type BroadcastRadioRow, type BroadcastSource } from "./broadcast-catalog";

export type RadioTariff = {
  id: string; label: string; edition: string; market: string; target: string;
  validFrom: string | null; validTo: string | null; taxIncluded: boolean | null;
  unit: "second" | "spot"; conditions: string;
  rates: { label: string; amountUsd: number | null; seconds: number | null }[];
};
export type RadioRankingLink = { sourceId: string; stationName: string; marketKeys: string[]; frequency: string };
export type RadioStationProfile = { coverage: string; website: string | null; tariffs: RadioTariff[]; rankingLinks: RadioRankingLink[] };
export const emptyRadioProfile: RadioStationProfile = { coverage: "", website: null, tariffs: [], rankingLinks: [] };
const text = (value: unknown, max = 180): string => typeof value === "string" ? value.trim().slice(0, max) : "";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const id = (value: unknown) => /^[a-z0-9-]{1,150}$/.test(text(value, 150)) ? text(value, 150) : "";
const date = (value: unknown) => validDate(text(value)) ? text(value) : null;

/** Whitelist display data only. Raw documents, contacts and internal source paths stay private. */
export function projectRadioProfile(value: unknown): RadioStationProfile {
  const row = record(value);
  let website: string | null = null;
  try {
    const url = new URL(text(row.website, 500));
    if (url.protocol === "https:" && !url.username && !url.password) website = url.href;
  } catch { /* Missing or unsafe official URL. */ }
  const tariffs: RadioTariff[] = [];
  for (const item of (Array.isArray(row.tariffs) ? row.tariffs.slice(0, 30) : [])) {
    const tariff = record(item), tariffId = id(tariff.id);
    const rates: RadioTariff["rates"] = [];
    for (const item of (Array.isArray(tariff.rates) ? tariff.rates.slice(0, 50) : [])) {
      const rate = record(item), label = text(rate.label);
      if (!label || typeof rate.amountUsd !== "number" || !Number.isFinite(rate.amountUsd) || rate.amountUsd < 0 || rate.amountUsd > 1_000_000) continue;
      rates.push({ label, amountUsd: rate.amountUsd, seconds: typeof rate.seconds === "number" && Number.isInteger(rate.seconds) && rate.seconds > 0 && rate.seconds <= 3600 ? rate.seconds : null });
    }
    if (!tariffId || !text(tariff.label) || !text(tariff.edition) || !text(tariff.market) || !rates.length || !["second", "spot"].includes(String(tariff.unit))) continue;
    const validFrom = date(tariff.validFrom), validTo = date(tariff.validTo);
    // Reject malformed/reversed explicit dates instead of accidentally presenting them as current.
    if ((tariff.validFrom && !validFrom) || (tariff.validTo && !validTo) || (validFrom && validTo && validTo < validFrom)) continue;
    tariffs.push({ id: tariffId, label: text(tariff.label), edition: text(tariff.edition), market: text(tariff.market, 300), target: text(tariff.target) || "No segmentado en la fuente", validFrom, validTo, taxIncluded: typeof tariff.taxIncluded === "boolean" ? tariff.taxIncluded : null, unit: tariff.unit as RadioTariff["unit"], conditions: text(tariff.conditions, 700), rates });
  }
  const rankingLinks: RadioRankingLink[] = [];
  for (const item of (Array.isArray(row.rankingLinks) ? row.rankingLinks.slice(0, 100) : [])) {
    const link = record(item), sourceId = id(link.sourceId), stationName = text(link.stationName);
    if (!sourceId || !stationName || !Array.isArray(link.marketKeys) || link.marketKeys.length > 25) continue;
    rankingLinks.push({ sourceId, stationName, marketKeys: [...new Set<string>(link.marketKeys.map((key: unknown) => text(key, 80)).filter(Boolean))], frequency: text(link.frequency, 60) });
  }
  return { coverage: text(row.coverage, 700), website, tariffs, rankingLinks };
}

export function radioTariffStatus(tariff: RadioTariff, asOf: string): "Vigente" | "Vencida" | "Próxima vigencia" | "Vigencia no declarada" {
  if (!validDate(asOf) || !validDate(tariff.validFrom ?? "") || !validDate(tariff.validTo ?? "")) return "Vigencia no declarada";
  if (asOf < tariff.validFrom!) return "Próxima vigencia";
  if (asOf > tariff.validTo!) return "Vencida";
  return "Vigente";
}

export type RadioStationRanking = { source: BroadcastSource; row: BroadcastRadioRow };
/** Exact curated identity + study + territory + band; no fuzzy names or inferred geography. */
export function radioStationRankings(profile: RadioStationProfile, catalog: BroadcastCatalog, asOf: string): RadioStationRanking[] {
  if (!validDate(asOf)) return [];
  const cohorts = new Map<string, RadioStationRanking>();
  for (const link of profile.rankingLinks) {
    const source = catalog.sources.find(item => item.id === link.sourceId && item.kind === "radio");
    if (!source || !validDate(source.periodStart) || !validDate(source.periodEnd) || source.periodStart > source.periodEnd || source.periodEnd > asOf) continue;
    const keys = [...new Set(source.marketKeys.map(normalized))].sort();
    const linkedKeys = [...new Set(link.marketKeys.map(normalized))].sort();
    if (JSON.stringify(keys) !== JSON.stringify(linkedKeys) || normalized(source.frequency) !== normalized(link.frequency)) continue;
    const rows = catalog.radio.filter(row => row.sourceId === source.id && normalized(row.name) === normalized(link.stationName));
    if (rows.length !== 1) continue; // Ambiguous identity is not a match.
    const row = rows[0];
    const cohort = JSON.stringify([keys, source.market, source.target, source.ageMin, source.ageMax, source.sex, source.nse, source.frequency, source.daypart]);
    const previous = cohorts.get(cohort);
    if (!previous || source.periodEnd > previous.source.periodEnd || (source.periodEnd === previous.source.periodEnd && source.id < previous.source.id)) cohorts.set(cohort, { source, row });
  }
  return [...cohorts.values()].sort((a, b) => b.source.periodEnd.localeCompare(a.source.periodEnd) || a.source.market.localeCompare(b.source.market, "es") || a.source.target.localeCompare(b.source.target, "es"));
}
