import Link from "next/link";
import { workspacePreviewHref } from "@/lib/workspace-preview";
import { MaviScene } from "./Mavi";
import { PORTAL_LABELS, portalCapabilities } from "@/lib/portal-access";
import type { WorkspaceIdentity } from "@/lib/workspace-brand";
import styles from "./WorkspaceHome.module.css";
import { personalGreeting } from "@/lib/personal-greeting";
export function WorkspaceHome({workspace,name,previewCompanyId}:{workspace:WorkspaceIdentity;name:string;previewCompanyId?:string}) {
 const kind=workspace.kind??"agency",cap=portalCapabilities(kind,workspace.role,false,workspace.clientPlanning);
 const tiles=kind==="agency"?[
 {href:"/planificador?view=planner",title:"Crea tu próximo plan",copy:"Define el brief y construye una recomendación para tu cliente.",icon:"↗",primary:true,show:cap.plan},
 {href:"/clientes",title:"Tus clientes y campañas",copy:"Consulta planes, avances y resultados en un solo lugar.",icon:"◫",show:cap.reports},
 {href:"/planificador?view=media&section=tv",title:"Explora el catálogo",copy:"Compara medios y reúne los productos de tu próxima campaña.",icon:"⊞",show:cap.catalog},
 {href:"/creditos",title:"Crédito y facturación",copy:"Revisa tu cupo mensual, compras y facturas pendientes.",icon:"◎",show:cap.request},
 ]:kind==="client"?[
 {href:"/planificador?view=planner",title:"Planifica tu próxima campaña",copy:"Completa el brief y explora una recomendación para tus objetivos.",icon:"↗",primary:true,show:cap.plan},
 {href:"/planificador?view=diy",title:"Arma tu plan a tu manera",copy:"Construye la combinación de medios, formatos y cantidades.",icon:"⊞",show:cap.plan},
 {href:"/reportes",title:"Así van tus campañas",copy:"Encuentra reportes, inversión ejecutada y resultados de tus medios.",icon:"↗",primary:true,show:cap.reports},
 {href:"/planificador?view=media&section=tv",title:"Descubre los medios",copy:"Explora formatos, coberturas y condiciones de tu catálogo.",icon:"⊞",show:cap.catalog},
 ]:[
 {href:"/proveedores",title:"Tus medios, al día",copy:"Presenta tus espacios, formatos, tarifas y disponibilidad.",icon:"↗",primary:true,show:true},
 {href:"/proveedores?tab=updates",title:"Comparte una novedad",copy:"Carga ofertas, promociones y actualizaciones para las agencias.",icon:"✧",show:true},
 ];
 return <main id="workspace-content" className="portal-page"><section className={styles.hero}><div><p>{PORTAL_LABELS[kind]} · Ad Mavericks One</p><h1>{personalGreeting(name,workspace.name)}</h1><span>{kind==="agency"?"Tu próxima campaña empieza aquí.":kind==="client"?"Tus medios y resultados, en un lugar.":"Todo lo que necesitan conocer de tus medios."}</span></div><MaviScene height={176} motion="float" className={styles.mavi}/></section>
 <section className={styles.tiles} aria-label="Accesos de tu espacio">{tiles.filter(t=>t.show).map(t=><Link key={t.href} href={previewCompanyId?workspacePreviewHref(previewCompanyId,t.href):t.href} className={t.primary?styles.primary:styles.tile}><span aria-hidden>{t.icon}</span><h2>{t.title}</h2><p>{t.copy}</p><strong>Explorar <span aria-hidden>→</span></strong></Link>)}</section>
 <aside className={styles.help}><strong>Trabaja con claridad.</strong><p>{kind==="client"?"Tu agencia coordina las solicitudes y contrataciones. Aquí puedes consultar tu catálogo y tus resultados.":kind==="provider"?"La información que publiques pertenece a tus medios. Cada actualización conserva su vigencia y condiciones.":"Los planes, acuerdos y reportes se organizan dentro del espacio de tu agencia."}</p></aside></main>;
}
