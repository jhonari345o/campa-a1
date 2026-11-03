import { TV_CHANNELS } from "./media-catalog";
import { normalized, type BroadcastCatalog } from "./broadcast-catalog";
import type { CatalogProduct } from "./catalog-shopping";

export type TelevisionChannel = { key: string; name: string; logo: string | null; products: CatalogProduct[] };
const aliases: Record<string, string[]> = {
  ecuavisa: ["ecuavisa"], "tc-television": ["tc", "tc television", "tc tv"], teleamazonas: ["teleamazonas"],
  "red-comercial": ["red comercial"], "oromar-tv": ["oromar", "oromar tv"], "ecuador-tv": ["ecuador tv"],
  "catomedia-ucsg": ["catomedia", "ucsg tv", "catomedia ucsg tv"],
  rts: ["rts"], tvc: ["tvc"],
};
export function televisionProviderKey(provider: string) {
  const key = normalized(provider);
  return Object.entries(aliases).find(([, names]) => names.some(name => key === name || key.startsWith(`${name} `)))?.[0] ?? key;
}
export function televisionChannels(products: CatalogProduct[]): TelevisionChannel[] {
  const groups = new Map<string, TelevisionChannel>();
  for (const channel of TV_CHANNELS) groups.set(channel.slug, { key: channel.slug, name: channel.name, logo: channel.imagePath ?? null, products: [] });
  for (const product of products.filter(product => product.kind === "tv")) {
    const key = televisionProviderKey(product.provider);
    if (!groups.has(key)) groups.set(key, { key, name: product.provider, logo: null, products: [] });
    groups.get(key)!.products.push(product);
  }
  return [...groups.values()];
}
export type TelevisionMarket = "Guayaquil" | "Quito" | "Nacional" | "Otras plazas";
/** Filter explicit commercial coverage only. A blank or unknown market never becomes GYE/UIO. */
export function televisionMarkets(product: CatalogProduct): TelevisionMarket[] {
  const location = normalized((product.marketKeys?.length ? product.marketKeys.join(" ") : product.location));
  if (/\b(nacional|ecuador|todo el pais|todo el ecuador)\b/.test(location)) return ["Nacional"];
  const markets: TelevisionMarket[] = [];
  if (/\b(guayaquil|gye|guayas)\b/.test(location)) markets.push("Guayaquil");
  if (/\b(quito|uio|pichincha)\b/.test(location)) markets.push("Quito");
  return markets.length ? markets : ["Otras plazas"];
}
export function televisionEdition(product: CatalogProduct, catalog: BroadcastCatalog) {
  if (product.source.workspaceProductId || product.source.defaultPrice) return { key: "account", label: "Tarifas de tu cuenta" };
  const source = catalog.sources.find(source => source.id === product.source.sourceId);
  return source ? { key: source.id, label: `${source.periodStart} – ${source.periodEnd}` } : { key: "catalog", label: "Tarifas del catálogo" };
}

/** All account-resolved programmes are visible initially, including approved
 * defaults that do not belong to a broadcast-source edition. */
export function televisionPrograms(products: CatalogProduct[], catalog: BroadcastCatalog, market: TelevisionMarket, query = "", edition = "all") {
  const needle = normalized(query);
  return products.filter(product => product.kind === "tv" && televisionMarkets(product).includes(market)
    && (edition === "all" || televisionEdition(product, catalog).key === edition)
    && normalized(`${product.name} ${product.format} ${product.unit}`).includes(needle))
    .sort((a,b) => a.name.localeCompare(b.name,"es",{numeric:true}) || a.format.localeCompare(b.format,"es",{numeric:true}));
}

/** An expired archive edition must not hide current negotiated programmes or
 * appear as an active buying option. Historical plan records stay untouched. */
export function activeTelevisionProducts(products: CatalogProduct[], day: string) {
  return products.filter(product => product.kind === "tv"
    && (!product.validFrom || product.validFrom <= day)
    && (!product.validTo || product.validTo >= day));
}
