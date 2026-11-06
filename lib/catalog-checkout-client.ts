import type { CatalogCheckoutInput, CatalogRequestResult } from "./catalog-checkout";
import { normalizeCatalogPicks } from "./catalog-shopping";

export async function checkoutCatalog(input:CatalogCheckoutInput, options:{fetcher?:typeof fetch;timeoutMs?:number}={}):Promise<CatalogRequestResult> {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),options.timeoutMs??25000);
  try{
    const response=await (options.fetcher??fetch)("/api/catalog/checkout",{method:"POST",credentials:"same-origin",cache:"no-store",signal:controller.signal,headers:{"content-type":"application/json"},body:JSON.stringify(input)});
    if(!response.headers.get("content-type")?.includes("application/json"))throw new Error("CHECKOUT_RESPONSE");
    const body=await response.json();
    if(body?.ok===false&&typeof body.error==="string"&&body.error.trim())return body;
    if(!response.ok||body?.ok!==true||typeof body.id!=="string"||!body.id||!Number.isSafeInteger(body.cart?.version)||body.cart.version<0)throw new Error("CHECKOUT_RESPONSE");
    return {...body,cart:{...body.cart,items:normalizeCatalogPicks(body.cart.items)}};
  }finally{clearTimeout(timer);}
}
