import {normalized,type BroadcastBrief} from "./broadcast-catalog";
import {planningProductPrice} from "./catalog-planning";
import {planningStudyBrief} from "./planning-market";
import type {CatalogProduct} from "./catalog-shopping";

/** DIY TV uses the same account-resolved SKU as the catalog and delivery preview. */
export function diyTvPrice(sourceId:string,offerId:string,brief:BroadcastBrief,products:CatalogProduct[]){
  const product=products.find(p=>p.kind==="tv"&&p.key===`tv:${sourceId}:${offerId}`);
  if(!product)return null;
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
