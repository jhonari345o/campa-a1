"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export async function activarCuenta(_prev:{error:string}|null,form:FormData):Promise<{error:string}> {
 const password=String(form.get("password")??""),confirm=String(form.get("confirm")??"");
 if(password.length<12||password.length>128||password!==confirm) return {error:"Usa al menos 12 caracteres y confirma la misma contraseña."};
 const db=await createClient(),{data:{user}}=await db.auth.getUser();
 if(!user||user.app_metadata?.must_change_password!==true)return {error:"Inicia sesión con el acceso temporal que te entregó tu administrador."};
 const {error}=await db.auth.updateUser({password});
 if(error)return {error:"No se pudo guardar la contraseña. Vuelve a intentar."};
 const {error:grantError}=await createAdminClient().auth.admin.updateUserById(user.id,{app_metadata:{...user.app_metadata,must_change_password:false}});
 if(grantError)return {error:"La contraseña fue guardada; falta completar la activación. Contacta a tu administrador."};
 await db.auth.refreshSession();
 return {error:""};
}
