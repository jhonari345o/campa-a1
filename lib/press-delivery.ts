import { normalized, validDate, type BroadcastBrief } from "./broadcast-catalog";
import { pressObservationFor, pressPublicationKey, type PressAudience } from "./atl-audience";
import type { CatalogProduct } from "./catalog-shopping";
import type { StrategyBrief } from "./media-strategy-evidence";
import { planningStudyBrief } from "./planning-market";

/** The source unit was confirmed as readership per edition. It is an
 * opportunity-to-see estimate, not proof that an advertisement was noticed. */
export type PressEditionReach = {
  publicationKey: string; reachPct: number; marketKeys: string[];
  periodEnd: string; evidenceId: string;
};

export function pressReachForProduct(product: CatalogProduct, rows: PressAudience[], brief: BroadcastBrief, asOf: string): PressEditionReach | undefined {
  if (product.kind !== "press" || product.key.endsWith(":quote") || !/^(insercion|aviso|pagina|publicacion)$/.test(normalized(product.unit))) return undefined;
  const format = `${product.name} ${product.format} ${product.unit}`;
  // A newspaper's main edition cannot stand in for a magazine or supplement.
  if (/revista|suplemento|clasificado|obituario|exequial/.test(normalized(format))) return undefined;
  const study = pressObservationFor(product.provider, format, rows, brief as StrategyBrief, asOf);
  if (!study) return undefined;
  const covers = (markets: string[]) => Boolean(planningStudyBrief(study.marketKeys, {...brief, coverage: undefined, geography: markets.join(", ")}));
  const options = product.marketOptions?.length ? product.marketOptions : product.marketKeys?.length ? [product.marketKeys] : [];
  // Alternative editions (Quito OR Guayaquil) do not purchase both cities.
  if (options.length ? !options.every(covers) : !["nacional", "edicion general"].includes(normalized(product.location)) && !covers(product.location.split(/\s*[·,+]\s*/))) return undefined;
  return { publicationKey: pressPublicationKey(study.provider), reachPct: study.reachPct, marketKeys: study.marketKeys, periodEnd: study.periodEnd, evidenceId: study.id };
}

/** Planning projection: retain one edition's audience per publication because
 * no between-edition accumulation curve is supplied. More insertions or page
 * formats do not fabricate new readers. Distinct titles use the planning
 * independence assumption; source percentages are normalized onto the shared
 * target universe, never added as counts from different population bases. */
export function projectPressEditionReach(rows: {quantity: number; pressReach?: PressEditionReach}[], markets: string[], marketWeights: Record<string, number>, startDate: string): number | null {
  const scopeWeight = markets.reduce((sum, key) => sum + (marketWeights[key] ?? 0), 0);
  if (!validDate(startDate) || !Number.isFinite(scopeWeight) || scopeWeight <= 0) return null;
  const publications = new Map<string, {scope: string; reach: number}>();
  for (const row of rows) {
    const s = row.pressReach;
    if (!s) continue;
    if (!Number.isSafeInteger(row.quantity) || row.quantity < 1 || !s.publicationKey || !s.evidenceId || !Number.isFinite(s.reachPct) || s.reachPct < 0 || s.reachPct > 100 || !validDate(s.periodEnd)) return null;
    const keys = [...new Set(s.marketKeys.map(normalized))].sort();
    if (!keys.length || !keys.every(key => markets.includes(key)) || s.periodEnd > startDate || Date.parse(startDate) - Date.parse(s.periodEnd) > 366 * 86400000) continue;
    const weight = keys.reduce((sum, key) => sum + (marketWeights[key] ?? 0), 0) / scopeWeight;
    if (!Number.isFinite(weight) || weight <= 0 || weight > 1.000001) return null;
    const scope = keys.join(","), reach = s.reachPct * weight;
    const prior = publications.get(s.publicationKey);
    // Conflicting scopes need a disjoint audience breakdown, not a second copy.
    if (prior && prior.scope !== scope) return null;
    publications.set(s.publicationKey, {scope, reach: Math.max(prior?.reach ?? 0, reach)});
  }
  if (!publications.size) return null;
  return (1 - [...publications.values()].reduce((unreached, row) => unreached * (1 - row.reach / 100), 1)) * 100;
}
