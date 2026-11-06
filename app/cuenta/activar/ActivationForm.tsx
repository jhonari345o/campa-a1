"use client";
import {useActionState,useEffect} from "react";
import {activarCuenta} from "./actions";
export function ActivationForm(){
 const [state,action,pending]=useActionState(activarCuenta,null);
 useEffect(()=>{if(state&&state.error==="")window.location.assign("/panel")},[state]);
 return <><form action={action} className="mt-6 grid gap-4"><label className="grid gap-2 text-sm font-bold">Nueva contraseña<input type="password" name="password" minLength={12} maxLength={128} required autoComplete="new-password" className="rounded-xl border border-border p-3"/></label><label className="grid gap-2 text-sm font-bold">Confirma tu contraseña<input type="password" name="confirm" minLength={12} maxLength={128} required autoComplete="new-password" className="rounded-xl border border-border p-3"/></label><button disabled={pending} className="btn btn-primary">{pending?"Guardando…":"Continuar a mi espacio →"}</button></form>{state?.error&&<p role="alert" className="mt-4 text-sm text-coral">{state.error}</p>}</>;
}
