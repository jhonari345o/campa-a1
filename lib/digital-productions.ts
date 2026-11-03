import type { CatalogProduct } from "./catalog-shopping";

export function isDigitalProduction(product: CatalogProduct) {
  const metadata = product.digitalProduction;
  const id = metadata?.id;
  return product.kind === "digital" && typeof id === "string" && /^[a-z0-9-]{1,100}$/.test(id)
    && /^digital:production:[a-z0-9-]{1,100}:[a-z0-9-]{1,100}$/.test(product.key)
    && product.key.startsWith(`digital:production:${id}:`)
    && typeof metadata?.network === "string" && metadata.network.length > 0 && metadata.network.length <= 120
    && typeof metadata.description === "string" && metadata.description.length <= 1000
    && Array.isArray(metadata.rights) && metadata.rights.length > 0 && metadata.rights.length <= 50
    && metadata.rights.every(right => typeof right === "string" && right.length > 0 && right.length <= 1000)
    && (metadata.programsPerPeriod == null || (Number.isSafeInteger(metadata.programsPerPeriod) && metadata.programsPerPeriod > 0));
}

/** Selling defaults are private, curated records; a budget is never a programme price. */
export function mergeDigitalProductions(products: CatalogProduct[], defaults: CatalogProduct[]) {
  const accepted = defaults.filter(product => isDigitalProduction(product)
    && product.source?.defaultPrice && product.source.standingPrice
    && Number.isSafeInteger(product.priceCents) && product.priceCents! > 0
    && product.priceCents! <= 1_000_000_000 && product.validFrom);
  const replacementKeys = new Set(accepted.map(product => product.key));
  return [...products.filter(product => !replacementKeys.has(product.key)), ...accepted];
}

export function digitalProductionGroups(products: CatalogProduct[]) {
  const groups = new Map<string, CatalogProduct[]>();
  for (const product of products.filter(isDigitalProduction)) {
    const id = product.digitalProduction!.id;
    groups.set(id, [...(groups.get(id) ?? []), product]);
  }
  return [...groups].map(([id, packages]) => ({ id, name: packages[0].provider,
    network: packages[0].digitalProduction!.network,
    description: packages[0].digitalProduction!.description,
    image: packages[0].image, packages,
  })).sort((a, b) => a.network.localeCompare(b.network, "es") || a.name.localeCompare(b.name, "es"));
}
