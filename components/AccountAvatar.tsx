import { AVATAR_TONES, initials, type AvatarKey, type AvatarTone } from "@/lib/account-preferences";

/** Original, code-native animal head glyphs. Two green tones; no third-party images. */
export function AccountAvatar({ animal, tone = "forest", name = "", size = 40 }: { animal: AvatarKey | null; tone?: AvatarTone; name?: string; size?: number }) {
  const colors = AVATAR_TONES.find(item => item.key === tone) ?? AVATAR_TONES[0];
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 96 96" width={size} height={size} className="account-avatar" style={{ color: colors.foreground }}>
    <rect width="96" height="96" rx="26" fill={colors.background}/>
    {!animal ? <text x="48" y="52" textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize="32" fontWeight="800">{initials(name)}</text> : null}
    {animal === "iguana" && <>
      <path d="m33 27 4-12 9 11 8-13 5 14 12-7-1 15 10 8-7 10 1 11-13 12-21-1-15-10-5-16 7-15Z" fill="currentColor"/>
      <path d="M30 48c8-12 27-15 39-5M29 58c11 9 25 12 37 3" fill="none" stroke={colors.background} strokeWidth="4" strokeLinecap="round"/>
      <circle cx="58" cy="44" r="6" fill={colors.background}/><circle cx="60" cy="42" r="1.7" fill="currentColor"/>
      <circle cx="40" cy="56" r="4" fill={colors.background}/><circle cx="69" cy="53" r="2" fill={colors.background}/>
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
      <path d="M25 47c-5-6-10-5-12-12-2-5 0-11 4-14l3 10 5 2 2-11c7 6 9 15 3 22l7 9Zm46 0c5-6 10-5 12-12 2-5 0-11-4-14l-3 10-5 2-2-11c-7 6-9 15-3 22l-7 9Z" fill="currentColor"/>
      <path d="M24 58c0-12 11-20 24-20s24 8 24 20c0 12-11 19-24 19S24 70 24 58Z" fill="currentColor"/>
      <path d="m39 43-3-13m21 13 3-13" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
      <circle cx="35" cy="28" r="6" fill="currentColor"/><circle cx="61" cy="28" r="6" fill="currentColor"/>
      <circle cx="35" cy="28" r="2.2" fill={colors.background}/><circle cx="61" cy="28" r="2.2" fill={colors.background}/>
      <path d="M38 59c6 5 14 5 20 0m-17 9h14" fill="none" stroke={colors.background} strokeWidth="3" strokeLinecap="round"/>
    </>}
  </svg>;
}
