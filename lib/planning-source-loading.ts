/** Catalog loading is required: a timeout must never become an empty recommendation. */
export class PlanningSourcesUnavailable extends Error {
  constructor() { super("PLANNING_SOURCES_UNAVAILABLE"); }
}

export async function requirePlanningSources<T>(task:()=>Promise<T>,timeoutMs:number):Promise<T> {
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new PlanningSourcesUnavailable()),Math.max(1,timeoutMs));}),
    ]);
  } catch { throw new PlanningSourcesUnavailable(); }
  finally { clearTimeout(timer); }
}

export type PlanningPreparationResult = {ok:true;preparation:string}|{ok:false;error:string;retryable?:boolean};

/** Retry only the read-only source stage, never an AI request or a purchase. */
export async function prepareWithSourceRetry(prepare:()=>Promise<PlanningPreparationResult>):Promise<PlanningPreparationResult> {
  const result=await prepare();
  return !result.ok&&result.retryable ? prepare() : result;
}
