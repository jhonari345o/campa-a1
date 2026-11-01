export const AVATARS = [
  { key: "iguana", label: "Iguana" },
  { key: "capuchin", label: "Mono machín" },
  { key: "macaw", label: "Papagayo de Guayaquil" },
  { key: "ocelot", label: "Tigrillo de Guayas" },
  { key: "crab", label: "Cangrejo de manglar" },
] as const;
export type AvatarKey = typeof AVATARS[number]["key"];
export const AVATAR_TONES = [
  { key: "forest", label: "Bosque", background: "#173c2e", foreground: "#b6ed94" },
  { key: "mangrove", label: "Manglar", background: "#103e38", foreground: "#b7ead0" },
  { key: "olive", label: "Oliva", background: "#303f25", foreground: "#daeda2" },
] as const;
export type AvatarTone = typeof AVATAR_TONES[number]["key"];
export type AccountPreferences = { displayName: string; avatarKey: AvatarKey | null; avatarTone: AvatarTone; reducedMotion: boolean };
export const DEFAULT_PREFERENCES: AccountPreferences = { displayName: "", avatarKey: null, avatarTone: "forest", reducedMotion: false };
export const isAvatarKey = (value: unknown): value is AvatarKey => AVATARS.some(avatar => avatar.key === value);
export const isAvatarTone = (value: unknown): value is AvatarTone => AVATAR_TONES.some(tone => tone.key === value);
export function readPreferences(row: Record<string, unknown> | null | undefined): AccountPreferences {
  return { displayName: typeof row?.display_name === "string" ? row.display_name.slice(0, 120) : "",
    avatarKey: isAvatarKey(row?.avatar_key) ? row.avatar_key : null,
    avatarTone: isAvatarTone(row?.avatar_tone) ? row.avatar_tone : "forest", reducedMotion: row?.reduced_motion === true };
}
export function parsePreferences(form: FormData): AccountPreferences | null {
  const displayName = String(form.get("displayName") ?? "").trim(), avatarKey = form.get("avatarKey"), avatarTone = form.get("avatarTone");
  if (displayName.length > 120 || /[\u0000-\u001f\u007f<>]/u.test(displayName) || (avatarKey !== "initials" && !isAvatarKey(avatarKey)) || !isAvatarTone(avatarTone)) return null;
  return { displayName, avatarKey: avatarKey === "initials" ? null : avatarKey as AvatarKey, avatarTone, reducedMotion: form.get("reducedMotion") === "on" };
}
export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] ?? "").join("").toLocaleUpperCase("es") || "A";
}
