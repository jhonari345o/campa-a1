import type { WorkspaceIdentity } from "@/lib/workspace-brand";
import { PORTAL_LABELS } from "@/lib/portal-access";
import { WorkspaceClientBrand } from "./WorkspaceClientBrand";

export function WorkspaceBanner({ workspace }: { workspace: WorkspaceIdentity }) {
  return <div className="workspace-banner-slot">
    <section className={`workspace-banner workspace-banner--${workspace.brand}`} aria-label={`Espacio de trabajo de ${workspace.name}`}>
      <div className="workspace-banner-copy"><p>{PORTAL_LABELS[workspace.kind ?? "agency"]} · Tu espacio de trabajo</p><h2>{workspace.name}</h2><span>En Ad Mavericks One</span></div>
      <WorkspaceClientBrand workspace={workspace}/>
    </section>
  </div>;
}
