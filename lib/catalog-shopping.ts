import { INFLUENCER_IMAGE_SLUGS, OOH_PROVIDERS, DIGITAL_PLATFORMS, type InfluencerProfile } from "./media-catalog";
import type { BroadcastCatalog } from "./broadcast-catalog";
import type { RadioDirectoryCatalog } from "./radio-directory";
import type { PressCatalog } from "./press-catalog";
import { oohRateUnit, type OohCatalog, type OohRate } from "./ooh-catalog";

export const CART_LIMITS = { lines: 100, quantity: 10_000, totalCents: 1_000_000_000 } as const;
export type CatalogPick = { productKey: string; quantity: number };
export type CatalogCart = { version: number; items: CatalogPick[]; error?: string; expiresAt?: string };
export type CatalogProduct = {
  key: string; kind: "influencer" | "ooh" | "tv" | "radio" | "press" | "digital"; provider: string; name: string;
  format: string; unit: string; priceCents: number | null; taxIncluded: boolean | null;
  location: string; reference: string; image: string | null; conditions: string;
  source: { rateId?: string; profileId?: string; assetId?: string; rate?: OohRate; rateIndex?: number; sourceId?: string; offerId?: string; stationId?: string; tariffId?: string; seconds?: number; publicationId?: string; editionId?: string; platformSlug?: string; workspaceProductId?: string; agreementId?: string };
  marketKeys?: string[];
  formatGroup?: "other" | "totem_standard" | "totem_special";
  validFrom?: string | null; validTo?: string | null; referencePriceCents?: number | null;
};
export type CatalogCartLine = { pick: CatalogPick; product: CatalogProduct | null; subtotalCents: number | null };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const price = (value: number | null) => value != null && Number.isFinite(value) && value >= 0 && value <= CART_LIMITS.totalCents / 100 ? Math.round(value * 100) : null;

export function oohProductKey(assetId: string, rate?: OohRate, index = 0) {
  return rate ? `ooh:${assetId}:${index}` : `ooh:${assetId}:quote`;
}
export function catalogProducts(profiles: InfluencerProfile[], ooh: OohCatalog, extra?: { broadcast: BroadcastCatalog; radio: RadioDirectoryCatalog; press: PressCatalog }): CatalogProduct[] {
  const products: CatalogProduct[] = [];
  for (const profile of profiles) for (const rate of profile.rates) {
    if (!rate.id || !uuid.test(rate.id)) continue;
    products.push({
      key: `creator:${rate.id}`, kind: "influencer", provider: profile.name,
      name: rate.format, format: rate.format, unit: "entregable", priceCents: price(rate.amountUsd),
      taxIncluded: rate.taxIncluded ?? false, location: profile.platform ?? "",
      reference: "Tarifa del catálogo", conditions: rate.conditions ?? "",
      image: INFLUENCER_IMAGE_SLUGS.has(profile.slug) ? `/providers/influencers/${profile.slug}.webp` : null,
      source: { profileId: profile.id, rateId: rate.id },
    });
  }
  for (const asset of ooh.assets) {
    const rates: Array<OohRate | undefined> = asset.rates.length ? asset.rates : [undefined];
    for (const [rateIndex, rate] of rates.entries()) {
      const key = oohProductKey(asset.id, rate, rateIndex);
      if (key.length > 2048) continue;
      const normalizedTax = asset.taxLabel.toLowerCase();
      products.push({
        key, kind: "ooh", provider: asset.brand || OOH_PROVIDERS.find(p => p.slug === asset.providerSlug)?.name || asset.providerSlug, name: asset.name,
        format: rate?.component || asset.format || "Espacio publicitario",
        unit: rate ? oohRateUnit(rate) : "unidad por cotizar", priceCents: rate ? price(rate.amount) : null,
        taxIncluded: /sin iva|no incluy/.test(normalizedTax) ? false : /iva incluid|incluye iva/.test(normalizedTax) ? true : null,
        location: [asset.city, asset.address, asset.code].filter(Boolean).join(" · "),
        reference: asset.reference, image: asset.photo ? `/api/ooh/images/${encodeURIComponent(asset.id)}` : null,
        conditions: "Disponibilidad y período de contratación requieren revisión comercial.",
        source: { assetId: asset.id, ...(rate ? { rate, rateIndex } : {}) },
      });
    }
  }
  if (extra) {
    for (const source of extra.broadcast.sources.filter(s => s.kind === "tv")) for (const offer of extra.broadcast.tv.filter(o => o.sourceId === source.id)) products.push({
      key: `tv:${source.id}:${offer.id}`, kind: "tv", provider: source.label, name: offer.title, format: `${offer.day} · ${offer.schedule}`, unit: source.spotSeconds ? `cuña de ${source.spotSeconds} s` : "cuña · duración por confirmar", priceCents: price(offer.priceUsd), taxIncluded: source.taxIncluded,
      location: source.market, reference: `${source.periodStart} – ${source.periodEnd} · ${offer.target || source.target}`, image: null, conditions: source.conditions, validFrom: source.periodStart, validTo: source.periodEnd, source: { sourceId: source.id, offerId: offer.id, ...(source.spotSeconds ? { seconds: source.spotSeconds } : {}) },
    });
    for (const station of extra.radio.stations) for (const tariff of station.profile.tariffs) for (const [rateIndex, rate] of tariff.rates.entries()) {
      for (const seconds of tariff.unit === "second" ? [10,15,20,30,45,60] : [rate.seconds ?? 0]) products.push({
        key: `radio:${station.id}:${tariff.id}:${rateIndex}:${seconds}`, kind: "radio", provider: station.name, name: rate.label, format: seconds ? `Cuña de ${seconds} s` : "Cuña", unit: seconds ? `cuña de ${seconds} s` : "cuña", priceCents: price(rate.amountUsd == null ? null : rate.amountUsd * (tariff.unit === "second" ? seconds : 1)), taxIncluded: tariff.taxIncluded,
        location: tariff.market, reference: `${tariff.edition} · ${tariff.target}`, image: station.logoPath, conditions: tariff.conditions, validFrom: tariff.validFrom, validTo: tariff.validTo, source: { stationId: station.id, tariffId: tariff.id, rateIndex, seconds },
      });
    }
    for (const publication of extra.press.entries) for (const edition of publication.editions) for (const offer of edition.offers) products.push({
      key: `press:${publication.id}:${edition.id}:${offer.id}`, kind: "press", provider: publication.name, name: offer.name, format: offer.group, unit: offer.unit === "CPM" ? "1.000 impresiones" : offer.unit, priceCents: price(offer.priceUsd), taxIncluded: edition.taxIncluded,
      location: offer.market, reference: `${edition.period} · ${offer.target}`, image: publication.logoPath, conditions: [...edition.conditions, offer.notes].filter(Boolean).join(" · "), validFrom: edition.validFrom, validTo: edition.validTo, source: { publicationId: publication.id, editionId: edition.id, offerId: offer.id },
    });
    for (const station of extra.radio.stations.filter(s=>!s.profile.tariffs.some(t=>t.rates.length))) products.push({ key:`radio:${station.id}:quote`,kind:"radio",provider:station.name,name:"Cuñas de radio",format:"Cuña",unit:"cuña · duración por definir",priceCents:null,taxIncluded:null,location:station.city??"",reference:"",image:station.logoPath,conditions:"",source:{stationId:station.id} });
    for (const publication of extra.press.entries.filter(p=>!p.editions.some(e=>e.offers.length))) products.push({ key:`press:${publication.id}:quote`,kind:"press",provider:publication.name,name:"Espacio de prensa",format:"Formato por definir",unit:"inserción",priceCents:null,taxIncluded:null,location:publication.city??"",reference:"",image:publication.logoPath,conditions:"",source:{publicationId:publication.id} });
    for (const platform of DIGITAL_PLATFORMS) products.push({ key: `digital:${platform.slug}`, kind: "digital", provider: platform.name, name: "Inversión de medios", format: "Presupuesto de plataforma", unit: "USD de inversión", priceCents: 100, taxIncluded: null, location: "Según el brief", reference: "Presupuesto solicitado", image: platform.imagePath ?? null, conditions: "El presupuesto se coordina antes de activar la pauta.", source: { platformSlug: platform.slug } });
  }
  return [...new Map(products.map(p => [p.key, p])).values()];
}

/** Input carries identifiers and quantities only. Prices never come from the browser. */
export function normalizeCatalogPicks(value: unknown): CatalogPick[] {
  if (!Array.isArray(value) || value.length > CART_LIMITS.lines) throw new Error("INVALID_CART");
  const seen = new Set<string>();
  return value.map(row => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("INVALID_CART");
    const r = row as Record<string, unknown>;
    if (Object.keys(r).some(k => !["productKey", "quantity"].includes(k)) || typeof r.productKey !== "string" || !/^(creator:|ooh:|tv:|radio:|press:|digital:)/.test(r.productKey) || r.productKey.length > 2048 || /[\u0000-\u001f]/.test(r.productKey) || !Number.isInteger(r.quantity) || Number(r.quantity) < 1 || Number(r.quantity) > CART_LIMITS.quantity || seen.has(r.productKey)) throw new Error("INVALID_CART");
    seen.add(r.productKey);
    return { productKey: r.productKey, quantity: Number(r.quantity) };
  }).sort((a, b) => a.productKey.localeCompare(b.productKey));
}
export function changeCatalogQuantity(items: CatalogPick[], productKey: string, delta: number) {
  const current = items.find(p => p.productKey === productKey)?.quantity ?? 0;
  const quantity = Math.max(0, Math.min(CART_LIMITS.quantity, current + delta));
  return normalizeCatalogPicks([...items.filter(p => p.productKey !== productKey), ...(quantity ? [{ productKey, quantity }] : [])]);
}
export function catalogCartSummary(items: CatalogPick[], products: CatalogProduct[]) {
  const byKey = new Map(products.map(p => [p.key, p]));
  const lines: CatalogCartLine[] = normalizeCatalogPicks(items).map(pick => {
    const product = byKey.get(pick.productKey) ?? null;
    return { pick, product, subtotalCents: product?.priceCents == null ? null : product.priceCents * pick.quantity };
  });
  const knownSubtotalCents = lines.reduce((n, l) => n + (l.subtotalCents ?? 0), 0);
  if (!Number.isSafeInteger(knownSubtotalCents) || knownSubtotalCents > CART_LIMITS.totalCents) throw new Error("CART_AMOUNT_LIMIT");
  const pendingPrice = lines.filter(l => l.subtotalCents == null).length, unavailable = lines.filter(l => !l.product).length;
  const taxes = new Set(lines.filter(l => l.product).map(l => l.product!.taxIncluded));
  return { lines, knownSubtotalCents, totalCents: pendingPrice ? null : knownSubtotalCents, pendingPrice, unavailable,
    quantity: lines.reduce((n, l) => n + l.pick.quantity, 0),
    totalLabel: pendingPrice ? "Subtotal con precio" : taxes.size === 1 && taxes.has(false) ? "Subtotal sin IVA" : taxes.size === 1 && taxes.has(true) ? "Subtotal con IVA" : "Subtotal de catálogo" };
}
export function catalogQuoteSignature(items: CatalogPick[], products: CatalogProduct[]) {
  return JSON.stringify(catalogCartSummary(items, products).lines.map(l => [l.pick.productKey, l.pick.quantity, l.product?.priceCents ?? null, l.product?.taxIncluded ?? null, l.product?.provider ?? null, l.product?.name ?? null, l.product?.format ?? null, l.product?.unit ?? null, l.product?.location ?? null, l.product?.reference ?? null, l.product?.conditions ?? null, l.product?.source.agreementId ?? null, l.product?.validFrom ?? null, l.product?.validTo ?? null]));
}
export function canonicalCatalogOrder(items: CatalogPick[], products: CatalogProduct[]) {
  const summary = catalogCartSummary(items, products);
  if (!summary.lines.length || summary.unavailable) throw new Error("PRODUCT_UNAVAILABLE");
  return { ...summary, items: summary.lines.map(({ pick, product }) => ({
    productKey: pick.productKey, quantity: pick.quantity, kind: product!.kind, provider: product!.provider,
    name: product!.name, format: product!.format, unit: product!.unit,
    unitPriceCents: product!.priceCents, taxIncluded: product!.taxIncluded,
    location: product!.location, reference: product!.reference, conditions: product!.conditions, validFrom: product!.validFrom ?? null, validTo: product!.validTo ?? null, source: product!.source,
  })) };
}
