import type { TgiResearch } from "@/lib/tgi";
import { tgiIndicatorApplies } from "@/lib/tgi";

export function TgiResearchPanel({ research, selectedMedia }: { research?: TgiResearch; selectedMedia: string[] }) {
  if (!research) return <section className="infomedia-research" aria-label="Consumo de medios"><h2>Consumo de medios · TGI</h2><p>La referencia TGI no está disponible para este análisis. La propuesta conserva la evidencia de Infomedia y los criterios del brief.</p></section>;
  const media = research.values.filter((row) => row.role === "media" && tgiIndicatorApplies(row.id, selectedMedia));
  const behaviors = research.values.filter((row) => row.role === "behavior");
  return <section className="infomedia-research tgi-research" aria-label="Consumo de medios TGI">
    <header><div><p>Audiencia · consumo de medios</p><h2>{research.study}</h2><span>{research.period} · {research.geography}</span></div><strong>{research.targetLabel}</strong></header>
    <p className="infomedia-note"><b>{research.relationship === "age_matched" ? "Corte de edad disponible. " : "Contexto de audiencia. "}</b>{research.note}</p>
    <div className="infomedia-columns"><article><h3>Medios seleccionados en el brief</h3>{media.length ? media.map((row) => <div className="infomedia-bar-row" key={row.id}><div><span>{row.label}</span><strong>{row.value.toLocaleString("es-EC", { maximumFractionDigits: 2 })}%</strong></div><meter min={0} max={100} value={row.value} aria-label={row.label} /></div>) : <p>La referencia no incluye un indicador de consumo para estos medios.</p>}</article>
      <article><h3>Hábitos que orientan la estrategia</h3>{behaviors.map((row) => <div className="infomedia-bar-row" key={row.id}><div><span>{row.label}</span><strong>{row.value.toLocaleString("es-EC", { maximumFractionDigits: 2 })}%</strong></div><meter min={0} max={100} value={row.value} aria-label={row.label} /></div>)}<p className="infomedia-note">La inversión de categoría muestra dónde compiten las marcas; TGI aporta hábitos de consumo. Son fuentes y períodos distintos: sus porcentajes no se suman.</p></article></div>
  </section>;
}
