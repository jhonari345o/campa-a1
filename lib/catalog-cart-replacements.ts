import { CART_LIMITS, normalizeCatalogPicks, type CatalogPick, type CatalogProduct } from "./catalog-shopping";

/** Resolve an old unpriced station selection only against this account's catalog.
 * Choosing a duration is explicit: never silently turn an unspecified spot into 20s. */
export function catalogReplacementOptions(key: string, products: CatalogProduct[]) {
  const stationId = /^radio:([^:]+):quote$/.exec(key)?.[1];
  if (!stationId) return [];
  return products.filter(product => product.kind === "radio" && product.source.stationId === stationId
    && [20, 30].includes(product.source.seconds ?? 0) && Number.isSafeInteger(product.priceCents) && product.priceCents! > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "es") || (a.source.seconds! - b.source.seconds!));
}

export function replaceCatalogProduct(items: CatalogPick[], oldKey: string, newKey: string, products: CatalogProduct[]) {
  const old = items.find(item => item.productKey === oldKey);
  if (!old || !catalogReplacementOptions(oldKey, products).some(product => product.key === newKey)) throw new Error("INVALID_REPLACEMENT");
  const quantity = old.quantity + (items.find(item => item.productKey === newKey)?.quantity ?? 0);
  if (quantity > CART_LIMITS.quantity) throw new Error("INVALID_QUANTITY");
  return normalizeCatalogPicks([...items.filter(item => item.productKey !== oldKey && item.productKey !== newKey), { productKey: newKey, quantity }]);
}
