import { INFLUENCER_IMAGE_SLUGS, OOH_PROVIDERS, type InfluencerProfile } from "./media-catalog";
import { oohRateUnit, type OohCatalog, type OohRate } from "./ooh-catalog";

export const CART_LIMITS = { lines: 100, quantity: 99, totalCents: 1_000_000_000 } as const;
export type CatalogPick = { productKey: string; quantity: number };
export type CatalogCart = { version: number; items: CatalogPick[]; error?: string };
export type CatalogProduct = {
  key: string; kind: "influencer" | "ooh"; provider: string; name: string;
  format: string; unit: string; priceCents: number | null; taxIncluded: boolean | null;
  location: string; reference: string; image: string | null; conditions: string;
  source: { rateId?: string; profileId?: string; assetId?: string; rate?: OohRate };
};
export type CatalogCartLine = { pick: CatalogPick; product: CatalogProduct | null; subtotalCents: number | null };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const price = (value: number) => Number.isFinite(value) && value >= 0 && value <= CART_LIMITS.totalCents / 100 ? Math.round(value * 100) : null;

export function oohProductKey(assetId: string, rate?: OohRate) {
  return rate ? `ooh:${assetId}:${[rate.period, rate.basis, rate.component, String(rate.amount)].map(encodeURIComponent).join("|")}` : `ooh:${assetId}:quote`;
}
export function catalogProducts(profiles: InfluencerProfile[], ooh: OohCatalog): CatalogProduct[] {
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
    for (const rate of rates) {
      const key = oohProductKey(asset.id, rate);
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
        source: { assetId: asset.id, ...(rate ? { rate } : {}) },
      });
    }
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
    if (Object.keys(r).some(k => !["productKey", "quantity"].includes(k)) || typeof r.productKey !== "string" || !/^(creator:|ooh:)/.test(r.productKey) || r.productKey.length > 2048 || /[\u0000-\u001f]/.test(r.productKey) || !Number.isInteger(r.quantity) || Number(r.quantity) < 1 || Number(r.quantity) > CART_LIMITS.quantity || seen.has(r.productKey)) throw new Error("INVALID_CART");
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
  return JSON.stringify(catalogCartSummary(items, products).lines.map(l => [l.pick.productKey, l.pick.quantity, l.product?.priceCents ?? null, l.product?.taxIncluded ?? null, l.product?.provider ?? null, l.product?.name ?? null, l.product?.format ?? null, l.product?.unit ?? null, l.product?.location ?? null, l.product?.reference ?? null]));
}
export function canonicalCatalogOrder(items: CatalogPick[], products: CatalogProduct[]) {
  const summary = catalogCartSummary(items, products);
  if (!summary.lines.length || summary.unavailable) throw new Error("PRODUCT_UNAVAILABLE");
  return { ...summary, items: summary.lines.map(({ pick, product }) => ({
    productKey: pick.productKey, quantity: pick.quantity, kind: product!.kind, provider: product!.provider,
    name: product!.name, format: product!.format, unit: product!.unit,
    unitPriceCents: product!.priceCents, taxIncluded: product!.taxIncluded,
    location: product!.location, reference: product!.reference, source: product!.source,
  })) };
}
