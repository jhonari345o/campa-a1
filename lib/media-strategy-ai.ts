import { optionalWithinBudget } from "./optional-task";
import { parseStrategyAdvice, type StrategyAdvice, type StrategyAiState } from "./media-strategy";
import type { StrategyBrief, StrategyEvidenceBundle } from "./media-strategy-evidence";

type AiDependencies = {
  enabled: boolean; allowRequest: boolean; cacheAvailable: boolean; cached: unknown;
  claim: () => Promise<boolean>;
  invoke: (payload: string, signal: AbortSignal) => Promise<string>;
  persist: (advice: StrategyAdvice | null) => Promise<boolean>;
};
/** Dependency boundary makes quota, provider failure and fail-closed validation testable without inference charges. */
export async function resolveStrategyAi(brief:StrategyBrief,bundle:StrategyEvidenceBundle,payload:string,timeoutMs:number,deps:AiDependencies):Promise<{advice:StrategyAdvice|null;state:StrategyAiState}> {
  const result=(state:StrategyAiState,advice:StrategyAdvice|null=null)=>({state,advice});
  if(deps.cached){const advice=parseStrategyAdvice(JSON.stringify(deps.cached),brief,bundle);if(advice)return result("cached",advice);}
  if(!deps.enabled)return result("not_configured");
  if(!deps.allowRequest||!deps.cacheAvailable||timeoutMs<1000)return result("unavailable");
  if(new TextEncoder().encode(payload).length>96_000)return result("rejected");
  let claimed=false;try{claimed=await deps.claim();}catch{return result("unavailable");}
  if(!claimed)return result("quota");
  let invalid=false;
  const advice=await optionalWithinBudget(async signal=>{
    const raw=await deps.invoke(payload,signal),parsed=parseStrategyAdvice(raw,brief,bundle);
    invalid=!parsed;return parsed;
  },()=>null,Math.min(15_000,timeoutMs));
  let persisted=false;try{persisted=await deps.persist(advice);}catch{ /* No uncached AI recommendation is applied. */ }
  if(!persisted)return result("unavailable");
  return advice?result("validated",advice):result(invalid?"rejected":"unavailable");
}
