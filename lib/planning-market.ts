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


/** Commercial coverage may contain a requested canton. This must never be used
 * to change the population denominator of a rating or audience study. */
export function commercialTerritoryFits(markets:string[],brief:BroadcastBrief):boolean {
  const requested=briefMarketKeys(brief);
  // A commercial package may also cover unrequested areas. That does not
  // invalidate its coverage of the brief; audience cohorts remain exact above.
  return markets.length>0 && markets.some(m=>requested.some(r=>territoriesOverlap(m,r)));
}
export const NATIONAL_PROVINCE_PRIORITY=["Guayas","Pichincha","Azuay","Manabí","Tungurahua","El Oro","Los Ríos"];
export const territoryKey=(value:string)=>{
  const key=normalized(value).replace(/^provincia de /,"");
  return ["nacional","nacionales","national","ecuador","todo ecuador"].includes(key)?"nacional":key;
};
export function territoryProvince(value:string):string {
  const key=territoryKey(value);
  const matches=directory.filter(p=>normalized(p.label)===key);
  const province=matches.find(p=>p.kind==="province");
  if(province)return normalized(province.label);
  const city=matches.length===1?matches[0]:null;
  return city&&"context" in city?normalized(city.context??""):key;
}
export function territoriesOverlap(a:string,b:string):boolean {
  const x=territoryKey(a),y=territoryKey(b);
  if(!x||!y)return false;
  if(x==="nacional"||y==="nacional"||x===y)return true;
  // Two different cantons in the same province are not interchangeable.
  return directory.some(p=>p.kind==="province"&&normalized(p.label)===x)&&territoryProvince(y)===x
    ||directory.some(p=>p.kind==="province"&&normalized(p.label)===y)&&territoryProvince(x)===y;
}
export function nationalTerritoryOrder():string[] {
  const priority=NATIONAL_PROVINCE_PRIORITY.map(territoryKey);
  return [...priority,...directory.filter(p=>p.kind==="province"&&!priority.includes(normalized(p.label))).map(p=>normalized(p.label)).sort((a,b)=>a.localeCompare(b,"es"))];
}
