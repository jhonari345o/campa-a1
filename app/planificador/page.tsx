import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import { getInfluencerCatalog, getMySavedPlans, getRadioCatalog } from "@/lib/media-workspace";
import type { CatalogSection } from "@/lib/media-catalog";
import { MediaCatalog } from "./MediaCatalog";
import { PlanForm } from "./PlanForm";
import { PlannerWorkspaceNav } from "./PlannerWorkspaceNav";
import { SavedPlans } from "./SavedPlans";

export const metadata = { title: "Planificador de medios" };

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default async function PlanificadorPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; section?: string }>;
}) {
  if (!supabaseConfigured) redirect("/consola");
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");
  const params = await searchParams;
  const view = params.view === "media" || params.view === "plans" ? params.view : "planner";
  const allowedSections = new Set<CatalogSection>(["tv", "radio", "ooh", "press", "digital", "influencers"]);
  const section = allowedSections.has(params.section as CatalogSection)
    ? params.section as CatalogSection
    : "digital";

  const [radio, influencers, plans] = await Promise.all([
    view === "media" ? getRadioCatalog() : Promise.resolve([]),
    view === "media" ? getInfluencerCatalog() : Promise.resolve([]),
    view === "plans" ? getMySavedPlans(profile.id) : Promise.resolve([]),
  ]);

  return (
    <div className="min-h-screen">
      <AppHeader
        name={profile.full_name ?? profile.email ?? "Ad Mavericks"}
        isAdmin={profile.is_platform_admin}
        active="planificador"
      />
      <main className={`mx-auto px-4 py-8 sm:px-6 ${view === "media" ? "max-w-[1500px]" : "max-w-6xl"}`}>
        <PlannerWorkspaceNav view={view} />
        {view === "media" ? (
          <MediaCatalog section={section} radio={radio} influencers={influencers} />
        ) : view === "plans" ? (
          <SavedPlans plans={plans} />
        ) : (
          <>
            <h1 className="text-3xl font-black tracking-tight">Planificador de medios</h1>
            <p className="mt-1 max-w-3xl text-muted">
              Completa el brief, revisa la recomendación y guarda un borrador privado.
              La plataforma recomienda; tu equipo conserva el control.
            </p>
            <div className="mt-8"><PlanForm /></div>
          </>
        )}
      </main>
    </div>
  );
}
