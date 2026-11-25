import "server-only";
import { createClient } from "./supabase/server";
import { getSessionProfile } from "./auth";
import { validLiveReport, type LiveReport } from "./live-reports";

export async function getLiveReports(previewCompanyId?: string): Promise<{ reports: LiveReport[]; available: boolean }> {
  const profile = await getSessionProfile();
  if (!profile || !profile.is_platform_admin && profile.workspace?.kind === "provider") return { reports: [], available: false };
  if (previewCompanyId && !profile.is_platform_admin) return { reports: [], available: false };
  const db = await createClient();
  let query = db.from("live_reports").select("id,client_key,client_name,client_logo,channel_key,channel_name,period,title,embed_url").eq("published", true).order("period", { ascending: false });
  if (previewCompanyId) {
    const access = await db.from("live_report_access").select("report_id").eq("company_id", previewCompanyId).eq("enabled", true);
    if (access.error) return { reports: [], available: false };
    const ids = [...new Set((access.data ?? []).map(row => row.report_id))];
    if (!ids.length) return { reports: [], available: true };
    query = query.in("id", ids);
  }
  // The session-bound client enforces per-user, per-workspace grants in Postgres.
  const { data, error } = await query;
  if (error) return { reports: [], available: false };
  return { reports: (data ?? []).filter(validLiveReport), available: true };
}
