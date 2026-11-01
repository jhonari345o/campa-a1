import 'server-only';
import {cache} from 'react';
import {getSessionProfile} from './auth';
import {createClient} from './supabase/server';
export const catalogClientContext=cache(async()=>{
 const profile=await getSessionProfile();
 if(!profile?.workspace||profile.workspace.kind!=='agency')return null;
 const db=await createClient();
 const [{data:clients,error},{data:cart,error:cartError}]=await Promise.all([
  db.from('workspace_clients').select('id,name').eq('company_id',profile.workspace.companyId).order('name'),
  db.rpc('load_catalog_cart'),
 ]);
 if(error||cartError)throw new Error('CLIENT_CONTEXT_UNAVAILABLE');
 const selected=(clients??[]).find(c=>c.id===cart?.clientId)??null;
 return {clients:clients??[],selected,version:Number(cart?.version??0),hasItems:Array.isArray(cart?.items)&&cart.items.length>0};
});
