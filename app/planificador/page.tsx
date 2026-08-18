import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import { PlanForm } from "./PlanForm";

export const metadata = { title: "Planificador de medios" };

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default async function PlanificadorPage() {
  if (!supabaseConfigured) redirect("/consola");
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");

  return (
    <div className="min-h-screen">
      <AppHeader
        name={profile.full_name ?? profile.email ?? "Ad Mavericks"}
        isAdmin={profile.is_platform_admin}
        active="planificador"
      />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-black tracking-tight">Planificador de medios</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Arma un plan de medios para tu negocio. Nos basamos en cuanto invierten
          negocios similares del mercado para recomendarte una distribucion.
        </p>
        <div className="mt-8">
          <PlanForm />
        </div>
      </main>
    </div>
  );
}
