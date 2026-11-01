import { getBroadcastCatalog } from "@/lib/broadcast-server";
import { getOohCatalog } from "@/lib/ooh-server";
import { getRadioDirectory } from "@/lib/radio-directory-server";
import { getPressCatalog } from "@/lib/press-server";
import { getInfomediaCatalog } from "@/lib/infomedia-server";
import { getMyCompanies } from "@/lib/company";
import { canCompanyRole } from "@/lib/permissions";
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
  getCatalogHealth,
} from "@/lib/media-workspace";
import type { CatalogSection } from "@/lib/media-catalog";
import { DiyPlanner } from "./DiyPlanner";
import { MediaCatalog } from "./MediaCatalog";
import { PlanForm } from "./PlanForm";
import { PlanVersions } from "./PlanVersions";
import { SavedPlans } from "./SavedPlans";
import { catalogProducts } from "@/lib/catalog-shopping";
import { readCatalogCart, readOohPurchaseReferences } from "@/lib/catalog-shopping-server";

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
  const companies = await getMyCompanies(profile.id);
  const canApprove = profile.is_platform_admin || companies.some(c => c.status === "activa" && canCompanyRole(c.role, "campaign:approve"));
  const params = await searchParams;
  const view = ["media", "plans", "diy", "versions"].includes(params.view ?? "")
    ? params.view!
    : "planner";
  const allowedSections = new Set<CatalogSection>(["tv", "radio", "ooh", "press", "digital", "influencers"]);
  const section = allowedSections.has(params.section as CatalogSection)
    ? params.section as CatalogSection
    : "digital";

  const categoryCatalog = view === "planner" || view === "diy" ? await getInfomediaCatalog() : { categories: [] };
  const catalogNeeded = view === "media" || view === "diy";
  const selectedPlanNeeded = (view === "planner" || view === "diy" || view === "versions") && Boolean(params.plan);
  const [influencers, plans, selectedPlan, versions, oohLocations, collaboration, catalogHealth, broadcast, ooh, radioDirectory, press, shoppingCart, purchaseReferences] = await Promise.all([
    catalogNeeded ? getInfluencerCatalog() : Promise.resolve([]),
    view === "plans" ? getMySavedPlans(profile.id) : Promise.resolve([]),
    selectedPlanNeeded ? getMySavedPlan(profile.id, params.plan!) : Promise.resolve(null),
    view === "versions" && params.plan ? getMyPlanVersions(profile.id, params.plan) : Promise.resolve([]),
    view === "diy" ? getOohLocationCatalog() : Promise.resolve([]),
    view === "versions" && params.plan ? getPlanCollaboration(profile.id, params.plan) : Promise.resolve({ comments: [], approvals: [] }),
    view === "media" && section !== "tv" && section !== "radio" && section !== "press" ? getCatalogHealth() : Promise.resolve(null),
    catalogNeeded ? getBroadcastCatalog() : Promise.resolve({ sources: [], tv: [], radio: [] }),
    view === "diy" || view === "media" ? getOohCatalog() : Promise.resolve({ assets: [] }),
    view === "media" && section === "radio" ? getRadioDirectory() : Promise.resolve({ stations: [] }),
    view === "diy" || (view === "media" && section === "press") ? getPressCatalog() : Promise.resolve({ entries: [] }),
    view === "media" ? readCatalogCart() : Promise.resolve({ version: 0, items: [] }),
    view === "media" && section === "ooh" && profile.is_platform_admin ? readOohPurchaseReferences() : Promise.resolve([]),
  ]);

  return (
    <div className="min-h-screen">
      <AppHeader
        name={profile.full_name ?? profile.email ?? "Ad Mavericks"}
        isAdmin={profile.is_platform_admin} workspace={profile.workspace}
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
          <MediaCatalog broadcast={broadcast} ooh={ooh} radioDirectory={radioDirectory} press={press} section={section} influencers={influencers} health={catalogHealth} shoppingProducts={catalogProducts(influencers, ooh)} shoppingCart={shoppingCart} shoppingCompanies={companies.filter(c => c.status === "activa" && canCompanyRole(c.role, "campaign:create")).map(c => ({ id: c.id, name: c.name }))} canRequest={profile.is_platform_admin || companies.some(c => c.status === "activa" && canCompanyRole(c.role, "campaign:create"))} isAdmin={profile.is_platform_admin} purchaseReferences={purchaseReferences} />
        ) : view === "plans" ? (
          <SavedPlans plans={plans} />
        ) : view === "diy" ? (
          <DiyPlanner broadcast={broadcast} pressCatalog={press} oohCatalog={ooh} categoryCatalog={categoryCatalog} influencers={influencers} oohLocations={oohLocations} initialPlan={selectedPlan} />
        ) : view === "versions" ? (
          <PlanVersions canApprove={profile.is_platform_admin || companies.some(c => c.id === selectedPlan?.companyId && c.status === "activa" && canCompanyRole(c.role, "campaign:approve"))} plan={selectedPlan} versions={versions} comments={collaboration.comments} approvals={collaboration.approvals} />
        ) : (
          <>
            <h1 className="text-3xl font-black tracking-tight">Planificador de medios</h1>
            <p className="mt-1 max-w-3xl text-muted">
              Completa el brief, revisa la recomendación y guarda un borrador privado.
              La plataforma recomienda; tu equipo conserva el control.
            </p>
            <div className="mt-8"><PlanForm categoryCatalog={categoryCatalog} workspaceName={profile.workspace?.name} canApprove={canApprove} initialPlan={selectedPlan} /></div>
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
