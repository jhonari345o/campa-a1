import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import { PautarChat } from "./PautarChat";

export const metadata = { title: "Pautar con Mavi" };

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// El motor real se enciende cuando conectas Meta (token en el entorno).
const metaConectada = Boolean(process.env.META_ACCESS_TOKEN);

export default async function PautarPage() {
  if (!supabaseConfigured) redirect("/consola");
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");

  return (
    <div className="min-h-screen">
      <AppHeader
        name={profile.full_name ?? profile.email ?? "Ad Mavericks"}
        isAdmin={profile.is_platform_admin}
        active="pautar"
      />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-black tracking-tight">Pautar con Mavi</h1>
        <p className="mt-1 text-muted">
          Mavi te pide lo necesario y crea la orden de pauta. La sigues en "Mis campanas".
        </p>

        {!metaConectada && (
          <p className="mt-4 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm font-bold text-forest">
            🔌 Modo demostracion: tu orden queda guardada en la cola. La pauta saldra en vivo y las
            metricas seran reales cuando conectemos tu cuenta de Meta.
          </p>
        )}

        <div className="mt-6">
          <PautarChat />
        </div>
      </main>
    </div>
  );
}
