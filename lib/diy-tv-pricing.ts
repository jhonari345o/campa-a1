import {normalized,type BroadcastBrief,type BroadcastCatalog,type ResolvedTvPrice} from "./broadcast-catalog";
import {planningProductPrice} from "./catalog-planning";
import {planningStudyBrief} from "./planning-market";
import type {CatalogProduct} from "./catalog-shopping";

/** DIY TV uses the same account-resolved SKU as the catalog and delivery preview. */
export function diyTvPrice(sourceId:string,offerId:string,brief:BroadcastBrief,products:CatalogProduct[]){
  const product=products.find(p=>p.kind==="tv"&&p.key===`tv:${sourceId}:${offerId}`);
  if(!product)return null;
  return diyTvProductPrice(product,brief);
}
/** The same dates and commercial coverage apply to source, default and
 * individually negotiated programme SKUs. */
export function diyTvProductPrice(product:CatalogProduct,brief:BroadcastBrief){
  if(product.kind!=="tv")return null;
  const markets=product.marketKeys??[];
  // Tariff territories describe where the same product is sold, unlike a
  // consolidated audience study whose denominator cannot be split.
  if(!markets.some(m=>normalized(m)==="nacional"||planningStudyBrief([m],brief)))return null;
  const price=planningProductPrice(product,brief.startDate,brief.endDate);
  return price?{product,priceUsd:price.priceUsd}:null;
}
export function applyDiyTvPrices<T extends {id?:unknown;sourceId?:unknown;unitPrice?:unknown}>(picks:T[],brief:BroadcastBrief,products:CatalogProduct[]){
  return picks.map(pick=>{
    const price=diyTvPrice(String(pick.sourceId??""),String(pick.id??""),brief,products);
    return {...pick,unitPrice:price?.priceUsd??null,...(price?{market:price.product.location,conditions:price.product.conditions}: {})};
  });
}
export function diyTvResolver(brief:BroadcastBrief,products:CatalogProduct[]){
  return (sourceId:string,offerId:string):ResolvedTvPrice|null=>{
    const resolved=diyTvPrice(sourceId,offerId,brief,products);
    return resolved?{priceUsd:resolved.priceUsd,market:resolved.product.location,context:resolved.product.reference,conditions:resolved.product.conditions}:null;
  };
}
/** Bound identifiers/quantities before looking up private account products. */
export function diyTvRequests(catalog:BroadcastCatalog,input:unknown){
  if(!Array.isArray(input)||input.length>100)throw new Error("INVALID_TV_SELECTION");
  return input.map(pick=>{
    const offer=catalog.tv.find(o=>o.id===pick?.id&&o.sourceId===pick?.sourceId);
    if(!offer||!Number.isInteger(pick?.quantity)||pick.quantity<1||pick.quantity>10000)throw new Error("INVALID_TV_SELECTION");
    return {productKey:`tv:${offer.sourceId}:${offer.id}`,quantity:pick.quantity as number};
  });
}
