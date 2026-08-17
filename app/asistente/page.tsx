import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import { ChatMavi } from "./ChatMavi";

export const metadata = { title: "Pregunta a Mavi" };

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default async function AsistentePage() {
  if (!supabaseConfigured) redirect("/consola");
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");

  return (
    <div className="min-h-screen">
      <AppHeader
        name={profile.full_name ?? profile.email ?? "Ad Mavericks"}
        isAdmin={profile.is_platform_admin}
        active="asistente"
      />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-5 flex items-center gap-3">
          <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-signal/15 text-2xl">
            🦎
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Pregunta a Mavi</h1>
            <p className="text-sm text-muted">
              Tu guia de medios. Solo habla de publicidad, con datos de referencia del mercado.
            </p>
          </div>
        </div>
        <ChatMavi />
      </main>
    </div>
  );
}
