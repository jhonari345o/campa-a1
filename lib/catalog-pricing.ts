import type { CatalogProduct } from "./catalog-shopping";
export type AgreedCatalogRate = { agreementId: string; productKey: string; priceCents: number; taxIncluded: boolean | null; conditions: string; validFrom: string; validTo: string };

/** No global rate fallback, no cross-client price merge, no expired agreement masquerading as current. */
export function scopeCatalogProducts(products: CatalogProduct[], rates: AgreedCatalogRate[], day: string, admin: boolean): CatalogProduct[] {
  if (admin) return products;
  return products.map(p => {
    const matching = rates.filter(r => r.productKey === p.key && r.validFrom <= day && r.validTo >= day && Number.isSafeInteger(r.priceCents) && r.priceCents >= 0);
    const rate = matching.length === 1 ? matching[0] : null;
    // Source IDs are sufficient to resolve an order; raw acquisition rates must never reach a customer.
    const { rate: _privateRate, ...source } = p.source;
    void _privateRate;
    return { ...p, source: { ...source, ...(rate ? { agreementId: rate.agreementId } : {}) }, priceCents: p.kind === "digital" ? 100 : rate?.priceCents ?? null, taxIncluded: rate?.taxIncluded ?? null,
      conditions: rate?.conditions ?? "", reference: rate ? `Acuerdo comercial · ${rate.validFrom} – ${rate.validTo}` : p.kind === "digital" ? "Presupuesto solicitado" : "Tarifa de tu espacio", validFrom: rate?.validFrom ?? null, validTo: rate?.validTo ?? null };
  });
}
