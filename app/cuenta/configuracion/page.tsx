import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { SettingsGear } from "@/components/AccountMenu";
import { getSessionProfile } from "@/lib/auth";
import { getAccountPreferences } from "@/lib/account-preferences-server";
import { createClient } from "@/lib/supabase/server";
import { portalCapabilities, PORTAL_LABELS } from "@/lib/portal-access";
import { ProfileSettings, PasswordSettings, SessionSettings } from "./SettingsForms";
export const metadata = { title: "Mi configuración" };
export const dynamic = "force-dynamic";
export default async function AccountSettingsPage() {
  const profile = await getSessionProfile(); if (!profile) redirect("/ingresar");
  const [{ preferences, available }, db] = await Promise.all([getAccountPreferences(profile.id), createClient()]);
  const { data: { user } } = await db.auth.getUser(); if (!user) redirect("/ingresar");
  const name = profile.full_name || profile.email || "Mi cuenta", workspace = profile.workspace;
  const capabilities = portalCapabilities(workspace?.kind ?? "agency", workspace?.role ?? "", profile.is_platform_admin, workspace?.clientPlanning);
  const lastSignIn = user.last_sign_in_at ? new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" }).format(new Date(user.last_sign_in_at)) : "Sin registro disponible";
  return <><AppHeader name={name} isAdmin={profile.is_platform_admin} workspace={workspace} active="configuracion"/>
    <main id="workspace-content" className="portal-page account-settings-page">
      <div className="settings-page-heading"><span className="settings-heading-icon"><SettingsGear/></span><div><p>Ad Mavericks One · Mi cuenta</p><h1>A tu manera.</h1><span>Tu perfil, tu seguridad y la forma en que navegas.</span></div></div>
      <nav className="settings-section-nav" aria-label="Secciones de configuración"><a href="#perfil">Perfil y avatar</a><a href="#seguridad">Seguridad</a><a href="#acceso">Mi acceso</a></nav>
      <div className="settings-page-grid"><div className="settings-main-column">
        <section id="perfil" className="settings-card"><div className="settings-card-heading"><p>01 · Perfil</p><h2>Así te ve tu equipo</h2></div><ProfileSettings preferences={preferences} name={name} available={available}/></section>
        <section id="seguridad" className="settings-card"><div className="settings-card-heading"><p>02 · Seguridad</p><h2>Contraseña y sesiones</h2></div><PasswordSettings/><div className="settings-subsection"><h3>Otros dispositivos</h3><SessionSettings/></div></section>
      </div><aside className="settings-side-column"><section id="acceso" className="settings-card"><div className="settings-card-heading"><p>Tu acceso</p><h2>Todo en su lugar</h2></div><dl className="settings-account-data"><div><dt>Correo de acceso</dt><dd>{profile.email}</dd></div><div><dt>Espacio</dt><dd>{workspace?.name ?? "Ad Mavericks"}</dd></div><div><dt>Tipo de cuenta</dt><dd>{profile.is_platform_admin ? "Administración de plataforma" : PORTAL_LABELS[workspace?.kind ?? "agency"]}</dd></div><div><dt>Permiso</dt><dd>{profile.is_platform_admin ? "Administrador" : workspace?.role === "planner" ? "Planificador" : workspace?.role === "viewer" ? "Consulta" : "Usuario autorizado"}</dd></div><div><dt>Último ingreso · Ecuador</dt><dd>{lastSignIn}</dd></div><div><dt>Correo verificado</dt><dd>{user.email_confirmed_at ? "Sí" : "Pendiente"}</dd></div></dl><p className="settings-field-help">El correo, la empresa y los permisos los gestiona tu administrador.</p><div className="settings-permission-list"><span>{capabilities.catalog ? "✓" : "—"} Consultar catálogo</span><span>{capabilities.plan ? "✓" : "—"} Crear planes</span><span>{capabilities.request ? "✓" : "—"} Enviar solicitudes</span><span>{capabilities.approve ? "✓" : "—"} Aprobar compras</span></div></section>
        <section className="settings-card settings-help"><h2>Estamos para ayudarte</h2><p>Tu administrador puede ayudarte con tu acceso y tu espacio de trabajo.</p><Link href="/#contacto">Solicitar ayuda ↗</Link><div><Link href="/privacidad">Privacidad</Link><Link href="/terminos">Términos de uso</Link></div></section>
      </aside></div>
    </main></>;
}
