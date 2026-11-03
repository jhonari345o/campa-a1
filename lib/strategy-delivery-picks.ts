import type { CatalogPick } from "./catalog-shopping";
import type { StrategyReport } from "./media-strategy";

/** Use the same exact catalog selection in the analysis and the final proposal. */
export function strategyDeliveryPicks(report: Pick<StrategyReport, "allocations">): CatalogPick[] {
  const quantities = new Map<string, number>();
  for (const allocation of report.allocations) {
    const rows = allocation.executions?.length ? allocation.executions : allocation.candidate ? [{ candidate: allocation.candidate, units: allocation.units }] : [];
    for (const row of rows) {
      const key = row.candidate.catalogKey;
      if (key && row.units != null && Number.isSafeInteger(row.units) && row.units > 0) {
        quantities.set(key, (quantities.get(key) ?? 0) + row.units);
      }
    }
  }
  return [...quantities].map(([productKey, quantity]) => ({ productKey, quantity }));
}
