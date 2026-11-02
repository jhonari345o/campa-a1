import type { MediaGroup } from "./media-groups";
export const MEDIA_COLORS: Record<MediaGroup, string> = { television: "#a5d96c", radio: "#57c7ab", ooh: "#66afe1", press: "#e2c374", digital: "#a79ae8", influencers: "#e6a3b5" };
export type MixSegment = { key: MediaGroup | "unassigned"; share: number; offset: number; amountUsd: number | null; color: string };
/** Display the real denominator, including unassigned budget; never rescale a partial mix to 100%. */
export function mixSegments(rows: { medium: MediaGroup; pct: number; amountUsd: number | null }[], budget: number | null): MixSegment[] {
  if (rows.some(row => !Object.hasOwn(MEDIA_COLORS, row.medium) || !Number.isFinite(row.pct) || row.pct < 0 || row.pct > 1) || rows.reduce((sum, row) => sum + row.pct, 0) > 1.000001 || new Set(rows.map(row => row.medium)).size !== rows.length) return [];
  let offset = 0;
  const result: MixSegment[] = rows.filter(row => row.pct > 0).map(row => { const segment = { key: row.medium, share: row.pct, offset, amountUsd: row.amountUsd, color: MEDIA_COLORS[row.medium] }; offset += row.pct; return segment; });
  if (offset < .999999) result.push({ key: "unassigned", share: 1 - offset, offset, amountUsd: budget != null ? Math.max(0, Math.round((budget - rows.reduce((sum, row) => sum + (row.amountUsd ?? 0), 0)) * 100) / 100) : null, color: "#dce5dd" });
  return result;
}
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Only known, local brand assets. A report can never supply a tracking or image URL. */
const LOGOS: Partial<Record<MediaGroup, [string[], string][]>> = {
  television: [ [["ecuavisa"], "/providers/tv/ecuavisa.png"], [["tc television", "tc"], "/providers/tv/tc-television.png"], [["teleamazonas"], "/providers/tv/teleamazonas.png"], [["oromar"], "/providers/tv/oromar-tv.png"], [["ecuador tv"], "/providers/tv/ecuador-tv.png"] ],
  radio: [ [["kch", "radio kch"], "/providers/radio/kch/logo.webp"], [["forever", "radio forever"], "/providers/radio/forever/logo.webp"], [["la tuya", "radio la tuya"], "/providers/radio/la-tuya/logo.webp"], [["canela", "radio canela"], "/providers/radio/canela-guayas/logo.webp"] ],
  press: [ [["el universo", "diario el universo"], "/providers/press/el-universo.png"], [["expreso", "diario expreso"], "/providers/press/expreso.png"], [["metro", "diario metro"], "/providers/press/metro.png"], [["extra", "diario extra"], "/providers/press/extra.png"], [["el comercio", "diario el comercio"], "/providers/press/el-comercio.png"] ],
  ooh: [ [["zazapec", "zaza"], "/providers/ooh/zazapec/logo.png"], [["gran comercio"], "/providers/ooh/gran-comercio/logo.png"], [["duoprint", "grupo duo"], "/providers/ooh/duoprint/logo.png"], [["induvallas"], "/providers/ooh/induvallas/logo.png"] ],
  digital: [ [["meta", "facebook", "instagram"], "/providers/digital/meta.svg"], [["google", "youtube"], "/providers/digital/google-ads.svg"], [["tiktok"], "/providers/digital/tiktok.svg"], [["linkedin"], "/providers/digital/linkedin.svg"], [["spotify"], "/providers/digital/spotify.svg"] ],
};
export function providerLogo(provider: string, medium: MediaGroup): string | null {
  const name = normalized(provider);
  return LOGOS[medium]?.find(([aliases]) => aliases.some(alias => name === alias || name.startsWith(alias + " ")))?.[1] ?? null;
}
