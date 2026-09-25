export type CompanyAction = "plan" | "campaign:create" | "campaign:approve" | "read";

const ACTION_ROLES: Record<CompanyAction, ReadonlySet<string>> = {
  read: new Set(["admin", "planner", "analyst", "approver", "viewer"]),
  plan: new Set(["admin", "planner", "analyst"]),
  "campaign:create": new Set(["admin", "planner"]),
  "campaign:approve": new Set(["admin", "approver"]),
};

export function canCompanyRole(role: string | null | undefined, action: CompanyAction): boolean {
  return Boolean(role && ACTION_ROLES[action].has(role));
}
