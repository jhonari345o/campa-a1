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
import { OohPlanPhoto } from "./OohPlanPhoto";
import { formatBudgetInput } from "@/lib/brief-inputs";
import { PlanDeliveryPreview } from "./PlanDeliveryPreview";
import type { BroadcastBrief } from "@/lib/broadcast-catalog";
import type { CatalogPick } from "@/lib/catalog-shopping";
import styles from "./MediaStrategyPanel.module.css";

const money = (value: number | null) => value == null ? "Por definir" : `$ ${formatBudgetInput(value)}`;
const share = (value: number) => new Intl.NumberFormat("es-EC", { style: "percent", maximumFractionDigits: 1 }).format(value);
const number = (value: number) => new Intl.NumberFormat("es-EC", { maximumFractionDigits: 2 }).format(value);
const TABS = [{ id: "mix", label: "Mix recomendado", short: "Mix" }, { id: "category", label: "Categoría y competencia", short: "Categoría" }, { id: "audience", label: "Audiencias", short: "Audiencias" }, { id: "compare", label: "Comparar", short: "Comparar" }] as const;
type View = typeof TABS[number]["id"];

export function MediaStrategyPanel({ report, research, brief, brand = "", objective = "", selectedMedia = report.allocations.map(row => row.medium) }: { report: StrategyReport; brief?: BroadcastBrief & {clientId?:string|null}; research?: CategoryResearch; brand?: string; objective?: string; selectedMedia?: string[] }) {
  const [view, setView] = useState<View>("mix");
  const [selectedMedium, setSelectedMedium] = useState<MediaGroup | null>(report.allocations[0]?.medium ?? null);
  const [brandLimit, setBrandLimit] = useState(5), [audienceKind, setAudienceKind] = useState<"media" | "behavior">("media");
  const [comparisonId, setComparisonId] = useState("current");
  const ai = report.aiState === "validated" || report.aiState === "cached", sources = new Map(report.sources.map(source => [source.id, source]));
  const active = report.allocations.find(row => row.medium === selectedMedium) ?? report.allocations[0];
  const scenarios = [{ id: "current", label: "Mix recomendado", allocations: report.allocations }, ...report.alternatives].filter((row, index, all) => all.findIndex(item => JSON.stringify(item.allocations.map(({ medium, pct, amountUsd }) => ({ medium, pct, amountUsd }))) === JSON.stringify(row.allocations.map(({ medium, pct, amountUsd }) => ({ medium, pct, amountUsd })))) === index);
  const comparison = scenarios.find(row => row.id === comparisonId) ?? scenarios[0];
  const comparisonRows = [...new Set([...report.allocations, ...comparison.allocations].map(row => row.medium))].map(medium => comparison.allocations.find(row => row.medium === medium) ?? { medium, pct: 0, amountUsd: report.budgetUsd == null ? null : 0 });
  const competition = [...report.competition].sort((a, b) => b.estimatedInvestment - a.estimatedInvestment).slice(0, brandLimit);
  const competitionScale = Math.max(.01, ...report.competition.map(row => row.soi));
  const tgi = research?.tgi, audienceRows = tgi?.values.filter(row => row.role === audienceKind && (audienceKind === "behavior" || tgiIndicatorApplies(row.id, selectedMedia))) ?? [];
  const quantities = new Map<string,number>();
  for (const allocation of report.allocations) for (const execution of allocation.executions ?? (allocation.candidate ? [{candidate:allocation.candidate,units:allocation.units}] : [])) {
    const key=execution.candidate.catalogKey;
    if(key&&execution.units&&Number.isSafeInteger(execution.units)) quantities.set(key,(quantities.get(key)??0)+execution.units);
  }
  const deliveryPicks:CatalogPick[]=[...quantities].map(([productKey,quantity])=>({productKey,quantity}));
  return <section className={styles.root} aria-label="Análisis y recomendación de medios">
    <header className={styles.header}><div><p className={styles.kicker}>Análisis del plan</p><h2>Tu mix de medios</h2><p>{report.summary}</p></div><span className={styles.badge}>{report.customized ? "Mix personalizado" : ai ? "Datos + IA de Mavi" : "Motor de datos"}</span></header>

    <div className={styles.metrics}><div><span>Presupuesto</span><strong>{money(report.budgetUsd)}</strong></div><div><span>Medios en el mix</span><strong>{report.allocations.length}</strong></div><div><span>Opciones de medios</span><strong>{report.candidateCount}</strong></div></div>
    {brief && <PlanDeliveryPreview request={{brief,picks:deliveryPicks,expectedMedia:report.allocations.filter(a=>(a.amountUsd??a.pct)>0).map(a=>a.medium),clientId:brief.clientId}}/>}
    <nav className={styles.tabs} aria-label="Explorar análisis del plan">{TABS.map(tab => <button type="button" key={tab.id} aria-label={tab.label} aria-pressed={view === tab.id} onClick={() => setView(tab.id)}><span className={styles.desktopTab}>{tab.label}</span><span className={styles.mobileTab}>{tab.short}</span></button>)}</nav>

    {view === "mix" && <div className={styles.overview}>
      <div className={styles.mixCard}><h3>Distribución de la inversión</h3><StrategyMixChart rows={report.allocations} budget={report.budgetUsd} selected={selectedMedium}/><p className={styles.chartHelp}>Selecciona un medio para revisar su recomendación.</p>
        <div className={styles.mixLegend}>{report.allocations.map(row => <button type="button" key={row.medium} onClick={() => setSelectedMedium(row.medium)} aria-pressed={selectedMedium === row.medium} style={{ "--mix-color": MEDIA_COLORS[row.medium] } as CSSProperties}>
          <i/><span>{mediaGroupLabel(row.medium)}</span><strong>{share(row.pct)}</strong><small>{money(row.amountUsd)}</small>
        </button>)}{Boolean(report.reserveUsd) && <div className={styles.reserve}><span>Sin asignar</span><strong>{money(report.reserveUsd)}</strong></div>}</div>
      </div>
      {active ? <article className={styles.decision} aria-label={`Detalle de ${mediaGroupLabel(active.medium)}`} style={{ "--mix-color": MEDIA_COLORS[active.medium] } as CSSProperties}>
        <header className={styles.decisionHeading}><span className={styles.mediumIcon}><MediaSelectionIcon medium={active.medium}/></span><div><p>Medio seleccionado</p><h3>{mediaGroupLabel(active.medium)}</h3></div><b>{share(active.pct)}</b></header>
        <div className={styles.decisionBudget}><strong>{money(active.amountUsd)}</strong><span>{active.readiness === "reference" ? "Tarifa compatible" : active.readiness === "platform_budget" ? "Presupuesto de plataforma" : "Asignación de inversión"}</span></div>
        <p className={styles.rationale}>{active.rationale}</p>
        {active.candidate ? (active.executions?.length ? active.executions : [{candidate:active.candidate,amountUsd:active.amountUsd,units:active.units,referenceSpendUsd:active.referenceSpendUsd,remainderUsd:active.remainderUsd}]).map(execution=><div key={execution.candidate.id} className={styles.candidate}>
          <div className={styles.provider}><MediaProviderMark provider={execution.candidate.provider} medium={active.medium}/><div><span>Selección del plan</span><strong>{execution.candidate.provider}</strong><p>{execution.candidate.product}</p></div></div>
          {execution.candidate.oohPhoto && <OohPlanPhoto photo={execution.candidate.oohPhoto} title={execution.candidate.product}/>}
          {execution.candidate.stationCoverage?.length ? <p>Cobertura de la emisora: {execution.candidate.stationCoverage.join(", ")}</p> : null}
          <dl><div><dt>Plaza</dt><dd>{execution.candidate.market || "No declarada"}</dd></div><div><dt>Público</dt><dd>{execution.candidate.target}</dd></div><div><dt>Período</dt><dd>{execution.candidate.period}</dd></div><div><dt>Formato / unidad</dt><dd>{execution.candidate.unit}</dd></div></dl>
          {execution.units != null && execution.units > 0 && <div className={styles.unitSummary}><strong>{number(execution.units)} {execution.candidate.unit}</strong><span>{money(execution.referenceSpendUsd)}{execution.remainderUsd ? ` · saldo ${money(execution.remainderUsd)}` : ""}</span></div>}
          {execution.candidate.metrics.length > 0 && <div className={styles.evidenceMetrics}>{execution.candidate.metrics.map((metric, index) => { const source = sources.get(metric.sourceId); return <div key={`${metric.sourceId}-${index}`}><span>{metric.label}</span><strong>{number(metric.value)} {metric.unit}</strong>{source && <small>{source.period} · {source.market}<br/>{source.target}</small>}</div>; })}</div>}
        </div>) : <div className={styles.empty}>No hay una opción comercial documentada para este medio en el corte del análisis.</div>}

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
      </section>
      {Boolean(report.channelShares?.length) && <section className={styles.section}><h3>Share de canales</h3><p>{report.channelShares![0].market} · {report.channelShares![0].target} · {report.channelShares![0].period}</p><div className={styles.audienceChart}>{[...report.channelShares!].sort((a,b)=>b.sharePct-a.sharePct).map(row=><article key={row.provider}><div><strong><MediaProviderMark provider={row.provider} medium="television"/>{row.provider}</strong><span>{number(row.sharePct)}%</span></div><meter min={0} max={100} value={row.sharePct} aria-label={`Share de ${row.provider}: ${number(row.sharePct)} por ciento`}/></article>)}</div></section>}
      {report.audienceReferences.length > 0 && <section className={styles.section}><h3>Ratings de televisión</h3><div className={styles.table}><table><thead><tr><th>Medio / programa</th><th>Rating</th><th>Plaza y público</th><th>Período</th></tr></thead><tbody>{report.audienceReferences.map(row => { const source = sources.get(row.sourceId); return <tr key={row.sourceId}><th scope="row"><MediaProviderMark provider={row.provider} medium={row.medium}/>{row.provider}<small>{row.product}</small></th><td>{row.rating == null ? "Sin dato" : `${number(row.rating)}%`}</td><td>{source?.market}<small>{source?.target}</small></td><td>{source?.period}</td></tr>; })}</tbody></table></div></section>}
    </div>}

    {view === "compare" && <div className={styles.tabContent}><section className={styles.section}><div className={styles.sectionHeading}><div><h3>Compara el mix</h3><p>El mismo presupuesto, con las alternativas documentadas del análisis.</p></div></div>
      <div className={styles.scenarioPicker}>{scenarios.map(scenario => <button type="button" key={scenario.id} aria-pressed={comparison.id === scenario.id} onClick={() => setComparisonId(scenario.id)}>{scenario.label}</button>)}</div>
      <div className={styles.comparison}><div><StrategyMixChart rows={comparison.allocations} budget={report.budgetUsd} compact caption="Comparación"/><h4>{comparison.label}</h4><p>Vista de comparación. Puedes ajustar el plan en Personalizar propuesta.</p></div><div className={styles.comparisonRows}>{comparisonRows.map(row => { const base = report.allocations.find(item => item.medium === row.medium)?.pct ?? 0, change = row.pct - base; return <article key={row.medium}><header><strong>{mediaGroupLabel(row.medium)}</strong><span>{share(row.pct)}</span></header><div className={styles.comparisonTrack}><i style={{ width: `${row.pct * 100}%`, background: MEDIA_COLORS[row.medium] }}/></div><footer><span>{money(row.amountUsd)}</span><small>{Math.abs(change) < .00001 ? "Igual al recomendado" : `${change > 0 ? "+" : ""}${number(change * 100)} puntos porcentuales`}</small></footer></article>; })}</div></div>
    </section></div>}

    {report.questions.length > 0 && <details className={styles.nextSteps}><summary>Personaliza la estrategia</summary><ul>{report.questions.map(question => <li key={question}>{question}</li>)}</ul></details>}

  </section>;
}
