import directory from "./ecuador-geography.json";
import { briefMarketKeys, normalized, type BroadcastBrief } from "./broadcast-catalog";

/** A local study may inform its own territory inside a wider brief, never the wider population. */
export function planningStudyBrief(marketKeys:string[],brief:BroadcastBrief):BroadcastBrief|null {
  const observed=[...new Set(marketKeys.map(normalized))].filter(Boolean);
  if(!observed.length)return null;
  const requested=briefMarketKeys(brief);
  const national=requested.includes("nacional");
  const provinces=new Set((brief.coverage??[]).filter(c=>c.kind==="province").map(c=>normalized(c.label)));
  const contains=(market:string)=>national||requested.includes(market)||directory.some(place=>place.kind==="city"&&normalized(place.label)===market&&"context" in place&&provinces.has(normalized(place.context??"")));
  if(!observed.every(contains))return null;
  return {...brief,coverage:undefined,geography:observed.join(", ")};
}
