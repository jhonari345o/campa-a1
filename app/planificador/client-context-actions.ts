'use server';
import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
export async function chooseCatalogClient(_state:{error:string}|null,form:FormData):Promise<{error:string}>{
 const id=String(form.get('clientId')??''),version=Number(form.get('version'));
 if(!/^[a-f0-9-]{36}$/i.test(id)||!Number.isSafeInteger(version)||version<0)return {error:'Selecciona un cliente válido.'};
 const db=await createClient(),{error}=await db.rpc('choose_catalog_client',{p_client:id,p_expected_version:version,p_clear:form.get('clear')==='yes'});
 if(error)return {error:error.message.includes('CART_NOT_EMPTY')?'Confirma que quieres vaciar la selección antes de cambiar de cliente.':'La selección cambió. Recarga la página para continuar.'};
 revalidatePath('/planificador');return {error:''};
}
