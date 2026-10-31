"use client";
import { useState, useTransition } from "react";
import type { CategoryResearch } from "@/lib/infomedia";
import type { ResearchAdvice } from "@/lib/infomedia-ai";
import { interpretarCategoria } from "@/app/planificador/research-actions";
const money = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const percent = (n: number) => new Intl.NumberFormat("es-EC", { style: "percent", maximumFractionDigits: 1 }).format(n);
export function InfomediaResearchPanel({ research, brand = "", objective = "" }: { research?: CategoryResearch; brand?: string; objective?: string }) {
  const [periodIndex, setPeriodIndex] = useState(Math.max(0, research?.periods.findIndex((item) => item.year === research.referenceYear) ?? 0));
  const [advice, setAdvice] = useState<ResearchAdvice | null>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  if (!research?.periods.length) return null;
  const period = research.periods[periodIndex] ?? research.periods[0];
  return <section className="infomedia-research" aria-label="Investigación de categoría">
    <header><div><p>Infomedia · investigación de categoría</p><h2>{research.category.label}</h2><span>Datos hasta {research.dataThrough} · {period.sourceTarget}</span></div>
      <label>Consultar período<select value={periodIndex} onChange={(event) => setPeriodIndex(Number(event.target.value))}>{research.periods.map((item, index) => <option key={item.year} value={index}>{item.periodLabel}</option>)}</select></label>
    </header>
    <div className="infomedia-metrics">
      <article><small>Inversión estimada observada</small><strong>{money(period.totals.estimatedInvestment)}</strong></article>
      <article><small>Avisos registrados</small><strong>{period.totals.notices.toLocaleString("es-EC")}</strong></article>
      <article><small>Marcas activas</small><strong>{period.totals.activeBrands}</strong></article>
    </div>
    <p className="infomedia-note">Referencia de mercado para {period.periodLabel.toLowerCase()}. No representa la ejecución del cliente ni el costo de compra. Los períodos se consultan por separado. La propuesta utiliza: {research.periods.find((item) => item.year === research.referenceYear)?.periodLabel ?? research.periods[0].periodLabel}.</p>
    <div className="infomedia-columns">
      <article><h3>Mezcla de medios observada</h3>{period.mediaMix.map((item) => <div className="infomedia-bar-row" key={item.media}>
        <div><span>{item.media}</span><strong>{percent(item.share)}</strong></div><meter min={0} max={1} value={item.share} aria-label={item.media} /><small>{money(item.estimatedInvestment)}</small>
      </div>)}</article>
      <article><h3>Principales marcas</h3><div className="infomedia-table-wrap"><table><thead><tr><th>Marca</th><th>Inversión estimada</th><th>SOI</th><th>SOA</th></tr></thead><tbody>
        {period.topBrands.map((item) => <tr key={item.brand}><th>{item.brand}</th><td>{money(item.estimatedInvestment)}</td><td>{percent(item.soi)}</td><td>{percent(item.soa)}</td></tr>)}
      </tbody></table></div><small>SOI: participación de inversión. SOA: participación de avisos. Ninguna equivale a alcance.</small></article>
    </div>
    {brand && <p className="infomedia-note">{period.focusBrand ? `${period.focusBrand.brand}: ${money(period.focusBrand.estimatedInvestment)} · SOI ${percent(period.focusBrand.soi)} · SOA ${percent(period.focusBrand.soa)}.` : `No hay coincidencia exacta para “${brand}” en este período. No se asignan datos de otras marcas.`}</p>}
    {period.pressureContexts.length > 0 && <details><summary>Presión publicitaria por medio y mercado</summary><p className="infomedia-note">Cada contexto conserva su target y plaza. No se suman GRP entre medios o mercados.</p><div className="infomedia-table-wrap"><table><thead><tr><th>Medio</th><th>Mercado</th><th>GRP del contexto</th><th>Marcas</th></tr></thead><tbody>{period.pressureContexts.map((item) => <tr key={`${item.media}-${item.market}`}><th>{item.media}</th><td>{item.market}</td><td>{item.grps.toLocaleString("es-EC", { maximumFractionDigits: 1 })}</td><td>{item.activeBrands}</td></tr>)}</tbody></table></div></details>}
    <div className="infomedia-ai"><div><h3>Lectura estratégica de Mavi</h3><p>La IA interpreta el período elegido para la propuesta. Las cifras y el presupuesto se conservan calculados por la plataforma.</p></div>
      <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => {
        setMessage(""); start(async () => {
          const result = await interpretarCategoria(research.category.id, objective, research.referenceYear);
          if (result.ok) setAdvice(result.advice); else setMessage(result.error);
        });
      }}>{pending ? "Analizando…" : "Interpretar con IA de AWS"}</button>
      {message && <p role="status">{message}</p>}
      {advice && <aside><strong>Interpretación de IA · para revisión</strong><p>{advice.emphasis}</p><ul>{advice.questions.map((question) => <li key={question}>{question}</li>)}</ul></aside>}
    </div>
  </section>;
}
