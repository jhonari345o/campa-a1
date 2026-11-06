"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { AVATARS, AVATAR_TONES, isAvatarKey, type AccountPreferences } from "@/lib/account-preferences";
import { AccountAvatar } from "@/components/AccountAvatar";
import { cambiarMiContrasena, cerrarOtrasSesiones, guardarPreferencias } from "./actions";
import type { SecurityResult } from "@/lib/account-security";
import { prepareAvatarFile } from "@/lib/account-avatar-client";
import { quitarMiImagen } from "./avatar-actions";

function FormMessage({ state }: { state: SecurityResult | null }) { return state ? <p className={`settings-message ${state.ok ? "is-success" : "is-error"}`} role={state.ok ? "status" : "alert"}>{state.message}</p> : null; }
export function ProfileSettings({ preferences, name, available }: { preferences: AccountPreferences; name: string; available: boolean }) {
  type Choice = AccountPreferences["avatarKey"] | "photo";
  const [state, setState] = useState<SecurityResult | null>(null);
  const [pending, startSave] = useTransition(), [removing, startRemove] = useTransition();
  const [displayName, setDisplayName] = useState(preferences.displayName || name), [avatar, setAvatar] = useState<Choice>(preferences.useCustomAvatar ? "photo" : preferences.avatarKey), [tone, setTone] = useState(preferences.avatarTone), [reducedMotion, setReducedMotion] = useState(preferences.reducedMotion);
  const [customVersion, setCustomVersion] = useState(preferences.customAvatarVersion), [preparedImage, setPreparedImage] = useState<File | null>(null), [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false), [imageMessage, setImageMessage] = useState<SecurityResult | null>(null), [confirmRemove, setConfirmRemove] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null), busy = pending || removing || preparing;
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const cancelSelection = () => { setPreparedImage(null); setPreviewUrl(null); if (avatar === "photo" && !customVersion) setAvatar(null); setImageMessage(null); };
  const renderAvatar = (choice: Choice, size: number) => choice === "photo" && previewUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={previewUrl} alt="" width={size} height={size} className="account-avatar"/>
    : <AccountAvatar animal={isAvatarKey(choice) ? choice : null} imageVersion={choice === "photo" ? customVersion : null} tone={tone} name={displayName} size={size}/>;
  return <form onSubmit={event => {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget);
    if (avatar === "photo" && preparedImage) data.set("image", preparedImage);
    startSave(async () => {
      try {
        const result = await guardarPreferencias(null, data); setState(result);
        if (result.ok) {
          setCustomVersion(result.version);
          if (avatar === "photo" && preparedImage) { setPreparedImage(null); setPreviewUrl(null); }
          window.dispatchEvent(new Event("one:preferences-updated"));
        }
      } catch { setState({ ok: false, message: "No se pudieron guardar los cambios. Revisa tu conexión e inténtalo nuevamente." }); }
    });
  }} className="settings-profile-form">
    <div className="settings-profile-preview">{renderAvatar(avatar, 88)}<div><strong>{displayName || name}</strong><span>Tu avatar</span></div></div>
    <label className="settings-field">Nombre visible<input name="displayName" value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={120} autoComplete="name"/></label>
    <fieldset><legend>Selecciona tu avatar</legend><p className="settings-field-help">Elige un animal, usa tus iniciales o carga tu imagen.</p>
      <div className="settings-avatar-grid">{[{ key: null, label: "Mis iniciales" }, ...AVATARS].map(item => <label className={"settings-avatar-option " + (avatar === item.key ? "is-selected" : "")} key={item.key ?? "initials"}>
        <input type="radio" name="avatarKey" value={item.key ?? "initials"} checked={avatar === item.key} onChange={() => setAvatar(item.key)}/>{renderAvatar(item.key, 64)}<span>{item.label}</span>{avatar === item.key && <b aria-hidden="true">✓</b>}
      </label>)}</div>
      <div className="settings-photo-upload">
        {(customVersion || previewUrl) && <label className={"settings-own-photo " + (avatar === "photo" ? "is-selected" : "")}><input type="radio" name="avatarKey" value="photo" checked={avatar === "photo"} onChange={() => setAvatar("photo")}/>{renderAvatar("photo", 64)}<span>Mi imagen</span></label>}
        <div className="settings-photo-actions"><strong>Tu imagen de perfil</strong><p className="settings-field-help">JPG, PNG o WebP · hasta 10 MB.</p>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Seleccionar imagen de perfil" hidden onChange={async event => {
            const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (!file || busy) return;
            setPreparing(true); setImageMessage(null); setConfirmRemove(false);
            try { const prepared = await prepareAvatarFile(file); setPreparedImage(prepared); setPreviewUrl(URL.createObjectURL(prepared)); setAvatar("photo"); }
            catch (error) { setImageMessage({ ok: false, message: error instanceof Error ? error.message : "No pudimos abrir esa imagen." }); }
            finally { setPreparing(false); }
          }}/>
          <div className="settings-photo-buttons"><button type="button" className="btn btn-secondary" disabled={busy || !available} onClick={() => fileInput.current?.click()}>{preparing ? "Preparando imagen…" : "Subir mi imagen"}</button>{preparedImage && <button type="button" disabled={busy} onClick={cancelSelection}>Cancelar selección</button>}{customVersion && !preparedImage && <button type="button" disabled={busy} onClick={() => setConfirmRemove(true)}>Quitar imagen</button>}</div>
          {preparedImage && <p className="settings-field-help" role="status">Vista previa lista. Pulsa Guardar mi perfil para usarla.</p>}
          {confirmRemove && <div className="settings-photo-confirm"><span>¿Quieres quitar tu imagen de perfil?</span><button type="button" disabled={busy} onClick={() => startRemove(async () => {
            try { const result = await quitarMiImagen(); setImageMessage(result); if (result.ok) { setCustomVersion(null); setPreparedImage(null); setPreviewUrl(null); if (avatar === "photo") setAvatar(null); setConfirmRemove(false); window.dispatchEvent(new Event("one:preferences-updated")); } }
            catch { setImageMessage({ ok: false, message: "No se pudo quitar la imagen. Vuelve a intentarlo." }); }
          })}>{removing ? "Quitando…" : "Quitar imagen"}</button><button type="button" disabled={busy} onClick={() => setConfirmRemove(false)}>Cancelar</button></div>}
          <FormMessage state={imageMessage}/>
        </div>
      </div>
    </fieldset>
    <fieldset><legend>Tonalidad del avatar</legend><div className="settings-tone-options">{AVATAR_TONES.map(item => <label key={item.key} className={tone === item.key ? "is-selected" : ""}><input type="radio" name="avatarTone" value={item.key} checked={tone === item.key} onChange={() => setTone(item.key)}/><span style={{ background: item.background, borderColor: item.foreground }}/>{item.label}</label>)}</div></fieldset>
    <label className="settings-check"><input type="checkbox" name="reducedMotion" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)}/><span><strong>Reducir movimiento</strong><small>Una navegación más tranquila, con menos animaciones.</small></span></label>
    {!available && <p role="status" className="settings-message">La configuración de perfil está preparándose. Puedes consultar los datos de tu cuenta.</p>}
    <div className="settings-form-footer"><button disabled={busy || !available} className="btn btn-primary">{pending ? "Guardando…" : "Guardar mi perfil"}</button><FormMessage state={state}/></div>
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
