import { STACKADAPT_BREAKDOWN_QUERY, STACKADAPT_CAMPAIGN_SCOPE_QUERY, STACKADAPT_DASHBOARD_QUERY } from "./stackadapt-report-queries";
/** Fixed, read-only StackAdapt GraphQL operations. Credentials stay in the caller. */
export const STACKADAPT_ENDPOINT = "https://api.stackadapt.com/graphql";
export const STACKADAPT_CONNECTION_QUERY = `query OneStackAdaptConnection($after: String) {
  account { id currency }
  tokenInfo { expiresAt scopesByAdvertiser(first: 100, after: $after) {
    nodes { advertiser { id name isArchived } scopes }
    pageInfo { endCursor hasNextPage } totalCount
  } }
}`;
export const STACKADAPT_CAMPAIGNS_QUERY = `query OneStackAdaptCampaigns($advertiserIds: [ID!]!, $after: String) {
  campaigns(first: 100, after: $after, filterBy: {advertiserIds: $advertiserIds, archived: false}, sortBy: {field: NAME, order: ASC}) {
    nodes { id name advertiser { id } channelType campaignStatus { state status } }
    pageInfo { endCursor hasNextPage } totalCount
  }
}`;
export const STACKADAPT_REPORT_QUERY = `query OneStackAdaptReport($advertiserIds: [ID!]!, $date: DateRangeInput!) {
  campaignDelivery(dataType: TABLE, granularity: TOTAL, date: $date, filterBy: {advertiserIds: $advertiserIds}) {
    __typename
    ... on CampaignDeliveryOutcome { totalStats {
      cost impressionsBigint clicksBigint conversions videoCompletionsBigint
    } }
  }
}`;

export class StackAdaptError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 502) {
    super(message);
    this.name = "StackAdaptError";
  }
}
const invalid = () => new StackAdaptError("invalid_response", "StackAdapt devolvió una respuesta incompleta. Vuelve a verificar la conexión.");
type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as JsonObject;
}
function string(value: unknown): string {
  if (typeof value !== "string" || !value.length || value.length > 4096) throw invalid();
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw invalid();
  return value;
}
function id(value: unknown): string {
  const result = string(value);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(result)) throw invalid();
  return result;
}
export type StackAdaptConfig = { token: string; accountId: string };
export type StackAdaptAdvertiser = { id: string; name: string; canWrite: boolean };
export type StackAdaptConnection = {
  accountId: string; currency: string; checkedAt: string; expiresAt: string | null;
  advertisers: StackAdaptAdvertiser[];
};
export type StackAdaptCampaign = { id: string; name: string; channel: string; state: string; status: string };
export type StackAdaptCampaignPage = { campaigns: StackAdaptCampaign[]; total: number; nextCursor: string | null };
export type StackAdaptReport = {
  state: "ready" | "processing"; from: string; to: string;
  metrics: { cost: number | null; impressions: number | null; clicks: number | null; conversions: number | null; videoCompletions: number | null } | null;
};
export function stackAdaptConfig(env: Record<string, string | undefined>): StackAdaptConfig | null {
  const token = env.STACKADAPT_API_TOKEN?.trim();
  const accountId = env.STACKADAPT_ACCOUNT_ID?.trim();
  if (!token || !accountId) return null;
  if (token.length > 4096 || /[\s\x00-\x1f\x7f]/.test(token) || !/^[A-Za-z0-9_-]{1,128}$/.test(accountId)) {
    throw new StackAdaptError("invalid_config", "Revisa la configuración privada de StackAdapt.", 503);
  }
  return { token, accountId };
}

/** Reject redirects, oversized payloads, partial GraphQL errors and raw provider messages. */
export function stackAdaptReader(config: StackAdaptConfig, fetcher: typeof fetch = fetch) {
  return async (query: string, variables: Record<string, unknown>): Promise<JsonObject> => {
    if (![STACKADAPT_CONNECTION_QUERY, STACKADAPT_CAMPAIGNS_QUERY, STACKADAPT_REPORT_QUERY, STACKADAPT_CAMPAIGN_SCOPE_QUERY, STACKADAPT_DASHBOARD_QUERY, STACKADAPT_BREAKDOWN_QUERY].includes(query)) throw invalid();
    try {
      const response = await fetcher(STACKADAPT_ENDPOINT, {
        method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables }),
      });
      if (response.status === 401 || response.status === 403) throw new StackAdaptError("access_denied", "StackAdapt rechazó el acceso. Revisa la vigencia y los permisos de la llave.", 503);
      if (response.status === 429) throw new StackAdaptError("rate_limited", "StackAdapt alcanzó su límite de consultas. Inténtalo más tarde.", 429);
      if (!response.ok || !response.body) throw invalid();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "", length = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > 1_000_000) { await reader.cancel(); throw invalid(); }
          text += decoder.decode(value, { stream: true });
        }
      } finally { reader.releaseLock(); }
      const payload = object(JSON.parse(text + decoder.decode()));
      if (payload.errors !== undefined && (!Array.isArray(payload.errors) || payload.errors.length)) {
        throw new StackAdaptError("api_error", "StackAdapt no pudo completar la consulta. Revisa los permisos o vuelve a intentarlo.");
      }
      return object(payload.data);
    } catch (error) {
      if (error instanceof StackAdaptError) throw error;
      throw new StackAdaptError("unavailable", "No se pudo consultar StackAdapt. Vuelve a intentarlo.");
    }
  };
}
export type StackAdaptRead = ReturnType<typeof stackAdaptReader>;
function page(value: unknown) {
  const result = object(value), info = object(result.pageInfo);
  const more = boolean(info.hasNextPage);
  if (!Array.isArray(result.nodes) || result.nodes.length > 100 || !Number.isSafeInteger(result.totalCount) || Number(result.totalCount) < 0) throw invalid();
  return { nodes: result.nodes, total: Number(result.totalCount), nextCursor: more ? string(info.endCursor) : null };
}

export async function inspectStackAdapt(config: StackAdaptConfig, read: StackAdaptRead): Promise<StackAdaptConnection> {
  const advertisers = new Map<string, StackAdaptAdvertiser>();
  const cursors = new Set<string>();
  let after: string | null = null, currency = "", expiresAt: string | null = null;
  for (let index = 0; index < 20; index++) {
    const data = await read(STACKADAPT_CONNECTION_QUERY, { after });
    const account = object(data.account), token = object(data.tokenInfo);
    if (id(account.id) !== config.accountId) throw new StackAdaptError("account_mismatch", "La llave pertenece a otra cuenta de StackAdapt. Corrige la conexión antes de consultar campañas.", 503);
    currency = string(account.currency);
    if (!/^[A-Z]{3}$/.test(currency)) throw invalid();
    expiresAt = token.expiresAt === null ? null : string(token.expiresAt);
    if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) {
      throw new StackAdaptError("expired", "La llave de StackAdapt está vencida. Configura una llave vigente.", 503);
    }
    const scopes = page(token.scopesByAdvertiser);
    for (const item of scopes.nodes) {
      const entry = object(item), advertiser = object(entry.advertiser);
      const advertiserId = id(advertiser.id), name = string(advertiser.name), archived = boolean(advertiser.isArchived);
      if (!Array.isArray(entry.scopes) || entry.scopes.some(scope => scope !== "READ" && scope !== "WRITE")) throw invalid();
      if (!archived && entry.scopes.includes("READ")) advertisers.set(advertiserId, { id: advertiserId, name, canWrite: entry.scopes.includes("WRITE") });
    }
    if (!scopes.nextCursor) return { accountId: config.accountId, currency, expiresAt, checkedAt: new Date().toISOString(), advertisers: [...advertisers.values()] };
    if (cursors.has(scopes.nextCursor)) throw invalid();
    cursors.add(scopes.nextCursor);
    after = scopes.nextCursor;
  }
  throw new StackAdaptError("scope_limit", "La llave incluye demasiados anunciantes. Limita sus permisos a los anunciantes de esta operación.", 503);
}
export function assertStackAdaptAdvertiser(connection: StackAdaptConnection, advertiserId: string) {
  if (!connection.advertisers.some(item => item.id === advertiserId)) throw new StackAdaptError("advertiser_forbidden", "El anunciante no está autorizado por esta conexión.", 403);
}
export async function readStackAdaptCampaigns(read: StackAdaptRead, connection: StackAdaptConnection, advertiserId: string, after: string | null): Promise<StackAdaptCampaignPage> {
  assertStackAdaptAdvertiser(connection, advertiserId);
  if (after && (after.length > 4096 || /[\x00-\x1f]/.test(after))) throw new StackAdaptError("invalid_cursor", "La página solicitada no es válida.", 400);
  const result = page((await read(STACKADAPT_CAMPAIGNS_QUERY, { advertiserIds: [advertiserId], after })).campaigns);
  const campaigns = result.nodes.map(value => {
    const item = object(value), status = object(item.campaignStatus);
    if (id(object(item.advertiser).id) !== advertiserId) throw invalid();
    return { id: id(item.id), name: string(item.name), channel: string(item.channelType), state: string(status.state), status: string(status.status) };
  });
  return { campaigns, total: result.total, nextCursor: result.nextCursor };
}
export function stackAdaptDateRange(from: string, to: string) {
  for (const value of [from, to]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new StackAdaptError("invalid_dates", "Selecciona fechas válidas.", 400);
  }
  if (from > to || (Date.parse(to) - Date.parse(from)) / 86_400_000 > 92 || to > new Date().toISOString().slice(0, 10)) throw new StackAdaptError("invalid_dates", "Elige un período de hasta 93 días que termine hoy o antes.", 400);
  return { from, to };
}
function metric(value: unknown, integer = false): number | null {
  if (value === null || value === undefined) return null;
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value))) throw invalid();
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || result > Number.MAX_SAFE_INTEGER || (integer && !Number.isSafeInteger(result))) throw invalid();
  return result;
}
export async function readStackAdaptReport(read: StackAdaptRead, connection: StackAdaptConnection, advertiserId: string, from: string, to: string): Promise<StackAdaptReport> {
  assertStackAdaptAdvertiser(connection, advertiserId);
  const date = stackAdaptDateRange(from, to);
  const outcome = object((await read(STACKADAPT_REPORT_QUERY, { advertiserIds: [advertiserId], date })).campaignDelivery);
  if (outcome.__typename === "Progress") return { ...date, state: "processing", metrics: null };
  if (outcome.__typename !== "CampaignDeliveryOutcome") throw invalid();
  if (outcome.totalStats === null) return { ...date, state: "ready", metrics: null };
  const stats = object(outcome.totalStats);
  return { ...date, state: "ready", metrics: {
    cost: metric(stats.cost), impressions: metric(stats.impressionsBigint, true), clicks: metric(stats.clicksBigint, true),
    conversions: metric(stats.conversions), videoCompletions: metric(stats.videoCompletionsBigint, true),
  } };
}
