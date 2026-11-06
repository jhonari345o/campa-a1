type PlanningResult={ok:boolean;plan?:{strategy?:{aiState?:string;aiRetryable?:boolean}}};

/** A completed free-model failure gets one continuation. No transport retry,
 * payment, permission, quota or unknown-outcome request is replayed here. */
export async function completeWithFreeAiRetry<T extends PlanningResult>(complete:()=>Promise<T>):Promise<T> {
  const first=await complete();
  if(!first.ok||first.plan?.strategy?.aiRetryable!==true||!["unavailable","rejected"].includes(first.plan.strategy.aiState??""))return first;
  // The first response already carries a complete plan. A dropped continuation
  // must not replace it with an error page.
  try {const next=await complete();return next.ok?next:first;} catch {return first;}
}

/** Stored server diagnostics contain model IDs only, never prompts or keys. */
export function failedFreeModelIds(result:unknown):string[] {
  if(!result||typeof result!=="object")return [];
  const diagnostic=(result as Record<string,unknown>)._diagnostic;
  if(!diagnostic||typeof diagnostic!=="object")return [];
  const d=diagnostic as Record<string,unknown>;
  return [...new Set([...(Array.isArray(d.attemptedModels)?d.attemptedModels:[]),d.routedModel].filter((id):id is string=>typeof id==="string"&&id.length<=160&&(/^[a-z0-9._:/-]+:free$/i.test(id)||id==="openrouter/free")))].slice(0,12);
}
