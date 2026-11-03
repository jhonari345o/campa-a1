import { optionalWithinBudget } from "./optional-task";
import { parseStrategyAdvice, type StrategyAdvice, type StrategyAiState } from "./media-strategy";
import type { StrategyBrief, StrategyEvidenceBundle } from "./media-strategy-evidence";

type AiDependencies = {
  enabled: boolean; allowRequest: boolean; cacheAvailable: boolean; cached: unknown;
  claim: () => Promise<boolean>;
  invoke: (payload: string, signal: AbortSignal, correction?: string) => Promise<string>;
  allowRepair?: boolean;
  persist: (advice: StrategyAdvice | null, diagnostic: StrategyAiDiagnostic) => Promise<boolean>;
};
export type StrategyAiDiagnostic = {
  code: string; durationMs: number; budgetMs: number; inputBytes: number; outputChars: number; attempts?: number; safeTextUsed?: boolean; attemptCodes?: string[];
};
/** Codes only: never persist prompts, raw output, account details or error messages. */
function providerFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return /^(?:PROVIDER_HTTP_[45]\d\d|PROVIDER_HTTP_400_(?:REASONING|MODEL|MODEL_COUNT|ROUTING|FORMAT|CONTEXT)|PROVIDER_TIMEOUT|PROVIDER_OUTPUT_TRUNCATED|BEDROCK_OUTPUT_TRUNCATED)$/.test(message)
    ? message : "PROVIDER_UNAVAILABLE";
}
/** Dependency boundary makes quota, provider failure and fail-closed validation testable without inference charges. */
export async function resolveStrategyAi(brief:StrategyBrief,bundle:StrategyEvidenceBundle,payload:string,timeoutMs:number,deps:AiDependencies):Promise<{advice:StrategyAdvice|null;state:StrategyAiState}> {
  const result=(state:StrategyAiState,advice:StrategyAdvice|null=null)=>({state,advice});
  if(deps.cached){const advice=parseStrategyAdvice(JSON.stringify(deps.cached),brief,bundle);if(advice)return result("cached",advice);}
  if(!deps.enabled)return result("not_configured");
  if(!deps.allowRequest||!deps.cacheAvailable||timeoutMs<1000)return result("unavailable");
  if(new TextEncoder().encode(payload).length>96_000)return result("rejected");
  const deadline=Date.now()+Math.min(23_500,timeoutMs);
  let claimed=false;try{claimed=await optionalWithinBudget(()=>deps.claim(),()=>false,Math.min(5000,Math.max(1,timeoutMs-2000)));}catch{return result("unavailable");}
  if(!claimed)return result("quota");
  let invalid=false;
  // Keep the inference lease below the cache's thirty-second single-flight claim.
  // Quota acquisition consumes the same request budget; reserve time to save the
  // validated result and finish the HTTP response before hosting's hard deadline.
  const started=Date.now(), budgetMs=Math.max(1,Math.min(22_000,deadline-started-1500));
  const diagnostic:StrategyAiDiagnostic={code:"TIME_BUDGET_EXHAUSTED",durationMs:0,budgetMs,inputBytes:new TextEncoder().encode(payload).length,outputChars:0,attemptCodes:[]};
  const advice=await optionalWithinBudget(async signal=>{
    let correction:string|undefined;
    for(let attempt=0;attempt<(deps.allowRepair?2:1);attempt++){
      let raw:string;diagnostic.attempts=attempt+1;
      try { raw=await deps.invoke(payload,signal,correction); }
      catch(error) { if(!signal.aborted)diagnostic.code=providerFailureCode(error);diagnostic.attemptCodes!.push(diagnostic.code);return null; }
      if(signal.aborted)return null;
      diagnostic.outputChars=raw.length;
      const parsed=parseStrategyAdvice(raw,brief,bundle,code=>{correction=code;diagnostic.code=`OUTPUT_${code}`;diagnostic.attemptCodes!.push(diagnostic.code);},()=>{diagnostic.safeTextUsed=true;});
      invalid=!parsed;
      if(parsed){diagnostic.code="VALIDATED";diagnostic.attemptCodes!.push(diagnostic.code);return parsed;}
      // Repair a malformed selection once without weakening validation, changing
      // evidence, adding paid inference, or extending this request's deadline.
      if(!deps.allowRepair||attempt>0||budgetMs-(Date.now()-started)<6000)break;
    }
    return null;
  },()=>null,budgetMs);
  diagnostic.durationMs=Date.now()-started;
  let persisted=false;try{persisted=await optionalWithinBudget(()=>deps.persist(advice,{...diagnostic}),()=>false,Math.max(1,deadline-Date.now()));}catch{ /* No uncached AI recommendation is applied. */ }
  if(!persisted)return result("unavailable");
  return advice?result("validated",advice):result(invalid?"rejected":"unavailable");
}
