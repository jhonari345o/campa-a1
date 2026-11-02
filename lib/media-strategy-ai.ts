import { optionalWithinBudget } from "./optional-task";
import { parseStrategyAdvice, type StrategyAdvice, type StrategyAiState } from "./media-strategy";
import type { StrategyBrief, StrategyEvidenceBundle } from "./media-strategy-evidence";

type AiDependencies = {
  enabled: boolean; allowRequest: boolean; cacheAvailable: boolean; cached: unknown;
  claim: () => Promise<boolean>;
  invoke: (payload: string, signal: AbortSignal) => Promise<string>;
  persist: (advice: StrategyAdvice | null, diagnostic: StrategyAiDiagnostic) => Promise<boolean>;
};
export type StrategyAiDiagnostic = {
  code: string; durationMs: number; budgetMs: number; inputBytes: number; outputChars: number;
};
/** Codes only: never persist prompts, raw output, account details or error messages. */
function providerFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return /^(?:PROVIDER_HTTP_[45]\d\d|PROVIDER_TIMEOUT|PROVIDER_OUTPUT_TRUNCATED|BEDROCK_OUTPUT_TRUNCATED)$/.test(message)
    ? message : "PROVIDER_UNAVAILABLE";
}
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
  // Keep the inference lease below the cache's thirty-second single-flight claim.
  const started=Date.now(), budgetMs=Math.min(25_000,timeoutMs);
  const diagnostic:StrategyAiDiagnostic={code:"TIME_BUDGET_EXHAUSTED",durationMs:0,budgetMs,inputBytes:new TextEncoder().encode(payload).length,outputChars:0};
  const advice=await optionalWithinBudget(async signal=>{
    let raw:string;
    try { raw=await deps.invoke(payload,signal); }
    catch(error) { if(!signal.aborted)diagnostic.code=providerFailureCode(error);return null; }
    if(signal.aborted)return null;
    diagnostic.outputChars=raw.length;
    const parsed=parseStrategyAdvice(raw,brief,bundle,code=>{diagnostic.code=`OUTPUT_${code}`;});
    invalid=!parsed;if(parsed)diagnostic.code="VALIDATED";return parsed;
  },()=>null,budgetMs);
  diagnostic.durationMs=Date.now()-started;
  let persisted=false;try{persisted=await deps.persist(advice,{...diagnostic});}catch{ /* No uncached AI recommendation is applied. */ }
  if(!persisted)return result("unavailable");
  return advice?result("validated",advice):result(invalid?"rejected":"unavailable");
}
