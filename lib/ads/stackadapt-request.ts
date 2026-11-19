import { inspectStackAdapt, readStackAdaptCampaigns, readStackAdaptReport, StackAdaptError, stackAdaptDateRange, stackAdaptReader, type StackAdaptConfig } from "./stackadapt";
import { readStackAdaptDashboard, readStackAdaptBreakdowns } from "./stackadapt-dashboard";

/** The authorization gate precedes configuration access and every provider request. */
export async function handleStackAdaptRequest(
  profile: { is_platform_admin: boolean } | null,
  params: URLSearchParams,
  getConfig: () => StackAdaptConfig | null,
  reader = stackAdaptReader,
) {
  if (!profile) return { status: 401, body: { error: "Inicia sesión para consultar el DSP." } };
  if (!profile.is_platform_admin) return { status: 403, body: { error: "Esta conexión está disponible para administradores de Ad Mavericks." } };
  try {
    const mode = params.get("mode") ?? "connection";
    const advertiserId = params.get("advertiserId") ?? "";
    if (!["connection", "campaigns", "report", "dashboard", "breakdowns"].includes(mode) || (mode !== "connection" && !/^[A-Za-z0-9_-]{1,128}$/.test(advertiserId))) {
      throw new StackAdaptError("invalid_request", "La consulta solicitada no es válida.", 400);
    }
    const from = params.get("from") ?? "", to = params.get("to") ?? "";
    if (["report", "dashboard", "breakdowns"].includes(mode)) stackAdaptDateRange(from, to);
    const campaignId = params.get("campaignId") || null;
    if (campaignId && !/^[A-Za-z0-9_-]{1,128}$/.test(campaignId)) throw new StackAdaptError("invalid_campaign", "Selecciona una campaña válida.", 400);
    const config = getConfig();
    if (!config) return { status: 200, body: { state: "unconfigured" as const } };
    const read = reader(config);
    const connection = await inspectStackAdapt(config, read);
    if (mode === "dashboard") return { status: 200, body: { state: "connected" as const, connection, dashboard: await readStackAdaptDashboard(read, connection, advertiserId, from, to, campaignId) } };
    if (mode === "breakdowns") return { status: 200, body: { state: "connected" as const, connection, breakdowns: await readStackAdaptBreakdowns(read, connection, advertiserId, from, to, campaignId) } };
    if (mode === "campaigns") return { status: 200, body: { state: "connected" as const, connection, page: await readStackAdaptCampaigns(read, connection, advertiserId, params.get("after")) } };
    if (mode === "report") return { status: 200, body: { state: "connected" as const, connection, report: await readStackAdaptReport(read, connection, advertiserId, from, to) } };
    return { status: 200, body: { state: "connected" as const, connection } };
  } catch (error) {
    return error instanceof StackAdaptError
      ? { status: error.status, body: { error: error.message, code: error.code } }
      : { status: 502, body: { error: "No se pudo completar la consulta de StackAdapt." } };
  }
}
