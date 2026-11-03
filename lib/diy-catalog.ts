import {canonicalCatalogOrder,normalizeCatalogPicks,type CatalogProduct} from "./catalog-shopping";
import {catalogPriceCoversDates} from "./catalog-planning";
import type {MediaGroup} from "./media-groups";
import type {BroadcastBrief} from "./broadcast-catalog";
import {diyTvProductPrice} from "./diy-tv-pricing";
export function productMedium(p:Pick<CatalogProduct,"kind">):MediaGroup{return p.kind==="tv"?"television":p.kind==="influencer"?"influencers":p.kind;}
/** Only canonical server products determine labels, money and original units. */
export function resolveDiyCatalog(value:unknown,products:CatalogProduct[],selected:MediaGroup[],start:string,end:string,brief?:BroadcastBrief){
 const picks=normalizeCatalogPicks(value??[]);
 if(!picks.length)return [];
 const scoped=products.map(p=>{
   const bounded=Boolean(p.validFrom||p.validTo);
   const inPeriod=!bounded||catalogPriceCoversDates(p,start,end);
   const compatible=p.kind!=="tv"||!brief||!!diyTvProductPrice(p,brief);
   return {...p,priceCents:inPeriod&&compatible&&!p.referenceOnly?(p.priceCents??p.referencePriceCents??null):null};
 });
 const order=canonicalCatalogOrder(picks,scoped);
 return order.items.filter(p=>selected.includes(productMedium(p)));
}
