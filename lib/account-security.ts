export type SecurityResult = { ok: boolean; message: string };
export type PasswordInput = { currentPassword: string; password: string; confirm: string; closeOthers: boolean };
type PasswordPorts = {
  verifyCurrent: (password: string) => Promise<boolean>;
  updatePassword: (password: string, currentPassword: string) => Promise<boolean>;
  closeOtherSessions: () => Promise<boolean>;
};
/** No user ID, email override or elevated auth client is accepted by this flow. */
export async function changeOwnPassword(input: PasswordInput, ports: PasswordPorts): Promise<SecurityResult> {
  if (!input.currentPassword || input.currentPassword.length > 128) return { ok: false, message: "Escribe tu contraseña actual." };
  if (input.password.length < 12 || input.password.length > 128 || input.password !== input.confirm) return { ok: false, message: "Usa entre 12 y 128 caracteres y confirma la misma contraseña." };
  if (input.password === input.currentPassword) return { ok: false, message: "Elige una contraseña diferente a la actual." };
  if (!await ports.verifyCurrent(input.currentPassword)) return { ok: false, message: "No pudimos verificar tu contraseña actual. Revísala e intenta nuevamente." };
  if (!await ports.updatePassword(input.password, input.currentPassword)) return { ok: false, message: "No se pudo actualizar la contraseña. Revisa sus requisitos e intenta nuevamente." };
  if (input.closeOthers) {
    let closed = false;
    try { closed = await ports.closeOtherSessions(); } catch { /* The password has already been changed. */ }
    if (!closed) return { ok: true, message: "Contraseña actualizada. No se pudo completar el cierre de otras sesiones; puedes intentarlo desde Seguridad." };
  }
  return { ok: true, message: input.closeOthers ? "Contraseña actualizada. Se solicitó el cierre de tus otras sesiones." : "Contraseña actualizada." };
}
