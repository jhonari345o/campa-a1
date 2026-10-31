import "server-only";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_LIBRARY, type CampaignLibrary } from "./campaign-library";
import { validCampaignLibrary } from "./campaign-library-validation";

/** All four reads use the caller's session. Never substitute a service-role client. */
export async function getCampaignLibrary(companyId?: string): Promise<{ library: CampaignLibrary; available: boolean }> {
  const db = await createClient();
  const filter = companyId ? { company_id: companyId } : {};
  const [clients, campaigns, documents, metrics] = await Promise.all([
    db.from("workspace_clients").select("id,name,category,campaign_kind").match(filter).order("name"),
    db.from("workspace_campaigns").select("id,client_id,name,period,status,poster,summary").match(filter).order("sort_order"),
    db.from("workspace_documents").select("id,campaign_id,title,kind,version,issued_on,downloadable,summary,sections").match(filter).order("issued_on", { ascending: false }),
    db.from("workspace_metrics").select("id,campaign_id,plan_document_id,report_document_id,label,unit,planned,reported").match(filter).order("sort_order"),
  ]);
  if ([clients, campaigns, documents, metrics].some(result => result.error)) return { library: EMPTY_LIBRARY, available: false };
  const library = {
      clients: (clients.data ?? []).map(c => ({ id: c.id, name: c.name, category: c.category, campaignKind: c.campaign_kind })),
      campaigns: (campaigns.data ?? []).map(c => ({ id: c.id, clientId: c.client_id, name: c.name, period: c.period, status: c.status, poster: c.poster, summary: c.summary })),
      documents: (documents.data ?? []).map(d => ({ id: d.id, campaignId: d.campaign_id, title: d.title, kind: d.kind, version: d.version, issuedOn: d.issued_on, downloadable: d.downloadable, summary: d.summary, sections: d.sections })),
      metrics: (metrics.data ?? []).map(m => ({ id: m.id, campaignId: m.campaign_id, planDocumentId: m.plan_document_id, reportDocumentId: m.report_document_id, label: m.label, unit: m.unit, planned: m.planned, reported: m.reported })),
  };
  return validCampaignLibrary(library) ? { available: true, library } : { available: false, library: EMPTY_LIBRARY };
}

