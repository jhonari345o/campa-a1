import "server-only";
import { catalogAccess } from "./catalog-access-server";
import { createClient } from "./supabase/server";
import { selectPlanningCases, type PlanningCaseRecord } from "./planning-reference-cases";
import type { StrategyBrief, StrategyCandidate } from "./media-strategy-evidence";

export async function readPlanningReferenceCases(brief:StrategyBrief,candidates:StrategyCandidate[]) {
  const access=await catalogAccess(),caller=await createClient();
  const {data:allowed,error:permissionError}=await caller.rpc("can_access_infomedia");
  if(permissionError||!allowed)return [];
  const companyId=access.companyId??null,clientId=access.clientContext?.selected?.id??null;
  if(brief.clientId!=null&&brief.clientId!==clientId)throw new Error("CLIENT_CONTEXT_CHANGED");
  const base=()=>access.db.from("planning_reference_cases").select("id,company_id,client_id,sharing,definition").eq("active",true).not("reviewed_at","is",null).order("id").limit(100);
  const [generic,own]=await Promise.all([
    base().eq("sharing","method").is("company_id",null).is("client_id",null),
    companyId?(clientId?base().eq("sharing","client").eq("company_id",companyId).eq("client_id",clientId):base().eq("sharing","client").eq("company_id",companyId).is("client_id",null)):Promise.resolve({data:[],error:null}),
  ]);
  if(generic.error||own.error)return [];
  const records:PlanningCaseRecord[]=[...(generic.data??[]),...(own.data??[])].map(r=>({id:r.id,companyId:r.company_id,clientId:r.client_id,sharing:r.sharing,definition:r.definition}));
  return selectPlanningCases(records,brief,candidates,{companyId,clientId});
}
