"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { cerrarSesion } from "@/app/consola/actions";
import { DEFAULT_PREFERENCES, type AccountPreferences } from "@/lib/account-preferences";
import { AccountAvatar } from "./AccountAvatar";

export function SettingsGear(){
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9.8 3-.6 2.2-1.5.9-2.2-.6-2.2 3.8 1.6 1.7v2l-1.6 1.7 2.2 3.8 2.2-.6 1.5.9.6 2.2h4.4l.6-2.2 1.5-.9 2.2.6 2.2-3.8-1.6-1.7v-2l1.6-1.7-2.2-3.8-2.2.6-1.5-.9-.6-2.2Z"/><circle cx="12" cy="12" r="3.2"/></svg>;
}
export function AccountMenu({ name, isAdmin, workspaceName, role, preview = false }: { name: string; isAdmin: boolean; workspaceName?: string; role?: string; preview?: boolean }) {
  const [preferences, setPreferences] = useState<AccountPreferences>(DEFAULT_PREFERENCES);
  useEffect(() => {
    let active = true;
    const load = () => fetch("/api/account/preferences", { cache: "no-store", headers: { Accept: "application/json" } })
      .then(response => response.ok ? response.json() : null).then(data => {
        if (active && data?.preferences) { setPreferences(data.preferences); document.documentElement.dataset.userReducedMotion = data.preferences.reducedMotion ? "true" : "false"; }
      }).catch(() => {});
    void load(); window.addEventListener("one:preferences-updated", load);
    return () => { active = false; window.removeEventListener("one:preferences-updated", load); };
  }, []);
  const displayName = preview ? "Vista previa" : preferences.displayName || name;
  return <div className="account-controls">
    <Link href="/cuenta/configuracion" className="account-settings-gear" aria-label="Configuración de mi cuenta" title="Configuración de mi cuenta"><SettingsGear/></Link>
    <details className="portal-account-menu">
      <summary aria-label={`Abrir menú de cuenta de ${displayName}`}><AccountAvatar animal={preview ? null : preferences.avatarKey} tone={preferences.avatarTone} name={displayName} size={36}/><b>{displayName}</b><i>⌄</i></summary>
      <div><strong>{displayName}</strong><small>{preview ? "Vista de consulta" : isAdmin ? "Administrador de plataforma" : role === "planner" ? "Planificador" : "Usuario autorizado"}</small><p>{workspaceName ?? "Ad Mavericks One"} · espacio privado</p>
        <Link href="/cuenta/configuracion">Mi perfil y configuración</Link>{preview ? <Link href="/consola">Volver a administración</Link> : <form action={cerrarSesion}><button type="submit">Cerrar sesión</button></form>}
      </div>
    </details>
  </div>;
}
