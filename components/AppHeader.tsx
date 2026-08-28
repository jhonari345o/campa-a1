"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "./Wordmark";
import { cerrarSesion } from "@/app/consola/actions";
import { MaviFloatingAssistant } from "./MaviFloatingAssistant";

type ActivePage = "mercado" | "consola" | "panel" | "asistente" | "planificador" | "campanas" | "pautar" | "reportes" | "laboratorio";

type AppHeaderProps = {
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
};

export function AppHeader({ name, isAdmin, active = "panel", title, catalogSection }: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  const displayTitle = title ?? PAGE_TITLES[active];
  const initial = (name.trim()[0] || "A").toUpperCase();

  return (
    <>
      <a href="#workspace-content" className="portal-skip-link">Saltar al contenido principal</a>
      <aside className={`portal-sidebar ${menuOpen ? "is-open" : ""}`} aria-label="Navegación principal">
        <button type="button" className="portal-sidebar-close" onClick={close} aria-label="Cerrar menú">×</button>
        <Link href="/panel" onClick={close} className="portal-sidebar-brand" aria-label="Ir al inicio de Ad Mavericks One">
          <Wordmark one invert className="text-[18px]" />
        </Link>
        <span className="portal-private-badge">Beta privada</span>

        <div className="portal-sidebar-scroll">
          <nav className="portal-nav" aria-label="Creación y gestión">
            {CREATION.map((item) => {
              const showingSavedPlans = Boolean(title?.toLocaleLowerCase("es").includes("guardado"));
              const selected = item.id === "plans"
                ? showingSavedPlans
                : item.id === "planificador"
                  ? active === "planificador" && !showingSavedPlans
                  : active === item.id;
              return (
                <Link key={item.id} href={item.href} onClick={close} className={`portal-nav-item ${selected ? "is-active" : ""}`}>
                  <span>{item.number}</span><strong>{item.label}</strong>
                </Link>
              );
            })}
            <Link href="/campanas" onClick={close} className={`portal-nav-item ${active === "campanas" ? "is-active" : ""}`}><span>04</span><strong>Órdenes</strong></Link>
            <ReportNavigationItem active={active === "reportes"} onClick={close} />
          </nav>

          <nav className="portal-catalog-nav" aria-label="Catálogo general de medios">
            <div className="portal-catalog-title"><span>Explorar inventario</span><strong>CATÁLOGO GENERAL</strong><b>−</b></div>
            {CATALOG.map((item) => (
              <Link
                key={item.id}
                href={`/planificador?view=media&section=${item.id}`}
                onClick={close}
                className={`portal-catalog-link ${catalogSection === item.id ? "is-active" : ""}`}
              >
                <span>{item.mark}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div>
              </Link>
            ))}
          </nav>

          <Link href="/planificador?view=diy" onClick={close} className="portal-custom-plan-link">
            <span>Configura medio por medio</span><strong>CREA EL PLAN A TU MANERA</strong><b>→</b>
          </Link>

          <nav className="portal-utility-nav" aria-label="Herramientas de la cuenta">
            <Link href="/laboratorio" onClick={close}>Laboratorio creativo</Link>
            <Link href="/pautar" onClick={close}>Pautar con Mavi</Link>
            <Link href="/campanas" onClick={close}>Campañas</Link>
            {isAdmin && <Link href="/mercado" onClick={close}>Inteligencia de mercado</Link>}
            {isAdmin && <Link href="/consola" onClick={close}>Administración</Link>}
          </nav>
        </div>

        <div className="portal-sidebar-foot">
          <p>Workspace privado</p><strong>Ad Mavericks</strong><span>Comprador autorizado · Datos controlados</span>
        </div>
      </aside>

      {menuOpen && <button type="button" className="portal-sidebar-backdrop" onClick={close} aria-label="Cerrar menú" />}

      <header className="portal-topbar">
        <button type="button" className="portal-menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú" aria-expanded={menuOpen}>
          <span /><span /><span />
        </button>
        <div className="portal-topbar-copy"><p>Ad Mavericks One</p><strong>{displayTitle}</strong></div>
        <div className="portal-topbar-account">
          <span className="portal-license-pill"><i />Licencia activa</span>
          <details className="portal-account-menu">
            <summary aria-label={`Abrir menú de cuenta de ${name}`}><span>{initial}</span><b>{name}</b><i>⌄</i></summary>
            <div>
              <strong>{name}</strong>
              <small>{isAdmin ? "Administrador de plataforma" : "Usuario autorizado"}</small>
              <p>Ad Mavericks One · workspace privado</p>
              <form action={cerrarSesion}><button type="submit">Cerrar sesión</button></form>
            </div>
          </details>
        </div>
      </header>
      <MaviFloatingAssistant />
    </>
  );
}

function ReportNavigationItem({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    fetch("/api/account/campaign-status", { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setEnabled(Boolean(data?.hasCampaigns)))
      .catch(() => setEnabled(false));
  }, []);
  return enabled
    ? <Link href="/reportes" onClick={onClick} className={`portal-nav-item ${active ? "is-active" : ""}`}><span>05</span><strong>Reportes</strong></Link>
    : <span className="portal-nav-item is-disabled"><span>05</span><strong>Reportes</strong><em>Tras tu primera campaña</em></span>;
}
