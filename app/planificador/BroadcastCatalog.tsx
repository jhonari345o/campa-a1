"use client";
import { useState } from "react";
import { CatalogInlineProduct, CatalogPrice } from "./CatalogShopping";
import { sourceDescription, tvValidity, type BroadcastCatalog } from "@/lib/broadcast-catalog";
const number=(n:number|null)=>n==null?"—":new Intl.NumberFormat("es-EC",{maximumFractionDigits:3}).format(n);
export function BroadcastCatalogPanel({kind,catalog}:{kind:"tv"|"radio";catalog:BroadcastCatalog}) {
 const sources=catalog.sources.filter(s=>s.kind===kind);
 const [selected,setSelected]=useState(sources[0]?.id??"");
 const source=sources.find(s=>s.id===selected)??sources[0];
 const [query,setQuery]=useState(""); const [start,setStart]=useState(""); const [end,setEnd]=useState("");
 const [market,setMarket]=useState(""); const [target,setTarget]=useState("");
 const filteredSources=sources.filter(s=>(!market||s.market===market)&&(!target||s.target===target));
 const current=filteredSources.find(s=>s.id===source?.id)??filteredSources[0];
 const rows=catalog.radio.filter(r=>r.sourceId===current?.id&&r.name.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"))).sort((a,b)=>(b.rating??-1)-(a.rating??-1));
 const offers=catalog.tv.filter(o=>o.sourceId===current?.id&&`${o.title} ${o.day}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
 const invalidDates=kind==='tv'&&!!current&&!!(start||end)&&!tvValidity(current,start,end||start);
 const selectStyle="mt-1 w-full rounded-xl border border-border bg-white px-3 py-3 text-sm font-normal";
 return <section className="media-portal-section">
  <p className="text-xs font-black uppercase tracking-widest text-signal-dark">{kind==='tv'?'Televisión · tarifas':'Radio · estudios de audiencia'}</p>
  <h2 className="mt-2 text-3xl font-black">{kind==='tv'?'Tarifas por canal y vigencia':'Rankings por plaza y público'}</h2>
  <p className="mt-2 text-sm text-muted">{kind==='tv'?'Consulta la edición aplicable a las fechas de tu campaña.':'Cada ranking conserva su estudio, plaza, público y franja. La fecha de envío no cambia la fecha de medición.'}</p>
  {catalog.error&&<p role="alert" className="mt-4 text-coral">{catalog.error}</p>}
  {!current?<p className="mt-5">No hay fuentes disponibles para estos filtros.</p>:null}
  <div className="mt-5 grid gap-3 md:grid-cols-2">
   <label className="text-sm font-bold">Plaza<select className={selectStyle} value={market} onChange={e=>{setMarket(e.target.value);setSelected('');}}><option value="">Todas las plazas</option>{[...new Set(sources.map(s=>s.market))].map(v=><option key={v}>{v}</option>)}</select></label>
   <label className="text-sm font-bold">Público de la fuente<select className={selectStyle} value={target} onChange={e=>{setTarget(e.target.value);setSelected('');}}><option value="">Todos los públicos</option>{[...new Set(sources.map(s=>s.target))].map(v=><option key={v}>{v}</option>)}</select></label>
   <label className="text-sm font-bold md:col-span-2">{kind==='tv'?'Canal y edición del tarifario':'Estudio y período'}<select className={selectStyle} value={current?.id??''} onChange={e=>{setSelected(e.target.value);setQuery('');}}>{filteredSources.map(s=><option key={s.id} value={s.id}>{s.label} · {s.periodStart.slice(0,7)} · {s.market} · {s.target}{s.frequency?` · ${s.frequency}`:''}</option>)}</select></label>
  </div>
  {current&&<>
   <div className="mt-5 rounded-2xl bg-forest p-5 text-white"><strong>{sourceDescription(current)}</strong><p className="mt-2 text-sm">{current.conditions}</p>{current.annualContract&&<p className="mt-2 font-bold">Requiere contrato anual</p>}{kind==='tv'&&<p className="mt-2 text-sm">Base: {current.spotSeconds??'—'} segundos · mínimo {current.minimumSeconds??'no indicado'} segundos · {current.taxIncluded===false?'Sin IVA':current.taxIncluded===true?'IVA incluido':'Tratamiento de impuestos no indicado'}</p>}</div>
   {kind==='tv'&&<div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-sm font-bold">Inicio de campaña<input type="date" className={selectStyle} value={start} onChange={e=>setStart(e.target.value)}/></label><label className="text-sm font-bold">Fin de campaña<input type="date" className={selectStyle} value={end} onChange={e=>setEnd(e.target.value)}/></label></div>}
   {invalidDates&&<p role="status" className="mt-4 rounded-xl bg-amber/15 p-4 font-bold">Este tarifario no cubre todas las fechas seleccionadas. Puedes consultarlo, pero no aplicarlo al presupuesto de esas fechas.</p>}
   <label className="mt-5 block text-sm font-bold">{kind==='tv'?'Buscar programa o día':'Buscar emisora'}<input className={selectStyle} value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <div className="mt-5 overflow-x-auto rounded-xl border border-border"><table className="w-full text-left text-sm"><thead className="bg-fog"><tr>{(kind==='tv'?['Programa','Día','Horario','Público','Tarifa de la cuña','Cuñas al carrito']:['Puesto del corte','Emisora','Rating','Share (%)','Audiencia']).map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{kind==='tv'?offers.map(o=><tr key={o.id} className="border-t border-border"><th className="p-3">{o.title}{o.note&&<small className="block font-normal text-muted">{o.note}</small>}</th><td className="p-3">{o.day}</td><td className="p-3">{o.schedule}</td><td className="p-3">{o.target||current.target}</td><td className="p-3 font-bold">{<CatalogPrice productKey={`tv:${current.id}:${o.id}`}/>}</td><td className="p-3"><CatalogInlineProduct productKey={`tv:${current.id}:${o.id}`} label="Cuñas"/></td></tr>):rows.map(r=><tr key={r.id} className="border-t border-border"><td className="p-3">{r.rank??'—'}</td><th className="p-3">{r.name}</th><td className="p-3">{number(r.rating)}</td><td className="p-3">{number(r.share)}</td><td className="p-3">{number(r.audience)}</td></tr>)}</tbody></table></div>
   <p className="mt-3 text-xs text-muted">{kind==='tv'?`${offers.length} tarifas de esta edición. Las condiciones contractuales y la plaza se conservan al planificar.`:`${rows.length} emisoras del mismo corte. No se suman audiencias ni se convierte rating en alcance de campaña.`}</p>
  </>}
 </section>;
}
