"use client";
import {useState} from "react";
import {lookupKey,type ResearchPeriod} from "@/lib/infomedia";
import styles from "./CompetitiveShareChart.module.css";
const pct=(n:number|null)=>n==null?"—":`${new Intl.NumberFormat("es-EC",{maximumFractionDigits:1}).format(n*100)}%`;
export function CompetitiveShareChart({period,brand}:{period:ResearchPeriod;brand:string}) {
 const [index,setIndex]=useState(0);
 const context=period.pressureContexts[index]??period.pressureContexts[0];
 const rows=[...period.topBrands];
 if(period.focusBrand&&!rows.some(r=>lookupKey(r.brand)===lookupKey(period.focusBrand!.brand)))rows.push(period.focusBrand);
 if(!rows.length)return null;
 return <section className={styles.root} aria-label="Inversión y participación publicitaria">
  <header><div><p>Categoría y competencia</p><h3>Inversión y presencia de marca</h3></div>{context&&<label>Voz publicitaria<select value={index} onChange={e=>setIndex(Number(e.target.value))}>{period.pressureContexts.map((c,i)=><option key={`${c.media}-${c.market}`} value={i}>{c.media} · {c.market}</option>)}</select></label>}</header>
  <div className={styles.legend}><span>● SOI · inversión total de la categoría</span>{context&&<span>● SOV · {context.media} · {context.market}</span>}</div>
  <div className={styles.rows}>{rows.map(row=>{const sov=context?.topBrands.find(b=>lookupKey(b.brand)===lookupKey(row.brand))?.sov??null;return <article className={lookupKey(row.brand)===lookupKey(brand)?styles.own:""} key={row.brand}><div><strong>{row.brand}</strong>{lookupKey(row.brand)===lookupKey(brand)&&<small>Tu marca</small>}</div><div className={styles.bars}>{[row.soi,...(context?[sov]:[])].map((value,i)=><div key={i}><div className={styles.track}><i style={{width:`${Math.min(100,(value??0)*100)}%`}}/></div><span>{pct(value)}</span></div>)}</div></article>;})}</div>
 </section>;
}
