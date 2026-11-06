import type { CampaignLibrary } from "./campaign-library";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Obj = Record<string, unknown>;
function object(v: unknown): v is Obj { return !!v && typeof v === "object" && !Array.isArray(v); }
function text(v: unknown, max: number, required = true): v is string { return typeof v === "string" && v.length <= max && (!required || v.trim().length > 0); }
function uuid(v: unknown): v is string { return typeof v === "string" && UUID.test(v); }
function date(v: unknown) { return v === null || typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v; }
function measurement(v: unknown) {
  return v === null || object(v) && typeof v.value === "number" && Number.isFinite(v.value) && v.value >= 0
    && text(v.period, 120) && text(v.scope, 240) && text(v.basis, 240) && typeof v.estimated === "boolean";
}
/** Validate imports and database responses before showing any customer content. */
export function validCampaignLibrary(value: unknown): value is CampaignLibrary {
  if (!object(value)) return false;
  const { clients, campaigns, documents, metrics } = value;
  if (![clients, campaigns, documents, metrics].every(v => Array.isArray(v) && v.length <= 10000)) return false;
  const c = clients as unknown[], a = campaigns as unknown[], d = documents as unknown[], m = metrics as unknown[];
  const rows = [...c, ...a, ...d, ...m];
  if (!rows.every(v => object(v) && uuid(v.id)) || new Set(rows.map(v => (v as Obj).id)).size !== rows.length) return false;
  if (!c.every(v => object(v) && text(v.name, 180) && text(v.category, 180, false) && ["film", "campaign"].includes(v.campaignKind as string))) return false;
  const clientIds = new Set(c.map(v => (v as Obj).id));
  if (!a.every(v => object(v) && clientIds.has(v.clientId) && text(v.name, 240) && text(v.period, 120, false)
    && ["planning", "running", "reported"].includes(v.status as string) && text(v.summary, 2000, false)
    && (v.poster === null || typeof v.poster === "string" && /^\/postbuy\/warner\/posters\/[a-z0-9-]+\.jpg$/.test(v.poster)))) return false;
  const campaignIds = new Set(a.map(v => (v as Obj).id));
  if (!d.every(v => object(v) && campaignIds.has(v.campaignId) && text(v.title, 240) && ["plan", "report"].includes(v.kind as string)
    && text(v.version, 100, false) && date(v.issuedOn) && typeof v.downloadable === "boolean" && text(v.summary, 4000, false)
    && Array.isArray(v.sections) && v.sections.length <= 100 && v.sections.every(s => object(s) && text(s.title, 240)
      && Array.isArray(s.columns) && s.columns.length > 0 && s.columns.length <= 30 && s.columns.every(c => text(c, 240))
      && Array.isArray(s.rows) && s.rows.length <= 2000 && s.rows.every(r => Array.isArray(r) && r.length === (s.columns as unknown[]).length && r.every(c => text(c, 4000, false)))))) return false;
  const docs = new Map(d.map(v => [(v as Obj).id, v as Obj]));
  const reference = (id: unknown, campaign: unknown, kind: string) => id === null || docs.get(id)?.campaignId === campaign && docs.get(id)?.kind === kind;
  return m.every(v => object(v) && campaignIds.has(v.campaignId) && text(v.label, 180) && ["USD", "number", "percent"].includes(v.unit as string)
    && reference(v.planDocumentId, v.campaignId, "plan") && reference(v.reportDocumentId, v.campaignId, "report")
    && measurement(v.planned) && measurement(v.reported) && (v.planned !== null || v.reported !== null)
    && (v.planned === null || v.planDocumentId !== null) && (v.reported === null || v.reportDocumentId !== null));
}
