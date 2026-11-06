import { boundedJson } from "./bounded-json";
/** JSON transport avoids re-rendering the workspace after each read-only planning stage. */
type Failure={ok:false;error:string};
type Dependencies={prepare:(form:FormData)=>Promise<unknown>;complete:(token:string)=>Promise<unknown>};
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"};
const failure=(error:string,status:number)=>Response.json({ok:false,error} satisfies Failure,{status,headers});
const maxBodyBytes=650_000;

export async function handlePlanningRequest(request:Request,dependencies:Dependencies,siteUrl?:string,timeoutMs=26_000):Promise<Response>{
  const origin=request.headers.get("origin");
  try{if(!origin||new URL(origin).origin!==new URL(siteUrl||request.url).origin)return failure("Origen no permitido.",403);}catch{return failure("Origen no permitido.",403);}
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return failure("Tipo de contenido no admitido.",415);
  let value:unknown;
  try{value=await boundedJson(request,maxBodyBytes);}catch(error){return failure("El brief no se pudo leer.",error instanceof Error&&error.message==="SIZE"?413:400);}
  if(!value||typeof value!=="object")return failure("Solicitud inválida.",400);
  const input=value as Record<string,unknown>;
  let task:()=>Promise<unknown>;
  if(input.phase==="prepare"){
    if(!Array.isArray(input.fields)||input.fields.length>120||JSON.stringify(input.fields).length>40_000||!input.fields.every(pair=>Array.isArray(pair)&&pair.length===2&&typeof pair[0]==="string"&&pair[0].length<=100&&typeof pair[1]==="string"&&pair[1].length<=24_000))return failure("El brief es demasiado extenso o contiene datos inválidos.",400);
    const form=new FormData();for(const [name,value] of input.fields as [string,string][])form.append(name,value);
    task=()=>dependencies.prepare(form);
  }else if(input.phase==="complete"&&typeof input.preparation==="string"&&input.preparation.length>=40&&input.preparation.length<=600_000&&/^[A-Za-z0-9_-]+$/.test(input.preparation)){
    const preparation=input.preparation;task=()=>dependencies.complete(preparation);
  }else return failure("Solicitud inválida.",400);
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("PLANNING_TIMEOUT")),timeoutMs);});
    const result=await Promise.race([Promise.resolve().then(task),timeout]);
    return Response.json(result,{headers});
  }catch{
    return failure("El análisis tardó más de lo esperado. Tu brief se conserva; vuelve a intentarlo.",503);
  }finally{clearTimeout(timer);}
}
