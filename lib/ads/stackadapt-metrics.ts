import type { DeliveryMetrics } from "./stackadapt-dashboard";

/** Ratios are calculated from totals, never from an average of daily ratios. */
export function deliveryRates(m: DeliveryMetrics) {
  return {
    ctr: m.clicks != null && m.impressions ? m.clicks / m.impressions * 100 : null,
    cpm: m.cost != null && m.impressions ? m.cost / m.impressions * 1000 : null,
    cpc: m.cost != null && m.clicks ? m.cost / m.clicks : null,
  };
}
