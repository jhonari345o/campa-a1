import type { StrategyAllocation } from "@/lib/media-strategy";
import type { DeliverySummary } from "@/lib/media-delivery";
import { strategyProviderGroups } from "@/lib/strategy-groups";
import { formatBudgetInput } from "@/lib/brief-inputs";
import { MediaProviderMark } from "./MediaProviderMark";
import { OohPlanPhoto } from "./OohPlanPhoto";
import styles from "./ProviderPlanCards.module.css";
const number=(n:number)=>new Intl.NumberFormat("es-EC",{maximumFractionDigits:1}).format(n);
const money=(n:number)=>`$ ${formatBudgetInput(n)}`;

export function ProviderPlanCards({allocation,delivery,campaignPeriod}:{allocation:StrategyAllocation;delivery:DeliverySummary|null;campaignPeriod:string|null}) {
  const broadcast=allocation.medium==="television"||allocation.medium==="radio";
  return <div className={styles.grid}>{strategyProviderGroups(allocation).map(group=>{
    const measurement=delivery?.providers?.find(p=>p.key===group.key);
    const programs=[...new Set(group.rows.map(r=>r.candidate.product))];
    return <details className={styles.card} key={group.key}>
      <summary><div className={styles.identity}><MediaProviderMark provider={group.provider} medium={allocation.medium} context={group.rows.map(r=>r.candidate.market).join(" ")}/><div><h4>{group.provider}</h4><p>{programs.length} {broadcast?"programas / formatos":"opciones"}</p></div><strong>{money(group.spend)}</strong></div>
        <p className={styles.programs}>{programs.slice(0,3).join(" · ")}{programs.length>3?` · +${programs.length-3}`:""}</p>
        <dl className={styles.kpis}><div><dt>{broadcast?"Cuñas":"Unidades"}</dt><dd>{number(group.spots)}</dd></div>{measurement?.grps!=null&&<div><dt>GRPs</dt><dd>{number(measurement.grps)}</dd></div>}{measurement&&<div><dt>Alcance</dt><dd>{number(measurement.reachPct)}%</dd></div>}{measurement?.frequency!=null&&<div><dt>Frecuencia</dt><dd>{number(measurement.frequency)}×</dd></div>}</dl>
        <span className={styles.expand}>Ver {broadcast?"mapa de pauta":"selección"}<b aria-hidden="true">＋</b></span>
      </summary>
      <div className={styles.detail}><p>{campaignPeriod}{measurement?.scopeLabel?` · ${measurement.scopeLabel}`:""}</p><div className={styles.table}><table><thead><tr><th>{broadcast?"Programa y horario":"Formato"}</th><th>Plaza</th><th>{broadcast?"Cuñas":"Cantidad"}</th><th>Inversión</th></tr></thead><tbody>{group.rows.map(row=><tr key={row.candidate.id}><th scope="row">{row.candidate.product}<small>{row.candidate.note.split(" · ").slice(0,2).join(" · ")}</small></th><td>{row.candidate.market}</td><td>{row.units??"—"}</td><td>{money(row.referenceSpendUsd??row.amountUsd??0)}</td></tr>)}</tbody></table></div>
        {allocation.medium==="ooh"&&<div className={styles.photos}>{group.rows.filter(r=>r.candidate.oohPhoto).map(r=><div key={r.candidate.id}><OohPlanPhoto photo={r.candidate.oohPhoto!} title={r.candidate.product}/><strong>{r.candidate.product}</strong></div>)}</div>}
        {group.rows.some(r=>r.candidate.digitalProduction)&&<ul>{group.rows.flatMap(r=>r.candidate.digitalProduction?.rights??[]).map((right,i)=><li key={i}>{right}</li>)}</ul>}
      </div>
    </details>;
  })}</div>;
}
