import type { StrategyReport } from "@/lib/media-strategy";
import { mediaGroupLabel } from "@/lib/plan-optimizer";
import styles from "./MediaStrategyPanel.module.css";

const money=(n:number|null)=>n==null?"Por definir":new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
const share=(n:number)=>new Intl.NumberFormat("es-EC",{style:"percent",maximumFractionDigits:1}).format(n);
const number=(n:number)=>new Intl.NumberFormat("es-EC",{maximumFractionDigits:2}).format(n);
const stateText:Record<StrategyReport["aiState"],string>={
  validated:"Interpretación de AWS validada contra las fuentes del plan.",cached:"Interpretación de AWS recuperada para el mismo brief y el mismo corte de fuentes.",
  not_configured:"Recomendación calculada con el motor de datos. La interpretación de IA aún no está activada.",
  quota:"Recomendación calculada con datos. La consulta de IA no se ejecutó por el límite de uso.",
  unavailable:"Recomendación calculada con datos. La interpretación de IA no estuvo disponible.",
  rejected:"Recomendación calculada con datos. La interpretación de IA no superó la validación de evidencia.",
};

export function MediaStrategyPanel({report}:{report:StrategyReport}) {
  const ai=report.aiState==="validated"||report.aiState==="cached";
  const sources=new Map(report.sources.map(s=>[s.id,s]));
  const scenarioKeys=new Set<string>();
  const alternatives=report.alternatives.filter(a=>{const key=JSON.stringify(a.allocations);if(scenarioKeys.has(key))return false;scenarioKeys.add(key);return true;});
  return <section aria-label="Recomendación de medios con evidencia" className={styles.root}>
    <header className={styles.header}><div><p className={styles.kicker}>Decisión de medios</p><h2>El mix, sus razones y la evidencia.</h2><p>{report.summary}</p></div><span className={styles.badge}>{report.customized?"Distribución personalizada":ai?"Datos + IA de AWS":"Motor de datos"}</span></header>
    <p className={styles.engine}>{stateText[report.aiState]}</p>
    <div className={styles.metrics}><div><span>Presupuesto del brief</span><strong>{money(report.budgetUsd)}</strong></div><div><span>Opciones documentadas</span><strong>{report.candidateCount}</strong></div><div><span>Fuentes y cortes</span><strong>{report.sources.length}</strong></div><div><span>Medios para cotizar</span><strong>{report.allocations.filter(a=>a.readiness==="needs_quote").length}</strong></div></div>
    {!!report.reserveUsd&&<p className={styles.pending}>Sin asignar: {money(report.reserveUsd)}. Completa las fuentes o revisa el presupuesto para construir una combinación viable.</p>}
    <div className={styles.allocations}>{report.allocations.map(a=><article key={a.medium}>
      <header><h3>{mediaGroupLabel(a.medium)}</h3><span>{share(a.pct)}</span></header><strong className={styles.amount}>{money(a.amountUsd)}</strong>
      <p>{a.rationale}</p><span className={styles.tag}>{a.readiness==="reference"?"Tarifa compatible":a.readiness==="platform_budget"?"Presupuesto de plataforma":"Presupuesto para cotizar"}</span>
      {a.candidate&&<div className={styles.candidate}><strong>{a.candidate.provider}</strong><p>{a.candidate.product}</p><small>{a.candidate.market} · {a.candidate.period}</small>
        {a.units!=null&&a.units>0&&<p>{number(a.units)} × {a.candidate.unit} · {money(a.referenceSpendUsd)}{a.remainderUsd?` · saldo ${money(a.remainderUsd)}`:""}</p>}
        <small>{a.candidate.target}</small></div>}
      <details><summary>Por qué entra al mix</summary>{a.sourceIds.map(id=>{const s=sources.get(id);return s?<p key={id}><b>{s.label}</b> · {s.period}<br/><small>{s.market} · {s.target} · {s.use==="comparable"?"Compatible con el brief":"Referencia contextual"}</small></p>:null;})}</details>
    </article>)}</div>
    {report.competition.length>0&&<section className={styles.section}><h3>Competencia observada</h3><p>Inversión estimada de la categoría en {sources.get("category-investment")?.period}. Describe presión competitiva, no resultados de las marcas.</p><div className={styles.table}><table><thead><tr><th>Marca</th><th>Inversión estimada</th><th>Participación</th></tr></thead><tbody>{report.competition.slice(0,12).map(b=><tr key={b.brand}><th scope="row">{b.brand}{b.declared&&<small>Declarada en el brief</small>}</th><td>{money(b.estimatedInvestment)}</td><td>{share(b.soi)}</td></tr>)}</tbody></table></div></section>}
    {report.audienceReferences.length>0&&<section className={styles.section}><h3>Ratings de TV disponibles</h3><p>Cada observación conserva su público y período. Los estrenos y los cortes de otro target se presentan como referencia contextual.</p><div className={styles.table}><table><thead><tr><th>Programa</th><th>Rating</th><th>Plaza y público</th><th>Período</th><th>Uso</th></tr></thead><tbody>{report.audienceReferences.map(r=>{const s=sources.get(r.sourceId);return <tr key={r.sourceId}><th scope="row">{r.provider}<small>{r.product}</small></th><td>{r.rating==null?"Sin dato":`${number(r.rating)}%`}</td><td>{s?.market}<small>{s?.target}</small></td><td>{s?.period}</td><td>{s?.use==="comparable"?"Compatible":"Contextual"}</td></tr>;})}</tbody></table></div></section>}
    {report.gaps.length>0&&<aside className={styles.pending}><h3>Datos que faltan para cerrar la pauta</h3><ul>{report.gaps.slice(0,6).map(g=><li key={g}>{g}</li>)}</ul>{report.gaps.length>6&&<details><summary>Ver los demás puntos ({report.gaps.length-6})</summary><ul>{report.gaps.slice(6).map(g=><li key={g}>{g}</li>)}</ul></details>}</aside>}
    {report.questions.length>0&&<aside className={styles.questions}><h3>Preguntas para afinar la recomendación</h3><ul>{report.questions.map(q=><li key={q}>{q}</li>)}</ul></aside>}
    {alternatives.length>1&&<details className={styles.section}><summary>Comparar distribuciones</summary><p>Alternativas bajo el mismo presupuesto y las mismas fuentes; no son pronósticos de rendimiento.</p><div className={styles.alternatives}>{alternatives.map(a=><article key={a.id}><h4>{a.label}</h4><dl>{a.allocations.map(r=><div key={r.medium}><dt>{mediaGroupLabel(r.medium)}</dt><dd>{share(r.pct)} · {money(r.amountUsd)}</dd></div>)}</dl></article>)}</div></details>}
    <details className={styles.section}><summary>Ver fuentes y compatibilidad ({report.sources.length})</summary><div className={`${styles.table} ${styles.sourceTable}`}><table><thead><tr><th>Fuente</th><th>Período</th><th>Plaza y público</th><th>Uso en el plan</th></tr></thead><tbody>{report.sources.map(s=><tr key={s.id}><th scope="row">{s.label}<small>{s.note}</small></th><td>{s.period}</td><td>{s.market}<small>{s.target}</small></td><td>{s.use==="comparable"?"Compatible":s.use==="context"?"Contextual":"No aplicable"}</td></tr>)}</tbody></table></div></details>
    <p className={styles.footer}>Las referencias históricas y contextuales se conservan separadas de las mediciones del público. El alcance único y los resultados requieren fuentes de medición específicas.</p>
  </section>;
}
