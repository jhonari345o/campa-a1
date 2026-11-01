import geography from "./ecuador-geography.json";
import { projectRadioProfile, type RadioStationProfile } from "./radio-station";

export type RadioRegion = { key: string; label: string };
export type RadioDirectoryEntry = {
  id: string; name: string; regionKeys: string[]; city: string | null;
  dial: string | null; genres: string[]; description: string; logoPath: string | null;
  reviewedAt: string | null;
  profile: RadioStationProfile;
};
export type RadioDirectoryCatalog = { stations: RadioDirectoryEntry[]; error?: string; asOfDate?: string };

export const radioRegions: RadioRegion[] = [
  { key: "national", label: "Nacionales" },
  ...geography.filter(item => item.kind === "province")
    .map(item => ({ key: item.key.replace(/^province:/, ""), label: item.label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" })),
];
const regionKeys = new Set(radioRegions.map(item => item.key));
export const radioSearchKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim();
export function radioEntriesForRegion(stations: RadioDirectoryEntry[], regionKey: string) {
  if (!regionKeys.has(regionKey)) return [];
  return stations.filter(station => station.regionKeys.includes(regionKey))
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }) || (a.city ?? "").localeCompare(b.city ?? "", "es") || a.id.localeCompare(b.id));
}
export function radioDirectoryMatches(station: RadioDirectoryEntry, query: string) {
  const text = radioSearchKey([station.name, station.city, station.dial, ...station.genres].filter(Boolean).join(" "));
  return radioSearchKey(query).split(" ").filter(Boolean).every(term => text.includes(term));
}
const text = (value: unknown, max = 180) => typeof value === "string" ? value.trim().slice(0, max) : "";
/** Only whitelisted directory/profile fields leave the private table. */
export function projectRadioDirectory(value: unknown): RadioDirectoryEntry[] {
  if (!Array.isArray(value)) return [];
  const entries = new Map<string, RadioDirectoryEntry>();
  for (const row of value.slice(0, 10_000)) {
    if (!row || typeof row !== "object") continue;
    const id = text(row.id, 150), name = text(row.name);
    const keys = Array.isArray(row.region_keys) ? [...new Set<string>(row.region_keys.filter((key: unknown): key is string => typeof key === "string" && regionKeys.has(key)))] : [];
    if (!/^[a-z0-9-]{1,150}$/.test(id) || !name || !keys.length) continue;
    const logo = text(row.logo_path);
    entries.set(id, {
      id, name, regionKeys: keys, city: text(row.city) || null, dial: text(row.dial, 60) || null,
      genres: Array.isArray(row.genres) ? row.genres.slice(0, 8).map((item: unknown) => text(item, 60)).filter(Boolean) : [],
      description: text(row.description, 600),
      logoPath: /^\/providers\/(?:radio\/[a-z0-9-]+\/logo\.(?:png|jpe?g|webp)|catomedia\/catomedia-logo\.png)$/.test(logo) ? logo : null,
      reviewedAt: /^\d{4}-\d{2}-\d{2}$/.test(text(row.reviewed_at)) ? row.reviewed_at : null,
      profile: projectRadioProfile(row.profile),
    });
  }
  return [...entries.values()];
}
