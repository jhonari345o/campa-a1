"use client";
import { useState } from "react";
import { avatarImageUrl } from "@/lib/account-avatar";
import { AVATAR_TONES, initials, type AvatarKey, type AvatarTone } from "@/lib/account-preferences";

/** Original, code-native animal head glyphs. Two green tones; no third-party images. */
type AvatarProps = { animal: AvatarKey | null; tone?: AvatarTone; name?: string; size?: number; imageVersion?: string | null };
function PhotoAvatar({ src, ...fallback }: AvatarProps & { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <AccountAvatar {...fallback}/>;
  // The authenticated route has no public or third-party image URL.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={fallback.size ?? 40} height={fallback.size ?? 40} className="account-avatar" onError={() => setFailed(true)}/>;
}
export function AccountAvatar({ animal, tone = "forest", name = "", size = 40, imageVersion }: AvatarProps) {
  const photo = avatarImageUrl(imageVersion);
  if (photo) return <PhotoAvatar key={imageVersion} src={photo} animal={animal} tone={tone} name={name} size={size}/>;
  const colors = AVATAR_TONES.find(item => item.key === tone) ?? AVATAR_TONES[0];
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 96 96" width={size} height={size} className="account-avatar" style={{ color: colors.foreground }}>
    <rect width="96" height="96" rx="26" fill={colors.background}/>
    {!animal ? <text x="48" y="52" textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize="32" fontWeight="800">{initials(name)}</text> : null}
    {animal === "iguana" && <>
      <path d="m21 49-8-11 13-1-6-13 14 5 4-14 10 13 7-8 3 15Z" fill="currentColor"/>
      <path d="M20 77V50c0-15 12-24 27-24 10 0 19 5 23 13l11 6c5 3 6 10 1 14-5 5-12 6-23 6L48 82l-9-8-9 4Z" fill="currentColor"/>
      <path d="M43 56c10 5 23 5 34 0M46 67l4 5" fill="none" stroke={colors.background} strokeWidth="3" strokeLinecap="round"/>
      <circle cx="58" cy="39" r="6" fill={colors.background}/><circle cx="59.5" cy="37.5" r="1.7" fill="currentColor"/>
      <circle cx="39" cy="53" r="7" fill={colors.background}/><circle cx="39" cy="53" r="3.5" fill="currentColor"/>
      <circle cx="77" cy="48" r="2" fill={colors.background}/>
    </>}
    {animal === "capuchin" && <>
      <circle cx="23" cy="47" r="11" fill="currentColor"/><circle cx="73" cy="47" r="11" fill="currentColor"/>
      <circle cx="23" cy="47" r="5" fill={colors.background}/><circle cx="73" cy="47" r="5" fill={colors.background}/>
      <path d="M25 38c0-13 9-20 18-20l5-6 6 7c12 1 20 12 19 25l-2 19c-3 11-13 17-23 17S26 72 24 61Z" fill="currentColor"/>
      <path d="M32 37c6-6 12-2 16 2 4-4 10-8 16-2 6 6 2 14-1 18 9 15-3 19-15 19S24 70 33 55c-3-4-7-12-1-18Z" fill={colors.background}/>
      <circle cx="39" cy="45" r="3" fill="currentColor"/><circle cx="57" cy="45" r="3" fill="currentColor"/>
      <path d="m44 58 4 3 4-3M40 66c5 4 11 4 16 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </>}
    {animal === "macaw" && <>
      <path d="M24 69c2-8 1-18 1-26 0-17 12-27 27-27 13 0 23 8 26 20L65 55l-5 21-10-4-9 5-7-7-12 5Z" fill="currentColor"/>
      <path d="M49 29c12-5 22 2 24 12L61 56c-10 1-20-6-20-15 0-5 3-9 8-12Z" fill={colors.background}/>
      <path d="M67 32c15 1 19 14 14 28l-9-12-12-2Z" fill="currentColor"/>
      <path d="M69 46c-2 7-4 12-8 15l-3-12Z" fill={colors.background}/><circle cx="54" cy="36" r="3" fill="currentColor"/>
      <path d="m47 45 7 2m-6 5 6 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </>}
    {animal === "ocelot" && <>
      <path d="m24 39-4-19c9-4 17 1 22 7h12c6-6 14-11 22-7l-4 20c8 8 7 19 1 26L57 79H39L23 66c-7-8-7-19 1-27Z" fill="currentColor"/>
      <path d="m26 27 9 7-8 6Zm44 0-9 7 8 6Z" fill={colors.background}/>
      <path d="m31 47 9 2m16 0 9-2m-21 9 4 4 4-4m-4 5v4m0 0-6 4m6-4 6 4" fill="none" stroke={colors.background} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="m44 33-1 5m10-5 1 5m-21 20-4 2m36-2 4 2m-35 5-4 2m32-2 4 2" stroke={colors.background} strokeWidth="3" strokeLinecap="round"/>
    </>}
    {animal === "crab" && <>
      <path d="M25 56 14 47l3-10 10 4 8 10Zm46 0 11-9-3-10-10 4-8 10Z" fill="currentColor"/>
      <path d="M20 43C9 40 7 31 12 22l5-5 1 12 7-3-1-13c12 5 15 17 7 25l-8 7Z" fill="currentColor"/>
      <path d="M20 43C9 40 7 31 12 22l5-5 1 12 7-3-1-13c12 5 15 17 7 25l-8 7Z" transform="matrix(-1 0 0 1 96 0)" fill="currentColor"/>
      <path d="M24 56c2-10 12-16 24-16s22 6 24 16l-3 14c-12 9-30 9-42 0Z" fill="currentColor"/>
      <path d="m40 43-1-15m17 15 1-15" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/>
      <circle cx="39" cy="25" r="6" fill="currentColor"/><circle cx="57" cy="25" r="6" fill="currentColor"/>
      <circle cx="39" cy="25" r="2.5" fill={colors.background}/><circle cx="57" cy="25" r="2.5" fill={colors.background}/>
      <path d="M30 52c11-5 25-5 36 0m-25 9h14m-12 6h10" fill="none" stroke={colors.background} strokeWidth="3" strokeLinecap="round"/>
    </>}
  </svg>;
}
