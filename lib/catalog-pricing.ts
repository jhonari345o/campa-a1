import type { CatalogProduct } from "./catalog-shopping";
import { selectAccountRadioTariffs, type RadioRatePreference } from "./account-radio-tariffs";
export type AgreedCatalogRate = { agreementId: string; productKey: string; priceCents: number; taxIncluded: boolean | null; conditions: string; validFrom: string; validTo: string; radioPreference?: RadioRatePreference; clientSpecific?: boolean };

/** No global rate fallback, no cross-client price merge, no expired agreement masquerading as current. */
export function scopeCatalogProducts(products: CatalogProduct[], rates: AgreedCatalogRate[], day: string, admin: boolean): CatalogProduct[] {
  if (admin) return products;
  const priced = products.map(p => {
    const matching = rates.filter(r => r.productKey === p.key && r.validFrom <= day && r.validTo >= day && Number.isSafeInteger(r.priceCents) && r.priceCents >= 0);
    const rate = !p.referenceOnly && matching.length === 1 ? matching[0] : null;
    const history = p.source.workspaceProductId ? rates.filter(r=>r.productKey===p.key&&Number.isSafeInteger(r.priceCents)&&r.priceCents>=0) : [];
    const reference = !rate && history.length===1 ? history[0] : null;
    // Source IDs are sufficient to resolve an order; raw acquisition rates must never reach a customer.
    const { rate: _privateRate, ...source } = p.source;
    void _privateRate;
    return { ...p, source: { ...source, ...(rate ? { agreementId: rate.agreementId } : {}) }, priceCents: p.kind === "digital" && !p.source.workspaceProductId ? 100 : rate?.priceCents ?? null, taxIncluded: rate?.taxIncluded ?? reference?.taxIncluded ?? null,
      referencePriceCents: reference?.priceCents ?? null, conditions: rate?.conditions ?? reference?.conditions ?? "", reference: rate ? `Acuerdo comercial · ${rate.validFrom} – ${rate.validTo}` : reference ? `Acuerdo comercial · ${reference.validFrom} – ${reference.validTo}` : p.kind === "digital" ? "Presupuesto solicitado" : "Tarifa de tu espacio", validFrom: rate?.validFrom ?? reference?.validFrom ?? null, validTo: rate?.validTo ?? reference?.validTo ?? null };
  });
  return selectAccountRadioTariffs(priced, rates);
}
