"use client";

import { useId, useMemo, useState } from "react";
import type { StrategyAllocation } from "@/lib/media-strategy";
import { strategyRadioMonths } from "@/lib/strategy-groups";
import { radioMonthSchedule } from "@/lib/radio-schedule";
import { formatBudgetInput } from "@/lib/brief-inputs";
import { MediaProviderMark } from "./MediaProviderMark";
import styles from "./RadioMonthlySchedule.module.css";

const money = (value: number) => `$ ${formatBudgetInput(value)}`;
const monthLabel = (month: string, long = false) => new Intl.DateTimeFormat("es-EC", {
  month: long ? "long" : "short", year: "numeric", timeZone: "UTC",
}).format(new Date(`${month}-01T00:00:00Z`));
const weekdays = ["D", "L", "M", "X", "J", "V", "S"];

export function RadioMonthlySchedule({ allocation }: { allocation: StrategyAllocation }) {
  const id = useId();
  const months = useMemo(() => strategyRadioMonths(allocation), [allocation]);
  const [selected, setSelected] = useState<string | null>(null);
  const active = months.find(m => m.month === selected);
  const schedule = useMemo(() => active ? radioMonthSchedule(allocation, active.month) : null, [allocation, active]);
  if (!months.length) return null;

  return <section className={styles.root} aria-label="Pauta mensual de radio">
    <div className={styles.heading}><h4>Pauta mensual</h4><span>Selecciona un mes para ver su mapa de pauta</span></div>
    <div className={styles.months}>{months.map(month => <button key={month.month} type="button"
      aria-expanded={selected === month.month} aria-controls={`${id}-map`} aria-label={`Ver mapa de pauta de ${monthLabel(month.month, true)}`}
      className={styles.month} onClick={() => setSelected(value => value === month.month ? null : month.month)}>
      <strong>{monthLabel(month.month)}</strong><span>{month.stations} emisoras · {month.units} cuñas</span>
      <b>{money(month.spend)}</b><i aria-hidden="true">{selected === month.month ? "−" : "+"}</i>
    </button>)}</div>
    <div id={`${id}-map`} hidden={!schedule}>{schedule && <>
      <header className={styles.mapHeading}><div><h5>Mapa de pauta · {monthLabel(schedule.month, true)}</h5><p>{schedule.stations} emisoras · {schedule.units} cuñas · {money(schedule.spendUsd)}</p></div>
        <button type="button" onClick={() => setSelected(null)} aria-label="Cerrar mapa de pauta mensual">Cerrar <span aria-hidden="true">×</span></button></header>
      <div className={styles.scroll} role="region" aria-label={`Calendario de cuñas de ${monthLabel(schedule.month, true)}`} tabIndex={0}>
        <table className={styles.table}>
          <caption>Cuñas por día · Pauta sugerida</caption>
          <thead><tr><th scope="col" className={styles.station}>Emisora</th><th scope="col">Costo por cuña</th><th scope="col">Cuñas</th><th scope="col">Total</th>
            {schedule.dates.map(date => <th key={date.date} scope="col" className={`${styles.date} ${date.weekend ? styles.weekend : ""}`} aria-label={new Intl.DateTimeFormat("es-EC", {dateStyle:"full", timeZone:"UTC"}).format(new Date(`${date.date}T00:00:00Z`))}>
              <span>{weekdays[new Date(`${date.date}T00:00:00Z`).getUTCDay()]}</span><b>{String(date.day).padStart(2, "0")}</b></th>)}
          </tr></thead>
          <tbody>{schedule.rows.map(row => <tr key={row.key}>
            <th scope="row" className={styles.station}><div className={styles.identity}><MediaProviderMark provider={row.station} medium="radio" context={row.market}/><div><strong>{row.station}</strong><small>{row.format}</small></div></div></th>
            <td className={styles.money}>{row.priceUsd == null ? "—" : money(row.priceUsd)}</td><td className={styles.quantity}>{row.units}</td><td className={`${styles.money} ${styles.total}`}>{money(row.totalUsd)}</td>
            {row.daily.map((units, i) => <td key={schedule.dates[i].date} className={`${styles.day} ${schedule.dates[i].weekend ? styles.weekend : ""}`}><span className={units ? styles.spots : styles.empty}>{units || "—"}</span></td>)}
          </tr>)}</tbody>
          <tfoot><tr><th scope="row" className={styles.station}>Total del mes</th><td/><td className={styles.quantity}>{schedule.units}</td><td className={styles.money}>{money(schedule.spendUsd)}</td>{schedule.dailyTotals.map((units, i) => <td key={schedule.dates[i].date} className={styles.day}>{units || "—"}</td>)}</tr></tfoot>
        </table>
      </div>
    </>}</div>
  </section>;
}
