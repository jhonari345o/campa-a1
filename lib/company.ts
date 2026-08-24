import { createClient } from "@/lib/supabase/server";

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  planner: "Planificador",
  analyst: "Analista",
  approver: "Aprobador",
  viewer: "Lector",
};

export type MyCompany = {
  role: string;
  id: string;
  name: string;
  slug: string;
  status: string;
  seats: number;
  created_at: string;
};

export type TeamMember = {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
};

/** Empresas a las que pertenece el usuario, con su rol. */
export async function getMyCompanies(userId: string): Promise<MyCompany[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_members")
    .select("role, companies(id, name, slug, status, seats, created_at)")
    .eq("user_id", userId);

  return (data ?? [])
    .map((row) => {
      const c = row.companies as unknown as Omit<MyCompany, "role"> | null;
      if (!c) return null;
      return { role: row.role as string, ...c };
    })
    .filter((c): c is MyCompany => c !== null);
}

/** Equipo de una empresa (requiere migracion 0002 para ver perfiles del equipo). */
export async function getCompanyTeam(companyId: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_members")
    .select("user_id, role, profiles(full_name, email)")
    .eq("company_id", companyId);

  return (data ?? []).map((row) => {
    const p = row.profiles as unknown as { full_name: string | null; email: string | null } | null;
    return {
      user_id: row.user_id as string,
      role: row.role as string,
      full_name: p?.full_name ?? null,
      email: p?.email ?? null,
    };
  });
}
