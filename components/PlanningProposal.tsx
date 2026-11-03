"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import type { PlanBrief } from "@/app/planificador/actions";
import { digitalProductionSpend, type StrategyReport } from "@/lib/media-strategy";
import type { DeliverySummary } from "@/lib/media-delivery";
import type { MediaGroup } from "@/lib/media-groups";
import { mediaGroupLabel } from "@/lib/plan-optimizer";
import { displayCampaignPeriod, formatBudgetInput } from "@/lib/brief-inputs";
import { restoreCoverage, coverageDescription } from "@/lib/geographic-coverage";
import { strategyProviderGroups } from "@/lib/strategy-groups";
import { strategyDeliveryPicks } from "@/lib/strategy-delivery-picks";
import { MEDIA_COLORS } from "@/lib/strategy-visuals";
import { GeographicCoveragePicker } from "./geography/GeographicCoveragePicker";
import { MediaSelectionIcon } from "./MediaSelectionIcon";
import { StrategyMixChart } from "./StrategyMixChart";
import { ProviderPlanCards } from "./ProviderPlanCards";
import { PlanDeliveryPreview } from "./PlanDeliveryPreview";
import styles from "./PlanningProposal.module.css";

const money = (value: number | null) => value == null ? "—" : `$ ${formatBudgetInput(value)}`;
const percent = (value: number) => new Intl.NumberFormat("es-EC", { style: "percent", maximumFractionDigits: 1 }).format(value);

/** The original brief → strategy → media selection → consolidated results flow. */
export function PlanningProposal({ report, brief, targetLabel, saveControl }: {
  report: StrategyReport;
  brief: PlanBrief;
  targetLabel: string;
  saveControl: ReactNode;
}) {
  const id = useId();
  const [selected, setSelected] = useState<MediaGroup | null>(report.allocations[0]?.medium ?? null);
  const [delivery, setDelivery] = useState<DeliverySummary | null>(null);
  const [showCoverage, setShowCoverage] = useState(false);
  const active = report.allocations.find(row => row.medium === selected) ?? report.allocations[0];
  const coverage = restoreCoverage(brief);
  const period = displayCampaignPeriod(brief.startDate, brief.endDate);
  const providerCount = report.allocations.reduce((sum, row) => sum + strategyProviderGroups(row).length, 0);
  const ai = report.aiState === "validated" || report.aiState === "cached";

  return <div className={styles.root}>
    <section className={styles.strategy} aria-labelledby={`${id}-strategy`}>
      <header><div><p className={styles.kicker}>Tu recomendación</p><h2 id={`${id}-strategy`}>{brief.brand || "Tu marca"}: una estrategia, un solo plan.</h2></div><span className={styles.badge}>{report.customized ? "Mix personalizado" : ai ? "Datos + IA de Mavi" : "Análisis de medios"}</span></header>
      <p className={styles.narrative}>{report.summary}</p>
      <dl className={styles.context}>
        <div><dt>Objetivo</dt><dd>{brief.objective}</dd></div>
        <div><dt>Audiencia</dt><dd>{targetLabel}</dd></div>
        <div><dt>Cobertura</dt><dd>{coverage.length ? coverageDescription(coverage) : brief.geography}</dd></div>
        <div><dt>Campaña</dt><dd>{period}</dd></div>
      </dl>
      {coverage.length > 0 && <button className={styles.mapButton} type="button" aria-expanded={showCoverage} aria-controls={`${id}-coverage`} onClick={() => setShowCoverage(value => !value)}>{showCoverage ? "Cerrar mapa" : "Ver cobertura en el mapa"}<span aria-hidden="true">{showCoverage ? "−" : "+"}</span></button>}
    </section>
    {showCoverage && <div id={`${id}-coverage`}><GeographicCoveragePicker value={coverage} readOnly /></div>}

    <section className={styles.mix} aria-labelledby={`${id}-mix`}>
      <div className={styles.mixHeading}><p className={styles.kicker}>Distribución de inversión</p><h2 id={`${id}-mix`}>El mix de tu campaña</h2><p>Cada medio cumple un papel en la estrategia.</p><dl className={styles.totals}><div><dt>Presupuesto antes de IVA</dt><dd>{money(report.budgetUsd)}</dd></div><div><dt>Medios</dt><dd>{report.allocations.length}</dd></div><div><dt>Canales y soportes</dt><dd>{providerCount}</dd></div></dl></div>
      <StrategyMixChart rows={report.allocations} budget={report.budgetUsd} selected={active?.medium} compact />
      <div className={styles.legend}>{report.allocations.map(row => <button type="button" key={row.medium} aria-pressed={active?.medium === row.medium} onClick={() => setSelected(row.medium)} style={{ "--medium-color": MEDIA_COLORS[row.medium] } as CSSProperties}><i aria-hidden="true"/><span>{mediaGroupLabel(row.medium)}</span><b>{percent(row.pct)}</b><strong>{money(row.amountUsd)}</strong></button>)}{Boolean(report.reserveUsd) && <p className={styles.reserve}>Saldo disponible <strong>{money(report.reserveUsd)}</strong></p>}</div>
    </section>

    <section className={styles.selection} aria-label="Selección de medios de la propuesta">
      <header className={styles.selectionHeading}><div><p className={styles.kicker}>Pauta recomendada</p><h2>Tu selección, medio por medio</h2></div><p>Abre una ficha para ver su pauta y cantidades.</p></header>
      <nav className={styles.mediaNav} aria-label="Medios de la propuesta">{report.allocations.map(row => <button key={row.medium} type="button" aria-pressed={active?.medium === row.medium} aria-controls={`${id}-selection`} onClick={() => setSelected(row.medium)}><MediaSelectionIcon medium={row.medium}/><span>{mediaGroupLabel(row.medium)}<small>{money(row.amountUsd)}</small></span><b>{percent(row.pct)}</b></button>)}</nav>
      {active && <div id={`${id}-selection`} className={styles.active}>
        <div className={styles.role}><div><h3>{mediaGroupLabel(active.medium)}</h3><p>{active.rationale}</p></div><strong>{money(active.amountUsd)}</strong></div>
        {active.medium === "digital" && active.amountUsd != null && active.amountUsd > digitalProductionSpend(active) && <div className={styles.digital}><strong>Plataformas digitales</strong><span>{brief.digitalObjective || brief.objective}</span><b>{money(active.amountUsd - digitalProductionSpend(active))}</b></div>}
        <ProviderPlanCards allocation={active} delivery={delivery} campaignPeriod={period}/>
      </div>}
    </section>

    <section className={styles.summary} aria-label="Resultados de la propuesta">
      <PlanDeliveryPreview onSummary={setDelivery} request={{ brief, picks: strategyDeliveryPicks(report), expectedMedia: report.allocations.filter(row => (row.amountUsd ?? row.pct) > 0).map(row => row.medium), clientId: brief.clientId }}/>
      <footer className={styles.save}><div><p className={styles.kicker}>Tu propuesta</p><strong>{money(report.budgetUsd)}</strong><span>{report.allocations.length} medios · {period}</span></div>{saveControl}</footer>
    </section>
  </div>;
}
