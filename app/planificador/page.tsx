import {catalogClientContext} from "@/lib/catalog-client-server";
import {CatalogClientSwitcher} from "./CatalogClientSwitcher";
import { getBroadcastCatalog } from "@/lib/broadcast-server";
import { getOohCatalog } from "@/lib/ooh-server";
import { getRadioDirectory } from "@/lib/radio-directory-server";
import { getPressCatalog } from "@/lib/press-server";
import { getInfomediaCatalog } from "@/lib/infomedia-server";
import { getMyCompanies } from "@/lib/company";
import { canWorkspaceRole } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { requestedWorkspaceClient } from "@/lib/client-navigation";
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
import { priceCatalogProducts } from "@/lib/catalog-access-server";
import { catalogProducts } from "@/lib/catalog-shopping";
import { readCatalogCart, readOohPurchaseReferences } from "@/lib/catalog-shopping-server";
import { catalogKindsFor } from "@/lib/catalog-loading";

export const metadata = { title: "Planificador de medios" };

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default async function PlanificadorPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; section?: string; plan?: string; client?: string }>;
}) {
  if (!supabaseConfigured) redirect("/consola");
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");
  if (!profile.is_platform_admin && !profile.workspace) redirect("/panel");
  const companies = await getMyCompanies(profile.id);
  const canApprove = profile.is_platform_admin || companies.some(c => c.status === "activa" && canWorkspaceRole(c, "campaign:approve"));
  const params = await searchParams;
  const view = ["media", "plans", "diy", "versions"].includes(params.view ?? "")
    ? params.view!
    : "planner";
  if (!profile.is_platform_admin && profile.workspace?.kind === "provider") redirect("/proveedores");
  if (!profile.is_platform_admin && profile.workspace?.kind === "client" && !profile.workspace.clientPlanning && view !== "media") redirect("/reportes");
  const allowedSections = new Set<CatalogSection>(["tv", "radio", "ooh", "press", "digital", "influencers"]);
  const section = allowedSections.has(params.section as CatalogSection)
    ? params.section as CatalogSection
    : "digital";
  const clientContext = await catalogClientContext();
  const requestedClient = requestedWorkspaceClient(clientContext?.clients ?? [], params.client);
  if (params.client && !requestedClient) notFound();

  const categoryCatalog = view === "planner" || view === "diy" ? await getInfomediaCatalog() : { categories: [] };
  const catalogNeeded = view === "media" || view === "diy";
  const selectedPlanNeeded = (view === "planner" || view === "diy" || view === "versions") && Boolean(params.plan);
  const shoppingCart = view === "media" ? await readCatalogCart() : {version:0,items:[]};
  const wantedKinds=catalogKindsFor(view,section,shoppingCart.items);
  const needs=(kind:typeof wantedKinds[number])=>wantedKinds.includes(kind);
  const [influencers, plans, selectedPlan, versions, oohLocations, collaboration, catalogHealth, broadcast, ooh, radioDirectory, press, purchaseReferences] = await Promise.all([
    needs("influencer") ? getInfluencerCatalog() : Promise.resolve([]),
    view === "plans" ? getMySavedPlans(profile.id, requestedClient?.id ?? clientContext?.selected?.id) : Promise.resolve([]),
    selectedPlanNeeded ? getMySavedPlan(profile.id, params.plan!) : Promise.resolve(null),
    view === "versions" && params.plan ? getMyPlanVersions(profile.id, params.plan) : Promise.resolve([]),
    view === "diy" ? getOohLocationCatalog() : Promise.resolve([]),
    view === "versions" && params.plan ? getPlanCollaboration(profile.id, params.plan) : Promise.resolve({ comments: [], approvals: [] }),
    view === "media" && section !== "tv" && section !== "radio" && section !== "press" ? getCatalogHealth() : Promise.resolve(null),
    needs("tv") || needs("radio") ? getBroadcastCatalog([...(needs("tv")?["tv" as const]:[]),...(needs("radio")?["radio" as const]:[])]) : Promise.resolve({ sources: [], tv: [], radio: [] }),
    needs("ooh") ? getOohCatalog() : Promise.resolve({ assets: [] }),
    needs("radio") ? getRadioDirectory() : Promise.resolve({ stations: [] }),
    needs("press") ? getPressCatalog() : Promise.resolve({ entries: [] }),
    view === "media" && section === "ooh" && profile.is_platform_admin ? readOohPurchaseReferences() : Promise.resolve([]),
  ]);

  if (selectedPlanNeeded && !selectedPlan) notFound();
  const savedClientId = typeof selectedPlan?.brief.clientId === "string" ? selectedPlan.brief.clientId : undefined;
  const savedClient = requestedWorkspaceClient(clientContext?.clients ?? [], savedClientId);
  if (clientContext && savedClientId && !savedClient) notFound();
  if (requestedClient && savedClientId && requestedClient.id !== savedClientId) notFound();
  const desiredClient = savedClient ?? requestedClient;
  const needsClient = Boolean(clientContext?.clients.length && (!clientContext.selected || (desiredClient && desiredClient.id !== clientContext.selected.id)));
  const shoppingProducts = catalogNeeded ? await priceCatalogProducts(catalogProducts(influencers, ooh, { broadcast, radio: radioDirectory, press }),undefined,undefined,wantedKinds) : [];
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
        {clientContext&&<CatalogClientSwitcher key={desiredClient?.id ?? clientContext.selected?.id ?? "choose"} {...clientContext} requestedClientId={desiredClient?.id}/>}
        {needsClient && view !== "plans" && view !== "versions" ? (
          <section className="rounded-2xl bg-forest p-6 text-white"><h1 className="text-xl font-bold">{desiredClient ? `Prepara tu plan para ${desiredClient.name}` : "Elige tu cliente"}</h1><p className="mt-2">Continúa con el cliente seleccionado para trabajar con sus tarifas y guardar el plan en su espacio.</p></section>
        ) : view === "media" ? (
          <MediaCatalog broadcast={section === "tv" || section === "radio" ? {...broadcast,sources:broadcast.sources.filter(source=>source.kind===section),tv:section==="tv"?broadcast.tv:[],radio:section==="radio"?broadcast.radio:[]} : {sources:[],tv:[],radio:[]}} ooh={section==="ooh"?ooh:{assets:[]}} radioDirectory={section==="radio"?radioDirectory:{stations:[]}} press={section==="press"?press:{entries:[]}} section={section} influencers={section==="influencers"?influencers:[]} health={catalogHealth} shoppingProducts={shoppingProducts} shoppingCart={shoppingCart} shoppingOwnerId={profile.id} shoppingCompanies={companies.filter(c => c.status === "activa" && canWorkspaceRole(c, "campaign:create")).map(c => ({ id: c.id, name: c.name }))} canPlan={profile.is_platform_admin || companies.some(c=>c.status==="activa"&&canWorkspaceRole(c,"plan"))} canRequest={profile.is_platform_admin || companies.some(c => c.status === "activa" && canWorkspaceRole(c, "campaign:create"))} isAdmin={profile.is_platform_admin} purchaseReferences={purchaseReferences} />
        ) : view === "plans" ? (
          <SavedPlans plans={plans} />
        ) : view === "diy" ? (
          <DiyPlanner key={selectedPlan?.id ?? clientContext?.selected?.id ?? "new"} initialClientName={clientContext?.selected?.name} workspaceProducts={shoppingProducts} broadcast={broadcast} pressCatalog={press} oohCatalog={ooh} categoryCatalog={categoryCatalog} influencers={influencers} oohLocations={oohLocations} initialPlan={selectedPlan} />
        ) : view === "versions" ? (
          <PlanVersions canApprove={profile.is_platform_admin || companies.some(c => c.id === selectedPlan?.companyId && c.status === "activa" && canWorkspaceRole(c, "campaign:approve"))} plan={selectedPlan} versions={versions} comments={collaboration.comments} approvals={collaboration.approvals} />
        ) : (
          <>
            <h1 className="text-3xl font-black tracking-tight">Planificador de medios</h1>
            <p className="mt-1 max-w-3xl text-muted">
              Completa el brief, revisa la recomendación y guarda un borrador privado.
              La plataforma recomienda; tu equipo conserva el control.
            </p>
            <div className="mt-8"><PlanForm key={selectedPlan?.id ?? clientContext?.selected?.id ?? "new"} initialClientName={clientContext?.selected?.name} categoryCatalog={categoryCatalog} workspaceName={profile.workspace?.name} canApprove={canApprove} initialPlan={selectedPlan} /></div>
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
