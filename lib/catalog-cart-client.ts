import type { CartSaveResult } from "./catalog-cart-http";
import type { CatalogCart, CatalogPick } from "./catalog-shopping";
import { normalizeCatalogPicks } from "./catalog-shopping";

type RequestOptions = {fetcher?:typeof fetch;timeoutMs?:number};
async function cartRequest(init:RequestInit,options:RequestOptions={}) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),options.timeoutMs??12000);
  try {
    const response=await (options.fetcher??fetch)("/api/catalog/cart",{...init,signal:controller.signal,credentials:"same-origin",cache:"no-store"});
    if(!response.headers.get("content-type")?.includes("application/json"))throw new Error("CART_UNAVAILABLE");
    return {response,result:await response.json()};
  } finally { clearTimeout(timer); }
}

/** Uses cookies and a deployment-independent route; never stores prices or credentials. */
export async function persistCatalogCart(items: CatalogPick[], expectedVersion: number, expectedClientId: string | null, options:RequestOptions={}): Promise<CartSaveResult> {
  const {response,result} = await cartRequest({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items:normalizeCatalogPicks(items), expectedVersion, expectedClientId }),
  },options);
  if (!result || typeof result!=="object" || ![true,false].includes(result.ok) || !response.ok && result.ok !== false) throw new Error("CART_UNAVAILABLE");
  if(result.ok===true){
    if(!Number.isSafeInteger(result.cart?.version)||result.cart.version<expectedVersion||(result.cart.clientId??null)!==expectedClientId)throw new Error("CART_UNAVAILABLE");
    return {...result,cart:{...result.cart,items:normalizeCatalogPicks(result.cart.items)}};
  }
  if(typeof result.error!=="string"||!result.error.trim())throw new Error("CART_UNAVAILABLE");
  return result as CartSaveResult;
}
export async function recoverCatalogCart(options:RequestOptions={}): Promise<CatalogCart> {
  const {response,result} = await cartRequest({},options);
  if(!result||typeof result!=="object")throw new Error("CART_UNAVAILABLE");
  if(typeof result.error==="string"&&result.error)return result;
  if(!response.ok||!Number.isSafeInteger(result.version)||result.version<0||!(result.clientId==null||typeof result.clientId==="string"))throw new Error("CART_UNAVAILABLE");
  return {...result,items:normalizeCatalogPicks(result.items)};
}
