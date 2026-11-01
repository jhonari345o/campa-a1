import {canonicalCatalogOrder,normalizeCatalogPicks,type CatalogProduct} from "./catalog-shopping";
import {validDate} from "./broadcast-catalog";
import type {MediaGroup} from "./media-groups";
export function productMedium(p:Pick<CatalogProduct,"kind">):MediaGroup{return p.kind==="tv"?"television":p.kind==="influencer"?"influencers":p.kind;}
/** Only canonical server products determine labels, money and original units. */
export function resolveDiyCatalog(value:unknown,products:CatalogProduct[],selected:MediaGroup[],start:string,end:string){
 const picks=normalizeCatalogPicks(value??[]);
 if(!picks.length)return [];
 const scoped=products.map(p=>{
   const bounded=Boolean(p.validFrom||p.validTo);
   const inPeriod=!bounded||(validDate(start)&&validDate(end)&&start<=end&&Boolean(p.validFrom&&p.validTo&&p.validFrom<=start&&p.validTo>=end));
   return {...p,priceCents:inPeriod&&!p.referenceOnly?(p.priceCents??p.referencePriceCents??null):null};
 });
 const order=canonicalCatalogOrder(picks,scoped);
 return order.items.filter(p=>selected.includes(productMedium(p)));
}
