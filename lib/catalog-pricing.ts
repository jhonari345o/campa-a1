import type { CatalogProduct } from "./catalog-shopping";
import { selectAccountRadioTariffs, type RadioRatePreference } from "./account-radio-tariffs";
import { digitalBudgetProduct } from "./digital-budget";
export type AgreedCatalogRate = { agreementId: string; productKey: string; priceCents: number; taxIncluded: boolean | null; conditions: string; validFrom: string; validTo: string; radioPreference?: RadioRatePreference; clientSpecific?: boolean };

/** No global rate fallback, no cross-client price merge, no expired agreement masquerading as current. */
export function scopeCatalogProducts(products: CatalogProduct[], rates: AgreedCatalogRate[], day: string, admin: boolean): CatalogProduct[] {
  if (admin) return products;
  const priced = products.map(p => {
    const matching = rates.filter(r => r.productKey === p.key && r.validFrom <= day && r.validTo >= day && Number.isSafeInteger(r.priceCents) && r.priceCents >= 0);
    const rate = !p.referenceOnly && matching.length === 1 ? matching[0] : null;
    const history = p.source.workspaceProductId ? rates.filter(r=>r.productKey===p.key&&Number.isSafeInteger(r.priceCents)&&r.priceCents>=0) : [];
    const reference = !rate && history.length===1 ? history[0] : null;
    const publishedPrice = p.referencePriceCents ?? p.priceCents;
    const published = p.kind === "press" && p.source.publishedTariff === true && publishedPrice != null;
    // Source IDs are sufficient to resolve an order; raw acquisition rates must never reach a customer.
    const { rate: _privateRate, ...source } = p.source;
    void _privateRate;
    return { ...p, source: { ...source, ...(rate ? { agreementId: rate.agreementId } : {}) }, priceCents: p.kind === "digital" && !p.source.workspaceProductId ? digitalBudgetProduct(p.key)?.priceCents ?? 100 : rate?.priceCents ?? null, taxIncluded: rate ? rate.taxIncluded : reference ? reference.taxIncluded : published ? p.taxIncluded : null,
      referencePriceCents: reference?.priceCents ?? (published && !rate ? publishedPrice : null), conditions: rate?.conditions ?? reference?.conditions ?? "", reference: rate ? `Acuerdo comercial · ${rate.validFrom} – ${rate.validTo}` : reference ? `Acuerdo comercial · ${reference.validFrom} – ${reference.validTo}` : published ? `Tarifa publicada${p.validFrom ? ` · desde ${p.validFrom}` : ""}` : p.kind === "digital" ? "Presupuesto solicitado" : "Tarifa de tu espacio", validFrom: rate?.validFrom ?? reference?.validFrom ?? (published ? p.validFrom : null), validTo: rate?.validTo ?? reference?.validTo ?? (published ? p.validTo : null), ...(published && !rate && !reference ? { referenceLabel: `Tarifa publicada${p.validFrom ? ` · desde ${p.validFrom.split("-").reverse().join("/")}` : ""}` } : {}) };
  });
  return selectAccountRadioTariffs(priced, rates);
}
