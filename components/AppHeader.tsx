"use client";

import Image from "next/image";
import { workspacePreviewHref } from "@/lib/workspace-preview";
import type { WorkspaceIdentity } from "@/lib/workspace-brand";
import { portalCapabilities, PORTAL_LABELS } from "@/lib/portal-access";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "./Wordmark";
import { cerrarSesion } from "@/app/consola/actions";
import { MaviFloatingAssistant } from "./MaviFloatingAssistant";

type ActivePage = "mercado" | "consola" | "panel" | "asistente" | "planificador" | "campanas" | "pautar" | "reportes" | "laboratorio" | "clientes";

type AppHeaderProps = {
  workspace?: WorkspaceIdentity | null;
  previewCompanyId?: string;
  name: string;
  isAdmin: boolean;
  active?: ActivePage;
  title?: string;
  catalogSection?: "tv" | "radio" | "ooh" | "press" | "digital" | "influencers";
};

const CREATION = [
  { number: "01", label: "Inicio", href: "/panel", id: "panel" },
  { number: "02", label: "Planificador", href: "/planificador?view=planner", id: "planificador" },
  { number: "03", label: "Planes guardados", href: "/planificador?view=plans", id: "plans" },
  { number: "04", label: "Laboratorio creativo", href: "/laboratorio", id: "laboratorio" },
  { number: "05", label: "Centro Mavi", href: "/asistente", id: "asistente" },
] as const;

const CATALOG = [
  { mark: "TV", label: "Televisión", detail: "Canales y grupos", id: "tv" },
  { mark: "RA", label: "Radio", detail: "Cobertura y rankings", id: "radio" },
  { mark: "VP", label: "Vía pública", detail: "Proveedores e inventario", id: "ooh" },
  { mark: "PR", label: "Prensa", detail: "Medios por cobertura", id: "press" },
  { mark: "DI", label: "Digital", detail: "Plataformas y objetivos", id: "digital" },
  { mark: "IN", label: "Influenciadores", detail: "Perfiles por categoría", id: "influencers" },
] as const;

const PAGE_TITLES: Record<ActivePage, string> = {
  panel: "Inicio",
  planificador: "Planificador de medios",
  pautar: "Pautar con Mavi",
  campanas: "Órdenes y campañas",
  asistente: "Mavi",
  mercado: "Inteligencia de mercado",
  consola: "Consola de administración",
  reportes: "Reportes",
  laboratorio: "Laboratorio creativo",
  clientes: "Clientes y campañas",
};

export function AppHeader({ name, isAdmin, active = "panel", title, catalogSection, workspace, previewCompanyId }: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  const link=(href:string)=>previewCompanyId?workspacePreviewHref(previewCompanyId,href):href;
  const displayTitle = title ?? PAGE_TITLES[active];
  const initial = (name.trim()[0] || "A").toUpperCase();
  const kind = workspace?.kind ?? "agency";
  const capabilities = portalCapabilities(kind, workspace?.role ?? "", isAdmin, workspace?.clientPlanning);

  return (
    <>
      <a href="#workspace-content" className="portal-skip-link">Saltar al contenido principal</a>
      <aside data-workspace-brand={workspace?.brand ?? "one"} data-portal-kind={kind} data-catalog-selection={capabilities.request ? "enabled" : "disabled"} className={`portal-sidebar ${menuOpen ? "is-open" : ""}`} aria-label="Navegación principal">
        <button type="button" className="portal-sidebar-close" onClick={close} aria-label="Cerrar menú">×</button>
        <Link href={link("/panel")} onClick={close} className="portal-sidebar-brand" aria-label={`Ir al inicio de ${workspace?.name ?? "Ad Mavericks One"}`}>
          {workspace?.brand === "lettera"
            ? <Image src="/partners/lettera/lettera-logo.png" width={2048} height={493} alt="Léttera" className="workspace-lettera-logo" priority />
            : workspace?.brand === "ucsg" ? <Image src="/partners/ucsg/ucsg-logo.png" width={534} height={132} alt="UCSG · Universidad Católica de Santiago de Guayaquil" className="workspace-ucsg-logo" priority /> : <Wordmark one invert className="text-[18px]" />}
        </Link>
        <span className="portal-private-badge">{workspace ? PORTAL_LABELS[kind] : "Administración"}</span>

        <div className="portal-sidebar-scroll">
          <nav className="portal-nav" aria-label="Creación y gestión">
            {capabilities.reports && <Link href={link(kind === "client" ? "/reportes" : "/clientes")} onClick={close} className={`portal-nav-item ${active === "clientes" ? "is-active" : ""}`}><span>↗</span><strong>{kind === "client" ? "Mis campañas" : "Clientes y campañas"}</strong></Link>}
            {CREATION.filter(item => item.id === "panel" || capabilities.plan).map((item) => {
              const showingSavedPlans = Boolean(title?.toLocaleLowerCase("es").includes("guardado"));
              const selected = item.id === "plans"
                ? showingSavedPlans
                : item.id === "planificador"
                  ? active === "planificador" && !showingSavedPlans
                  : active === item.id;
              return (
                <Link key={item.id} href={link(item.href)} onClick={close} className={`portal-nav-item ${selected ? "is-active" : ""}`}>
                  <span>{item.number}</span><strong>{item.label}</strong>
                </Link>
              );
            })}
            {(kind === "agency" || capabilities.request) && capabilities.reports && <Link href="/campanas" onClick={close} className={`portal-nav-item ${active === "campanas" ? "is-active" : ""}`}><span>06</span><strong>Órdenes</strong></Link>}
            {kind === "client" ? <Link href={link("/reportes")} onClick={close} className={`portal-nav-item ${active === "reportes" ? "is-active" : ""}`}><span>↗</span><strong>Reportes</strong></Link> : capabilities.reports && workspace?.brand !== "lettera" && <ReportNavigationItem active={active === "reportes"} isAdmin={isAdmin} onClick={close} />}
            {kind === "provider" && <Link href="/proveedores" onClick={close} className="portal-nav-item"><span>↗</span><strong>Mis medios y novedades</strong></Link>}
            {kind === "agency" && capabilities.request && <Link href="/creditos" onClick={close} className="portal-nav-item"><span>◎</span><strong>Crédito y facturación</strong></Link>}
          </nav>

          {capabilities.catalog && <nav className="portal-catalog-nav" aria-label="Catálogo general de medios">
            <div className="portal-catalog-title"><span>Explorar inventario</span><strong>CATÁLOGO GENERAL</strong><b>−</b></div>
            {CATALOG.map((item) => (
              <Link
                key={item.id}
                href={link(`/planificador?view=media&section=${item.id}`)}
                onClick={close}
                className={`portal-catalog-link ${catalogSection === item.id ? "is-active" : ""}`}
              >
                <span>{item.mark}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div>
              </Link>
            ))}
          </nav>}

          {capabilities.plan && <Link href="/planificador?view=diy" onClick={close} className="portal-custom-plan-link">
            <span>Configura medio por medio</span><strong>CREA EL PLAN A TU MANERA</strong><b>→</b>
          </Link>}

          <nav className="portal-utility-nav" aria-label="Herramientas de la cuenta">
            {capabilities.request && <Link href="/pautar" onClick={close}>Pautar con Mavi</Link>}
            {capabilities.reports && kind === "agency" && <Link href="/campanas" onClick={close}>Campañas</Link>}
            {isAdmin && <Link href="/mercado" onClick={close}>Inteligencia de mercado</Link>}
            {isAdmin && <Link href="/consola" onClick={close}>Administración</Link>}
          </nav>
        </div>

        <div className="portal-sidebar-foot">
          <p>Espacio privado</p><strong>{workspace?.name ?? "Ad Mavericks"}</strong><span>{workspace ? "Con tecnología de Ad Mavericks One" : "Comprador autorizado · Datos controlados"}</span>
        </div>
      </aside>

      {menuOpen && <button type="button" className="portal-sidebar-backdrop" onClick={close} aria-label="Cerrar menú" />}

      <header className="portal-topbar">
        <button type="button" className="portal-menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú" aria-expanded={menuOpen}>
          <span /><span /><span />
        </button>
        <div className="portal-topbar-copy"><p>{workspace?.name ?? "Ad Mavericks One"}</p><strong>{displayTitle}</strong></div>
        <div className="portal-topbar-account">
          <span className="portal-license-pill"><i />Licencia activa</span>
          <details className="portal-account-menu">
            <summary aria-label={`Abrir menú de cuenta de ${name}`}><span>{initial}</span><b>{name}</b><i>⌄</i></summary>
            <div>
              <strong>{name}</strong>
              <small>{isAdmin ? "Administrador de plataforma" : workspace?.role === "planner" ? "Planificador" : "Usuario autorizado"}</small>
              <p>{workspace?.name ?? "Ad Mavericks One"} · espacio privado</p>
              {previewCompanyId?<Link href="/consola">Volver a administración</Link>:<form action={cerrarSesion}><button type="submit">Cerrar sesión</button></form>}
            </div>
          </details>
        </div>
      </header>
      {!previewCompanyId && <MaviFloatingAssistant />}
    </>
  );
}

function ReportNavigationItem({ active, isAdmin, onClick }: { active: boolean; isAdmin: boolean; onClick: () => void }) {
  const [enabled, setEnabled] = useState(isAdmin);
  useEffect(() => {
    if (isAdmin) return;
    fetch("/api/account/campaign-status", { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setEnabled(Boolean(data?.hasCampaigns)))
      .catch(() => setEnabled(false));
  }, [isAdmin]);
  return enabled
    ? <Link href="/reportes" onClick={onClick} className={`portal-nav-item ${active ? "is-active" : ""}`}><span>07</span><strong>Reportes</strong></Link>
    : <span className="portal-nav-item is-disabled"><span>07</span><strong>Reportes</strong><em>Tras tu primera campaña</em></span>;
}
