import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ClientCampaignLibrary } from "@/components/ClientCampaignLibrary";
import { getSessionProfile } from "@/lib/auth";
import { getCampaignLibrary } from "@/lib/campaign-library-server";
export const metadata = { title: "Clientes y campañas" };
export const dynamic = "force-dynamic";
export default async function ClientsPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");
  const { library, available } = await getCampaignLibrary(profile.workspace?.companyId);
  return <div className="min-h-screen">
    <AppHeader name={profile.full_name ?? profile.email ?? ""} isAdmin={profile.is_platform_admin} workspace={profile.workspace} active="clientes" />
    <main id="workspace-content" className="portal-page library-page">
      <ClientCampaignLibrary library={library} workspaceName={profile.workspace?.name ?? "Clientes"} brand={profile.workspace?.brand ?? "one"} available={available} />
    </main>
  </div>;
}

