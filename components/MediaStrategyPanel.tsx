"use client";
import { useState, type CSSProperties } from "react";
import { digitalProductionSpend, strategyPresentation, type StrategyReport } from "@/lib/media-strategy";
import type { CategoryResearch } from "@/lib/infomedia";
import type { MediaGroup } from "@/lib/media-groups";
import { mediaGroupLabel } from "@/lib/plan-optimizer";
import { MEDIA_COLORS } from "@/lib/strategy-visuals";
import { tgiIndicatorApplies } from "@/lib/tgi";
import { MediaSelectionIcon } from "./MediaSelectionIcon";
import { MediaProviderMark } from "./MediaProviderMark";
import { StrategyMixChart } from "./StrategyMixChart";
import { InfomediaResearchPanel } from "./InfomediaResearchPanel";
import { displayCampaignPeriod, formatBudgetInput } from "@/lib/brief-inputs";
import { AudienceRankings } from "./AudienceRankings";
import { ProviderPlanCards } from "./ProviderPlanCards";
import type { DeliverySummary } from "@/lib/media-delivery";
import { PlanDeliveryPreview } from "./PlanDeliveryPreview";
import type { BroadcastBrief } from "@/lib/broadcast-catalog";
import { strategyDeliveryPicks } from "@/lib/strategy-delivery-picks";
import styles from "./MediaStrategyPanel.module.css";

const money = (value: number | null) => value == null ? "Por definir" : `$ ${formatBudgetInput(value)}`;
const share = (value: number) => new Intl.NumberFormat("es-EC", { style: "percent", maximumFractionDigits: 1 }).format(value);
const number = (value: number) => new Intl.NumberFormat("es-EC", { maximumFractionDigits: 2 }).format(value);
const TABS = [{ id: "category", label: "1. Categoría y competencia", short: "1. Categoría" }, { id: "audience", label: "2. Audiencias", short: "2. Audiencias" }, { id: "mix", label: "3. Mix recomendado", short: "3. Mix" }, { id: "compare", label: "Comparar", short: "Comparar" }] as const;
type View = typeof TABS[number]["id"];

export function MediaStrategyPanel({ report, research, brief, brand = "", objective = "", selectedMedia = report.allocations.map(row => row.medium) }: { report: StrategyReport; brief?: BroadcastBrief & {clientId?:string|null}; research?: CategoryResearch; brand?: string; objective?: string; selectedMedia?: string[] }) {
  const {allocations,summary} = strategyPresentation(report);
  const [view, setView] = useState<View>("category");
  const [delivery,setDelivery]=useState<DeliverySummary|null>(null);
  const [selectedMedium, setSelectedMedium] = useState<MediaGroup | null>(allocations[0]?.medium ?? null);
  const [brandLimit, setBrandLimit] = useState(5), [audienceKind, setAudienceKind] = useState<"media" | "behavior">("media");
  const [comparisonId, setComparisonId] = useState("current");
  const ai = report.aiState === "validated" || report.aiState === "cached", sources = new Map(report.sources.map(source => [source.id, source]));
  const campaignPeriod = displayCampaignPeriod(brief?.startDate, brief?.endDate);
  const active = allocations.find(row => row.medium === selectedMedium) ?? allocations[0];
  const scenarios = [{ id: "current", label: "Mix recomendado", allocations: allocations }, ...report.alternatives].filter((row, index, all) => all.findIndex(item => JSON.stringify(item.allocations.map(({ medium, pct, amountUsd }) => ({ medium, pct, amountUsd }))) === JSON.stringify(row.allocations.map(({ medium, pct, amountUsd }) => ({ medium, pct, amountUsd })))) === index);
  const comparison = scenarios.find(row => row.id === comparisonId) ?? scenarios[0];
  const comparisonRows = [...new Set([...allocations, ...comparison.allocations].map(row => row.medium))].map(medium => comparison.allocations.find(row => row.medium === medium) ?? { medium, pct: 0, amountUsd: report.budgetUsd == null ? null : 0 });
  const competition = [...report.competition].sort((a, b) => b.estimatedInvestment - a.estimatedInvestment).slice(0, brandLimit);
  const competitionScale = Math.max(.01, ...report.competition.map(row => row.soi));
  const tgi = research?.tgi, audienceRows = tgi?.values.filter(row => row.role === audienceKind && (audienceKind === "behavior" || tgiIndicatorApplies(row.id, selectedMedia))) ?? [];
  const deliveryPicks = strategyDeliveryPicks(report);
  return <section className={styles.root} aria-label="Análisis y recomendación de medios">
    <header className={styles.header}><div><p className={styles.kicker}>Análisis del plan</p><h2>La estrategia de tu plan</h2><p>{summary}</p></div><span className={styles.badge}>{report.customized ? "Mix personalizado" : ai ? "Datos + IA de Mavi" : "Motor de datos"}</span></header>

    <div className={styles.metrics}><div><span>Presupuesto</span><strong>{money(report.budgetUsd)}</strong></div><div><span>Medios en el mix</span><strong>{allocations.length}</strong></div><div><span>Opciones de medios</span><strong>{report.candidateCount}</strong></div></div>
    {view === "mix" && brief && <PlanDeliveryPreview onSummary={setDelivery} request={{brief,picks:deliveryPicks,expectedMedia:allocations.map(a=>a.medium),clientId:brief.clientId}}/>}
    <nav className={styles.tabs} aria-label="Explorar análisis del plan">{TABS.map(tab => <button type="button" key={tab.id} aria-label={tab.label} aria-pressed={view === tab.id} onClick={() => setView(tab.id)}><span className={styles.desktopTab}>{tab.label}</span><span className={styles.mobileTab}>{tab.short}</span></button>)}</nav>

    {view === "mix" && <div className={styles.overview}>
      <div className={styles.mixCard}><h3>Distribución de la inversión</h3><StrategyMixChart rows={allocations} budget={report.budgetUsd} selected={selectedMedium}/><p className={styles.chartHelp}>Selecciona un medio para revisar su recomendación.</p>
        <div className={styles.mixLegend}>{allocations.map(row => <button type="button" key={row.medium} onClick={() => setSelectedMedium(row.medium)} aria-pressed={selectedMedium === row.medium} style={{ "--mix-color": MEDIA_COLORS[row.medium] } as CSSProperties}>
          <i/><span>{mediaGroupLabel(row.medium)}</span><strong>{share(row.pct)}</strong><small>{money(row.amountUsd)}</small>
        </button>)}{Boolean(report.reserveUsd) && <div className={styles.reserve}><span>Sin asignar</span><strong>{money(report.reserveUsd)}</strong></div>}</div>
      </div>
      {active ? <article className={styles.decision} aria-label={`Detalle de ${mediaGroupLabel(active.medium)}`} style={{ "--mix-color": MEDIA_COLORS[active.medium] } as CSSProperties}>
        <header className={styles.decisionHeading}><span className={styles.mediumIcon}><MediaSelectionIcon medium={active.medium}/></span><div><p>Medio seleccionado</p><h3>{mediaGroupLabel(active.medium)}</h3></div><b>{share(active.pct)}</b></header>
        <div className={styles.decisionBudget}><strong>{money(active.amountUsd)}</strong><span>{active.readiness === "reference" ? "Tarifa compatible" : active.readiness === "platform_budget" ? "Presupuesto de plataforma" : "Asignación de inversión"}</span></div>
        <p className={styles.rationale}>{active.rationale}</p>
        {active.medium === "digital" && active.amountUsd != null && <div className={styles.unitSummary}><strong>Plataformas digitales</strong><span>{money(Math.max(0,active.amountUsd-digitalProductionSpend(active)))}</span></div>}
        <ProviderPlanCards allocation={active} delivery={delivery} campaignPeriod={campaignPeriod}/>


      </article> : <div className={styles.empty}>Puedes ajustar el presupuesto o elegir otros medios para esta pauta.</div>}
      <div className={styles.mediaRail}>{allocations.map(row => <button type="button" key={row.medium} aria-pressed={selectedMedium === row.medium} onClick={() => setSelectedMedium(row.medium)}>
        <span className={styles.mediumIcon} style={{ color: MEDIA_COLORS[row.medium] }}><MediaSelectionIcon medium={row.medium}/></span><strong>{mediaGroupLabel(row.medium)}</strong><span>{share(row.pct)} · {money(row.amountUsd)}</span>{row.candidate && <div><MediaProviderMark provider={row.candidate.provider} medium={row.medium}/><small>{row.candidate.provider}</small></div>}
      </button>)}</div>
    </div>}

    {view === "category" && <div className={styles.tabContent}>
      {!research && <section className={styles.section}><div className={styles.sectionHeading}><div><h3>Competencia observada</h3><p>Inversión estimada de la categoría · {sources.get("category-investment")?.period || "Corte disponible"}</p></div><div className={styles.segmented}>{[5, 10].map(limit => <button key={limit} type="button" aria-pressed={brandLimit === limit} onClick={() => setBrandLimit(limit)}>Top {limit}</button>)}</div></div>
        {competition.length ? <><p className={styles.scaleLabel}>Participación de inversión · escala 0–{share(competitionScale)}</p><div className={styles.brandChart}>{competition.map(row => <article key={row.brand}><div><strong>{row.brand}{row.declared && <small>Del brief</small>}</strong><span>{money(row.estimatedInvestment)}<b>{share(row.soi)}</b></span></div><div className={styles.brandTrack}><i style={{ width: `${Math.max(0, Math.min(100, row.soi / competitionScale * 100))}%` }}/></div></article>)}</div></> : <p className={styles.empty}>No hay un corte de competencia compatible para este brief.</p>}
      </section>}
      <InfomediaResearchPanel research={research} brand={brand} objective={objective} hideInterpretation/>
      <button className={styles.continueButton} type="button" onClick={()=>setView("audience")}>Continuar con audiencias →</button>
    </div>}

    {view === "audience" && <div className={styles.tabContent}>
      <div className={styles.audiencePrelude}><strong>El público de la campaña</strong><p>{[brief?.ageRange,brief?.sex,brief?.socioeconomic,brief?.geography].filter(Boolean).join(" · ")}</p><span>{campaignPeriod}</span></div>
      <section className={styles.section}><div className={styles.sectionHeading}><div><h3>Consumo de medios</h3><p>{tgi ? `${tgi.study} · ${tgi.period}` : "TGI · Corte de audiencia"}</p></div><div className={styles.segmented}><button type="button" aria-pressed={audienceKind === "media"} onClick={() => setAudienceKind("media")}>Medios</button><button type="button" aria-pressed={audienceKind === "behavior"} onClick={() => setAudienceKind("behavior")}>Hábitos</button></div></div>
        {tgi && <div className={styles.audienceContext}><span>{tgi.targetLabel}</span><span>{tgi.geography}</span><b>{tgi.relationship === "age_matched" ? "Corte de edad disponible" : "Referencia contextual"}</b></div>}
        {audienceRows.length ? <div className={styles.audienceChart}>{audienceRows.map(row => <article key={row.id}><div><strong>{row.label}</strong><span>{number(row.value)}%</span></div><meter min={0} max={100} value={row.value} aria-label={`${row.label}: ${number(row.value)} por ciento`}/></article>)}</div> : <p className={styles.empty}>No hay indicadores de este grupo compatibles con los medios y el público del brief.</p>}
      </section>
      {Boolean(report.channelShares?.length) && <section className={styles.section}><h3>Share de canales</h3><p>{report.channelShares![0].market} · {report.channelShares![0].target} · {report.channelShares![0].period}</p><div className={styles.audienceChart}>{[...report.channelShares!].sort((a,b)=>b.sharePct-a.sharePct).map(row=><article key={row.provider}><div><strong><MediaProviderMark provider={row.provider} medium="television"/>{row.provider}</strong><span>{number(row.sharePct)}%</span></div><meter min={0} max={100} value={row.sharePct} aria-label={`Share de ${row.provider}: ${number(row.sharePct)} por ciento`}/></article>)}</div></section>}
      <AudienceRankings report={report}/>
      <button className={styles.continueButton} type="button" onClick={()=>setView("mix")}>Ver recomendación de medios →</button>
    </div>}

    {view === "compare" && <div className={styles.tabContent}><section className={styles.section}><div className={styles.sectionHeading}><div><h3>Compara el mix</h3><p>El mismo presupuesto, con las alternativas documentadas del análisis.</p></div></div>
      <div className={styles.scenarioPicker}>{scenarios.map(scenario => <button type="button" key={scenario.id} aria-pressed={comparison.id === scenario.id} onClick={() => setComparisonId(scenario.id)}>{scenario.label}</button>)}</div>
      <div className={styles.comparison}><div><StrategyMixChart rows={comparison.allocations} budget={report.budgetUsd} compact caption="Comparación"/><h4>{comparison.label}</h4><p>Vista de comparación. Puedes ajustar el plan en Personalizar propuesta.</p></div><div className={styles.comparisonRows}>{comparisonRows.map(row => { const base = allocations.find(item => item.medium === row.medium)?.pct ?? 0, change = row.pct - base; return <article key={row.medium}><header><strong>{mediaGroupLabel(row.medium)}</strong><span>{share(row.pct)}</span></header><div className={styles.comparisonTrack}><i style={{ width: `${row.pct * 100}%`, background: MEDIA_COLORS[row.medium] }}/></div><footer><span>{money(row.amountUsd)}</span><small>{Math.abs(change) < .00001 ? "Igual al recomendado" : `${change > 0 ? "+" : ""}${number(change * 100)} puntos porcentuales`}</small></footer></article>; })}</div></div>
    </section></div>}

    {report.questions.length > 0 && <details className={styles.nextSteps}><summary>Personaliza la estrategia</summary><ul>{report.questions.map(question => <li key={question}>{question}</li>)}</ul></details>}

  </section>;
}
