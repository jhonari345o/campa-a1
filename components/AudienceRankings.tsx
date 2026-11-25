"use client";
import {useState} from "react";
import type {StrategyReport} from "@/lib/media-strategy";
import {MediaProviderMark} from "./MediaProviderMark";
import styles from "./AudienceRankings.module.css";

const number=(value:number)=>new Intl.NumberFormat("es-EC",{maximumFractionDigits:2}).format(value);
export function AudienceRankings({report}:{report:StrategyReport}) {
  const [channel,setChannel]=useState("all"),[cohort,setCohort]=useState("");
  const tv=report.audienceReferences.filter(row=>row.medium==="television");
  const radio=report.audienceReferences.filter(row=>row.medium==="radio");
  const sources=new Map(report.sources.map(source=>[source.id,source]));
  const cohorts=[...new Set(radio.map(row=>row.sourceId))];
  const active=cohorts.includes(cohort)?cohort:cohorts[0];
  const selected=sources.get(active);
  return <div className={styles.grid}>
    {!!tv.length&&<section className={styles.card}><header><h3>Ratings de televisión</h3><label>Canal<select value={channel} onChange={e=>setChannel(e.target.value)}><option value="all">Todos los canales</option>{[...new Set(tv.map(row=>row.provider))].map(name=><option key={name}>{name}</option>)}</select></label></header>
      <div className={styles.table}><table><thead><tr><th>Programa</th><th>Rating</th><th>Plaza y público</th></tr></thead><tbody>{tv.filter(row=>channel==="all"||row.provider===channel).sort((a,b)=>(b.rating??0)-(a.rating??0)).map(row=>{const source=sources.get(row.sourceId);return <tr key={`${row.sourceId}-${row.product}`}><th scope="row"><span className={styles.identity}><MediaProviderMark provider={row.provider} medium="television"/><span>{row.provider}<small>{row.product}</small></span></span></th><td>{row.rating==null?"—":`${number(row.rating)}%`}</td><td>{source?.market}<small>{source?.target}</small><small>{source?.period}</small></td></tr>;})}</tbody></table></div>
    </section>}
    {!!radio.length&&<section className={styles.card}><header><h3>Rankings de radio</h3><label>Plaza y público<select value={active} onChange={e=>setCohort(e.target.value)}>{cohorts.map(id=><option value={id} key={id}>{sources.get(id)?.market} · {sources.get(id)?.target}</option>)}</select></label></header>
      <p>{selected?.period}</p><div className={styles.table}><table><thead><tr><th>Emisora</th><th>Posición</th><th>Rating</th></tr></thead><tbody>{radio.filter(row=>row.sourceId===active).sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity)).map(row=><tr key={`${row.sourceId}-${row.provider}`}><th scope="row"><span className={styles.identity}><MediaProviderMark provider={row.provider} medium="radio" context={selected?.market}/>{row.provider}</span></th><td>{row.rank??"—"}</td><td>{row.rating==null?"—":number(row.rating)}</td></tr>)}</tbody></table></div>
    </section>}
  </div>;
}
