export type PortalKind = "agency" | "client" | "provider";
export const PORTAL_LABELS: Record<PortalKind, string> = { agency: "Agencia", client: "Cliente", provider: "Proveedor" };
export function portalKind(value: unknown): PortalKind { return value === "client" || value === "provider" ? value : "agency"; }
export function emailDomain(email: string): string | null {
 const match=/^[^\s@]+@([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)$/i.exec(email.trim());
 return match?.[1].toLowerCase() ?? null;
}
export function domainAllows(email: string, domains: string[]): boolean { const domain=emailDomain(email);return domain!==null&&domains.some(d=>d.toLowerCase()===domain); }
export function portalCapabilities(kind: PortalKind, role: string, isAdmin=false, clientPlanning=false) {
 const agency=isAdmin||kind==="agency", clientPlanner=kind==="client"&&clientPlanning&&["planner","analyst"].includes(role), provider=!isAdmin&&kind==="provider", reader=["admin","planner","analyst","approver","viewer"].includes(role);
 return { catalog:isAdmin||(!provider&&reader), reports:isAdmin||(!provider&&reader), plan:isAdmin||clientPlanner||(agency&&["admin","planner","analyst"].includes(role)), request:isAdmin||(clientPlanner&&role==="planner")||(agency&&["admin","planner"].includes(role)), approve:isAdmin||(agency&&["admin","approver"].includes(role)), providerEdit:provider&&["admin","planner"].includes(role), manageUsers:isAdmin };
}
