"use client";

import { useId, useState } from "react";
import type { StackAdaptDashboard, StackAdaptBreakdowns, DeliveryBreakdown } from "@/lib/ads/stackadapt-dashboard";
import { deliveryRates } from "@/lib/ads/stackadapt-metrics";
import styles from "./StackAdaptReport.module.css";

export const formatNumber = (value: number | null | undefined, digits = 2) => value == null ? "—" : new Intl.NumberFormat("es-EC", { maximumFractionDigits: digits }).format(value);
const shortDate = (date: string) => new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  const safe = /^\s*[=+@-]|^[\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
type ChartMetric = "impressions" | "clicks" | "cost";
const chartLabels: Record<ChartMetric, string> = { impressions: "Impresiones", clicks: "Clics", cost: "Inversión" };

export function StackAdaptReport({ report, breakdowns, advertiserName, currency, breakdownBusy, breakdownError, onRetryBreakdowns }: {
  report: StackAdaptDashboard; breakdowns: StackAdaptBreakdowns | null; advertiserName: string; currency: string;
  breakdownBusy: boolean; breakdownError: string; onRetryBreakdowns: () => void;
}) {
  const [chartMetric, setChartMetric] = useState<ChartMetric>("impressions");
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const chartId = useId();
  const money = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("es-EC", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  if (report.state === "processing") return <div className={styles.notice} role="status">StackAdapt está preparando los resultados. Pulsa «Actualizar reporte» para volver a consultar.</div>;
  if (!report.metrics) return <div className={styles.empty}><h3>Sin entrega en este período</h3><p>Prueba con otras fechas o selecciona otra campaña.</p></div>;
  const m = report.metrics, rates = deliveryRates(m);
  const max = Math.max(1, ...report.daily.map(day => day.metrics?.[chartMetric] ?? 0));
  const chartValue = (value: number | null | undefined) => chartMetric === "cost" ? money(value ?? null) : formatNumber(value, 0);
  const selectedDay = report.daily.find(day => day.date === hoverDate);
  const width = 960, height = 240, left = 64, top = 15, plotWidth = width - left - 12, plotHeight = 182;
  const barStep = plotWidth / Math.max(1, report.daily.length);
  const selectedCampaign = report.campaigns.find(c => c.id === report.campaignId);
  function exportCsv() {
    const columns = ["Anunciante", "Campaña", "Desde", "Hasta", "Fecha", "Inversión", "Moneda", "Impresiones", "Clics", "CTR (%)", "Conversiones", "Videos completos"];
    const rows = report.daily.map(day => [advertiserName, selectedCampaign?.name ?? "Todas las campañas", report.from, report.to, day.date, day.metrics?.cost, currency, day.metrics?.impressions, day.metrics?.clicks, day.metrics ? deliveryRates(day.metrics).ctr : null, day.metrics?.conversions, day.metrics?.videoCompletions]);
    const csv = "\uFEFF" + [columns, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `reporte-stackadapt-${report.advertiserId}-${report.from}-${report.to}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className={styles.report}>
    <header className={styles.reportHeader}>
      <div><p className={styles.eyebrow}>Resultados de campaña · StackAdapt</p><h2>{advertiserName}</h2><p>{shortDate(report.from)} – {shortDate(report.to)} {report.to.slice(0, 4)} · {selectedCampaign?.name ?? "Todas las campañas"}</p></div>
      <div className={styles.exportActions}><button type="button" onClick={exportCsv}>Descargar datos ↓</button><button type="button" onClick={() => window.print()}>Imprimir / PDF ↗</button></div>
    </header>
    <dl className={styles.kpis}>
      {([
        ["Inversión", money(m.cost), currency], ["Impresiones", formatNumber(m.impressions, 0), "Exposiciones del anuncio"],
        ["Alcance reportado", formatNumber(m.uniqueImpressions, 0), "Identificadores únicos de StackAdapt"], ["Frecuencia", m.frequency == null ? "—" : `${formatNumber(m.frequency)}×`, "Exposiciones por identificador único"],
        ["Clics", formatNumber(m.clicks, 0), "Clics reportados"], ["CTR", rates.ctr == null ? "—" : `${formatNumber(rates.ctr)}%`, "Clics / impresiones"],
      ] as const).map(([label, value, note]) => <div key={label}><dt>{label}</dt><dd>{value}</dd><small>{note}</small></div>)}
    </dl>
    <dl className={styles.secondaryKpis}>{([
      ["CPM", money(rates.cpm)], ["CPC", money(rates.cpc)], ["Conversiones", formatNumber(m.conversions)], ["Videos completos", formatNumber(m.videoCompletions, 0)],
    ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <section className={styles.card} aria-labelledby={`${chartId}-heading`}>
      <div className={styles.cardHeading}><div><h3 id={`${chartId}-heading`}>Evolución diaria</h3><p>{selectedDay ? `${shortDate(selectedDay.date)} · ${chartValue(selectedDay.metrics?.[chartMetric])}` : `${chartLabels[chartMetric]} durante el período`}</p></div>
        <div className={styles.segmented} aria-label="Métrica del gráfico">{(Object.keys(chartLabels) as ChartMetric[]).map(key => <button type="button" key={key} aria-pressed={chartMetric === key} onClick={() => { setChartMetric(key); setHoverDate(null); }}>{chartLabels[key]}</button>)}</div>
      </div>
      <div className={styles.chartScroll}>
        <svg viewBox={`0 0 ${width} ${height}`} className={styles.chart} role="img" aria-labelledby={`${chartId}-title ${chartId}-desc`} onMouseLeave={() => setHoverDate(null)}>
          <title id={`${chartId}-title`}>{chartLabels[chartMetric]} por día de {advertiserName}</title>
          <desc id={`${chartId}-desc`}>Gráfico de barras de {report.from} a {report.to}. Los valores completos están en «Ver datos diarios».</desc>
          {[0, .5, 1].map(f => <g key={f}><line x1={left} x2={width - 12} y1={top + plotHeight * (1 - f)} y2={top + plotHeight * (1 - f)} className={styles.gridline}/><text x={left - 10} y={top + plotHeight * (1 - f) + 4} textAnchor="end" className={styles.axis}>{new Intl.NumberFormat("es-EC", { notation: "compact", maximumFractionDigits: 1 }).format(max * f)}</text></g>)}
          {report.daily.map((day, i) => {
            const value = day.metrics?.[chartMetric], h = value == null ? 0 : value / max * plotHeight;
            return <g key={day.date} onMouseEnter={() => setHoverDate(day.date)}><rect x={left + i * barStep + 1} y={top} width={Math.max(1, barStep - 2)} height={plotHeight} fill="transparent"><title>{shortDate(day.date)}: {chartValue(value)}</title></rect><rect x={left + i * barStep + 1} y={top + plotHeight - h} width={Math.max(1, barStep - 2)} height={h} rx={Math.min(3, barStep / 4)} className={hoverDate === day.date ? styles.barSelected : styles.bar}><title>{shortDate(day.date)}: {chartValue(value)}</title></rect>{(i === 0 || i === report.daily.length - 1 || i % Math.ceil(report.daily.length / 7) === 0) && <text x={left + (i + .5) * barStep} y={top + plotHeight + 26} textAnchor="middle" className={styles.axis}>{shortDate(day.date)}</text>}</g>;
          })}
        </svg>
      </div>
      {!report.dailyComplete && <p className={styles.note}>El desglose diario está incompleto. Los indicadores superiores conservan el total reportado por StackAdapt.</p>}
      <details className={styles.dailyDetails}><summary>Ver datos diarios</summary><div className={styles.tableScroll}><table><caption className={styles.srOnly}>Entrega por día</caption><thead><tr><th>Fecha</th><th>Inversión</th><th>Impresiones</th><th>Clics</th><th>CTR</th></tr></thead><tbody>{report.daily.map(day => <tr key={day.date}><th scope="row">{shortDate(day.date)}</th><td>{money(day.metrics?.cost ?? null)}</td><td>{formatNumber(day.metrics?.impressions, 0)}</td><td>{formatNumber(day.metrics?.clicks, 0)}</td><td>{day.metrics && deliveryRates(day.metrics).ctr != null ? `${formatNumber(deliveryRates(day.metrics).ctr)}%` : "—"}</td></tr>)}</tbody></table></div></details>
    </section>
    <div className={styles.breakdownGrid}>
      <section className={styles.card}><div className={styles.cardHeading}><div><h3>Dispositivos</h3><p>Distribución de impresiones</p></div></div><BreakdownBars data={breakdowns?.devices} loading={breakdownBusy}/></section>
      <section className={styles.card}><div className={styles.cardHeading}><div><h3>Ubicaciones</h3><p>Impresiones y clics por provincia o región</p></div></div><RegionTable data={breakdowns?.regions} loading={breakdownBusy}/></section>
    </div>
    {(breakdownError || breakdowns?.devices.state === "processing" || breakdowns?.regions.state === "processing") && <div className={styles.notice}><span>{breakdownError || "StackAdapt está preparando los desgloses."}</span><button type="button" disabled={breakdownBusy} onClick={onRetryBreakdowns}>Actualizar desgloses</button></div>}
    <section className={styles.card}><div className={styles.cardHeading}><div><h3>Resultados por campaña</h3><p>{report.campaigns.length} campaña{report.campaigns.length === 1 ? "" : "s"} · {currency}</p></div></div>
      <div className={styles.tableScroll}><table><caption className={styles.srOnly}>Rendimiento de las campañas del anunciante</caption><thead><tr><th>Campaña</th><th>Inversión</th><th>Impresiones</th><th>Clics</th><th>CTR</th><th>Conversiones</th><th>Videos completos</th></tr></thead><tbody>{report.campaigns.map(c => <tr key={c.id}><th scope="row">{c.name}<small>{c.channel}</small></th><td>{money(c.metrics.cost)}</td><td>{formatNumber(c.metrics.impressions, 0)}</td><td>{formatNumber(c.metrics.clicks, 0)}</td><td>{deliveryRates(c.metrics).ctr == null ? "—" : `${formatNumber(deliveryRates(c.metrics).ctr)}%`}</td><td>{formatNumber(c.metrics.conversions)}</td><td>{formatNumber(c.metrics.videoCompletions, 0)}</td></tr>)}</tbody><tfoot><tr><th>Total del período</th><td>{money(m.cost)}</td><td>{formatNumber(m.impressions, 0)}</td><td>{formatNumber(m.clicks, 0)}</td><td>{rates.ctr == null ? "—" : `${formatNumber(rates.ctr)}%`}</td><td>{formatNumber(m.conversions)}</td><td>{formatNumber(m.videoCompletions, 0)}</td></tr></tfoot></table></div>
    </section>
    <p className={styles.footer}>Actualizado: {new Date(report.updatedAt).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })} · Fechas de entrega según StackAdapt. El alcance corresponde a identificadores únicos del proveedor; no se suma entre días.</p>
  </div>;
}

function BreakdownBars({ data, loading }: { data?: DeliveryBreakdown; loading: boolean }) {
  if (!data || data.state !== "ready") return <p className={styles.note}>{loading || data?.state === "processing" ? "Preparando desglose…" : "Desglose no disponible."}</p>;
  if (!data.rows.length) return <p className={styles.note}>Sin datos de dispositivos para este período.</p>;
  const total = data.rows.every(r => r.impressions != null) ? data.rows.reduce((sum, row) => sum + (row.impressions ?? 0), 0) : null;
  return <ul className={styles.bars}>{data.rows.map(row => <li key={row.id}><div><span>{row.name}</span><strong>{formatNumber(row.impressions, 0)} <small>{total && row.impressions != null ? `· ${formatNumber(row.impressions / total * 100, 1)}%` : ""}</small></strong></div><div className={styles.track}><span style={{ width: `${total && row.impressions != null ? row.impressions / total * 100 : 0}%` }}/></div></li>)}</ul>;
}
function RegionTable({ data, loading }: { data?: DeliveryBreakdown; loading: boolean }) {
  if (!data || data.state !== "ready") return <p className={styles.note}>{loading || data?.state === "processing" ? "Preparando desglose…" : "Desglose no disponible."}</p>;
  if (!data.rows.length) return <p className={styles.note}>Sin datos geográficos para este período.</p>;
  return <div className={`${styles.tableScroll} ${styles.regionTable}`}><table><caption className={styles.srOnly}>Entrega geográfica</caption><thead><tr><th>Ubicación</th><th>Impresiones</th><th>Clics</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.id}><th scope="row">{row.name.replace(/, Ecuador$/, "")}</th><td>{formatNumber(row.impressions, 0)}</td><td>{formatNumber(row.clicks, 0)}</td></tr>)}</tbody></table></div>;
}
