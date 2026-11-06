import { boundedJson } from "./bounded-json";
import type { CatalogCart, CatalogProduct } from "./catalog-shopping";
import { validDate } from "./broadcast-catalog";

export type CatalogCheckoutInput = { requestId:string; version:number; quote:string; companyId:string|null; title:string; desiredStart:string; notes:string; clientId?:string|null };
export type CatalogRequestResult = { ok:true; id:string; cart:CatalogCart } | { ok:false; error:string; products?:CatalogProduct[]; refreshCart?:boolean };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const allowed = new Set(["requestId","version","quote","companyId","clientId","title","desiredStart","notes"]);
const uuidOrNull = (v:unknown) => v === null || typeof v === "string" && uuid.test(v);
export function isCheckoutInput(raw:unknown):raw is CatalogCheckoutInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const x=raw as Record<string,unknown>;
  return Object.keys(x).every(k=>allowed.has(k)) && typeof x.requestId==="string" && uuid.test(x.requestId)
    && typeof x.version==="number" && Number.isSafeInteger(x.version) && x.version>=0
    && typeof x.quote==="string" && x.quote.length>0 && x.quote.length<=200000
    && uuidOrNull(x.companyId) && (x.clientId===undefined || uuidOrNull(x.clientId))
    && typeof x.title==="string" && !!x.title.trim() && x.title.length<=120
    && typeof x.desiredStart==="string" && (x.desiredStart==="" || validDate(x.desiredStart))
    && typeof x.notes==="string" && x.notes.length<=2000;
}

export async function handleCatalogCheckout(request:Request, submit:(input:CatalogCheckoutInput)=>Promise<CatalogRequestResult>,siteUrl?:string) {
  const reply=(value:CatalogRequestResult,status:number)=>Response.json(value,{status,headers:{"cache-control":"private, no-store","vary":"Cookie"}});
  const fail=(error:string,status:number)=>reply({ok:false,error},status);
  if(request.method!=="POST")return fail("Método no permitido.",405);
  const origins=new Set([new URL(request.url).origin]);
  try{if(siteUrl)origins.add(new URL(siteUrl).origin);}catch{/* Optional site origin. */}
  if(request.headers.get("sec-fetch-site")==="cross-site"||!origins.has(request.headers.get("origin")??""))return fail("Origen no permitido.",403);
  if(request.headers.get("content-type")?.split(";",1)[0].trim().toLowerCase()!=="application/json")return fail("Tipo de contenido no admitido.",415);
  let input:unknown;
  try{input=await boundedJson(request,256*1024);}catch(err){return fail("No pudimos leer la selección.",err instanceof Error && err.message==="SIZE"?413:400);}
  if(!isCheckoutInput(input))return fail("Revisa los datos de la compra.",400);
  try{const result=await submit(input);return reply(result,result.ok?200:409);}
  catch{return fail("No recibimos la confirmación. Vuelve a intentar con la misma compra.",503);}
}
