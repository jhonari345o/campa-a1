import { TV_CHANNELS } from "./media-catalog";
import { normalized, type BroadcastCatalog } from "./broadcast-catalog";
import type { CatalogProduct } from "./catalog-shopping";
import geography from "./ecuador-geography.json";

export type TelevisionDistribution = "national" | "local" | "paid";
export type TelevisionChannel = { key: string; name: string; logo: string | null; products: CatalogProduct[]; distribution: TelevisionDistribution };
const aliases: Record<string, string[]> = {
  ecuavisa: ["ecuavisa"], "tc-television": ["tc", "tc television", "tc tv"], teleamazonas: ["teleamazonas"],
  "red-comercial": ["red comercial"], "oromar-tv": ["oromar", "oromar tv"], "ecuador-tv": ["ecuador tv"],
  "catomedia-ucsg": ["catomedia", "ucsg tv", "catomedia ucsg tv"],
  rts: ["rts"], tvc: ["tvc"],
  directv: ["directv", "direct tv"], xtrim: ["xtrim", "tv cable", "tvcable"],
};
export function televisionProviderKey(provider: string) {
  const key = normalized(provider);
  return Object.entries(aliases).find(([, names]) => names.some(name => key === name || key.startsWith(`${name} `)))?.[0] ?? key;
}
export function televisionChannels(products: CatalogProduct[]): TelevisionChannel[] {
  const groups = new Map<string, TelevisionChannel>();
  for (const channel of TV_CHANNELS) groups.set(channel.slug, { key: channel.slug, name: channel.name, logo: channel.imagePath ?? null, products: [], distribution: nationalOrder.includes(channel.slug) ? "national" : "local" });
  for (const product of products.filter(product => product.kind === "tv")) {
    const provider = televisionProviderKey(product.provider);
    // Pricing keeps RTS and TVC independent; navigation nests both in their commercial group.
    const key = provider === "rts" || provider === "tvc" ? "red-comercial" : provider;
    if (!groups.has(key)) groups.set(key, { key, name: product.provider, logo: product.image, products: [], distribution: nationalOrder.includes(key) ? "national" : product.source.tvDistribution ?? (["directv", "xtrim"].includes(key) ? "paid" : "local") });
    groups.get(key)!.products.push(product);
  }
  const order = {national:0,local:1,paid:2};
  return [...groups.values()].sort((a,b) => order[a.distribution]-order[b.distribution] || (a.distribution === "national" ? nationalOrder.indexOf(a.key)-nationalOrder.indexOf(b.key) : a.name.localeCompare(b.name,"es")));
}
const nationalOrder = ["ecuavisa", "tc-television", "red-comercial", "teleamazonas", "oromar-tv", "ecuador-tv"];
const provinces = geography.filter(item => item.kind === "province").map(item => ({ key: item.key.replace("province:", ""), label:item.label })).sort((a,b)=>a.label.localeCompare(b.label,"es"));
const provinceByCity: Record<string,string> = {guayaquil:"Guayas",gye:"Guayas",quito:"Pichincha",uio:"Pichincha",cuenca:"Azuay",ambato:"Tungurahua",machala:"El Oro",manta:"Manabí",portoviejo:"Manabí",riobamba:"Chimborazo",latacunga:"Cotopaxi",tulcan:"Carchi",ibarra:"Imbabura",puyo:"Pastaza",macas:"Morona Santiago",quevedo:"Los Ríos",babahoyo:"Los Ríos"};
const containsName = (value:string,name:string) => ` ${normalized(value)} `.includes(` ${normalized(name)} `);
/** Province navigation uses explicit tariff coverage, never the channel's name. */
export function televisionProvinces(product: CatalogProduct) {
  const values = product.marketKeys?.length ? product.marketKeys : [product.location];
  const labels = provinces.filter(province=>values.some(value=>containsName(value,province.label) || containsName(value,province.key))).map(item=>item.label);
  for (const value of values) {
    if(provinces.some(province=>normalized(province.label)===normalized(value)||normalized(province.key)===normalized(value)))continue;
    const cities=geography.filter(place=>place.kind==="city" && normalized(place.label)===normalized(value));
    const contexts=[...new Set(cities.map(city=>"context" in city ? city.context : undefined).filter(Boolean))];
    if(contexts.length===1)labels.push(contexts[0]!);
  }
  for (const [city,province] of Object.entries(provinceByCity)) if (values.some(value=>containsName(value,city))) labels.push(province);
  return [...new Set(labels)].sort((a,b)=>a.localeCompare(b,"es"));
}
export function televisionRegions(channels: TelevisionChannel[]) { return provinces.filter(province=>channels.some(channel=>channel.distribution==="local" && channel.products.some(product=>televisionProvinces(product).includes(province.label)))); }
export type TelevisionSignal = "rts" | "tvc" | "combo";
export function televisionSignal(product: CatalogProduct): TelevisionSignal | null {
  const key = televisionProviderKey(product.provider);
  return key === "rts" || key === "tvc" ? key : key === "red-comercial" ? "combo" : null;
}
export type TelevisionMarket = string;
/** Filter explicit commercial coverage only. A blank or unknown market never becomes GYE/UIO. */
export function televisionMarkets(product: CatalogProduct): TelevisionMarket[] {
  const location = normalized((product.marketKeys?.length ? product.marketKeys.join(" ") : product.location));
  if (/\b(nacional|ecuador|todo el pais|todo el ecuador)\b/.test(location)) return ["Nacional"];
  const markets: TelevisionMarket[] = [];
  if (/\b(guayaquil|gye|guayas)\b/.test(location)) markets.push("Guayaquil");
  if (/\b(quito|uio|pichincha)\b/.test(location)) markets.push("Quito");
  markets.push(...televisionProvinces(product).filter(province=>province!=="Guayas"&&province!=="Pichincha"));
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
