import type { CatalogProduct } from "./catalog-shopping";
export type CatalogKind = CatalogProduct["kind"];
const kinds:CatalogKind[]=["tv","radio","ooh","press","digital","influencer"];
export function catalogKindsFor(view:string,section:string,items:readonly {productKey:string}[]):CatalogKind[] {
  if(view==="diy")return kinds;
  if(view!=="media")return [];
  const active=section==="influencers"?"influencer":section;
  const selected=items.map(item=>item.productKey.split(":")[0]).map(key=>key==="creator"?"influencer":key);
  return kinds.filter(kind=>kind===active||selected.includes(kind));
}
