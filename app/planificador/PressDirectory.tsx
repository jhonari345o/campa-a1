"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { pressEntriesForRegion, pressMatches, pressOfferMatches, pressRegions, pressEditionStatus, type PressCatalog, type PressEntry } from "@/lib/press-catalog";
import { radioLandscapes } from "@/lib/radio-landscapes";
import common from "./RadioDirectory.module.css";
import styles from "./PressDirectory.module.css";

const countLabel = (count: number) => `${count} ${count === 1 ? "cabecera" : "cabeceras"}`;
const money = (value: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
export function PressDirectoryPanel({ catalog }: { catalog: PressCatalog }) {
  const [regionKey, setRegionKey] = useState<string | null>(null), [query, setQuery] = useState(""), [entryId, setEntryId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const region = pressRegions.find(region => region.key === regionKey);
  const entries = region ? pressEntriesForRegion(catalog, region.key) : [];
  const shown = entries.filter(entry => pressMatches(entry, query));
  const selected = entries.find(entry => entry.id === entryId);
  function selectRegion(key: string | null) { setRegionKey(key); setEntryId(null); setQuery(""); }
  useEffect(() => { if (regionKey) { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: "start", behavior: "instant" }); } }, [regionKey, entryId]);
  return <section className="media-portal-section">
    <header className={common.heading}><div><p className={common.eyebrow}>Prensa</p><h2 ref={heading} tabIndex={-1} className={common.title}>{selected ? "Ficha de prensa" : region ? region.key === "national" ? "Cabeceras nacionales" : `Prensa de ${region.label}` : "Prensa por provincia"}</h2><p className={common.description}>{selected ? "Cobertura, formatos y ediciones del tarifario." : region ? "Elige una cabecera para revisar su ficha y sus formatos." : "Explora las cabeceras nacionales o selecciona una provincia."}</p></div>{!selected && <span className={common.count}>{region ? countLabel(entries.length) : "Nacionales + 24 provincias"}</span>}</header>
    {region && <nav className={common.breadcrumb} aria-label="Ubicación en el directorio de prensa"><button type="button" onClick={() => selectRegion(null)}>← Todas las coberturas</button><span aria-hidden="true">/</span>{selected ? <><button type="button" onClick={() => setEntryId(null)}>{region.label}</button><span aria-hidden="true">/</span><span aria-current="page">{selected.name}</span></> : <span aria-current="page">{region.label}</span>}</nav>}
    {catalog.error ? <p role="alert" className={common.empty}>{catalog.error}</p> : selected ? <PressProfile key={selected.id} entry={selected} asOf={catalog.asOfDate ?? ""} regionKey={regionKey!} /> : !region ? <>
      <div className={common.regions} aria-label="Coberturas de prensa">{pressRegions.map(region => { const photo = radioLandscapes[region.key]; return <button key={region.key} type="button" className={region.key === "national" ? common.national : common.province} onClick={() => selectRegion(region.key)}>
        {photo && <span className={common.landscape} aria-hidden="true"><Image src={photo.path} alt="" fill sizes="(max-width:600px) 220px, 300px" className="object-cover" /></span>}
        <span className={common.regionIcon} aria-hidden="true"><PressIcon /></span><span className={common.regionCopy}><strong>{region.label}</strong><span>{countLabel(pressEntriesForRegion(catalog, region.key).length)}</span>{photo && <small>{photo.label}</small>}</span><span aria-hidden="true" className={common.arrow}>→</span>
      </button>; })}</div>
      <details className={common.credits}><summary>Créditos de fotografías</summary><ul>{pressRegions.filter(region => radioLandscapes[region.key]).map(region => { const photo = radioLandscapes[region.key]; return <li key={region.key}><a href={photo.source} target="_blank" rel="noopener noreferrer">{region.label} · {photo.label}</a> — {photo.author} · <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">{photo.license}</a>. Recorte y conversión a WebP.</li>; })}</ul></details>
    </> : <>
      <div className={common.searchRow}><label>Buscar cabecera en {region.label}<input type="search" placeholder="Nombre o ciudad" value={query} maxLength={100} onChange={event => setQuery(event.target.value)} /></label><p role="status">{shown.length} de {countLabel(entries.length)}</p></div>
      <div className={common.stations}>{shown.map(entry => <article key={entry.id} className={common.station}><div className={common.stationHeader}><Logo entry={entry} /><span className={common.stationScope}>{region.label}</span></div><h3><button className={common.stationOpen} type="button" aria-label={`Ver ficha de ${entry.name}`} onClick={() => setEntryId(entry.id)}>{entry.name}</button></h3>{entry.city && <p className={common.stationFacts}>{entry.city}</p>}<p className={common.stationDescription}>{entry.description}</p><p className={common.stationFacts}>{entry.editions.some(edition => edition.offers.length) ? "Formatos y tarifarios incorporados" : "Ficha de directorio"}</p><span className={common.openLabel} aria-hidden="true">Ver ficha completa <span>→</span></span></article>)}</div>
      {!shown.length && <p className={common.empty}>{query ? "No hay cabeceras que coincidan con esta búsqueda." : "Todavía no hay cabeceras incorporadas en esta provincia."}</p>}
    </>}
  </section>;
}
function Logo({ entry, large = false }: { entry: PressEntry; large?: boolean }) {
  return <div className={large ? common.detailLogo : common.logo}>{entry.logoPath ? <Image src={entry.logoPath} alt={large ? `Logo de ${entry.name}` : ""} fill sizes={large ? "140px" : "72px"} className="object-contain p-3" /> : <><PressIcon />{large && <small>Logo pendiente</small>}</>}</div>;
}
function PressProfile({ entry, asOf, regionKey }: { entry: PressEntry; asOf: string; regionKey: string }) {
  const [editionId, setEditionId] = useState(entry.editions[0]?.id ?? ""), [family, setFamily] = useState(""), [market, setMarket] = useState(""), [query, setQuery] = useState("");
  const edition = entry.editions.find(item => item.id === editionId) ?? entry.editions[0];
  const families = [...new Set(edition?.offers.map(offer => offer.group) ?? [])];
  const currentFamily = families.includes(family) ? family : families[0] ?? "";
  const familyOffers = edition?.offers.filter(offer => offer.group === currentFamily) ?? [];
  const markets = [...new Set(familyOffers.map(offer => offer.market))];
  const preferred = regionKey === "national" ? markets.find(market => market.startsWith("ECU")) : regionKey === "azuay" ? markets.find(market => market === "Cuenca") : markets.find(market => market === "Quito o Guayaquil");
  const currentMarket = markets.includes(market) ? market : preferred ?? markets[0] ?? "";
  const offers = familyOffers.filter(offer => offer.market === currentMarket && pressOfferMatches(offer, query));
  return <div className={common.detail}>
    <header className={common.detailHero}><Logo entry={entry} large /><div className={common.detailIntro}><p className={common.eyebrow}>Ficha de prensa</p><h3>{entry.name}</h3>{entry.city && <p className={common.stationFacts}>{entry.city}</p>}<p className={common.stationDescription}>{entry.description}</p>{entry.website && <a className={common.officialLink} href={entry.website} target="_blank" rel="noopener noreferrer">Sitio oficial ↗</a>}</div></header>
    <nav className={common.detailNav} aria-label={`Secciones de ${entry.name}`}><a href="#press-coverage">Cobertura</a><a href="#press-formats">Formatos y tarifas</a></nav>
    <section id="press-coverage" className={common.detailSection} aria-labelledby="press-coverage-title"><p className={common.eyebrow}>01 · Territorio</p><h4 id="press-coverage-title">Cobertura y edición</h4><p>{entry.coverage}</p><div className={common.coverageTags}>{entry.regionKeys.map(key => <span key={key}>{pressRegions.find(region => region.key === key)?.label}</span>)}</div></section>
    <section id="press-formats" className={common.detailSection} aria-labelledby="press-formats-title"><p className={common.eyebrow}>02 · Formatos</p><h4 id="press-formats-title">Formatos y tarifas</h4>
      {!edition ? <p className={common.missing}>Todavía no hay un tarifario incorporado para esta cabecera.</p> : <>
        <label className={styles.field}>Edición del tarifario<select value={edition.id} onChange={event => { setEditionId(event.target.value); setFamily(""); setMarket(""); setQuery(""); }}>{entry.editions.map(edition => <option key={edition.id} value={edition.id}>{edition.label} · {edition.period}</option>)}</select></label>
        <div className={common.editionHeading}><div><h5>{edition.label}</h5><p>{edition.period} · {edition.taxIncluded === false ? "Sin IVA" : edition.taxIncluded === true ? "IVA incluido" : "Impuestos no declarados"}</p></div><span className={pressEditionStatus(edition, asOf) === "Vigente" ? common.current : common.reference}>{pressEditionStatus(edition, asOf)}</span></div>
        <div className={common.views} role="group" aria-label="Familia de formatos de prensa">{families.map(group => <button key={group} type="button" aria-pressed={currentFamily === group} onClick={() => { setFamily(group); setMarket(""); setQuery(""); }}>{group}</button>)}</div>
        <div className={styles.filters}><label className={styles.field}>Cobertura del formato<select value={currentMarket} onChange={event => setMarket(event.target.value)}>{markets.map(market => <option key={market}>{market}</option>)}</select></label><label className={styles.field}>Buscar formato<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre, tamaño o posición" maxLength={100} /></label></div>
        <div className={`${common.tableWrap} ${styles.offerTable}`}><table><caption className="sr-only">{entry.name} · {edition.label} · {currentMarket}</caption><thead><tr><th>Formato</th><th>Especificaciones</th><th>Plaza y público</th><th>Tarifa USD</th></tr></thead><tbody>{offers.map(offer => <tr key={offer.id}><th scope="row">{offer.name}</th><td>{offer.specs}{offer.duration && <small>{offer.duration}</small>}{offer.notes && <small>{offer.notes}</small>}</td><td>{offer.market}<small>{offer.target}</small></td><td>{offer.priceUsd == null ? "Sin precio declarado" : money(offer.priceUsd)}<small>{offer.unit === "CPM" ? "por 1.000 impresiones" : `por ${offer.unit}`}</small></td></tr>)}</tbody></table></div>
        {!offers.length && <p className={common.missing}>No hay formatos que coincidan con esta búsqueda.</p>}
        <div className={styles.conditions}>{edition.conditions.map(condition => <p key={condition}>{condition}</p>)}</div>
      </>}
    </section>
  </div>;
}
function PressIcon() { return <svg viewBox="0 0 32 32" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M25 10h4v15a3 3 0 0 1-3 3H8a4 4 0 0 1-4-4V4h21v22a2 2 0 0 0 4 0M9 9h11M9 21h11M9 24h7" /><path d="M9 13h5v5H9zM18 13h3m-3 5h3" /></svg>; }
