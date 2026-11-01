import type { CatalogProduct } from "./catalog-shopping";

/** A historical reference is visible separately from the price used to quote an order. */
export function catalogReferenceDisclosure(product: CatalogProduct) {
  if (product.priceCents != null || product.referencePriceCents == null) return null;
  return {
    label: product.referenceOnly ? "Última tarifa negociada" : "Tarifa del período",
    priceCents: product.referencePriceCents,
    confirmation: "Reconfirmar con el medio antes de aprobar la compra.",
  };
}
