import Image from "next/image";
import type { BroadcastCatalog } from "@/lib/broadcast-catalog";
import { radioRegions, type RadioDirectoryEntry } from "@/lib/radio-directory";
import { radioStationRankings, radioTariffStatus } from "@/lib/radio-station";
import styles from "./RadioDirectory.module.css";

const money = (value: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
const number = (value: number | null, decimals = 3) => value == null ? "—" : new Intl.NumberFormat("es-EC", { maximumFractionDigits: decimals }).format(value);
const date = (value: string) => value.split("-").reverse().join("/");

export function RadioStationDetail({ station, catalog, asOf }: { station: RadioDirectoryEntry; catalog: BroadcastCatalog; asOf: string }) {
  const profile = station.profile;
  const rankings = radioStationRankings(profile, catalog, asOf);
  const regions = station.regionKeys.map(key => radioRegions.find(region => region.key === key)?.label).filter(Boolean);
  return <div className={styles.detail}>
    <header className={styles.detailHero}>
      <div className={styles.detailLogo}>{station.logoPath ? <Image src={station.logoPath} alt={`Logo de ${station.name}`} fill sizes="140px" className="object-contain p-4" /> : <><span aria-hidden="true">{station.name.split(/\s+/).filter(word => !["radio", "fm", "am"].includes(word.toLocaleLowerCase("es"))).slice(0, 2).map(word => word[0]).join("")}</span><small>Logo pendiente</small></>}</div>
      <div className={styles.detailIntro}><p className={styles.eyebrow}>Ficha de emisora</p><h3>{station.name}</h3><p className={styles.stationFacts}>{[station.city, station.dial].filter(Boolean).join(" · ") || regions.join(" · ")}</p>{station.description && <p className={styles.stationDescription}>{station.description}</p>}{station.genres.length > 0 && <div className={styles.genres}>{station.genres.map(genre => <span key={genre}>{genre}</span>)}</div>}{profile.website && <a className={styles.officialLink} href={profile.website} target="_blank" rel="noopener noreferrer">Sitio oficial ↗</a>}</div>
    </header>
    <nav className={styles.detailNav} aria-label={`Secciones de ${station.name}`}><a href="#radio-coverage">Cobertura</a><a href="#radio-tariffs">Tarifas</a><a href="#radio-rankings">Rankings</a></nav>
    <section id="radio-coverage" className={styles.detailSection} aria-labelledby="radio-coverage-title">
      <p className={styles.eyebrow}>01 · Territorio</p><h4 id="radio-coverage-title">Cobertura</h4>
      <p>{profile.coverage || `Referencia territorial del directorio: ${[station.city, ...regions].filter(Boolean).join(" · ")}. La extensión de la señal no está declarada en esta ficha.`}</p>
      <div className={styles.coverageTags}>{regions.map(label => <span key={label}>{label}</span>)}</div>
    </section>
    <section id="radio-tariffs" className={styles.detailSection} aria-labelledby="radio-tariffs-title">
      <p className={styles.eyebrow}>02 · Inversión</p><h4 id="radio-tariffs-title">Tarifas y formatos</h4>
      {!profile.tariffs.length ? <p className={styles.missing}>Todavía no hay un tarifario incorporado para esta emisora.</p> : <div className={styles.editions}>{profile.tariffs.map(tariff => {
        const status = radioTariffStatus(tariff, asOf);
        return <article key={tariff.id} className={styles.edition}>
          <div className={styles.editionHeading}><div><h5>{tariff.label}</h5><p>{tariff.edition}</p></div><span className={status === "Vigente" ? styles.current : styles.reference}>{status}</span></div>
          <dl className={styles.sourceFacts}><div><dt>Plaza de la tarifa</dt><dd>{tariff.market}</dd></div><div><dt>Público</dt><dd>{tariff.target}</dd></div><div><dt>Vigencia declarada</dt><dd>{tariff.validFrom && tariff.validTo ? `${date(tariff.validFrom)} – ${date(tariff.validTo)}` : "No especificada"}</dd></div><div><dt>Base comercial</dt><dd>{tariff.unit === "second" ? "USD por segundo" : "USD por cuña"} · {tariff.taxIncluded === false ? "Sin IVA" : tariff.taxIncluded === true ? "IVA incluido" : "Impuestos no declarados"}</dd></div></dl>
          <div className={styles.tableWrap}><table><caption className="sr-only">Tarifas de {station.name} · {tariff.edition}</caption><thead><tr><th>Formato</th><th>Duración / unidad</th><th>Tarifa USD</th></tr></thead><tbody>{tariff.rates.map((rate, index) => <tr key={`${rate.label}-${index}`}><th scope="row">{rate.label}</th><td>{tariff.unit === "second" ? "1 segundo" : rate.seconds ? `${rate.seconds} segundos` : "Cuña"}</td><td>{money(rate.amountUsd)}</td></tr>)}</tbody></table></div>
          {tariff.conditions && <p className={styles.conditions}>{tariff.conditions}</p>}
        </article>;
      })}</div>}
    </section>
    <section id="radio-rankings" className={styles.detailSection} aria-labelledby="radio-rankings-title">
      <p className={styles.eyebrow}>03 · Audiencia</p><h4 id="radio-rankings-title">Últimos rankings disponibles</h4>
      <p className={styles.description}>Última medición de cada plaza, público y franja disponibles para esta emisora.</p>
      {catalog.error ? <p role="alert" className={styles.missing}>{catalog.error}</p> : !rankings.length ? <p className={styles.missing}>No hay un ranking vinculado con identidad y plaza verificadas para esta emisora.</p> : <div className={styles.editions}>{rankings.map(({ source, row }) => <article key={`${source.id}-${row.id}`} className={styles.rankingEdition}>
        <div className={styles.editionHeading}><div><h5>{source.market}</h5><p>{source.target}</p></div><span className={styles.reference}>Medición {date(source.periodEnd)}</span></div>
        <dl className={styles.sourceFacts}><div><dt>Período medido</dt><dd>{date(source.periodStart)} – {date(source.periodEnd)}</dd></div><div><dt>Frecuencia</dt><dd>{source.frequency || "No declarada"}</dd></div><div><dt>Días y franja</dt><dd>{source.daypart || "No declarados"}</dd></div><div><dt>Nombre en el estudio</dt><dd>{row.name}</dd></div></dl>
        <dl className={styles.metrics}><div><dt>Puesto del corte</dt><dd>{row.rank == null ? "—" : `#${row.rank}`}</dd></div><div><dt>Rating (%)</dt><dd>{number(row.rating)}</dd></div><div><dt>Share (%)</dt><dd>{number(row.share)}</dd></div><div><dt>Audiencia del estudio</dt><dd>{number(row.audience, 0)}</dd></div></dl>
        {source.conditions && <p className={styles.conditions}>{source.conditions}</p>}
      </article>)}</div>}
      {rankings.length > 0 && <p className={styles.note}>Cada puesto corresponde a su propio corte. Las audiencias de distintas plazas o públicos no se suman ni representan el alcance acumulado de una campaña.</p>}
    </section>
  </div>;
}
