export type OohRate = { amount: number | null; period: string; basis: string; component: string };
export type OohAsset = {
  id: string; providerSlug: string; provinces: string[]; name: string; code: string;
  city: string; address: string; format: string; dimensions: string; brand: string;
  latitude: number | null; longitude: number | null; recordType: string;
  rates: OohRate[]; rateLabel: string; reference: string; taxLabel: string;
  photo: boolean; photoKind: "asset" | "format"; dailySpots: number | null; spotSeconds: number | null;
};
export type OohCatalog = { assets: OohAsset[]; error?: string };
export const OOH_UNLOCATED = "Ubicación por definir";
export const oohKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
export function oohProvinceGroups(assets: OohAsset[]) {
  const groups = new Map<string, { name: string; assets: OohAsset[] }>();
  for (const asset of assets) {
    for (const name of asset.provinces.length ? asset.provinces : [OOH_UNLOCATED]) {
      const key = oohKey(name);
      const group = groups.get(key) ?? { name, assets: [] };
      if (!group.assets.some(item => item.id === asset.id)) group.assets.push(asset);
      groups.set(key, group);
    }
  }
  return [...groups.entries()].map(([key, group]) => ({ key, ...group })).sort((a, b) =>
    a.name === OOH_UNLOCATED ? 1 : b.name === OOH_UNLOCATED ? -1 : a.name.localeCompare(b.name, "es"));
}
export function oohMatches(asset: OohAsset, query: string) {
  return oohKey([asset.name, asset.code, asset.city, asset.address, asset.format, asset.brand].join(" ")).includes(oohKey(query));
}
export function oohPhotoPathAllowed(path: string) { return /^[a-f0-9]{64}\.(jpg|jpeg|png|webp)$/.test(path); }
const text = (value: unknown) => typeof value === "string" ? value.slice(0, 1000) : "";
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
export function parseOohAsset(row: Record<string, unknown>): OohAsset | null {
  if (typeof row.id !== "string" || !/^[a-z0-9-]{1,150}$/.test(row.id) || !row.details || typeof row.details !== "object" || Array.isArray(row.details)) return null;
  const d = row.details as Record<string, unknown>;
  const rates = (Array.isArray(d.rates) ? d.rates : []).flatMap(value => {
    if (!value || typeof value !== "object") return [];
    const r = value as Record<string, unknown>, amount = number(r.amount);
    return amount != null && amount >= 0 ? [{ amount, period: text(r.period), basis: text(r.basis), component: text(r.component) }] : [];
  });
  const latitude = number(d.latitude), longitude = number(d.longitude);
  const coordinatesValid = latitude != null && longitude != null && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  return { id: row.id, providerSlug: text(row.provider_slug), provinces: Array.isArray(row.provinces) ? [...new Set(row.provinces.filter(p => typeof p === "string" && p.trim()).map(p => text(p).trim()))] : [],
    name: text(d.name), code: text(d.code), city: text(d.city), address: text(d.address), format: text(d.format), dimensions: text(d.dimensions), brand: text(d.brand),
    latitude: coordinatesValid ? latitude : null, longitude: coordinatesValid ? longitude : null, recordType: text(d.recordType),
    rates, rateLabel: text(d.rateLabel), reference: text(d.reference), taxLabel: text(d.taxLabel),
    photo: typeof row.photo_path === "string" && oohPhotoPathAllowed(row.photo_path), photoKind: d.photoKind === "asset" ? "asset" : "format", dailySpots: number(d.dailySpots), spotSeconds: number(d.spotSeconds) };
}
export function oohRateUnit(rate: OohRate) {
  const periods: Record<string, string> = { month: "mes", day: "día", week: "semana", year: "año", quarter: "trimestre", "3_months": "3 meses", "6_months": "6 meses", "12_months": "12 meses", event: "evento", campaign: "campaña", one_time: "pago único" };
  const bases: Record<string, string> = { per_screen: "por pantalla", per_unit: "por unidad", per_asset: "por elemento", per_circuit: "por circuito", circuit: "circuito completo", circuit_5: "circuito completo de 5 columnas", per_m2: "por m²", per_vehicle: "por vehículo", per_route: "por recorrido", per_location: "por ubicación", per_face: "por cara", per_spot: "por spot", package: "paquete" };
  return [periods[rate.period] ?? rate.period, bases[rate.basis] ?? rate.basis.replaceAll("_", " ")].filter(Boolean).join(" · ");
}
