import "server-only";
import { createClient } from "./supabase/server";
import { getMyCompanies } from "./company";
import type { Profile } from "./auth";
import { parseBrandProfile, parseSocialPeriod, type SocialWorkspace, type SocialCompany, type SocialAsset } from "./social-media";

export async function getSocialWorkspace(profile: Profile, requestedCompany?: string): Promise<SocialWorkspace> {
  const db = await createClient();
  let companies: SocialCompany[] = [];
  if (profile.is_platform_admin) {
    const { data } = await db.from("companies").select("id,name").eq("status", "activa").in("portal_kind", ["agency", "client"]).order("name");
    companies = (data ?? []).map(c => ({ ...c, canEdit: true, canApprove: true, canCreateClient: true }));
  } else {
    companies = (await getMyCompanies(profile.id)).filter(c => c.status === "activa" && c.portal_kind !== "provider").map(c => ({
      id: c.id, name: c.name,
      canEdit: c.portal_kind === "client" ? c.client_planning_enabled === true && c.role === "planner" : ["admin", "planner"].includes(c.role),
      canApprove: c.portal_kind !== "client" && ["admin", "approver"].includes(c.role),
      canCreateClient: c.portal_kind !== "client" && ["admin", "planner"].includes(c.role),
    }));
  }
  const companyId = companies.find(c => c.id === requestedCompany)?.id ?? (companies.length === 1 ? companies[0].id : "");
  const workspace: SocialWorkspace = { companies, companyId, clients: [], brands: {}, periods: [], assets: {}, available: true };
  if (!companyId) return workspace;
  const [clients, brands, periods, assets] = await Promise.all([
    db.from("workspace_clients").select("id,name,category").eq("company_id", companyId).order("name"),
    db.from("social_brands").select("client_id,profile,version").eq("company_id", companyId),
    db.from("social_periods").select("id,company_id,client_id,name,starts_on,ends_on,brief,posts,version").eq("company_id", companyId).order("starts_on", { ascending: false }),
    db.from("social_assets").select("id,client_id,kind,name,mime,size,created_at").eq("company_id", companyId).order("created_at", { ascending: false }),
  ]);
  if ([clients, brands, periods, assets].some(r => r.error)) return { ...workspace, available: false };
  workspace.clients = clients.data ?? [];
  for (const b of brands.data ?? []) { const parsed = parseBrandProfile(b.profile); if (parsed) workspace.brands[b.client_id] = { profile: parsed, version: b.version }; }
  for (const p of periods.data ?? []) { const parsed = parseSocialPeriod({ id: p.id, companyId: p.company_id, clientId: p.client_id, name: p.name, start: p.starts_on, end: p.ends_on, brief: p.brief, posts: p.posts, version: p.version }); if (parsed) workspace.periods.push(parsed); }
  for (const a of assets.data ?? []) (workspace.assets[a.client_id] ??= []).push({ id: a.id, kind: a.kind, name: a.name, mime: a.mime, size: a.size, createdAt: a.created_at } as SocialAsset);
  return workspace;
}
