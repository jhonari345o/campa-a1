import { normalized } from "./broadcast-catalog";
import type { CatalogProduct } from "./catalog-shopping";
import { televisionProviderKey } from "./television-directory";

/** Defaults are explicit selling prices, never raw supplier prices or another client's agreement. */
export function mergeTvDefaults(products: CatalogProduct[], defaults: CatalogProduct[]): CatalogProduct[] {
  const result = [...products];
  for (const p of defaults) {
    if (p.kind !== "tv" || !p.source.defaultPrice || !p.source.standingPrice || !p.key.startsWith("tv:") || !Number.isSafeInteger(p.priceCents) || p.priceCents! <= 0) continue;
    const index = result.findIndex(row => row.key === p.key);
    if (index >= 0) result[index] = p;
    else result.push(p);
  }
  return result;
}
export function televisionProductIdentity(p: CatalogProduct) {
  const program = normalized(p.name.replace(/\([^)]*\)/g, ""));
  const format = normalized(p.format), raw = p.format.toLowerCase();
  const time = raw.match(/\b(\d{1,2})[:h](\d{2})\b/);
  const saturday = /sabado/.test(format), sunday = /domingo/.test(format);
  const weekend = saturday && sunday || /s d/.test(format) || /[–-]{5}sd/i.test(raw);
  const weekdays = /lunes|lmxjv|lun vie/.test(format);
  const days = weekdays ? "weekday" : weekend ? "weekend" : saturday ? "saturday" : sunday ? "sunday" : "unknown";
  // No guessed identity when the source lacks a day or start time.
  if (!time || days === "unknown" || !p.marketKeys?.length) return null;
  const aliases: Record<string,string> = {"de casa de en casa":"de casa en casa","la noticia primera emision":"la noticia","tvc noticias i emision":"tvc noticias emision"};
  return JSON.stringify([televisionProviderKey(p.provider), aliases[program] ?? program, `${time[1].padStart(2,"0")}:${time[2]}`, days, normalized(p.unit), [...p.marketKeys].map(normalized).sort()]);
}
/** An exact customer negotiation takes precedence without hiding other programs or plazas. */
export function preferNegotiatedTelevision(products: CatalogProduct[]) {
  const negotiated = new Set(products.filter(p => p.kind === "tv" && p.source.agreementId && p.priceCents != null).map(televisionProductIdentity).filter(Boolean));
  return products.filter(p => !(p.kind === "tv" && p.source.defaultPrice && !p.source.agreementId && negotiated.has(televisionProductIdentity(p)))).map(p=>{
    if(p.kind!=="tv"||!p.source.agreementId||p.source.offerId)return p;
    const id=televisionProductIdentity(p);
    const matches=products.filter(d=>d.source.defaultPrice&&d.source.offerId&&id&&televisionProductIdentity(d)===id);
    return matches.length===1?{...p,source:{...p.source,offerId:matches[0].source.offerId}}:p;
  });
}
