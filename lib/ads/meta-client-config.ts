import "server-only";
import {createAdminClient} from "@/lib/supabase/admin";
import {parseMetaClientBindings,selectMetaClientBinding,type MetaClientBinding,type MetaClientScope} from "./meta-client-binding";

export type MetaClientConfig={
  accessToken:string;adAccountId:string;pageId:string;instagramUserId?:string;apiVersion:string;binding:MetaClientBinding;
};
export function configuredMetaClientBindings():MetaClientBinding[]{
  return parseMetaClientBindings(process.env.META_CLIENT_BINDINGS_JSON);
}
export function hasConfiguredMetaClients():boolean{
  try{return configuredMetaClientBindings().some(b=>b.active&&Boolean(process.env[b.credentialEnv]?.trim()));}catch{return false;}
}
/** Called only after administrator authorization or from the authorized job executor.
 * Scope is resolved from the stored company/job; browser-supplied Meta IDs are never used. */
export async function metaClientConfig(scope:MetaClientScope,allowInactive=false):Promise<MetaClientConfig>{
  const binding=selectMetaClientBinding(configuredMetaClientBindings(),scope,allowInactive);
  const db=createAdminClient();
  const {data:company,error}=await db.from("companies").select("id,status,portal_kind").eq("id",binding.companyId).maybeSingle();
  if(error||!company||(!allowInactive&&company.status!=="activa"))throw new Error("El espacio de la conexión de Meta no está disponible.");
  if(company.portal_kind==="agency"){
    if(!binding.clientId)throw new Error("Selecciona el cliente de la agencia antes de conectar Meta.");
    const result=await db.from("workspace_clients").select("id").eq("company_id",binding.companyId).eq("id",binding.clientId).maybeSingle();
    if(result.error||!result.data)throw new Error("El cliente no pertenece al espacio de esta conexión.");
  }else if(company.portal_kind!=="client"||binding.clientId!==null){
    throw new Error("La conexión de Meta no corresponde al tipo de espacio.");
  }
  const accessToken=process.env[binding.credentialEnv]?.trim();
  if(!accessToken)throw new Error("Falta la credencial privada de Meta para este cliente.");
  const apiVersion=process.env.META_GRAPH_API_VERSION?.trim()||"v25.0";
  if(!/^v\d+\.\d+$/.test(apiVersion))throw new Error("La versión de Meta no es válida.");
  return {accessToken,adAccountId:binding.adAccountId,pageId:binding.pageId,instagramUserId:binding.instagramUserId,apiVersion,binding};
}
