import "server-only";
import { createClient } from "./supabase/server";
import type { TvAudienceObservation } from "./media-strategy-evidence";

export async function readTvAudience():Promise<TvAudienceObservation[]> {
  const db=await createClient();
  const rows:TvAudienceObservation[]=[];
  for(let from=0;from<10000;from+=500){
    const {data,error}=await db.from("tv_audience_observations").select("id,study,period_start,period_end,market,market_keys,target,age_min,age_max,sex,nse,channel,program,basis,offer_ids,rating_pct,reach_pct").eq("active",true).order("period_end",{ascending:false}).order("id").range(from,from+499);
    if(error)return [];
    for(const r of data??[]){
      if(!Array.isArray(r.market_keys)||!Array.isArray(r.offer_ids))continue;
      rows.push({id:r.id,study:r.study,periodStart:r.period_start,periodEnd:r.period_end,market:r.market,marketKeys:r.market_keys,target:r.target,ageMin:r.age_min,ageMax:r.age_max,sex:r.sex,nse:r.nse,channel:r.channel,program:r.program,basis:r.basis,offerIds:r.offer_ids,ratingPct:r.rating_pct==null?null:Number(r.rating_pct),reachPct:r.reach_pct==null?null:Number(r.reach_pct)});
    }
    if((data??[]).length<500)break;
  }
  return rows;
}
