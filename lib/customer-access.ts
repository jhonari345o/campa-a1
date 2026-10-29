export const CUSTOMER_ROLES = ["planner", "viewer"] as const;
export type CustomerRole = typeof CUSTOMER_ROLES[number];
export type CustomerInput = { companyId: string; fullName: string; email: string; role: CustomerRole };
export function parseCustomerInput(form: FormData): CustomerInput | null {
  const companyId = String(form.get("company_id") ?? "");
  const fullName = String(form.get("full_name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = String(form.get("role") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId)
    || fullName.length < 2 || fullName.length > 120 || email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !CUSTOMER_ROLES.includes(role as CustomerRole)) return null;
  return { companyId, fullName, email, role: role as CustomerRole };
}
