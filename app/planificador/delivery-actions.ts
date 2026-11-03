"use server";
import { televisionStudyMatches, disjointTelevisionStudies } from "@/lib/television-measurement";
import { televisionProviderKey } from "@/lib/television-directory";
import { catalogAccess } from "@/lib/catalog-access-server";
import { readShoppingProducts } from "@/lib/catalog-shopping-server";
import { normalizeCatalogPicks, type CatalogPick } from "@/lib/catalog-shopping";
import { productMedium } from "@/lib/diy-catalog";
import { getBroadcastCatalog } from "@/lib/broadcast-server";
import { getRadioDirectory } from "@/lib/radio-directory-server";
import { readTvAudience } from "@/lib/tv-audience-server";
import { readPlanningDeliveryModel } from "@/lib/planning-delivery-server";
import { planningStudyBrief } from "@/lib/planning-market";
import { tvAudienceApplies, type StrategyBrief } from "@/lib/media-strategy-evidence";
import { radioCompatibility, type BroadcastBrief } from "@/lib/broadcast-catalog";
import { radioStationRankings } from "@/lib/radio-station";
import { projectPlanningDelivery, type RatedDeliveryLine } from "@/lib/planning-delivery";
import type { DeliverySummary } from "@/lib/media-delivery";
import type { MediaGroup } from "@/lib/media-groups";

export type DeliveryRequest = { brief: BroadcastBrief; picks: CatalogPick[]; expectedMedia?: MediaGroup[]; clientId?: string | null; radioRows?:{id:string;quantity:number}[] };
const media: MediaGroup[] = ["television","radio","ooh","press","digital","influencers"];
export async function projectMediaDelivery(input: DeliveryRequest): Promise<DeliverySummary | null> {
  try {
    if (!input || JSON.stringify(input).length > 50_000 || !input.brief || typeof input.brief.geography !== "string" || input.brief.geography.length > 3000 || input.expectedMedia?.some(m => !media.includes(m))) return null;
    const picks = normalizeCatalogPicks(input.picks);
    if (!picks.length && !input.radioRows?.length) return null;
    if(input.radioRows && (!Array.isArray(input.radioRows)||input.radioRows.length>100||new Set(input.radioRows.map(r=>r.id)).size!==input.radioRows.length||input.radioRows.some(r=>typeof r.id!=="string"||r.id.length>200||!Number.isSafeInteger(r.quantity)||r.quantity<1||r.quantity>10000)))return null;
    const access = await catalogAccess();
    if (input.clientId !== undefined && (access.clientContext?.selected?.id ?? null) !== input.clientId) return null;
    const model = await readPlanningDeliveryModel();
    if (!model) return null;
    const [products, broadcast, radio, tvAudience] = await Promise.all([
      readShoppingProducts(picks), getBroadcastCatalog(), getRadioDirectory(), readTvAudience(),
    ]);
    const brief = input.brief, asOf = new Date().toISOString().slice(0,10), lines: RatedDeliveryLine[] = [];
    for (const pick of picks) {
      const p = products.find(p => p.key === pick.productKey);
      if (!p) return null;
      const line: RatedDeliveryLine = {id:p.key,medium:productMedium(p),quantity:pick.quantity,amountCents:(p.priceCents??0)*pick.quantity,ratingPct:null,ratingMarketKeys:[],studyEnd:null};
      if (p.kind === "tv") {
        const studies = tvAudience.filter(s => {
          if (!televisionStudyMatches(p,s)) return false;
          const local = planningStudyBrief(s.marketKeys, brief);
          return local && tvAudienceApplies(s, {...brief,...local} as StrategyBrief, asOf);
        }).sort((a,b) => b.periodEnd.localeCompare(a.periodEnd) || a.id.localeCompare(b.id));
        // For the consolidated projection, a province observation cannot become a city rating.
        const measured = disjointTelevisionStudies(studies, model.marketKeys);
        if (measured.length) {
          for (const study of measured) lines.push({...line,id:`${p.key}@${study.marketKeys.join(",")}`,ratingPct:study.ratingPct,ratingMarketKeys:study.marketKeys,studyEnd:study.periodEnd});
          continue;
        }
      }
      if (p.kind === "radio" && p.source.stationId) {
        const station = radio.stations.find(s => s.id === p.source.stationId);
        const rankings = station ? radioStationRankings(station.profile,broadcast,asOf).filter(({source}) => {
          const local=planningStudyBrief(source.marketKeys,brief);
          return local && radioCompatibility(source,local)===null && source.marketKeys.every(k=>model.marketKeys.includes(k));
        }) : [];
        // Keep one measured cohort per selected station; never add station ranks or shares as reach.
        const match=rankings.sort((a,b)=>b.source.periodEnd.localeCompare(a.source.periodEnd)||b.source.marketKeys.length-a.source.marketKeys.length||a.source.id.localeCompare(b.source.id))[0];
        if(match){line.ratingPct=match.row.rating;line.ratingMarketKeys=match.source.marketKeys;line.studyEnd=match.source.periodEnd;}
      }
      lines.push(line);
    }
    for(const pick of input.radioRows??[]){
      const row=broadcast.radio.find(r=>r.id===pick.id),source=broadcast.sources.find(s=>s.id===row?.sourceId&&s.kind==="radio");
      if(!row||!source)return null;
      const local=planningStudyBrief(source.marketKeys,brief);
      const compatible=local&&radioCompatibility(source,local)===null;
      lines.push({id:`radio-observation:${row.id}`,medium:"radio",quantity:pick.quantity,amountCents:0,ratingPct:compatible?row.rating:null,ratingMarketKeys:source.marketKeys,studyEnd:source.periodEnd});
    }
    // Preserve all selected media. OOH/press without a forecast remain geographic
    // complements and contribute no incremental contacts to the numerical projection.
    for(const medium of input.expectedMedia??[])if(!lines.some(l=>l.medium===medium))lines.push({id:`unquantified:${medium}`,medium,quantity:1,amountCents:0,ratingPct:null,ratingMarketKeys:[],studyEnd:null});
    const summary = projectPlanningDelivery(brief,lines,model);
    if (!summary) return null;
    const groups = new Map<string,typeof lines>();
    for (const p of products) {
      const key = `${productMedium(p)}:${p.kind==="tv"?televisionProviderKey(p.provider):p.provider}`;
      const owned = lines.filter(l=>l.id===p.key||l.id.startsWith(`${p.key}@`));
      groups.set(key,[...(groups.get(key)??[]),...owned]);
    }
    summary.providers=[...groups].flatMap(([key,owned])=>{
      const result=projectPlanningDelivery(brief,owned,model), row=result?.media[0], contact=result?.contactMedia?.[0];
      return row?[{key,reachPct:row.reachPct,grps:contact?.grps??null,frequency:contact?.frequency??null,scopeLabel:result?.scopeLabel??""}]:[];
    });
    return summary;
  } catch { return null; }
}
