"use client";
import { useState, type CSSProperties } from "react";
import type { StrategyReport } from "@/lib/media-strategy";
import type { CategoryResearch } from "@/lib/infomedia";
import type { MediaGroup } from "@/lib/media-groups";
import { mediaGroupLabel } from "@/lib/plan-optimizer";
import { MEDIA_COLORS } from "@/lib/strategy-visuals";
import { tgiIndicatorApplies } from "@/lib/tgi";
import { MediaSelectionIcon } from "./MediaSelectionIcon";
import { MediaProviderMark } from "./MediaProviderMark";
import { StrategyMixChart } from "./StrategyMixChart";
import { InfomediaResearchPanel } from "./InfomediaResearchPanel";
import styles from "./MediaStrategyPanel.module.css";

const money = (value: number | null) => value == null ? "Por definir" : new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const share = (value: number) => new Intl.NumberFormat("es-EC", { style: "percent", maximumFractionDigits: 1 }).format(value);
const number = (value: number) => new Intl.NumberFormat("es-EC", { maximumFractionDigits: 2 }).format(value);
const stateText: Record<StrategyReport["aiState"], string> = {
  validated: "Interpretación de AWS validada contra las fuentes del plan.", cached: "Interpretación de AWS para este brief y el mismo corte de fuentes.",
  not_configured: "Recomendación del motor de datos. La interpretación de IA aún no está activada.",
  quota: "Recomendación del motor de datos. La consulta de IA alcanzó su límite de uso.",
  unavailable: "Recomendación del motor de datos. La interpretación de IA no estuvo disponible.",
  rejected: "Recomendación del motor de datos. La interpretación de IA no superó la validación de fuentes.",
};
const TABS = [{ id: "mix", label: "Mix recomendado", short: "Mix" }, { id: "category", label: "Categoría y competencia", short: "Categoría" }, { id: "audience", label: "Audiencias", short: "Audiencias" }, { id: "compare", label: "Comparar", short: "Comparar" }, { id: "sources", label: "Fuentes", short: "Fuentes" }] as const;
type View = typeof TABS[number]["id"];

export function MediaStrategyPanel({ report, research, brand = "", objective = "", selectedMedia = report.allocations.map(row => row.medium) }: { report: StrategyReport; research?: CategoryResearch; brand?: string; objective?: string; selectedMedia?: string[] }) {
  const [view, setView] = useState<View>("mix");
  const [selectedMedium, setSelectedMedium] = useState<MediaGroup | null>(report.allocations[0]?.medium ?? null);
  const [brandLimit, setBrandLimit] = useState(5), [audienceKind, setAudienceKind] = useState<"media" | "behavior">("media");
  const [sourceFilter, setSourceFilter] = useState("all"), [comparisonId, setComparisonId] = useState("current");
  const ai = report.aiState === "validated" || report.aiState === "cached", sources = new Map(report.sources.map(source => [source.id, source]));
  const active = report.allocations.find(row => row.medium === selectedMedium) ?? report.allocations[0];
  const scenarios = [{ id: "current", label: "Mix recomendado", allocations: report.allocations }, ...report.alternatives].filter((row, index, all) => all.findIndex(item => JSON.stringify(item.allocations.map(({ medium, pct, amountUsd }) => ({ medium, pct, amountUsd }))) === JSON.stringify(row.allocations.map(({ medium, pct, amountUsd }) => ({ medium, pct, amountUsd })))) === index);
  const comparison = scenarios.find(row => row.id === comparisonId) ?? scenarios[0];
  const comparisonRows = [...new Set([...report.allocations, ...comparison.allocations].map(row => row.medium))].map(medium => comparison.allocations.find(row => row.medium === medium) ?? { medium, pct: 0, amountUsd: report.budgetUsd == null ? null : 0 });
  const competition = [...report.competition].sort((a, b) => b.estimatedInvestment - a.estimatedInvestment).slice(0, brandLimit);
  const competitionScale = Math.max(.01, ...report.competition.map(row => row.soi));
  const tgi = research?.tgi, audienceRows = tgi?.values.filter(row => row.role === audienceKind && (audienceKind === "behavior" || tgiIndicatorApplies(row.id, selectedMedia))) ?? [];
  const sourceRows = report.sources.filter(source => sourceFilter === "all" || source.use === sourceFilter);
  return <section className={styles.root} aria-label="Análisis y recomendación de medios">
    <header className={styles.header}><div><p className={styles.kicker}>Análisis del plan</p><h2>Tu mix de medios</h2><p>{report.summary}</p></div><span className={styles.badge}>{report.customized ? "Mix personalizado" : ai ? "Datos + IA de AWS" : "Motor de datos"}</span></header>
    <p className={styles.engine}>{stateText[report.aiState]}</p>
    <div className={styles.metrics}><div><span>Presupuesto</span><strong>{money(report.budgetUsd)}</strong></div><div><span>Medios en el mix</span><strong>{report.allocations.length}</strong></div><div><span>Opciones documentadas</span><strong>{report.candidateCount}</strong></div><div><span>Fuentes del análisis</span><strong>{report.sources.length}</strong></div></div>
    <nav className={styles.tabs} aria-label="Explorar análisis del plan">{TABS.map(tab => <button type="button" key={tab.id} aria-label={tab.label} aria-pressed={view === tab.id} onClick={() => setView(tab.id)}><span className={styles.desktopTab}>{tab.label}</span><span className={styles.mobileTab}>{tab.short}</span></button>)}</nav>

    {view === "mix" && <div className={styles.overview}>
      <div className={styles.mixCard}><h3>Distribución de la inversión</h3><StrategyMixChart rows={report.allocations} budget={report.budgetUsd} selected={selectedMedium}/><p className={styles.chartHelp}>Selecciona un medio para revisar su recomendación.</p>
        <div className={styles.mixLegend}>{report.allocations.map(row => <button type="button" key={row.medium} onClick={() => setSelectedMedium(row.medium)} aria-pressed={selectedMedium === row.medium} style={{ "--mix-color": MEDIA_COLORS[row.medium] } as CSSProperties}>
          <i/><span>{mediaGroupLabel(row.medium)}</span><strong>{share(row.pct)}</strong><small>{money(row.amountUsd)}</small>
        </button>)}{Boolean(report.reserveUsd) && <div className={styles.reserve}><span>Sin asignar</span><strong>{money(report.reserveUsd)}</strong></div>}</div>
      </div>
      {active ? <article className={styles.decision} aria-label={`Detalle de ${mediaGroupLabel(active.medium)}`} style={{ "--mix-color": MEDIA_COLORS[active.medium] } as CSSProperties}>
        <header className={styles.decisionHeading}><span className={styles.mediumIcon}><MediaSelectionIcon medium={active.medium}/></span><div><p>Medio seleccionado</p><h3>{mediaGroupLabel(active.medium)}</h3></div><b>{share(active.pct)}</b></header>
        <div className={styles.decisionBudget}><strong>{money(active.amountUsd)}</strong><span>{active.readiness === "reference" ? "Tarifa compatible" : active.readiness === "platform_budget" ? "Presupuesto de plataforma" : "Presupuesto para cotizar"}</span></div>
        <p className={styles.rationale}>{active.rationale}</p>
        {active.candidate ? <div className={styles.candidate}>
          <div className={styles.provider}><MediaProviderMark provider={active.candidate.provider} medium={active.medium}/><div><span>Opción documentada</span><strong>{active.candidate.provider}</strong><p>{active.candidate.product}</p></div></div>
          <dl><div><dt>Plaza</dt><dd>{active.candidate.market || "No declarada"}</dd></div><div><dt>Público de la fuente</dt><dd>{active.candidate.target}</dd></div><div><dt>Período</dt><dd>{active.candidate.period}</dd></div><div><dt>Formato / unidad</dt><dd>{active.candidate.unit}</dd></div></dl>
          {active.units != null && active.units > 0 && <div className={styles.unitSummary}><strong>{number(active.units)} {active.candidate.unit}</strong><span>{money(active.referenceSpendUsd)}{active.remainderUsd ? ` · saldo ${money(active.remainderUsd)}` : ""}</span></div>}
          {active.candidate.metrics.length > 0 && <div className={styles.evidenceMetrics}>{active.candidate.metrics.map((metric, index) => { const source = sources.get(metric.sourceId); return <div key={`${metric.sourceId}-${index}`}><span>{metric.label}</span><strong>{number(metric.value)} {metric.unit}</strong>{source && <small>{source.period} · {source.market}<br/>{source.target}</small>}</div>; })}</div>}
        </div> : <div className={styles.empty}>No hay una opción comercial documentada para este medio en el corte del análisis.</div>}
        <details className={styles.why}><summary>Ver las fuentes de esta recomendación</summary>{active.sourceIds.map(id => { const source = sources.get(id); return source ? <p key={id}><strong>{source.label}</strong><span>{source.period} · {source.market}</span><small>{source.target} · {source.use === "comparable" ? "Compatible con el brief" : "Referencia contextual"}</small></p> : null; })}</details>
      </article> : <div className={styles.empty}>Completa las fuentes del brief para construir la distribución de medios.</div>}
      <div className={styles.mediaRail}>{report.allocations.map(row => <button type="button" key={row.medium} aria-pressed={selectedMedium === row.medium} onClick={() => setSelectedMedium(row.medium)}>
        <span className={styles.mediumIcon} style={{ color: MEDIA_COLORS[row.medium] }}><MediaSelectionIcon medium={row.medium}/></span><strong>{mediaGroupLabel(row.medium)}</strong><span>{share(row.pct)} · {money(row.amountUsd)}</span>{row.candidate && <div><MediaProviderMark provider={row.candidate.provider} medium={row.medium}/><small>{row.candidate.provider}</small></div>}
      </button>)}</div>
    </div>}

    {view === "category" && <div className={styles.tabContent}>
      <section className={styles.section}><div className={styles.sectionHeading}><div><h3>Competencia observada</h3><p>Inversión estimada de la categoría · {sources.get("category-investment")?.period || research?.dataThrough || "Corte disponible"}</p></div><div className={styles.segmented}>{[5, 10].map(limit => <button key={limit} type="button" aria-pressed={brandLimit === limit} onClick={() => setBrandLimit(limit)}>Top {limit}</button>)}</div></div>
        {competition.length ? <><p className={styles.scaleLabel}>Participación de inversión · escala 0–{share(competitionScale)}</p><div className={styles.brandChart}>{competition.map(row => <article key={row.brand}><div><strong>{row.brand}{row.declared && <small>Del brief</small>}</strong><span>{money(row.estimatedInvestment)}<b>{share(row.soi)}</b></span></div><div className={styles.brandTrack}><i style={{ width: `${Math.max(0, Math.min(100, row.soi / competitionScale * 100))}%` }}/></div></article>)}</div></> : <p className={styles.empty}>No hay un corte de competencia compatible para este brief.</p>}
      </section>
      <InfomediaResearchPanel research={research} brand={brand} objective={objective} hideInterpretation/>
    </div>}

    {view === "audience" && <div className={styles.tabContent}>
      <section className={styles.section}><div className={styles.sectionHeading}><div><h3>Consumo de medios</h3><p>{tgi ? `${tgi.study} · ${tgi.period}` : "TGI · Corte de audiencia"}</p></div><div className={styles.segmented}><button type="button" aria-pressed={audienceKind === "media"} onClick={() => setAudienceKind("media")}>Medios</button><button type="button" aria-pressed={audienceKind === "behavior"} onClick={() => setAudienceKind("behavior")}>Hábitos</button></div></div>
        {tgi && <div className={styles.audienceContext}><span>{tgi.targetLabel}</span><span>{tgi.geography}</span><b>{tgi.relationship === "age_matched" ? "Corte de edad disponible" : "Referencia contextual"}</b></div>}
        {audienceRows.length ? <div className={styles.audienceChart}>{audienceRows.map(row => <article key={row.id}><div><strong>{row.label}</strong><span>{number(row.value)}%</span></div><meter min={0} max={100} value={row.value} aria-label={`${row.label}: ${number(row.value)} por ciento`}/></article>)}</div> : <p className={styles.empty}>No hay indicadores de este grupo compatibles con los medios y el público del brief.</p>}
        {tgi && <p className={styles.methodNote}>{tgi.note} Cada indicador se consulta por separado.</p>}
      </section>
      {report.audienceReferences.length > 0 && <section className={styles.section}><h3>Ratings de televisión</h3><p className={styles.methodNote}>Cada observación conserva su plaza, público y período.</p><div className={styles.table}><table><thead><tr><th>Medio / programa</th><th>Rating</th><th>Plaza y público</th><th>Período</th><th>Uso</th></tr></thead><tbody>{report.audienceReferences.map(row => { const source = sources.get(row.sourceId); return <tr key={row.sourceId}><th scope="row"><MediaProviderMark provider={row.provider} medium={row.medium}/>{row.provider}<small>{row.product}</small></th><td>{row.rating == null ? "Sin dato" : `${number(row.rating)}%`}</td><td>{source?.market}<small>{source?.target}</small></td><td>{source?.period}</td><td>{source?.use === "comparable" ? "Compatible" : "Contextual"}</td></tr>; })}</tbody></table></div></section>}
    </div>}

    {view === "compare" && <div className={styles.tabContent}><section className={styles.section}><div className={styles.sectionHeading}><div><h3>Compara el mix</h3><p>El mismo presupuesto, con las alternativas documentadas del análisis.</p></div></div>
      <div className={styles.scenarioPicker}>{scenarios.map(scenario => <button type="button" key={scenario.id} aria-pressed={comparison.id === scenario.id} onClick={() => setComparisonId(scenario.id)}>{scenario.label}</button>)}</div>
      <div className={styles.comparison}><div><StrategyMixChart rows={comparison.allocations} budget={report.budgetUsd} compact caption="Comparación"/><h4>{comparison.label}</h4><p>Vista de comparación. Puedes ajustar el plan en Personalizar propuesta.</p></div><div className={styles.comparisonRows}>{comparisonRows.map(row => { const base = report.allocations.find(item => item.medium === row.medium)?.pct ?? 0, change = row.pct - base; return <article key={row.medium}><header><strong>{mediaGroupLabel(row.medium)}</strong><span>{share(row.pct)}</span></header><div className={styles.comparisonTrack}><i style={{ width: `${row.pct * 100}%`, background: MEDIA_COLORS[row.medium] }}/></div><footer><span>{money(row.amountUsd)}</span><small>{Math.abs(change) < .00001 ? "Igual al recomendado" : `${change > 0 ? "+" : ""}${number(change * 100)} puntos porcentuales`}</small></footer></article>; })}</div></div>
    </section></div>}

    {view === "sources" && <div className={styles.tabContent}><section className={styles.section}><div className={styles.sectionHeading}><div><h3>Fuentes y compatibilidad</h3><p>Plaza, público y período de cada dato utilizado en el plan.</p></div><div className={styles.segmented}>{[{ key: "all", label: "Todas" }, { key: "comparable", label: "Compatibles" }, { key: "context", label: "Contexto" }].map(filter => <button type="button" key={filter.key} aria-pressed={sourceFilter === filter.key} onClick={() => setSourceFilter(filter.key)}>{filter.label}</button>)}</div></div>
      <div className={styles.table}><table><thead><tr><th>Fuente</th><th>Período</th><th>Plaza y público</th><th>Uso en el plan</th></tr></thead><tbody>{sourceRows.map(source => <tr key={source.id}><th scope="row">{source.label}<small>{source.note}</small></th><td>{source.period}</td><td>{source.market}<small>{source.target}</small></td><td>{source.use === "comparable" ? "Compatible" : source.use === "context" ? "Contextual" : "No aplicable"}</td></tr>)}</tbody></table></div>
    </section></div>}

    {(report.gaps.length > 0 || report.questions.length > 0) && <details className={styles.nextSteps}><summary>Completar el plan{report.gaps.length ? ` · ${report.gaps.length} ${report.gaps.length === 1 ? "punto" : "puntos"} de validación` : ""}</summary>{report.gaps.length > 0 && <ul>{report.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>}{report.questions.length > 0 && <><h3>Preguntas para afinar la recomendación</h3><ul>{report.questions.map(question => <li key={question}>{question}</li>)}</ul></>}</details>}
  </section>;
}
