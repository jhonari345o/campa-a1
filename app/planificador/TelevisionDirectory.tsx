"use client";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import type { BroadcastCatalog } from "@/lib/broadcast-catalog";
import type { CatalogProduct } from "@/lib/catalog-shopping";
import { formatBudgetInput } from "@/lib/brief-inputs";
import { activeTelevisionProducts, televisionChannels, televisionEdition, televisionMarkets, televisionPrograms, televisionProvinces, televisionRegions, televisionSignal, type TelevisionDistribution, type TelevisionMarket, type TelevisionSignal } from "@/lib/television-directory";
import { CatalogInlineProduct, CatalogPrice } from "./CatalogShopping";
import styles from "./TelevisionDirectory.module.css";

const distributionLabels: Record<TelevisionDistribution,string> = {national:"Nacionales",local:"Locales por provincia",paid:"TV pagada"};
const signalLabels: Record<TelevisionSignal,string> = {rts:"RTS",tvc:"TVC",combo:"Combo RTS + TVC"};
export function TelevisionDirectoryPanel({ catalog, products }: { catalog: BroadcastCatalog; products: CatalogProduct[] }) {
  return <div className="media-portal-section"><TelevisionProgramBrowser catalog={catalog} products={products}
    renderPrice={product => <CatalogPrice productKey={product.key} showReference={false}/>}
    renderAction={product => <CatalogInlineProduct productKey={product.key} label="Cuñas"/>}/></div>;
}

/** One programme list for the catalogue and DIY. Both receive only the
 * account-resolved products; no source tariff is reconstructed in the UI. */
export function TelevisionProgramBrowser({ catalog, products, renderAction, renderPrice, selectedKeys = [], day }: {
  catalog: BroadcastCatalog; products: CatalogProduct[];
  renderAction: (product: CatalogProduct) => ReactNode;
  renderPrice?: (product: CatalogProduct) => ReactNode;
  selectedKeys?: string[];
  day?: string;
}) {
  const currentDay = day || new Intl.DateTimeFormat("en-CA", {timeZone:"America/Guayaquil",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const channels = televisionChannels(activeTelevisionProducts(products, currentDay));
  const [distribution, setDistribution] = useState<TelevisionDistribution>("national");
  const [province, setProvince] = useState("");
  const [signal, setSignal] = useState<TelevisionSignal>("rts");
  const [channelKey, setChannelKey] = useState<string | null>(null);
  const [market, setMarket] = useState<TelevisionMarket>("Guayaquil");
  const [editionKey, setEditionKey] = useState("all"), [query, setQuery] = useState("");
  const regions = televisionRegions(channels);
  const visibleChannels = channels.filter(item=>item.distribution===distribution && (distribution!=="local" || !province || item.products.some(product=>televisionProvinces(product).includes(province))));
  const channel = visibleChannels.find(item => item.key === channelKey);
  const channelProducts = (channel?.products ?? []).filter(product => channel?.key!=="red-comercial" || televisionSignal(product)===signal);
  const markets = [...new Set(channelProducts.flatMap(televisionMarkets))];
  const currentMarket = markets.includes(market) ? market : markets[0] ?? "Guayaquil";
  const marketRows = channelProducts.filter(product => televisionMarkets(product).includes(currentMarket));
  const editions = [...new Map(marketRows.map(product => { const edition = televisionEdition(product, catalog); return [edition.key, edition]; })).values()];
  const currentEdition = editionKey === "all" || editions.some(item => item.key === editionKey) ? editionKey : "all";
  const rows = televisionPrograms(channelProducts, catalog, currentMarket, query, currentEdition);
  function openChannel(key: string) {
    const selected = channels.find(item => item.key === key);
    setChannelKey(key); setQuery(""); setEditionKey("all");
    const firstSignal = (["rts","tvc","combo"] as TelevisionSignal[]).find(item=>selected?.products.some(product=>televisionSignal(product)===item)) ?? "rts";
    setSignal(firstSignal);
    const available = (selected?.products ?? []).filter(product=>key!=="red-comercial"||televisionSignal(product)===firstSignal).flatMap(televisionMarkets);
    setMarket(available.includes(province) ? province : available[0] ?? "Guayaquil");
  }
  return <section className={styles.root} aria-label="Programas de televisión">
    <header className={styles.heading}><div><p className={styles.eyebrow}>Televisión</p><h2>Elige tus programas</h2><p>Selecciona un canal, elige la plaza y añade las cuñas de cada programa.</p></div><span className={styles.count}>{visibleChannels.length} canales y grupos</span></header>
    {catalog.error && <p role="alert" className={styles.empty}>{catalog.error}</p>}
    <div className={styles.distributions} role="group" aria-label="Tipo de televisión">{(Object.keys(distributionLabels) as TelevisionDistribution[]).map(key=><button type="button" key={key} aria-pressed={distribution===key} onClick={()=>{setDistribution(key);setChannelKey(null);setQuery("");setProvince("");}}>{distributionLabels[key]}</button>)}</div>
    {distribution==="local" && <div className={styles.provinces} role="group" aria-label="Provincias con televisión local"><button type="button" aria-pressed={!province} onClick={()=>{setProvince("");setChannelKey(null);}}>Todas las provincias</button>{regions.map(region=><button type="button" key={region.key} aria-pressed={province===region.label} onClick={()=>{setProvince(region.label);setChannelKey(null);}}>{region.label}</button>)}</div>}
    <div className={styles.channels} role="group" aria-label="Seleccionar canal de televisión">{visibleChannels.map(item => <button type="button" key={item.key} className={styles.channel} onClick={() => openChannel(item.key)} aria-label={`Ver programas de ${item.name}`} aria-pressed={channelKey === item.key}>
      <span className={styles.logo}>{item.logo ? <Image src={item.logo} alt="" fill sizes="120px" className="object-contain p-3"/> : <TvIcon/>}</span><strong>{item.name}</strong>{item.key==="red-comercial"&&<small>RTS · TVC · Combo</small>}
    </button>)}</div>
    {channel ? <div className={styles.tariffPanel} aria-label={`Tarifario de ${channel.name}`}>
      <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Programación y tarifas</p><h3>{channel.name}</h3></div><span role="status">{rows.length} {rows.length === 1 ? "opción" : "opciones"} · {currentMarket}</span></div>
      {channel.key==="red-comercial"&&<div className={styles.signals} role="group" aria-label="Señales de Red Comercial">{(Object.keys(signalLabels) as TelevisionSignal[]).map(key=><button type="button" key={key} aria-pressed={signal===key} onClick={()=>{setSignal(key);setEditionKey("all");setQuery("");}}>{signalLabels[key]}</button>)}</div>}
      <div className={styles.markets} role="group" aria-label="Plaza de televisión">{markets.map(item => <button type="button" key={item} aria-pressed={currentMarket === item} onClick={() => { setMarket(item); setEditionKey("all"); setQuery(""); }}>{item}</button>)}</div>
      <div className={styles.filters}><label className={styles.search}>Buscar programa<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre, horario o duración" maxLength={100}/></label>
        {editions.length > 1 && <div className={styles.editions} role="group" aria-label="Ediciones de tarifas"><button type="button" aria-pressed={currentEdition === "all"} onClick={() => setEditionKey("all")}>Todas las tarifas</button>{editions.map(edition => <button type="button" key={edition.key} aria-pressed={currentEdition === edition.key} onClick={() => setEditionKey(edition.key)}>{edition.label}</button>)}</div>}
      </div>
      {!!rows.length && <><div className={styles.columnHead} aria-hidden="true"><span>Programa y emisión</span><span>Tarifa</span><span>Tu selección</span></div><ul className={styles.programs} aria-label={`Programas de ${channel.name} en ${currentMarket}`}>{rows.map(product => <li key={product.key} className={`${styles.program} ${selectedKeys.includes(product.key) ? styles.selected : ""}`}>
        <div className={styles.programInfo}><h4>{product.name}</h4><p>{product.format}</p><small>{product.unit}</small>{product.conditions && <p className={styles.conditions}>{product.conditions}</p>}</div>
        <div className={styles.price}>{renderPrice ? renderPrice(product) : <><strong>{product.priceCents == null ? "Consultar tarifa" : `$ ${formatBudgetInput(product.priceCents / 100)}`}</strong>{product.taxIncluded!==null&&<small>{product.taxIncluded ? "IVA incluido" : "Sin IVA"}</small>}</>}</div>
        <div className={styles.action}>{renderAction(product)}</div>
      </li>)}</ul></>}
      {!rows.length && <p role="status" className={styles.panelEmpty}>{query.trim() ? "No hay programas que coincidan con esta búsqueda." : `No hay programas disponibles en esta plaza.${channel.products.some(product => televisionMarkets(product).includes("Nacional")) ? " Puedes consultar los paquetes en Nacional." : ""}`}</p>}
    </div> : <p className={styles.empty}>{visibleChannels.length ? "Selecciona un canal para ver su listado de programas." : "No hay canales disponibles en esta selección."}</p>}
  </section>;
}
function TvIcon() { return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="6" y="12" width="36" height="27" rx="6"/><path d="m17 4 7 8 8-8M17 44h14"/><path d="m21 20 9 6-9 6z"/></svg>; }
