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

export function canWorkspaceRole(company: {role:string;portal_kind?:string;client_planning_enabled?:boolean}, action: CompanyAction): boolean {
 if(action==="read")return canCompanyRole(company.role,action);
 if(company.portal_kind==="client")return company.client_planning_enabled===true&&["planner","analyst"].includes(company.role)&&action!=="campaign:approve"&&canCompanyRole(company.role,action);
 return (company.portal_kind??"agency")==="agency"&&canCompanyRole(company.role,action);
}
