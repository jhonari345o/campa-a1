"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { BroadcastCatalog } from "@/lib/broadcast-catalog";
import type { CatalogProduct } from "@/lib/catalog-shopping";
import { televisionChannels, televisionEdition, televisionMarkets, type TelevisionMarket } from "@/lib/television-directory";
import { CatalogInlineProduct, CatalogPrice } from "./CatalogShopping";
import styles from "./TelevisionDirectory.module.css";

const markets: TelevisionMarket[] = ["Guayaquil", "Quito", "Nacional", "Otras plazas"];
export function TelevisionDirectoryPanel({ catalog, products }: { catalog: BroadcastCatalog; products: CatalogProduct[] }) {
  const channels = televisionChannels(products);
  const [channelKey, setChannelKey] = useState<string | null>(null), [market, setMarket] = useState<TelevisionMarket>("Guayaquil");
  const [editionKey, setEditionKey] = useState(""), [query, setQuery] = useState("");
  const heading = useRef<HTMLHeadingElement>(null), previousChannel = useRef(channelKey);
  const channel = channels.find(channel => channel.key === channelKey);
  const marketRows = channel?.products.filter(product => televisionMarkets(product).includes(market)) ?? [];
  const editions = [...new Map(marketRows.map(product => { const edition = televisionEdition(product, catalog); return [edition.key, edition]; })).values()];
  const currentEdition = editions.find(edition => edition.key === editionKey) ?? editions[0];
  const needle = query.trim().toLocaleLowerCase("es");
  const rows = marketRows.filter(product => televisionEdition(product, catalog).key === currentEdition?.key && `${product.name} ${product.format}`.toLocaleLowerCase("es").includes(needle));
  useEffect(() => {
    if (previousChannel.current === channelKey) return;
    previousChannel.current = channelKey;
    heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [channelKey]);
  function openChannel(key: string) {
    const selected = channels.find(channel => channel.key === key);
    setChannelKey(key); setQuery(""); setEditionKey("");
    setMarket(markets.find(market => selected?.products.some(product => televisionMarkets(product).includes(market))) ?? "Guayaquil");
  }
  return <section className="media-portal-section" aria-label="Catálogo de televisión">
    <header className={styles.heading}><div><p className={styles.eyebrow}>Televisión</p><h2 ref={heading} tabIndex={-1}>{channel ? channel.name : "Elige un canal"}</h2><p>{channel ? "Selecciona la plaza y explora sus programas, formatos y tarifas." : "Abre la ficha de un canal para ver su programación y elegir tus cuñas."}</p></div><span className={styles.count}>{channel ? `${channel.products.length} formatos` : `${channels.length} canales`}</span></header>
    {catalog.error && <p role="alert" className={styles.empty}>{catalog.error}</p>}
    <div className={`${styles.channels} ${channel ? styles.compactChannels : ""}`} role="group" aria-label="Seleccionar canal de televisión">{channels.map(item => <button type="button" key={item.key} className={styles.channel} onClick={() => openChannel(item.key)} aria-label={`Ver tarifas de ${item.name}`} aria-pressed={channelKey === item.key}>
      <span className={styles.logo}>{item.logo ? <Image src={item.logo} alt="" fill sizes="160px" className="object-contain p-4"/> : <TvIcon/>}</span><strong>{item.name}</strong><span>{item.products.length ? `${item.products.length} formatos disponibles` : "Ficha del canal"}</span>{!channel && <b aria-hidden="true">Explorar canal →</b>}
    </button>)}</div>
    {channel && <div className={styles.tariffPanel} aria-label={`Tarifario de ${channel.name}`}>
      <div className={styles.channelHero}><div className={styles.heroLogo}>{channel.logo ? <Image src={channel.logo} alt={`Logo de ${channel.name}`} fill sizes="170px" className="object-contain p-4"/> : <TvIcon/>}</div><div><span>Tu pauta en televisión</span><h3>{channel.name}</h3><p>Programa, franja, duración y tarifa en una sola ficha.</p></div></div>
      <div className={styles.markets} role="group" aria-label="Plaza de televisión">{markets.filter(item => item === "Guayaquil" || item === "Quito" || channel.products.some(product => televisionMarkets(product).includes(item))).map(item => <button type="button" key={item} aria-pressed={market === item} onClick={() => { setMarket(item); setEditionKey(""); setQuery(""); }}><span aria-hidden="true">{item === "Guayaquil" ? "GYE" : item === "Quito" ? "UIO" : item === "Nacional" ? "EC" : "+"}</span>{item}</button>)}</div>
      {editions.length > 1 && <div className={styles.editions} role="group" aria-label="Ediciones de tarifas">{editions.map(edition => <button type="button" key={edition.key} aria-pressed={currentEdition?.key === edition.key} onClick={() => setEditionKey(edition.key)}>{edition.label}</button>)}</div>}
      {!!marketRows.length && <div className={styles.search}><label>Buscar programa o formato<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Programa, franja o día" maxLength={100}/></label><span role="status">{rows.length} {rows.length === 1 ? "formato" : "formatos"} · {market}</span></div>}
      <div className={styles.offers}>{rows.map(product => <article key={product.key} className={styles.offer}><header><span>{market}</span><small>{product.unit}</small></header><h4>{product.name}</h4><p className={styles.format}>{product.format}</p><div className={styles.price}><CatalogPrice productKey={product.key}/></div><p className={styles.reference}>{product.referenceLabel || televisionEdition(product, catalog).label}{product.reference && ` · ${product.reference}`}</p>{product.conditions && <p className={styles.conditions}>{product.conditions}</p>}<div className={styles.buy}><CatalogInlineProduct productKey={product.key} label="Cuñas"/></div></article>)}</div>
      {!rows.length && <p role="status" className={styles.empty}>{needle ? "No hay programas que coincidan con esta búsqueda." : market === "Guayaquil" || market === "Quito" ? `No hay una tarifa específica de ${market} en esta ficha.${channel.products.some(product => televisionMarkets(product).includes("Nacional")) ? " Puedes consultar los paquetes en Nacional." : ""}` : "No hay formatos incorporados para esta plaza."}</p>}
    </div>}
  </section>;
}
function TvIcon() { return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="6" y="12" width="36" height="27" rx="6"/><path d="m17 4 7 8 8-8M17 44h14"/><path d="m21 20 9 6-9 6z"/></svg>; }
