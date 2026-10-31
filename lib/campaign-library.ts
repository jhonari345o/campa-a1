export type LibraryClient = { id: string; name: string; category: string; campaignKind: "film" | "campaign" };
export type LibraryDocument = { id: string; campaignId: string; title: string; kind: "plan" | "report"; version: string; issuedOn: string | null; downloadable: boolean; summary: string; sections: { title: string; columns: string[]; rows: string[][] }[] };
export type LibraryMetricValue = { value: number; period: string; scope: string; basis: string; estimated: boolean };
export type LibraryMetric = { id: string; campaignId: string; planDocumentId: string | null; reportDocumentId: string | null; label: string; unit: "USD" | "number" | "percent"; planned: LibraryMetricValue | null; reported: LibraryMetricValue | null };
export type LibraryCampaign = { id: string; clientId: string; name: string; period: string; status: "planning" | "running" | "reported"; poster: string | null; summary: string };
export type CampaignLibrary = { clients: LibraryClient[]; campaigns: LibraryCampaign[]; documents: LibraryDocument[]; metrics: LibraryMetric[] };
export const EMPTY_LIBRARY: CampaignLibrary = { clients: [], campaigns: [], documents: [], metrics: [] };
export function comparableMetric(metric: LibraryMetric): boolean {
  const { planned: p, reported: r } = metric;
  return Boolean(p && r && Number.isFinite(p.value) && Number.isFinite(r.value)
    && p.period.trim() && p.scope.trim() && p.basis.trim()
    && p.period === r.period && p.scope === r.scope && p.basis === r.basis);
}
export function metricDifference(metric: LibraryMetric): number | null {
  return comparableMetric(metric) ? metric.reported!.value - metric.planned!.value : null;
}
export function metricValue(value: number | null | undefined, unit: LibraryMetric["unit"]): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-EC", unit === "USD"
    ? { style: "currency", currency: "USD", maximumFractionDigits: 2 }
    : unit === "percent" ? { style: "percent", maximumFractionDigits: 1 }
    : { maximumFractionDigits: 0 }).format(value);
}
export function documentPathAllowed(path: string, companyId: string, campaignId: string, documentId: string): boolean {
  const prefix = `${companyId}/${campaignId}/${documentId}/`;
  return path.startsWith(prefix) && /^[a-zA-Z0-9_-]+\.(pdf|xlsx|pptx|png|jpg|webp)$/.test(path.slice(prefix.length));
}

