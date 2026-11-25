export type LiveReport = {
  id: string;
  client_key: string;
  client_name: string;
  client_logo: string | null;
  channel_key: string;
  channel_name: string;
  period: string;
  title: string;
  embed_url: string;
};
export type LiveReportSelection = { client?: string; channel?: string; report?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOGO = /^\/partners\/[a-z0-9-]+\/[a-z0-9-]+\.(?:png|webp|svg)$/;

/** Only a provider-generated embed URL is accepted, never arbitrary iframe HTML. */
export function lookerEmbedUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash
      || !["datastudio.google.com", "lookerstudio.google.com"].includes(url.hostname)
      || !/^\/embed\/reporting\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/page\/[a-zA-Z0-9_-]+$/.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}
export function lookerViewUrl(embed: string): string | null {
  const safe = lookerEmbedUrl(embed);
  return safe ? safe.replace("/embed/reporting/", "/reporting/") : null;
}
export function validLiveReport(value: unknown): value is LiveReport {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  const text = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
  return typeof r.id === "string" && UUID.test(r.id)
    && typeof r.client_key === "string" && SLUG.test(r.client_key) && r.client_key.length <= 80
    && typeof r.channel_key === "string" && SLUG.test(r.channel_key) && r.channel_key.length <= 80
    && text(r.client_name, 180) && text(r.channel_name, 100) && text(r.title, 240)
    && (r.client_logo === null || typeof r.client_logo === "string" && LOGO.test(r.client_logo))
    && typeof r.period === "string" && /^\d{4}-(?:0[1-9]|1[0-2])-01$/.test(r.period)
    && lookerEmbedUrl(r.embed_url) !== null;
}
export function reportPeriodLabel(period: string): string {
  const value = new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(period + "T12:00:00Z"));
  return (value.charAt(0).toUpperCase() + value.slice(1)).replace(" de ", " ");
}
/** Resolve the complete chain only against the reports already authorized by RLS. */
export function resolveLiveReportSelection(reports: LiveReport[], selection: LiveReportSelection) {
  const clientReports = reports.filter(r => r.client_key === selection.client);
  const channelReports = clientReports.filter(r => r.channel_key === selection.channel);
  const report = channelReports.find(r => r.id === selection.report);
  const invalid = Boolean(selection.client && !clientReports.length
    || selection.channel && (!selection.client || !channelReports.length)
    || selection.report && (!selection.channel || !report));
  return { client: clientReports[0], channel: channelReports[0], report, clientReports, channelReports, invalid };
}
export function liveReportHref(base: string, selection: LiveReportSelection): string {
  const [path, search = ""] = base.split("?");
  const params = new URLSearchParams(search);
  for (const key of ["client", "channel", "report"] as const) {
    const queryKey = base.startsWith("/consola/") ? "live" + key.charAt(0).toUpperCase() + key.slice(1) : key;
    params.delete(queryKey);
    if (selection[key]) params.set(queryKey, selection[key]!);
  }
  return path + (params.size ? "?" + params.toString() : "");
}
