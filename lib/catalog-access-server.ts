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
  return { db, isAdmin: profile.is_platform_admin, companyId: profile.workspace?.companyId, rates };
});
export async function priceCatalogProducts(products: CatalogProduct[], previewCompanyId?: string): Promise<CatalogProduct[]> {
  const scope = await catalogAccess();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if(previewCompanyId&&!scope.isAdmin)throw new Error("ADMIN_PREVIEW_REQUIRED");
  const companyId=previewCompanyId??scope.companyId;
  let rates=scope.rates;
  if(previewCompanyId){
    const caller=await createClient();
    const {data,error}=await caller.from("catalog_price_agreements").select("id,valid_from,valid_to,catalog_agreed_rates(product_key,unit_price_cents,tax_included,conditions)").eq("company_id",previewCompanyId).eq("active",true);
    if(error)throw new Error("PRICING_UNAVAILABLE");
    rates=(data??[]).flatMap(a=>(a.catalog_agreed_rates??[]).map(r=>({agreementId:a.id,validFrom:a.valid_from,validTo:a.valid_to,productKey:r.product_key,priceCents:Number(r.unit_price_cents),taxIncluded:r.tax_included,conditions:r.conditions})));
  }
  if ((!scope.isAdmin || previewCompanyId) && companyId) {
    const caller = await createClient();
    const {data,error}=await caller.from("workspace_catalog_products").select("id,medium,provider,name,format,format_group,unit,market_keys,location,reference,conditions,radio_station_id,publication_id,asset_id").eq("company_id",companyId).eq("active",true);
    if(error)throw new Error("WORKSPACE_CATALOG_UNAVAILABLE");
    products=[...products,...(data??[]).map(p=>({key:`${p.medium==="influencer"?"creator":p.medium}:workspace:${p.id}`,kind:p.medium as CatalogProduct["kind"],provider:p.provider,name:p.name,format:p.format,formatGroup:p.format_group as CatalogProduct["formatGroup"],marketKeys:p.market_keys,unit:p.unit,priceCents:null,taxIncluded:null,location:p.location,reference:p.reference,image:null,conditions:p.conditions,source:{workspaceProductId:p.id,...(p.radio_station_id?{stationId:p.radio_station_id}:{}),...(p.publication_id?{publicationId:p.publication_id}:{}),...(p.asset_id?{assetId:p.asset_id}:{})}}))];
  }
  return scopeCatalogProducts(products, rates, day, scope.isAdmin && !previewCompanyId);
}
