"use client";
import {useState} from "react";
import {changeCatalogQuantity,type CatalogPick,type CatalogProduct} from "@/lib/catalog-shopping";
import {productMedium} from "@/lib/diy-catalog";
import type {MediaGroup} from "@/lib/media-groups";
export function WorkspaceDiyCatalog({products,picks,onChange,medium}:{products:CatalogProduct[];picks:CatalogPick[];onChange:(p:CatalogPick[])=>void;medium:MediaGroup}){
 const [query,setQuery]=useState(""),[limit,setLimit]=useState(6),[error,setError]=useState("");
 const all=products.filter(p=>p.source.workspaceProductId&&productMedium(p)===medium);
 const rows=all.filter(p=>`${p.provider} ${p.name} ${p.format} ${p.location}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
 const money=(p:CatalogProduct)=>{const v=p.priceCents??p.referencePriceCents;return v==null?"Consultar":new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(v/100)};
 if(!all.length)return null;
 function setQuantity(key:string,next:number){if(!Number.isInteger(next)||next<0||next>10000)return;const current=picks.find(p=>p.productKey===key)?.quantity??0;try{onChange(changeCatalogQuantity(picks,key,next-current));setError("")}catch{setError("Puedes incluir hasta 100 formatos distintos.")};}
 return <section className="mb-7 rounded-2xl border border-border bg-white p-5"><p className="text-xs font-black uppercase tracking-widest text-signal-dark">Tarifas de tu espacio</p><h3 className="mt-2 text-xl font-black">Incluye tus formatos acordados</h3><label className="mt-4 block text-sm font-bold">Buscar medio, formato o plaza<input value={query} type="search" onChange={e=>{setQuery(e.target.value);setLimit(6)}} className="mt-2 w-full rounded-xl border border-border bg-fog p-3 font-normal"/></label>{error&&<p role="alert" className="mt-3 text-sm">{error}</p>}<div className="mt-4 grid gap-3 md:grid-cols-2">{rows.slice(0,limit).map(p=>{const quantity=picks.find(x=>x.productKey===p.key)?.quantity??0;return <article key={p.key} className="rounded-xl border border-border bg-fog p-4"><p className="text-xs font-bold text-muted">{p.provider} · {p.location}</p><h4 className="mt-2 font-black">{p.name}</h4><p className="mt-2 text-sm">{p.format} · {money(p)} / {p.unit}</p><p className="mt-2 text-xs text-muted">{p.validFrom} – {p.validTo}</p><label className="mt-3 block text-sm font-bold">Cantidad<input type="number" min={0} max={10000} value={quantity} onChange={e=>setQuantity(p.key,Number(e.target.value))} className="ml-3 w-24 rounded-lg border border-border bg-white p-2"/></label></article>})}</div>{rows.length>limit&&<button type="button" className="btn btn-secondary mt-4" onClick={()=>setLimit(n=>n+6)}>Ver más formatos →</button>}</section>;
}
