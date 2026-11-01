import {productMedium} from "./diy-catalog";
import type {CatalogProduct} from "./catalog-shopping";
import type { MediaGroup } from "./media-groups";
import { DIGITAL_PLATFORMS, type InfluencerProfile } from "./media-catalog";
import { oohRateUnit, type OohCatalog } from "./ooh-catalog";
import type { OohLocationOption } from "./media-workspace";

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, length = 180) => typeof value === "string" ? value.slice(0, length) : "";
const positive = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 10_000;
const amount = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function influencerRateFor(profile: InfluencerProfile, deliverable: string) {
  const matches: Record<string, RegExp> = { "Reel colaborativo": /reel/, TikTok: /tiktok/, Historia: /historia|story|stories/, "Derecho de pauta": /derecho|pauta|paid.media|usage/ };
  const pattern = matches[deliverable];
  return pattern ? profile.rates.find(rate => pattern.test(normalized(rate.format)))?.amountUsd ?? null : null;
}
/** Re-resolve selected IDs and prices from the authenticated catalogs; omitted media stay out of the saved plan. */
export function validateManualExtras(input: { selectedMedia: MediaGroup[]; selections: Record<string, unknown>; ooh: OohCatalog; legacyOoh: OohLocationOption[]; influencers: InfluencerProfile[] }): { ok: true; selections: Record<string, unknown> } | { ok: false; error: string } {
  const { selectedMedia, selections } = input;
  for (const [key, medium] of [["ooh", "ooh"], ["digital", "digital"], ["influencers", "influencers"]] as const) {
    if (selectedMedia.includes(medium) && selections[key] !== undefined && !Array.isArray(selections[key])) return { ok: false, error: "Revisa los productos seleccionados en cada medio." };
  }
  const rows = (key: string, medium: MediaGroup) => selectedMedia.includes(medium) && Array.isArray(selections[key]) ? selections[key] as unknown[] : [];
  const oohRows = rows("ooh", "ooh"), digitalRows = rows("digital", "digital"), creators = rows("influencers", "influencers");
  if ([oohRows, digitalRows, creators].some(rows => rows.length > 100)) return { ok: false, error: "Reduce la selección a 100 productos por medio." };
  if (oohRows.length && input.ooh.error) return { ok: false, error: input.ooh.error };
  const ooh: Record<string, unknown>[] = [];
  for (const value of oohRows) {
    const pick = record(value), units = pick.units ?? pick.months;
    if (!positive(units)) return { ok: false, error: "Revisa las unidades de vía pública." };
    const asset = input.ooh.assets.find(asset => asset.id === pick.id);
    if (asset) {
      const rateIndex = typeof pick.rateIndex === "number" && Number.isInteger(pick.rateIndex) ? pick.rateIndex : -1;
      const rate = asset.rates[rateIndex];
      if (rateIndex !== -1 && !rate) return { ok: false, error: "Selecciona de nuevo la tarifa del elemento de vía pública." };
      ooh.push({ id: asset.id, name: asset.name, city: asset.city, status: "inventory", rate: rate?.amount ?? null, units, months: rate?.period === "month" ? units : 1, rateIndex, unitLabel: rate ? oohRateUnit(rate) : "Unidad por definir", reference: asset.reference });
      continue;
    }
    const legacy = input.legacyOoh.find(asset => asset.id === pick.id);
    if (!legacy) return { ok: false, error: "Selecciona nuevamente la ubicación de vía pública desde el catálogo." };
    ooh.push({ id: legacy.id, name: legacy.name, city: legacy.city, status: legacy.status, rate: legacy.status === "inventory" ? legacy.monthlyRateUsd : null, months: units, units, unitLabel: "mes", reference: legacy.sourceNote });
  }
  const digital: { slug: string; name: string; pct: number }[] = [];
  for (const value of digitalRows) {
    const pick = record(value), platform = DIGITAL_PLATFORMS.find(platform => platform.slug === pick.slug);
    if (!platform || typeof pick.pct !== "number" || !Number.isFinite(pick.pct) || pick.pct < 0 || pick.pct > 1 || digital.some(row => row.slug === platform.slug)) return { ok: false, error: "Revisa la distribución de plataformas digitales." };
    digital.push({ slug: platform.slug, name: platform.name, pct: pick.pct });
  }
  if (digital.length && Math.abs(digital.reduce((total, row) => total + row.pct, 0) - 1) > .000001) return { ok: false, error: "La distribución digital debe sumar 100%." };
  const influencers: Record<string, unknown>[] = [];
  for (const value of creators) {
    const pick = record(value);
    const profile = input.influencers.find(profile => profile.id === pick.profileId || (!pick.profileId && typeof pick.id === "string" && pick.id.startsWith(profile.id + "-")));
    const deliverable = text(pick.deliverable, 100);
    if (!profile || !["Reel colaborativo", "TikTok", "Historia", "Derecho de pauta"].includes(deliverable) || !positive(pick.quantity)) return { ok: false, error: "Revisa el perfil, entregable y cantidad de influenciadores." };
    influencers.push({ id: `${profile.id}-${deliverable}-${influencers.length}`, profileId: profile.id, name: profile.name, deliverable, rate: influencerRateFor(profile, deliverable), quantity: pick.quantity });
  }
  return { ok: true, selections: { ...selections, ooh, digital, influencers, press: selectedMedia.includes("press") ? selections.press : [] } };
}

export type DiySummaryRow = { key: string; medium: MediaGroup; label: string; detail: string; cost: number | null };
export function diySelectionSummary(selectedMedia: MediaGroup[], selection: Record<string, unknown>, digitalBudget = 0) {
  const result: DiySummaryRow[] = [];
  const add = (medium: MediaGroup, key: string, label: string, detail: string, cost: number | null) => { if (selectedMedia.includes(medium)) result.push({ medium, key, label, detail, cost }); };
  const rows = (key: string) => (Array.isArray(selection[key]) ? selection[key] as unknown[] : []).slice(0, 100).map(record);
  for (const [i, row] of rows("tv").entries()) add("television", `tv-${i}`, [text(row.channel), text(row.title)].filter(Boolean).join(" · "), `${row.quantity} spots`, amount(row.unitPrice) != null && positive(row.quantity) ? amount(row.unitPrice)! * Number(row.quantity) : null);
  for (const [i, row] of rows("radio").entries()) add("radio", `radio-${i}`, text(row.name), `${row.spotsPerDay} cuñas/día · ${row.days} días`, null);
  for (const [i, row] of rows("ooh").entries()) { const units = row.units ?? row.months; add("ooh", `ooh-${i}`, text(row.name), `${row.city ?? ""} · ${units} × ${row.unitLabel ?? "mes"}`, amount(row.rate) != null && positive(units) ? amount(row.rate)! * Number(units) : null); }
  for (const [i, row] of rows("press").entries()) { const price = amount(row.unitPrice) ?? amount(row.referencePriceUsd); add("press", `press-${i}`, text(row.name), `${text(row.format)} · ${row.quantity} ${row.unit === "CPM" ? "miles de impresiones" : "unidades"}`, price != null && positive(row.quantity) ? price * Number(row.quantity) : null); }
  for (const [i, row] of rows("digital").entries()) add("digital", `digital-${i}`, text(row.name), "Distribución del presupuesto digital", typeof row.pct === "number" && row.pct >= 0 && row.pct <= 1 && Number.isFinite(digitalBudget) && digitalBudget >= 0 ? row.pct * digitalBudget : null);
  for (const [i, row] of rows("influencers").entries()) add("influencers", `creator-${i}`, text(row.name), `${text(row.deliverable)} · ${row.quantity} unidades`, amount(row.rate) != null && positive(row.quantity) ? amount(row.rate)! * Number(row.quantity) : null);
  for(const [i,row] of rows("catalog").entries()){
    if(!["tv","radio","ooh","press","digital","influencer"].includes(String(row.kind)))continue;
    const medium=productMedium({kind:row.kind as CatalogProduct["kind"]});
    add(medium,`catalog-${i}`,`${text(row.provider)} · ${text(row.name)}`,`${row.quantity} × ${text(row.unit)}`,amount(row.unitPriceCents)!=null&&positive(row.quantity)?Number(row.unitPriceCents)*Number(row.quantity)/100:null);
  }
  return { rows: result, count: result.length, referenceUsd: result.reduce((sum, row) => sum + (row.cost ?? 0), 0), pending: result.filter(row => row.cost == null).length };
}
