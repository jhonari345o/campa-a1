import {cerrarSesion} from "@/app/consola/actions";
import Image from "next/image";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {getMyCompanies} from "@/lib/company";
import {workspaceIdentity} from "@/lib/workspace-brand";
import {ActivationForm} from "./ActivationForm";
export const metadata={title:"Activa tu acceso"};
export default async function ActivatePage(){
 const db=await createClient(),{data:{user}}=await db.auth.getUser();
 if(!user)redirect("/ingresar");
 if(user.app_metadata?.must_change_password!==true)redirect("/panel");
 const workspace=workspaceIdentity(await getMyCompanies(user.id),false);
 return <main data-workspace-brand={workspace?.brand??"one"} className="workspace-activation grid min-h-screen place-items-center bg-fog p-6"><section className="w-full max-w-md rounded-panel border border-border bg-white p-8 shadow-panel">
 {workspace?.brand==="mobil"?<Image src="/partners/mobil/mobil-logo.png" width={2000} height={610} alt="Mobil" className="mb-8 h-auto w-44" priority/>:workspace?.brand==="ucsg"?<Image src="/partners/ucsg/ucsg-logo.png" width={534} height={132} alt="UCSG" className="mb-8 h-auto w-44" priority/>:workspace?.brand==="lettera"?<Image src="/partners/lettera/lettera-logo.png" width={2048} height={493} alt="Léttera" className="mb-8 h-auto w-44" priority/>:null}
 <p className="text-xs font-black uppercase tracking-widest text-signal-dark">{workspace?.name??"Tu primer ingreso"}</p><h1 className="mt-3 text-3xl font-black">Haz tuya esta cuenta.</h1><p className="mt-3 text-sm leading-relaxed text-muted">Crea tu contraseña personal para continuar a tu espacio.</p><ActivationForm/><form action={cerrarSesion} className="mt-6"><button className="text-sm font-bold text-signal-dark">Cerrar sesión</button></form></section></main>;
}
