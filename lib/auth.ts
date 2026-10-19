import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  is_platform_admin: boolean;
};

/** Devuelve el usuario autenticado y su perfil, o null si no hay sesion. */
export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

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
  return profile as Profile;
}
