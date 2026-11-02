"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { radioDirectoryMatches, radioEntriesForRegion, radioRegions, type RadioDirectoryCatalog } from "@/lib/radio-directory";
import type { BroadcastCatalog } from "@/lib/broadcast-catalog";
import { BroadcastCatalogPanel } from "./BroadcastCatalog";
import { RadioStationDetail } from "./RadioStationDetail";
import { radioLandscapes } from "@/lib/radio-landscapes";
import styles from "./RadioDirectory.module.css";

const countLabel = (count: number) => `${count} ${count === 1 ? "emisora" : "emisoras"}`;
export function RadioDirectoryPanel({ directory, broadcast }: { directory: RadioDirectoryCatalog; broadcast: BroadcastCatalog }) {
  const [regionKey, setRegionKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rankings, setRankings] = useState(false);
  const [stationId, setStationId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const region = radioRegions.find(item => item.key === regionKey);
  const stations = region ? radioEntriesForRegion(directory.stations, region.key) : [];
  const shown = stations.filter(station => radioDirectoryMatches(station, query));
  const selectedStation = stations.find(station => station.id === stationId);
  function selectRegion(key: string | null) { setRegionKey(key); setStationId(null); setQuery(""); }
  useEffect(() => {
    if (regionKey) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [regionKey, stationId]);

  return <section className="media-portal-section">
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>Radio</p><h2 ref={heading} tabIndex={-1} className={styles.title}>{rankings ? "Rankings y audiencia" : selectedStation ? "Ficha de emisora" : region ? region.key === "national" ? "Emisoras nacionales" : `Emisoras de ${region.label}` : "Radio por cobertura"}</h2><p className={styles.description}>{rankings ? "Consulta cada estudio con su plaza, período y público." : selectedStation ? "Cobertura, tarifas y estudios de audiencia en un mismo lugar." : region ? "Explora las emisoras del directorio y abre su ficha completa." : "Elige Nacionales o una provincia para explorar sus emisoras."}</p></div>
      {!rankings && !selectedStation && <span className={styles.count}>{region ? countLabel(stations.length) : "Nacionales + 24 provincias"}</span>}
    </header>
    <div className={styles.views} role="group" aria-label="Consultas de radio">
      <button type="button" aria-pressed={!rankings} onClick={() => setRankings(false)}>Emisoras por cobertura</button>
      <button type="button" aria-pressed={rankings} onClick={() => setRankings(true)}>Rankings y audiencia</button>
    </div>
    {rankings ? <div className={styles.rankings}><BroadcastCatalogPanel kind="radio" catalog={broadcast} /></div> : <>
      {region && <nav className={styles.breadcrumb} aria-label="Ubicación en el directorio de radio"><button type="button" onClick={() => selectRegion(null)}>← Todas las coberturas</button><span aria-hidden="true">/</span>{selectedStation ? <><button type="button" onClick={() => setStationId(null)}>{region.label}</button><span aria-hidden="true">/</span><span aria-current="page">{selectedStation.name}</span></> : <span aria-current="page">{region.label}</span>}</nav>}
      {directory.error ? <p role="alert" className={styles.empty}>{directory.error}</p> : selectedStation ? <RadioStationDetail station={selectedStation} catalog={broadcast} asOf={directory.asOfDate ?? ""} /> : !region ? <>
        <div className={styles.regions} aria-label="Coberturas de radio">
          {radioRegions.map(item => {
            const count = radioEntriesForRegion(directory.stations, item.key).length;
            const landscape = radioLandscapes[item.key];
            return <button key={item.key} type="button" className={item.key === "national" ? styles.national : styles.province} onClick={() => selectRegion(item.key)}>
              {landscape && <span className={styles.landscape} aria-hidden="true"><Image src={landscape.path} alt="" fill sizes="(max-width:600px) 220px, 300px" className="object-cover" /></span>}
              <span className={styles.regionIcon} aria-hidden="true">{item.key === "national" ? <RadioIcon /> : <LocationIcon />}</span>
              <span className={styles.regionCopy}><strong>{item.label}</strong><span>{countLabel(count)}</span>{landscape && <small>{landscape.label}</small>}</span><span aria-hidden="true" className={styles.arrow}>→</span>
            </button>;
          })}
        </div>
        <details className={styles.credits}><summary>Créditos de fotografías</summary><ul>{radioRegions.filter(item => radioLandscapes[item.key]).map(item => { const photo = radioLandscapes[item.key]; return <li key={item.key}><a href={photo.source} target="_blank" rel="noopener noreferrer">{item.label} · {photo.label}</a> — {photo.author} · <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">{photo.license}</a>. Recorte y conversión a WebP.</li>; })}</ul></details>
      </> : <>
        <div className={styles.searchRow}><label>Buscar emisora en {region.label}<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre, ciudad o frecuencia" maxLength={100} /></label><p role="status">{shown.length} de {countLabel(stations.length)}</p></div>
        <div className={styles.stations}>{shown.map(station => <article key={station.id} className={styles.station}>
          <div className={styles.stationHeader}><div className={styles.logo}>{station.logoPath ? <Image src={station.logoPath} alt="" fill sizes="72px" className="object-contain p-2" /> : <RadioIcon />}</div><span className={styles.stationScope}>{region.label}</span></div>
          <h3><button type="button" className={styles.stationOpen} onClick={() => setStationId(station.id)} aria-label={`Ver ficha de ${station.name}`}>{station.name}</button></h3>
          {(station.city || station.dial) && <p className={styles.stationFacts}>{[station.city, station.dial].filter(Boolean).join(" · ")}</p>}
          {station.description && <p className={styles.stationDescription}>{station.description}</p>}
          {station.genres.length > 0 && <div className={styles.genres}>{station.genres.map(genre => <span key={genre}>{genre}</span>)}</div>}
          <span className={styles.openLabel} aria-hidden="true">Ver ficha completa <span>→</span></span>
        </article>)}</div>
        {!shown.length && <p className={styles.empty}>{query ? "No hay emisoras que coincidan con esta búsqueda." : "Todavía no hay emisoras incorporadas en esta cobertura."}</p>}
        {stations.length > 0 && <p className={styles.note}>Directorio territorial de referencia. La cobertura comercial y las frecuencias se verifican por emisora; los estudios de audiencia se consultan en “Rankings y audiencia”.</p>}
      </>}
    </>}
  </section>;
}
function RadioIcon() {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 8 17-5M5 11h22v17H5zM9 15h14M9 19h.01M9 23h.01" /><circle cx="20" cy="22" r="3" /></svg>;
}
function LocationIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}
