import { assertStackAdaptAdvertiser, stackAdaptDateRange, StackAdaptError, type StackAdaptConnection, type StackAdaptRead } from "./stackadapt";
import { STACKADAPT_BREAKDOWN_QUERY, STACKADAPT_CAMPAIGN_SCOPE_QUERY, STACKADAPT_DASHBOARD_QUERY } from "./stackadapt-report-queries";

export type DeliveryMetrics = { cost: number | null; impressions: number | null; clicks: number | null; conversions: number | null; videoCompletions: number | null; uniqueImpressions: number | null; frequency: number | null };
export type DeliveryDay = { date: string; metrics: DeliveryMetrics | null };
export type DeliveryCampaign = { id: string; name: string; channel: string; metrics: DeliveryMetrics };
export type StackAdaptDashboard = {
  state: "ready" | "processing"; advertiserId: string; campaignId: string | null; from: string; to: string; updatedAt: string;
  metrics: DeliveryMetrics | null; daily: DeliveryDay[]; dailyComplete: boolean; campaigns: DeliveryCampaign[];
};
export type BreakdownRow = { id: string; name: string; impressions: number | null; clicks: number | null };
export type DeliveryBreakdown = { state: "ready" | "processing"; rows: BreakdownRow[] };
export type StackAdaptBreakdowns = { advertiserId: string; campaignId: string | null; from: string; to: string; devices: DeliveryBreakdown; regions: DeliveryBreakdown };
const invalid = () => new StackAdaptError("invalid_report", "StackAdapt no pudo completar el desglose del reporte. Vuelve a intentarlo.");
function obj(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(); return value as Record<string, unknown>; }
function str(value: unknown) { if (typeof value !== "string" || !value.length || value.length > 4096) throw invalid(); return value; }
function num(value: unknown, integer = false): number | null {
  if (value == null) return null;
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value))) throw invalid();
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || result > Number.MAX_SAFE_INTEGER || (integer && !Number.isSafeInteger(result))) throw invalid();
  return result;
}
function metrics(value: unknown): DeliveryMetrics {
  const s = obj(value);
  return { cost: num(s.cost), impressions: num(s.impressionsBigint, true), clicks: num(s.clicksBigint, true), conversions: num(s.conversions), videoCompletions: num(s.videoCompletionsBigint, true), uniqueImpressions: num(s.uniqueImpressionsBigint, true), frequency: num(s.frequency) };
}
function page(value: unknown) {
  const p = obj(value), info = obj(p.pageInfo);
  if (!Array.isArray(p.nodes) || p.nodes.length > 100 || typeof info.hasNextPage !== "boolean") throw invalid();
  return { nodes: p.nodes, next: info.hasNextPage ? str(info.endCursor) : null };
}
function campaignScope(value: unknown, advertiserId: string, campaignId: string | null) {
  const campaign = obj(value), id = str(campaign.id);
  if (obj(campaign.advertiser).id !== advertiserId || (campaignId && id !== campaignId)) throw invalid();
  return campaign;
}
async function filterFor(read: StackAdaptRead, connection: StackAdaptConnection, advertiserId: string, campaignId: string | null) {
  assertStackAdaptAdvertiser(connection, advertiserId);
  if (campaignId) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(campaignId)) throw new StackAdaptError("invalid_campaign", "Selecciona una campaña válida.", 400);
    const data = await read(STACKADAPT_CAMPAIGN_SCOPE_QUERY, { id: campaignId });
    if (!data.campaign || obj(data.campaign).id !== campaignId || obj(obj(data.campaign).advertiser).id !== advertiserId) throw new StackAdaptError("campaign_forbidden", "La campaña no pertenece al anunciante seleccionado.", 403);
  }
  return { advertiserIds: [advertiserId], ...(campaignId ? { ids: [campaignId] } : {}) };
}
const additive = ["cost", "impressions", "clicks", "conversions", "videoCompletions"] as const;
function completeDays(rows: DeliveryDay[], total: DeliveryMetrics | null, from: string, to: string) {
  const reconciled = !!total && additive.every(key => total[key] == null || rows.every(row => row.metrics?.[key] != null) && Math.abs(rows.reduce((sum, row) => sum + (row.metrics?.[key] ?? 0), 0) - total[key]!) < (key === "cost" ? .01 : .0001));
  const byDate = new Map(rows.map(row => [row.date, row]));
  const days: DeliveryDay[] = [];
  for (let time = Date.parse(from); time <= Date.parse(to); time += 86_400_000) {
    const date = new Date(time).toISOString().slice(0, 10);
    days.push(byDate.get(date) ?? { date, metrics: reconciled ? { cost: total!.cost == null ? null : 0, impressions: total!.impressions == null ? null : 0, clicks: total!.clicks == null ? null : 0, conversions: total!.conversions == null ? null : 0, videoCompletions: total!.videoCompletions == null ? null : 0, uniqueImpressions: null, frequency: null } : null });
  }
  return { daily: days, dailyComplete: reconciled };
}
export async function readStackAdaptDashboard(read: StackAdaptRead, connection: StackAdaptConnection, advertiserId: string, from: string, to: string, campaignId: string | null = null): Promise<StackAdaptDashboard> {
  const date = stackAdaptDateRange(from, to), filter = await filterFor(read, connection, advertiserId, campaignId);
  const base = { ...date, advertiserId, campaignId, updatedAt: new Date().toISOString() };
  const pending: StackAdaptDashboard = { ...base, state: "processing", metrics: null, daily: [], dailyComplete: false, campaigns: [] };
  let after: string | null = null, total: DeliveryMetrics | null = null;
  const cursors = new Set<string>(), campaignIds = new Set<string>(), dayIds = new Set<string>();
  const campaigns: DeliveryCampaign[] = [], days: DeliveryDay[] = [];
  for (let index = 0; index < 20; index++) {
    const data = await read(STACKADAPT_DASHBOARD_QUERY, { filter, date, after, includeDaily: index === 0 });
    const summary = obj(data.summary);
    if (summary.__typename === "Progress") return pending;
    if (summary.__typename !== "CampaignDeliveryOutcome") throw invalid();
    const currentTotal = summary.totalStats == null ? null : metrics(summary.totalStats);
    if (index === 0) total = currentTotal;
    else if (JSON.stringify(total) !== JSON.stringify(currentTotal)) throw new StackAdaptError("report_changed", "La entrega se actualizó durante la consulta. Actualiza el reporte.");
    const records = page(summary.records);
    for (const value of records.nodes) {
      const row = obj(value), c = campaignScope(row.campaign, advertiserId, campaignId), id = str(c.id);
      if (campaignIds.has(id)) throw invalid();
      campaignIds.add(id);
      campaigns.push({ id, name: str(c.name), channel: str(c.channelType), metrics: metrics(row.metrics) });
    }
    if (index === 0) {
      const daily = obj(data.daily);
      if (daily.__typename === "Progress") return pending;
      if (daily.__typename !== "CampaignDeliveryOutcome") throw invalid();
      const records = page(daily.records);
      if (records.next || records.nodes.length > 93) throw invalid();
      for (const value of records.nodes) {
        const row = obj(value), granularity = obj(row.granularity), day = str(granularity.time);
        if (granularity.type !== "DAILY" || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day || day < from || day > to || dayIds.has(day)) throw invalid();
        dayIds.add(day); days.push({ date: day, metrics: metrics(row.metrics) });
      }
    }
    if (!records.next) {
      if (num(obj(summary.records).totalCount, true) !== campaigns.length) throw invalid();
      return { ...base, state: "ready", metrics: total, ...completeDays(days, total, from, to), campaigns: campaigns.sort((a, b) => (b.metrics.cost ?? 0) - (a.metrics.cost ?? 0)) };
    }
    if (cursors.has(records.next)) throw invalid();
    cursors.add(records.next); after = records.next;
  }
  throw new StackAdaptError("report_limit", "Este reporte tiene demasiadas campañas. Selecciona una campaña o acorta el período.", 400);
}

const devices: Record<string, string> = { MOBILE_APP: "Aplicaciones móviles", MOBILE_WEB: "Web móvil", DESKTOP: "Computadoras", TABLET: "Tabletas", CTV: "TV conectada", CONNECTED_TV: "TV conectada" };
async function breakdown(read: StackAdaptRead, filter: Record<string, unknown>, date: { from: string; to: string }, advertiserId: string, campaignId: string | null, dimension: "devices" | "regions"): Promise<DeliveryBreakdown> {
  let after: string | null = null;
  const rows = new Map<string, BreakdownRow>(), cursors = new Set<string>(), seen = new Set<string>();
  for (let index = 0; index < 20; index++) {
    const data = await read(STACKADAPT_BREAKDOWN_QUERY, { filter, date, attributes: dimension === "devices" ? ["DEVICE_TYPE"] : ["COUNTRY", "REGION"], after });
    const outcome = obj(data.campaignInsight);
    if (outcome.__typename === "Progress") return { state: "processing", rows: [] };
    if (outcome.__typename !== "CampaignInsightOutcome") throw invalid();
    const records = page(outcome.records);
    for (const value of records.nodes) {
      const row = obj(value), c = campaignScope(row.campaign, advertiserId, campaignId), a = obj(row.attributes), m = obj(row.metrics);
      const country = a.country == null ? null : obj(a.country), region = a.region == null ? null : obj(a.region);
      const id = dimension === "devices" ? a.deviceType == null ? "UNKNOWN" : str(a.deviceType) : `${country ? str(country.code) : "unknown"}:${region ? str(region.code) : "unknown"}`;
      const name = dimension === "devices" ? devices[id] ?? (id === "UNKNOWN" ? "Sin identificar" : id) : region ? str(region.name) : country ? `${str(country.name)} · Sin región` : "Sin identificar";
      const key = `${str(c.id)}:${id}`;
      if (seen.has(key)) throw invalid();
      seen.add(key);
      const impressions = num(m.impressions, true), clicks = num(m.clicks, true), previous = rows.get(id);
      const add = (left: number | null, right: number | null) => left == null || right == null ? null : num(left + right, true);
      rows.set(id, { id, name, impressions: previous ? add(previous.impressions, impressions) : impressions, clicks: previous ? add(previous.clicks, clicks) : clicks });
    }
    if (!records.next) return { state: "ready", rows: [...rows.values()].sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0)) };
    if (cursors.has(records.next)) throw invalid();
    cursors.add(records.next); after = records.next;
  }
  throw new StackAdaptError("breakdown_limit", "El desglose es demasiado amplio. Acorta el período o selecciona una campaña.", 400);
}
export async function readStackAdaptBreakdowns(read: StackAdaptRead, connection: StackAdaptConnection, advertiserId: string, from: string, to: string, campaignId: string | null = null): Promise<StackAdaptBreakdowns> {
  const date = stackAdaptDateRange(from, to), filter = await filterFor(read, connection, advertiserId, campaignId);
  const [devices, regions] = await Promise.all([breakdown(read, filter, date, advertiserId, campaignId, "devices"), breakdown(read, filter, date, advertiserId, campaignId, "regions")]);
  return { ...date, advertiserId, campaignId, devices, regions };
}
