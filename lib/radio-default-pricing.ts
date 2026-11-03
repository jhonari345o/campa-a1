import type { CatalogProduct } from "./catalog-shopping";

/** Only owner-approved sale defaults may enter the shared catalog. */
export function mergeRadioDefaults(products: CatalogProduct[], defaults: CatalogProduct[]) {
  const merged = new Map(products.map(p => [p.key, p]));
  for (const p of defaults) {
    if (p.kind !== "radio" || !/^radio:(?:cne|regional):[a-f0-9]{32}$/.test(p.key) || !p.source.defaultPrice || !p.source.standingPrice || ![20,30].includes(p.source.seconds ?? 0) || !Number.isSafeInteger(p.priceCents) || p.priceCents! <= 0 || p.source.workspaceProductId || p.source.agreementId || p.key.startsWith("radio:regional:") && !p.source.stationId) continue;
    merged.set(p.key,p);
  }
  return [...merged.values()];
}
