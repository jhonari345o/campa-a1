/** Server configuration metadata only. Credentials never belong in this registry. */
export type MetaClientScope = { companyId: string; clientId: string | null };
export type MetaClientBinding = MetaClientScope & {
  id: string;
  name: string;
  version: number;
  active: boolean;
  adAccountId: string;
  pageId: string;
  instagramUserId?: string;
  credentialEnv: string;
};
export type MetaBindingSnapshot = Omit<MetaClientBinding, "name" | "active">;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digits=/^[1-9][0-9]{0,29}$/;
const scopeKey=(s:MetaClientScope)=>`${s.companyId.toLowerCase()}:${s.clientId?.toLowerCase()??"workspace"}`;
const error=()=>new Error("La conexión de Meta por cliente está incompleta o es ambigua.");

export function parseMetaClientBindings(raw:string|undefined):MetaClientBinding[]{
  if(!raw?.trim())return [];
  if(raw.length>65536)throw error();
  let values:unknown;try{values=JSON.parse(raw);}catch{throw error();}
  if(!Array.isArray(values)||values.length>128)throw error();
  const ids=new Set<string>(),scopes=new Set<string>();
  return values.map((value:unknown)=>{
    if(!value||typeof value!=="object"||Array.isArray(value))throw error();
    const v=value as Record<string,unknown>;
    const allowed=new Set(["id","name","version","active","companyId","clientId","adAccountId","pageId","instagramUserId","credentialEnv"]);
    // Reject accidental token/secret fields rather than copying them to metadata.
    if(Object.keys(v).some(k=>!allowed.has(k)))throw error();
    if(typeof v.id!=="string"||!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(v.id)
      ||typeof v.name!=="string"||!v.name.trim()||v.name.length>120
      ||typeof v.companyId!=="string"||!uuid.test(v.companyId)
      ||!(v.clientId===null||typeof v.clientId==="string"&&uuid.test(v.clientId))
      ||!Number.isSafeInteger(v.version)||Number(v.version)<1||typeof v.active!=="boolean"
      ||typeof v.adAccountId!=="string"||!/^act_[1-9][0-9]{0,29}$/.test(v.adAccountId)
      ||typeof v.pageId!=="string"||!digits.test(v.pageId)
      ||!(v.instagramUserId===undefined||typeof v.instagramUserId==="string"&&digits.test(v.instagramUserId))
      ||typeof v.credentialEnv!=="string"||!/^META_CLIENT_TOKEN_[A-Z0-9_]{1,64}$/.test(v.credentialEnv))throw error();
    const binding=v as unknown as MetaClientBinding;
    const key=scopeKey(binding);
    if(ids.has(binding.id)||scopes.has(key))throw error();
    ids.add(binding.id);scopes.add(key);
    return {...binding,companyId:binding.companyId.toLowerCase(),clientId:binding.clientId?.toLowerCase()??null};
  });
}

export function selectMetaClientBinding(bindings:MetaClientBinding[],scope:MetaClientScope,allowInactive=false):MetaClientBinding{
  if(!uuid.test(scope.companyId)||!(scope.clientId===null||uuid.test(scope.clientId)))throw error();
  const matches=bindings.filter(b=>scopeKey(b)===scopeKey(scope));
  if(matches.length!==1||!allowInactive&&!matches[0].active)throw error();
  return matches[0];
}

export function snapshotMetaBinding(binding:MetaClientBinding):MetaBindingSnapshot{
  return {id:binding.id,version:binding.version,companyId:binding.companyId,clientId:binding.clientId,
    adAccountId:binding.adAccountId,pageId:binding.pageId,
    ...(binding.instagramUserId?{instagramUserId:binding.instagramUserId}:{}),credentialEnv:binding.credentialEnv};
}

/** Take the workspace from the persisted job, never from a requested Meta asset. */
export function metaScopeFromJob(companyId: string, spec: Record<string, unknown>): MetaClientScope {
  const clientId = spec.client_id;
  if (!uuid.test(companyId) || !(clientId === undefined || clientId === null || typeof clientId === "string" && uuid.test(clientId))) {
    throw error();
  }
  return { companyId: companyId.toLowerCase(), clientId: typeof clientId === "string" ? clientId.toLowerCase() : null };
}

/** Existing provider objects must retain the original client and identities. */
export function assertMetaBindingSnapshot(binding:MetaClientBinding,stored:unknown,hasProviderObjects:boolean):void{
  if(stored===undefined&&!hasProviderObjects)return;
  if(!stored||typeof stored!=="object"||Array.isArray(stored))throw error();
  const current=snapshotMetaBinding(binding),prior=stored as Record<string,unknown>;
  if(Object.keys(prior).length!==Object.keys(current).length
    ||Object.entries(current).some(([key,value])=>prior[key]!==value))throw error();
}
