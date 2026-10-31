import "server-only";
import { createClient } from "@/lib/supabase/server";
import { emptyBroadcastCatalog, type BroadcastCatalog, type BroadcastSource } from "@/lib/broadcast-catalog";
export async function getBroadcastCatalog(): Promise<BroadcastCatalog> {
  try {
    const db = await createClient();
    const [sources,tv,radio] = await Promise.all([
      db.from("broadcast_sources").select("id,kind,label,provider,period_start,period_end,market,market_keys,target,age_min,age_max,sex,nse,frequency,daypart,annual_contract,conditions,spot_seconds,minimum_seconds,tax_included").eq("active",true).order("period_end",{ascending:false}).limit(100),
      db.from("broadcast_tv_offers").select("id,source_id,day,title,schedule,price_usd,target,note").limit(1000),
      db.from("broadcast_radio_metrics").select("id,source_id,name,genre,rating,share,audience,rank").limit(1000),
    ]);
    if (sources.error || tv.error || radio.error) return {...emptyBroadcastCatalog,error:"No se pudo cargar el catálogo privado. Intenta nuevamente."};
    return {
      sources:(sources.data??[]).map(s=>({id:s.id,kind:s.kind,label:s.label,provider:s.provider,periodStart:s.period_start,periodEnd:s.period_end,market:s.market,marketKeys:s.market_keys,target:s.target,ageMin:s.age_min,ageMax:s.age_max,sex:s.sex,nse:s.nse,frequency:s.frequency,daypart:s.daypart,annualContract:s.annual_contract,conditions:s.conditions,spotSeconds:s.spot_seconds,minimumSeconds:s.minimum_seconds,taxIncluded:s.tax_included}) as BroadcastSource),
      tv:(tv.data??[]).map(o=>({id:o.id,sourceId:o.source_id,day:o.day,title:o.title,schedule:o.schedule,priceUsd:Number(o.price_usd),target:o.target,note:o.note})),
      radio:(radio.data??[]).map(r=>({id:r.id,sourceId:r.source_id,name:r.name,genre:r.genre,rating:r.rating,share:r.share,audience:r.audience,rank:r.rank})),
    };
  } catch { return {...emptyBroadcastCatalog,error:"No se pudo cargar el catálogo privado. Intenta nuevamente."}; }
}
