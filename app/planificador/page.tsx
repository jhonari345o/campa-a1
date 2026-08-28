import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import {
  getInfluencerCatalog,
  getMyPlanVersions,
  getMySavedPlan,
  getMySavedPlans,
  getOohLocationCatalog,
  getPlanCollaboration,
  getRadioCatalog,
  getCatalogHealth,
} from "@/lib/media-workspace";
import type { CatalogSection } from "@/lib/media-catalog";
import { DiyPlanner } from "./DiyPlanner";
import { MediaCatalog } from "./MediaCatalog";
import { PlanForm } from "./PlanForm";
import { PlanVersions } from "./PlanVersions";
import { SavedPlans } from "./SavedPlans";

export const metadata = { title: "Planificador de medios" };

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default async function PlanificadorPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; section?: string; plan?: string }>;
}) {
  if (!supabaseConfigured) redirect("/consola");
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");
  const params = await searchParams;
  const view = ["media", "plans", "diy", "versions"].includes(params.view ?? "")
    ? params.view!
    : "planner";
  const allowedSections = new Set<CatalogSection>(["tv", "radio", "ooh", "press", "digital", "influencers"]);
  const section = allowedSections.has(params.section as CatalogSection)
    ? params.section as CatalogSection
    : "digital";

  const catalogNeeded = view === "media" || view === "diy";
  const selectedPlanNeeded = (view === "planner" || view === "diy" || view === "versions") && Boolean(params.plan);
  const [radio, influencers, plans, selectedPlan, versions, oohLocations, collaboration, catalogHealth] = await Promise.all([
    catalogNeeded ? getRadioCatalog() : Promise.resolve([]),
    catalogNeeded ? getInfluencerCatalog() : Promise.resolve([]),
    view === "plans" ? getMySavedPlans(profile.id) : Promise.resolve([]),
    selectedPlanNeeded ? getMySavedPlan(profile.id, params.plan!) : Promise.resolve(null),
    view === "versions" && params.plan ? getMyPlanVersions(profile.id, params.plan) : Promise.resolve([]),
    view === "diy" ? getOohLocationCatalog() : Promise.resolve([]),
    view === "versions" && params.plan ? getPlanCollaboration(profile.id, params.plan) : Promise.resolve({ comments: [], approvals: [] }),
    view === "media" ? getCatalogHealth() : Promise.resolve(null),
  ]);

  return (
    <div className="min-h-screen">
      <AppHeader
        name={profile.full_name ?? profile.email ?? "Ad Mavericks"}
        isAdmin={profile.is_platform_admin}
        active="planificador"
        catalogSection={view === "media" ? section : undefined}
        title={view === "media"
          ? `Catálogo · ${sectionLabel(section)}`
          : view === "plans" ? "Planes guardados"
            : view === "diy" ? "Plan personalizado"
              : view === "versions" ? "Historial del plan"
                : "Planificador de medios"}
      />
      <main id="workspace-content" className={`portal-page ${view === "media" ? "portal-page-wide" : "portal-page-planner"}`}>
        {view === "media" ? (
          <MediaCatalog section={section} radio={radio} influencers={influencers} health={catalogHealth} />
        ) : view === "plans" ? (
          <SavedPlans plans={plans} />
        ) : view === "diy" ? (
          <DiyPlanner radio={radio} influencers={influencers} oohLocations={oohLocations} initialPlan={selectedPlan} />
        ) : view === "versions" ? (
          <PlanVersions plan={selectedPlan} versions={versions} comments={collaboration.comments} approvals={collaboration.approvals} />
        ) : (
          <>
            <h1 className="text-3xl font-black tracking-tight">Planificador de medios</h1>
            <p className="mt-1 max-w-3xl text-muted">
              Completa el brief, revisa la recomendación y guarda un borrador privado.
              La plataforma recomienda; tu equipo conserva el control.
            </p>
            <div className="mt-8"><PlanForm initialPlan={selectedPlan} /></div>
          </>
        )}
      </main>
    </div>
  );
}

function sectionLabel(section: CatalogSection): string {
  return ({
    tv: "Televisión",
    radio: "Radio",
    ooh: "Vía pública",
    press: "Prensa",
    digital: "Digital",
    influencers: "Influenciadores",
  } as const)[section];
}
