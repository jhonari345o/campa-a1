import { normalized, validDate } from "./broadcast-catalog";
import type { CatalogProduct } from "./catalog-shopping";

/** Private, reviewed forecasts for the actual purchased element and population.
 * Traffic/impact observations are not accepted here as unique people.
 * Groups are assigned before the selection: adding a bridge between two sites
 * must not silently regroup an existing plan and lower its estimated reach. */
export type OohSectorReachEstimate = {
  assetId: string;
  city: string;
  overlapGroup: string;
  people: number;
  universe: number;
  targetId: string;
  validFrom: string;
  validTo: string | null;
  accumulation: "fixed_audience";
  evidenceId: string;
  basis: "modeled_unique_people" | "measured_unique_people";
};
export const OOH_NEARBY_OVERLAP = 0.6;
/** Provisional owner-approved scenario (2026-11-03), not measured frequency. */
export const OOH_DAILY_CONTACTS_PER_PERSON = 2;
export type OohDailyImpactCalibration = Omit<OohSectorReachEstimate, "people" | "basis" | "accumulation"> & {
  dailyImpacts: number;
  impactPeriod: "day";
  impactTargetId: string;
};
const target = "18+|all|all";
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 300;
function validEstimate(s: OohSectorReachEstimate): boolean {
  return Boolean(s) && [s.assetId,s.city,s.overlapGroup,s.evidenceId].every(text)
    && s.targetId === target
    && ["modeled_unique_people","measured_unique_people"].includes(s.basis)
    && Number.isFinite(s.universe) && s.universe > 0
    && Number.isFinite(s.people) && s.people >= 0 && s.people <= s.universe
    && s.accumulation === "fixed_audience"
    && validDate(s.validFrom) && (s.validTo === null || validDate(s.validTo) && s.validTo >= s.validFrom);
}
const applies = (s: OohSectorReachEstimate, startDate: string, endDate: string) =>
  validDate(startDate) && validDate(endDate) && endDate >= startDate && s.validFrom <= startDate && (s.validTo === null || s.validTo >= endDate);

/** Convert only a privately reviewed match to the purchased asset. The impact
 * period and audience must be known; an unknown-period/all-ages observation
 * cannot silently become daily 18+ people. The scenario keeps a fixed audience
 * across the campaign rather than multiplying daily people by campaign days. */
export function oohEstimateFromDailyImpacts(input: OohDailyImpactCalibration): OohSectorReachEstimate | undefined {
  if (!input || input.impactPeriod !== "day" || input.impactTargetId !== input.targetId
    || !Number.isFinite(input.dailyImpacts) || input.dailyImpacts < 0) return undefined;
  const estimate: OohSectorReachEstimate = {
    assetId: input.assetId, city: input.city, overlapGroup: input.overlapGroup,
    people: Math.min(input.universe,input.dailyImpacts/OOH_DAILY_CONTACTS_PER_PERSON),
    universe: input.universe, targetId: input.targetId,
    validFrom: input.validFrom, validTo: input.validTo, evidenceId: input.evidenceId,
    basis: "modeled_unique_people", accumulation: "fixed_audience",
  };
  return validEstimate(estimate) ? estimate : undefined;
}

/** A caller can supply only product IDs. Resolve forecasts on the server after
 * authorization; never accept a client-supplied audience or nearest-site match. */
export function oohReachForProduct(product: CatalogProduct, estimates: OohSectorReachEstimate[] | undefined, startDate: string, endDate: string): OohSectorReachEstimate | undefined {
  if (product.kind !== "ooh" || !product.source.assetId || !Array.isArray(estimates) || estimates.length > 10000) return undefined;
  const rows = estimates.filter(s => s?.assetId === product.source.assetId && validEstimate(s) && applies(s,startDate,endDate));
  return rows.length === 1 ? rows[0] : undefined;
}

/** Owner-defined scenario, not a measured duplication rate.
 * Within a fixed proximity group retain the largest audience, then 40% of each
 * other element. This is invariant to order, monotonic and bounded by the city.
 * Other groups use planning independence within the city; different cities
 * are disjoint populations. Counts retain their original population base.
 * The fixed-audience scenario does not invent daily or monthly accumulation. */
export function projectOohSectorReach(
  rows: {quantity: number; oohReach?: OohSectorReachEstimate}[],
  markets: string[],
  marketWeights: Record<string, number>,
  modelUniverse: number,
  startDate: string,
  endDate: string,
): number | null {
  if (!validDate(startDate) || !validDate(endDate) || endDate < startDate || !Number.isFinite(modelUniverse) || modelUniverse <= 0) return null;
  const keys = [...new Set(markets.map(normalized))];
  const scopeWeight = keys.reduce((sum,key) => sum + (marketWeights[key] ?? 0),0);
  if (!keys.length || keys.some(key => !Number.isFinite(marketWeights[key]) || marketWeights[key] <= 0) || scopeWeight <= 0 || scopeWeight > 1.000001) return null;
  const assets = new Map<string,OohSectorReachEstimate>();
  for (const row of rows) {
    const s = row.oohReach;
    if (!s) continue;
    if (!Number.isSafeInteger(row.quantity) || row.quantity < 1 || !validEstimate(s)) return null;
    const city = normalized(s.city);
    if (!keys.includes(city) || !applies(s,startDate,endDate)) continue;
    const cityUniverse = modelUniverse * marketWeights[city];
    // An all-ages traffic count must not become an 18+ audience by changing
    // its denominator. The forecast must already use this exact population.
    if (Math.abs(s.universe - cityUniverse) > 0.01) return null;
    const prior = assets.get(s.assetId);
    if (prior && (prior.people !== s.people || normalized(prior.city) !== city || normalized(prior.overlapGroup) !== normalized(s.overlapGroup) || prior.evidenceId !== s.evidenceId)) return null;
    assets.set(s.assetId,s);
  }
  if (!assets.size) return null;
  let people = 0;
  for (const city of keys) {
    const cityUniverse = modelUniverse * marketWeights[city];
    const groups = new Map<string,number[]>();
    for (const s of assets.values()) if (normalized(s.city) === city) {
      const key = normalized(s.overlapGroup), values = groups.get(key) ?? [];
      values.push(s.people); groups.set(key,values);
    }
    let unreached = 1;
    for (const group of [...groups.keys()].sort()) {
      const values = groups.get(group)!.sort((a,b) => b-a);
      const groupPeople = Math.min(cityUniverse,values[0] + (1-OOH_NEARBY_OVERLAP)*values.slice(1).reduce((sum,n) => sum+n,0));
      unreached *= 1-groupPeople/cityUniverse;
    }
    people += cityUniverse*(1-unreached);
  }
  return Math.min(100,Math.max(0,people/(modelUniverse*scopeWeight)*100));
}
