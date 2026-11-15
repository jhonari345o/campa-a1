import {AppHeader} from "./AppHeader";
import {ClientCampaignLibrary} from "./ClientCampaignLibrary";
import {MaviScene} from "./Mavi";
import {getPublishedCompanyReports} from "@/lib/company-reports-server";
import {portalCapabilities} from "@/lib/portal-access";
import {workspacePreviewHref} from "@/lib/workspace-preview";
import type {Profile} from "@/lib/auth";
export async function ClientReports({profile,previewCompanyId}:{profile:Profile;previewCompanyId?:string}){
 const library=profile.workspace?await getPublishedCompanyReports(profile.workspace.companyId):{clients:[],campaigns:[],documents:[],metrics:[]};
 const canPlan=portalCapabilities(profile.workspace?.kind??"client",profile.workspace?.role??"",profile.is_platform_admin,profile.workspace?.clientPlanning).plan;
 const catalogHref=previewCompanyId?workspacePreviewHref(previewCompanyId,"/planificador?view=media&section=tv"):"/planificador?view=media&section=tv";
 return <div className="min-h-screen"><AppHeader name={profile.full_name??profile.email??""} isAdmin={false} workspace={profile.workspace} active="reportes" previewCompanyId={previewCompanyId}/>
 <main id="workspace-content" className="portal-page library-page">{library.campaigns.length?<ClientCampaignLibrary canPlan={canPlan} preview={Boolean(previewCompanyId)} planClientContext={false} library={library} workspaceName={profile.workspace?.name??"Tus campañas"} brand={profile.workspace?.brand??"one"} available/>:<section className="rounded-panel border border-border bg-white p-10 shadow-panel"><div className="flex items-center gap-6"><MaviScene height={135} motion="float" className="w-24 shrink-0"/><div><p className="text-xs font-black uppercase tracking-widest text-signal-dark">Tu espacio de resultados</p><h1 className="mt-3 text-3xl font-black">Tus campañas, en perspectiva.</h1><p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">Aquí encontrarás los reportes que tu agencia comparta contigo, organizados por campaña.</p><a href={catalogHref} className="btn btn-primary mt-6">Explorar medios →</a></div></div></section>}</main></div>;
}
