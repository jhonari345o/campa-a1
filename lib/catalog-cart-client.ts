import type { CartSaveResult } from "./catalog-cart-http";
import type { CatalogCart, CatalogPick } from "./catalog-shopping";

/** Uses cookies and a deployment-independent route; never stores prices or credentials. */
export async function persistCatalogCart(items: CatalogPick[], expectedVersion: number, expectedClientId: string | null): Promise<CartSaveResult> {
  const response = await fetch("/api/catalog/cart", {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items, expectedVersion, expectedClientId }),
  });
  const result = await response.json() as CartSaveResult;
  if (!response.ok && result.ok !== false) throw new Error("CART_UNAVAILABLE");
  return result;
}
export async function recoverCatalogCart(): Promise<CatalogCart> {
  const response = await fetch("/api/catalog/cart", { credentials: "same-origin", cache: "no-store" });
  const result = await response.json() as CatalogCart;
  if (!response.ok && !result.error) throw new Error("CART_UNAVAILABLE");
  return result;
}
