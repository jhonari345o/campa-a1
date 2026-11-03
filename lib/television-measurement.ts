import { normalized } from "./broadcast-catalog";
import type { CatalogProduct } from "./catalog-shopping";
import type { TvAudienceObservation } from "./media-strategy-evidence";
import { televisionProviderKey } from "./television-directory";
import { televisionStartMinute } from "./broadcast-time";

/** A refreshed tariff keeps its programme measurement even when its product ID
 * changes. Never substitute another programme, channel, edition or start time. */
export function televisionStudyMatches(product: CatalogProduct, study: TvAudienceObservation) {
  if (product.kind !== "tv") return false;
  const city=(key:string)=>({guayas:"guayaquil",pichincha:"quito",gye:"guayaquil",uio:"quito"}[normalized(key)]??normalized(key));
  const coverage=(product.marketKeys?.length?product.marketKeys:product.location.split(/\s*[·,+]\s*/)).map(city);
  if(!coverage.some(k=>["nacional","ecuador","todo ecuador"].includes(k)) && !study.marketKeys.every(k=>coverage.includes(city(k)))) return false;
  if (study.offerIds.includes(product.key) || product.source.offerId && study.offerIds.includes(product.source.offerId)) return true;
  if (!study.channel || !study.program || televisionProviderKey(product.provider) !== televisionProviderKey(study.channel)) return false;
  const title = (s: string) => {
    const key=normalized(s.split(" · ")[0].replace(/\s*\((?:GYE|UIO|NACIONAL)\)\s*$/i, ""));
    // The June grid spells out the same 07:00 segment within Televistazo.
    return televisionProviderKey(product.provider)==="ecuavisa"&&key==="contacto directo en televistazo"?"contacto directo":key;
  };
  if (title(product.name) !== title(study.program)) return false;
  const boughtTime = televisionStartMinute(product.format), measuredTime = televisionStartMinute(study.program);
  if (!Number.isFinite(boughtTime) || !Number.isFinite(measuredTime) || boughtTime !== measuredTime) return false;
  const weekend = (s: string) => /\b(sabado|domingo|s d|sd|fin de semana)\b/.test(normalized(s));
  const weekdays = (s: string) => /\b(lunes a viernes|l v|lv)\b/.test(normalized(s));
  if (weekend(product.format) && weekdays(study.program) || weekdays(product.format) && weekend(study.program)) return false;
  return true;
}

/** Keep one observation for each measured population. A national purchase may
 * use both city measurements; a consolidated rating must never be counted twice. */
export function disjointTelevisionStudies(studies: TvAudienceObservation[], markets: string[]) {
  const used = new Set<string>();
  return [...studies].filter(s => s.ratingPct != null && s.marketKeys.length > 0 && s.marketKeys.every(k => markets.includes(k)))
    .sort((a,b) => b.periodEnd.localeCompare(a.periodEnd) || b.marketKeys.length-a.marketKeys.length || a.id.localeCompare(b.id))
    .filter(s => {
      if (s.marketKeys.some(k => used.has(k))) return false;
      s.marketKeys.forEach(k => used.add(k)); return true;
    });
}
