'use client';
import {useActionState,useEffect,useState} from 'react';
import {chooseCatalogClient} from './client-context-actions';
export function CatalogClientSwitcher({clients,selected,version,hasItems}:{clients:{id:string;name:string}[];selected:{id:string;name:string}|null;version:number;hasItems:boolean}){
 const [state,action,pending]=useActionState(chooseCatalogClient,null),[choice,setChoice]=useState(selected?.id??'');
 useEffect(()=>{if(state&&state.error==='')window.location.reload()},[state]);
 if(!clients.length)return null;
 return <section className="mb-6 rounded-2xl border border-border bg-white p-5"><p className="text-xs font-black uppercase tracking-widest text-signal-dark">Cliente del plan y del catálogo</p><form action={action} className="mt-3 flex flex-wrap items-end gap-3"><input type="hidden" name="version" value={version}/><label className="grid flex-1 gap-2 text-sm font-bold">Usar tarifas de<select required name="clientId" value={choice} onChange={e=>setChoice(e.target.value)} className="min-w-48 rounded-xl border border-border bg-fog p-3"><option value="" disabled>Selecciona un cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="btn btn-primary" disabled={pending||choice===selected?.id}>{pending?'Cambiando…':'Usar este cliente'}</button>{hasItems&&choice!==selected?.id&&<label className="flex w-full gap-2 text-sm"><input type="checkbox" name="clear" value="yes" required/>Vaciar el carrito actual para cambiar de cliente.</label>}</form>{!selected&&<p className="mt-3 text-sm text-muted">Elige el cliente para consultar sus tarifas y preparar su plan.</p>}{state?.error&&<p role="alert" className="mt-3 text-sm text-coral">{state.error}</p>}</section>;
}
