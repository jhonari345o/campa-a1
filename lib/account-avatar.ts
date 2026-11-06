export const AVATAR_BUCKET = "account-avatars";
export const MAX_AVATAR_ORIGINAL_BYTES = 10 * 1024 * 1024;
export const MAX_AVATAR_UPLOAD_BYTES = 750 * 1024;
export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function avatarVersion(path: unknown): string | null {
  if (typeof path !== "string") return null;
  const parts = path.split("/");
  return parts.length === 2 && uuid.test(parts[0]) && parts[1].endsWith(".webp") && uuid.test(parts[1].slice(0, -5)) ? parts[1].slice(0, -5) : null;
}
export function ownsAvatarPath(path: unknown, userId: string): path is string {
  return typeof path === "string" && uuid.test(userId) && path.startsWith(`${userId}/`) && avatarVersion(path) !== null;
}
export function avatarImageUrl(version: string | null | undefined): string | null {
  return version && uuid.test(version) ? `/api/account/avatar?v=${encodeURIComponent(version)}` : null;
}
export type AvatarUploadResult = { ok: true; message: string; version: string | null } | { ok: false; message: string };
