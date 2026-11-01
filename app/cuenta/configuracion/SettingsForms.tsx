"use client";
import { startTransition, useActionState, useEffect, useState } from "react";
import { AVATARS, AVATAR_TONES, type AccountPreferences } from "@/lib/account-preferences";
import { AccountAvatar } from "@/components/AccountAvatar";
import { cambiarMiContrasena, cerrarOtrasSesiones, guardarPreferencias } from "./actions";
import type { SecurityResult } from "@/lib/account-security";

function FormMessage({ state }: { state: SecurityResult | null }) { return state ? <p className={`settings-message ${state.ok ? "is-success" : "is-error"}`} role={state.ok ? "status" : "alert"}>{state.message}</p> : null; }
export function ProfileSettings({ preferences, name, available }: { preferences: AccountPreferences; name: string; available: boolean }) {
  const [state, action, pending] = useActionState(guardarPreferencias, null);
  const [displayName, setDisplayName] = useState(preferences.displayName || name), [avatar, setAvatar] = useState(preferences.avatarKey), [tone, setTone] = useState(preferences.avatarTone), [reducedMotion, setReducedMotion] = useState(preferences.reducedMotion);
  useEffect(() => { if (state?.ok) window.dispatchEvent(new Event("one:preferences-updated")); }, [state]);
  return <form onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }} className="settings-profile-form">
    <div className="settings-profile-preview"><AccountAvatar animal={avatar} tone={tone} name={displayName} size={88}/><div><strong>{displayName || name}</strong><span>Tu avatar</span></div></div>
    <label className="settings-field">Nombre visible<input name="displayName" value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={120} autoComplete="name"/></label>
    <fieldset><legend>Selecciona tu avatar</legend><p className="settings-field-help">Elige un animal o usa tus iniciales.</p>
      <div className="settings-avatar-grid">{[{ key: null, label: "Mis iniciales" }, ...AVATARS].map(item => <label className={`settings-avatar-option ${avatar === item.key ? "is-selected" : ""}`} key={item.key ?? "initials"}>
        <input type="radio" name="avatarKey" value={item.key ?? "initials"} checked={avatar === item.key} onChange={() => setAvatar(item.key)}/><AccountAvatar animal={item.key} tone={tone} name={displayName} size={64}/><span>{item.label}</span>{avatar === item.key && <b aria-hidden="true">✓</b>}
      </label>)}</div>
    </fieldset>
    <fieldset><legend>Tonalidad del avatar</legend><div className="settings-tone-options">{AVATAR_TONES.map(item => <label key={item.key} className={tone === item.key ? "is-selected" : ""}><input type="radio" name="avatarTone" value={item.key} checked={tone === item.key} onChange={() => setTone(item.key)}/><span style={{ background: item.background, borderColor: item.foreground }}/>{item.label}</label>)}</div></fieldset>
    <label className="settings-check"><input type="checkbox" name="reducedMotion" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)}/><span><strong>Reducir movimiento</strong><small>Una navegación más tranquila, con menos animaciones.</small></span></label>
    {!available && <p role="status" className="settings-message">La configuración de perfil está preparándose. Puedes consultar los datos de tu cuenta.</p>}
    <div className="settings-form-footer"><button disabled={pending || !available} className="btn btn-primary">{pending ? "Guardando…" : "Guardar mi perfil"}</button><FormMessage state={state}/></div>
  </form>;
}
function PasswordField({ name, label, current = false }: { name: string; label: string; current?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <label className="settings-field">{label}<span className="settings-password-field"><input type={visible ? "text" : "password"} name={name} required minLength={current ? 1 : 12} maxLength={128} autoComplete={current ? "current-password" : "new-password"}/><button type="button" aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLocaleLowerCase("es")}`} aria-pressed={visible} onClick={() => setVisible(value => !value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="m4 3 16 18"/>}</svg></button></span></label>;
}
export function PasswordSettings() {
  const [state, action, pending] = useActionState(cambiarMiContrasena, null);
  return <form action={action} className="settings-password-form"><p className="settings-field-help">Confirma tu contraseña actual y elige una nueva de al menos 12 caracteres.</p><PasswordField name="currentPassword" label="Contraseña actual" current/><div className="settings-password-pair"><PasswordField name="password" label="Nueva contraseña"/><PasswordField name="confirm" label="Confirma la nueva contraseña"/></div><label className="settings-check"><input type="checkbox" name="closeOthers" defaultChecked/><span>Cerrar también mis otras sesiones</span></label><button disabled={pending} className="btn btn-primary">{pending ? "Actualizando…" : "Actualizar contraseña"}</button><FormMessage state={state}/></form>;
}
export function SessionSettings() {
  const [state, action, pending] = useActionState(cerrarOtrasSesiones, null);
  return <form action={action} className="settings-session-form"><label className="settings-check"><input type="checkbox" name="confirmOtherSessions" required/><span>Cerrar mis sesiones en otros dispositivos y conservar esta.</span></label><p className="settings-field-help">El cierre de los otros accesos se completa cuando vence su sesión vigente.</p><button className="btn btn-secondary" disabled={pending}>{pending ? "Cerrando…" : "Cerrar otras sesiones"}</button><FormMessage state={state}/></form>;
}
