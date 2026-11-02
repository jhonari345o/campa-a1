import { portalKind, type PortalKind } from "./portal-access";
export type WorkspaceIdentity = {
  companyId: string;
  name: string;
  role: string;
  brand: "one" | "lettera" | "ucsg" | "mobil";
  kind?: PortalKind;
  clientPlanning?:boolean;
};

/** Input must come from the authenticated membership query, never an email or URL. */
export function workspaceIdentity(
  companies: Array<{ id: string; name: string; role: string; status: string; brand_key?: string; portal_kind?: string;client_planning_enabled?:boolean }>,
  isPlatformAdmin: boolean,
): WorkspaceIdentity | null {
  if (isPlatformAdmin) return null;
  const active = companies.filter((company) => company.status === "activa");
  // No implicit tenant selection for a multi-company account.
  if (active.length !== 1) return null;
  const company = active[0];
  return { companyId: company.id, name: company.name, role: company.role,
    brand: company.brand_key === "mobil" ? "mobil" : company.brand_key === "ucsg" ? "ucsg" : company.brand_key === "lettera" ? "lettera" : "one", kind: portalKind(company.portal_kind), clientPlanning:company.portal_kind==="client"&&company.client_planning_enabled===true };
}
