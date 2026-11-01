import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { getSessionProfile } from "./auth";
import type { CatalogProduct } from "./catalog-shopping";
import { scopeCatalogProducts, type AgreedCatalogRate } from "./catalog-pricing";

/** Per-request authorization precedes every privileged catalog read. Never cache across users. */
export const catalogAccess = cache(async () => {
  const profile = await getSessionProfile();
  if (!profile) throw new Error("AUTH_REQUIRED");
  const caller = await createClient();
  const { data: allowed, error } = await caller.rpc("can_use_media_catalog");
  if (error || !allowed || (!profile.is_platform_admin && !profile.workspace)) throw new Error("CATALOG_ACCESS_REQUIRED");
  const db = createAdminClient();
  const rates: AgreedCatalogRate[] = [];
  if (!profile.is_platform_admin) {
    // RLS limits agreements to the selected workspace, including explicitly shared client agreements.
    const { data, error } = await caller.from("catalog_price_agreements").select("id,valid_from,valid_to,catalog_agreed_rates(product_key,unit_price_cents,tax_included,conditions)").eq("active", true);
    if (error) throw new Error("PRICING_UNAVAILABLE");
    for (const a of data ?? []) for (const rate of a.catalog_agreed_rates ?? []) rates.push({ agreementId: a.id, validFrom: a.valid_from, validTo: a.valid_to, productKey: rate.product_key, priceCents: Number(rate.unit_price_cents), taxIncluded: rate.tax_included, conditions: rate.conditions });
  }
  return { db, isAdmin: profile.is_platform_admin, rates };
});
export async function priceCatalogProducts(products: CatalogProduct[]): Promise<CatalogProduct[]> {
  const scope = await catalogAccess();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return scopeCatalogProducts(products, scope.rates, day, scope.isAdmin);
}
