import type { CSSProperties } from "react";
import type { DeliverySummary } from "@/lib/media-delivery";
import { mediaGroupLabel } from "@/lib/plan-optimizer";
import { MediaSelectionIcon } from "./MediaSelectionIcon";
import styles from "./MediaDeliveryChart.module.css";

const number = (n: number, digits = 0) => new Intl.NumberFormat("es-EC", { maximumFractionDigits: digits }).format(n);
const percent = (n: number) => `${number(n, 1)}%`;
export function MediaDeliveryChart({ summary }: { summary: DeliverySummary | null | undefined }) {
  if (!summary || (!summary.media.length && !summary.contactMedia?.length)) return null;
  const secondary = [
    { label: "Alcance 1+", value: summary.reach1Pct, format: percent },
    { label: "Alcance 2+", value: summary.reach2Pct, format: percent },
    { label: "Alcance 3+", value: summary.reach3Pct, format: percent },
  ].filter(metric => metric.value != null);
  const digital = summary.digital ? [
    { label: "Impresiones", value: summary.digital.impressions },
    { label: "Visualizaciones", value: summary.digital.views },
    { label: "Conversaciones", value: summary.digital.conversations },
  ].filter(metric => metric.value != null) : [];
  return <section className={styles.root} aria-label="Proyección de resultados">
    <header className={styles.heading}><span>{summary.media.some(row => row.medium === "ooh") ? "Alcance estimado" : "Proyección de resultados"}</span><h3>{summary.media.length ? "El alcance de tu plan" : "Resultados de tu pauta"}</h3>{summary.scopeLabel && <p>{summary.scopeLabel}</p>}</header>
    {summary.media.length > 0 && <div className={styles.main}>
      <div className={styles.byMedium}><h4>Alcance por medio</h4><div className={styles.axis} aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>
        {summary.media.map(row => <div key={row.medium} className={styles.medium}>
          <div className={styles.label}><span><MediaSelectionIcon medium={row.medium}/>{mediaGroupLabel(row.medium)}</span><strong>{percent(row.reachPct)}</strong></div>
          <div className={styles.track} role="meter" aria-label={`Alcance de ${mediaGroupLabel(row.medium)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.reachPct}><i style={{ "--reach": `${row.reachPct}%` } as CSSProperties}/></div>
          <small>{number(row.people)} personas</small>
        </div>)}
        {summary.geographicComplements?.map(medium=><div key={medium} className={styles.medium}><div className={styles.label}><span><MediaSelectionIcon medium={medium}/>{mediaGroupLabel(medium)}</span><strong>Presencia geográfica</strong></div></div>)}
      </div>
      {summary.reach1Pct != null && <div className={styles.total}><span>Alcance multimedios</span><strong>{percent(summary.reach1Pct)}</strong>{summary.people != null && <p>{number(summary.people)} personas</p>}<div className={styles.orbit} aria-hidden="true"/></div>}
    </div>}
    {secondary.length > 0 && <dl className={styles.kpis}>{secondary.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.format(metric.value!)}</dd></div>)}</dl>}
    {!!summary.contactMedia?.length&&<div className={styles.digital}><h4>{summary.contactMedia.some(row=>row.frequency!=null) ? "Frecuencia y GRPs por medio" : "Impactos estimados y GRPs"}</h4><dl>{summary.contactMedia.map(row=><div key={row.medium}><dt>{mediaGroupLabel(row.medium)}</dt><dd>{row.frequency!=null?`${number(row.frequency,1)}× · `:""}{number(row.grps,1)} GRPs</dd>{row.impressions!=null&&<small>{number(row.impressions)} impactos estimados</small>}</div>)}</dl></div>}
    {digital.length > 0 && <div className={styles.digital}><h4>Digital</h4><dl>{digital.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{number(metric.value!)}</dd></div>)}</dl></div>}
  </section>;
}
