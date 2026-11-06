"use server";
import { validDate } from "@/lib/broadcast-catalog";

import {revalidatePath} from "next/cache";
import {getSessionProfile} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {portalCapabilities} from "@/lib/portal-access";
export async function enviarNovedad(_previous:{ok:boolean;message:string}|null,form:FormData):Promise<{ok:boolean;message:string}>{
 const profile=await getSessionProfile(),workspace=profile?.workspace;
 if(!workspace||workspace.kind!=="provider"||!portalCapabilities("provider",workspace.role).providerEdit)return {ok:false,message:"Tu acceso no permite publicar novedades de este proveedor."};
 const title=String(form.get("title")??"").trim(),description=String(form.get("description")??"").trim();
 const kind=String(form.get("kind")??""),medium=String(form.get("medium")??""),value=String(form.get("amount")??"").trim();
 const from=String(form.get("from")??""),to=String(form.get("to")??"");
 if(title.length<2||title.length>180||description.length>6000||!["tariff","offer","promotion","news","availability"].includes(kind)||!["tv","radio","ooh","press","digital","influencers"].includes(medium)||value&&!/^\d{1,7}(\.\d{1,2})?$/.test(value)||from&&!validDate(from)||to&&!validDate(to)||from&&to&&to<from)return {ok:false,message:"Revisa los datos, el valor y las fechas de tu actualización."};
 const cents=value?Math.round(Number(value)*100):null;
 const db=await createClient(),{error}=await db.from("provider_submissions").insert({company_id:workspace.companyId,owner_id:profile!.id,title,description,kind,medium,amount_cents:cents,valid_from:from||null,valid_to:to||null,status:"submitted"});
 if(error)return {ok:false,message:"No se pudo guardar la actualización. Intenta nuevamente."};
 revalidatePath("/proveedores");return {ok:true,message:"Actualización enviada a revisión."};
}
