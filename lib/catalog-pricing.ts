import type { CatalogProduct } from "./catalog-shopping";
import { selectAccountRadioTariffs, type RadioRatePreference } from "./account-radio-tariffs";
import { digitalBudgetProduct } from "./digital-budget";
export type AgreedCatalogRate = { agreementId: string; productKey: string; priceCents: number; taxIncluded: boolean | null; conditions: string; validFrom: string; validTo: string; radioPreference?: RadioRatePreference; clientSpecific?: boolean };

/** Explicit owner selling defaults are allowed; private supplier prices and other clients are never fallbacks. */
export function scopeCatalogProducts(products: CatalogProduct[], rates: AgreedCatalogRate[], day: string, admin: boolean): CatalogProduct[] {
  if (admin) {
    if(!products.some(p=>p.kind==="radio"&&p.source.defaultPrice))return products;
    const selected=new Set(selectAccountRadioTariffs(products.filter(p=>!p.source.workspaceProductId),[]).map(p=>p.key));
    return products.filter(p=>p.kind!=="radio"||p.source.workspaceProductId||selected.has(p.key));
  }
  const priced = products.map(p => {
    const matching = rates.filter(r => r.productKey === p.key && r.validFrom <= day && r.validTo >= day && Number.isSafeInteger(r.priceCents) && r.priceCents >= 0);
    const specific = matching.filter(r => r.clientSpecific);
    const applicable = specific.length ? specific : matching;
    const rate = !p.referenceOnly && applicable.length === 1 ? applicable[0] : null;
    const history = p.source.workspaceProductId ? rates.filter(r=>r.productKey===p.key&&Number.isSafeInteger(r.priceCents)&&r.priceCents>=0) : [];
    const reference = !rate && history.length===1 ? history[0] : null;
    const defaultRate = (p.kind === "tv" || p.kind === "radio") && p.source.defaultPrice && p.source.standingPrice && p.validFrom && p.validFrom <= day && (!p.validTo || p.validTo >= day) && !rates.some(r => r.productKey === p.key) ? p : null;
    const publishedPrice = p.referencePriceCents ?? p.priceCents;
    const published = p.kind === "press" && p.source.publishedTariff === true && publishedPrice != null;
    // Source IDs are sufficient to resolve an order; raw acquisition rates must never reach a customer.
    const { rate: _privateRate, ...source } = p.source;
    void _privateRate;
    return { ...p, source: { ...source, ...(rate ? { agreementId: rate.agreementId } : {}) }, priceCents: p.kind === "digital" && !p.source.workspaceProductId ? digitalBudgetProduct(p.key)?.priceCents ?? 100 : rate?.priceCents ?? defaultRate?.priceCents ?? null, taxIncluded: rate ? rate.taxIncluded : defaultRate ? defaultRate.taxIncluded : reference ? reference.taxIncluded : published ? p.taxIncluded : null,
      referencePriceCents: reference?.priceCents ?? (published && !rate ? publishedPrice : null), conditions: rate?.conditions ?? reference?.conditions ?? defaultRate?.conditions ?? "", reference: rate ? rate.validTo === "infinity" ? `Tarifa de tu cuenta · desde ${rate.validFrom.split("-").reverse().join("/")}` : `Acuerdo comercial · ${rate.validFrom} – ${rate.validTo}` : reference ? `Acuerdo comercial · ${reference.validFrom} – ${reference.validTo}` : published ? `Tarifa publicada${p.validFrom ? ` · desde ${p.validFrom}` : ""}` : defaultRate ? "Tarifa de tu cuenta" : p.kind === "digital" ? "Presupuesto solicitado" : "Tarifa de tu espacio", validFrom: rate?.validFrom ?? reference?.validFrom ?? (published || defaultRate ? p.validFrom : null), validTo: rate?.validTo === "infinity" ? null : rate?.validTo ?? reference?.validTo ?? (published || defaultRate ? p.validTo : null), ...(published && !rate && !reference ? { referenceLabel: `Tarifa publicada${p.validFrom ? ` · desde ${p.validFrom.split("-").reverse().join("/")}` : ""}` } : {}) };
  });
  return selectAccountRadioTariffs(priced, rates);
}
