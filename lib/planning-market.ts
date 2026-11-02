import directory from "./ecuador-geography.json";
import { briefMarketKeys, normalized, type BroadcastBrief } from "./broadcast-catalog";

/** A local study may inform its own territory inside a wider brief, never the wider population. */
export function planningStudyBrief(marketKeys:string[],brief:BroadcastBrief):BroadcastBrief|null {
  const observed=[...new Set(marketKeys.map(normalized))].filter(Boolean);
  if(!observed.length)return null;
  const requested=briefMarketKeys(brief);
  const national=requested.includes("nacional");
  const provinces=new Set((brief.coverage??[]).filter(c=>c.kind==="province").map(c=>normalized(c.label)));
  // DIY stores labels rather than coverage objects. Recognize only known provinces.
  for(const label of requested){
    const province=label.replace(/^provincia de /, "");
    if(directory.some(place=>place.kind==="province"&&normalized(place.label)===province))provinces.add(province);
  }
  const contains=(market:string)=>national||requested.includes(market)||directory.some(place=>place.kind==="city"&&normalized(place.label)===market&&"context" in place&&provinces.has(normalized(place.context??"")));
  if(!observed.every(contains))return null;
  return {...brief,coverage:undefined,geography:observed.join(", ")};
}

/** A local station can be measured in a consolidated study. Price its actual
 * transmission footprint while preserving the study's complete denominator. */
export function radioTariffCoversStationStudy(tariffMarkets:string[],studyMarkets:string[],stationCoverage:string[]) {
  if(!tariffMarkets.length||!studyMarkets.length||!stationCoverage.length)return false;
  const base={geography:stationCoverage.map(m=>normalized(m)==="nacionales"?"nacional":m).join(", ")} as BroadcastBrief;
  const stationMarkets=studyMarkets.filter(m=>planningStudyBrief([m],base));
  if(!stationMarkets.length)return false;
  const tariff={geography:tariffMarkets.join(", ")} as BroadcastBrief;
  return stationMarkets.every(m=>planningStudyBrief([m],tariff));
}
