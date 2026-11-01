import { getMyCompanies } from "@/lib/company";
import { redirect } from "next/navigation";
import { workspaceIdentity, type WorkspaceIdentity } from "@/lib/workspace-brand";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  is_platform_admin: boolean;
  workspace?: WorkspaceIdentity | null;
};

/** Devuelve el usuario autenticado y su perfil, o null si no hay sesion. */
export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (user.app_metadata?.must_change_password === true) redirect("/cuenta/activar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return {
      id: user.id,
      full_name: null,
      email: user.email ?? null,
      is_platform_admin: false,
    };
  }
  const companies = profile.is_platform_admin ? [] : await getMyCompanies(user.id);
  const { data: preferences } = await supabase.from("account_preferences").select("display_name").eq("user_id", user.id).maybeSingle();
  return { ...profile, full_name: preferences?.display_name?.trim() || profile.full_name?.trim() || null, workspace: workspaceIdentity(companies, profile.is_platform_admin) } as Profile;
}
