import "server-only";
import { cache } from "react";
import {catalogClientContext} from "./catalog-client-server";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { getSessionProfile } from "./auth";
import type { CatalogProduct } from "./catalog-shopping";
import { scopeCatalogProducts, type AgreedCatalogRate } from "./catalog-pricing";
import { radioRatePreference } from "./account-radio-tariffs";

/** Per-request authorization precedes every privileged catalog read. Never cache across users. */
export const catalogAccess = cache(async () => {
  const profile = await getSessionProfile();
  if (!profile) throw new Error("AUTH_REQUIRED");
  const caller = await createClient();
  const { data: allowed, error } = await caller.rpc("can_use_media_catalog");
  if (error || !allowed || (!profile.is_platform_admin && !profile.workspace)) throw new Error("CATALOG_ACCESS_REQUIRED");
  const db = createAdminClient();
  return { db, isAdmin: profile.is_platform_admin, companyId: profile.workspace?.companyId, clientContext:await catalogClientContext() };

});
export async function priceCatalogProducts(products: CatalogProduct[], previewCompanyId?: string, previewClientId?:string): Promise<CatalogProduct[]> {
  const scope = await catalogAccess();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if(previewCompanyId&&!scope.isAdmin)throw new Error("ADMIN_PREVIEW_REQUIRED");
  const companyId=previewCompanyId??scope.companyId;
  const clientId=previewCompanyId?previewClientId:scope.clientContext?.selected?.id;
  const caller=await createClient();
  if(previewClientId){
    const {data,error}=await caller.from("workspace_clients").select("id").eq("id",previewClientId).eq("company_id",previewCompanyId).maybeSingle();
    if(error||!data)throw new Error("CLIENT_SCOPE_REQUIRED");
  }
  const rates:AgreedCatalogRate[]=[];
  if((!scope.isAdmin||previewCompanyId)&&companyId){
    for(let from=0;from<20000;from+=500){
      let q=caller.from("catalog_price_agreements").select("id,client_id,valid_from,valid_to,catalog_agreed_rates(product_key,unit_price_cents,tax_included,conditions)").eq("company_id",companyId).eq("active",true).order("id").range(from,from+499);
      q=clientId?q.or(`client_id.is.null,client_id.eq.${clientId}`):q.is("client_id",null);
      const {data,error}=await q;if(error)throw new Error("PRICING_UNAVAILABLE");
      for(const a of data??[])for(const r of a.catalog_agreed_rates??[])rates.push({agreementId:a.id,validFrom:a.valid_from,validTo:a.valid_to,productKey:r.product_key,priceCents:Number(r.unit_price_cents),taxIncluded:r.tax_included,conditions:r.conditions,clientSpecific:Boolean(a.client_id)});
      if((data??[]).length<500)break;
    }
    for(let from=0;from<20000;from+=500){
      let q=caller.from("workspace_catalog_products").select("id,medium,provider,name,format,format_group,unit,market_keys,location,reference,conditions,radio_station_id,publication_id,asset_id,reference_only,reference_label").eq("company_id",companyId).eq("active",true).order("id").range(from,from+499);
      q=clientId?q.or(`client_id.is.null,client_id.eq.${clientId}`):q.is("client_id",null);
      const {data,error}=await q;if(error)throw new Error("WORKSPACE_CATALOG_UNAVAILABLE");
      products.push(...(data??[]).map(p=>({key:`${p.medium==="influencer"?"creator":p.medium}:workspace:${p.id}`,kind:p.medium as CatalogProduct["kind"],provider:p.provider,name:p.name,format:p.format,formatGroup:p.format_group as CatalogProduct["formatGroup"],marketKeys:p.market_keys,unit:p.unit,priceCents:null,taxIncluded:null,location:p.location,reference:p.reference,referenceOnly:p.reference_only,referenceLabel:p.reference_label,image:null,conditions:p.conditions,source:{workspaceProductId:p.id,...(p.radio_station_id?{stationId:p.radio_station_id}:{}),...(p.publication_id?{publicationId:p.publication_id}:{}),...(p.asset_id?{assetId:p.asset_id}:{})}})));
      if((data??[]).length<500)break;
    }
    // Only IDs from the caller's authorized agreement query can reach this privileged read.
    const radioIds=[...new Set(rates.filter(r=>r.productKey.startsWith("radio:")).map(r=>r.agreementId))];
    const evidence=new Map<string,unknown>();
    for(let from=0;from<radioIds.length;from+=250){
      const {data,error}=await scope.db.from("catalog_private_provenance").select("agreement_id,evidence").in("agreement_id",radioIds.slice(from,from+250));
      if(error)throw new Error("PRICING_UNAVAILABLE");
      for(const row of data??[])evidence.set(row.agreement_id,row.evidence);
    }
    for(const rate of rates)if(rate.productKey.startsWith("radio:"))rate.radioPreference=radioRatePreference(evidence.get(rate.agreementId),Boolean(rate.clientSpecific));
  }
  return scopeCatalogProducts(products,rates,day,scope.isAdmin&&!previewCompanyId);
}
