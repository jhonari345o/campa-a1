import { influencerPhoto } from "./media-catalog";
import { broadcastLogo } from "./broadcast-logos";
import "server-only";
import { cache } from "react";
import {catalogClientContext} from "./catalog-client-server";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { getSessionProfile } from "./auth";
import type { CatalogProduct } from "./catalog-shopping";
import { scopeCatalogProducts, type AgreedCatalogRate } from "./catalog-pricing";
import { mergeTvDefaults, preferNegotiatedTelevision } from "./tv-default-pricing";
import { radioRatePreference } from "./account-radio-tariffs";
import { mergeRadioDefaults } from "./radio-default-pricing";
import { mergeDigitalProductions } from "./digital-productions";
import {requestScoped} from "./request-scope";

/** Per-request authorization precedes every privileged catalog read. Never cache across users. */
export const catalogAccess = cache(() => requestScoped("catalog-access",async () => {
  const profile = await getSessionProfile();
  if (!profile) throw new Error("AUTH_REQUIRED");
  const caller = await createClient();
  const { data: allowed, error } = await caller.rpc("can_use_media_catalog");
  if (error || !allowed || (!profile.is_platform_admin && !profile.workspace)) throw new Error("CATALOG_ACCESS_REQUIRED");
  const db = createAdminClient();
  return { db, isAdmin: profile.is_platform_admin, companyId: profile.workspace?.companyId, clientContext:await catalogClientContext() };

}));
export async function priceCatalogProducts(products: CatalogProduct[], previewCompanyId?: string, previewClientId?:string, wantedKinds?:CatalogProduct["kind"][]): Promise<CatalogProduct[]> {
  const scope = await catalogAccess();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if(previewCompanyId&&!scope.isAdmin)throw new Error("ADMIN_PREVIEW_REQUIRED");
  const companyId=previewCompanyId??scope.companyId;
  const clientId=previewCompanyId?previewClientId:scope.clientContext?.selected?.id;
  const caller=await createClient();
  const wanted=(kind:CatalogProduct["kind"])=>!wantedKinds||wantedKinds.includes(kind);
  products=products.filter(p=>wanted(p.kind));
  if(previewClientId){
    const {data,error}=await caller.from("workspace_clients").select("id").eq("id",previewClientId).eq("company_id",previewCompanyId).maybeSingle();
    if(error||!data)throw new Error("CLIENT_SCOPE_REQUIRED");
  }
  // Only authenticated catalog users reach this privileged read. Project public sale fields only.
  const [tvDefaults,radioProducts,digitalDefaults]=await Promise.all([
    wanted("tv")?scope.db.from("catalog_tv_defaults").select("product").eq("active",true).order("product_key").limit(1000):Promise.resolve({data:[] as {product:unknown}[],error:null}),
    !wanted("radio")?Promise.resolve([] as CatalogProduct[]):(async()=>{
      const rows:CatalogProduct[]=[];
      for(let from=0;from<20000;from+=500){
        const {data,error}=await scope.db.rpc("catalog_cne_radio_products").range(from,from+499);
        if(error)throw new Error("RADIO_DEFAULT_PRICING_UNAVAILABLE");
        rows.push(...(data??[]).map((row:{product:CatalogProduct})=>row.product));
        if((data??[]).length<500)return rows;
      }
      throw new Error("RADIO_DEFAULT_PRICING_LIMIT");
    })(),
    wanted("digital")?scope.db.from("catalog_digital_productions").select("product").eq("active",true).order("product_key").limit(1000):Promise.resolve({data:[] as {product:unknown}[],error:null}),
  ]);
  if(tvDefaults.error)throw new Error("TV_DEFAULT_PRICING_UNAVAILABLE");
  if(digitalDefaults.error)throw new Error("DIGITAL_CATALOG_UNAVAILABLE");
  products=mergeTvDefaults(products,(tvDefaults.data??[]).map(row=>row.product as CatalogProduct));
  products=mergeRadioDefaults(products,radioProducts);
  products=mergeDigitalProductions(products,(digitalDefaults.data??[]).map(row=>row.product as CatalogProduct));
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
      let q=caller.from("workspace_catalog_products").select("id,medium,provider,name,format,format_group,unit,market_keys,location,reference,conditions,radio_station_id,publication_id,asset_id,reference_only,reference_label,influencer_profile_id,influencer_profiles(slug)").eq("company_id",companyId).eq("active",true).order("id").range(from,from+499);
      if(wantedKinds)q=q.in("medium",wantedKinds);
      q=clientId?q.or(`client_id.is.null,client_id.eq.${clientId}`):q.is("client_id",null);
      const {data,error}=await q;if(error)throw new Error("WORKSPACE_CATALOG_UNAVAILABLE");
      products.push(...(data??[]).map(p=>({key:`${p.medium==="influencer"?"creator":p.medium}:workspace:${p.id}`,kind:p.medium as CatalogProduct["kind"],provider:p.provider,name:p.name,format:p.format,formatGroup:p.format_group as CatalogProduct["formatGroup"],marketKeys:p.market_keys,unit:p.unit,priceCents:null,taxIncluded:null,location:p.location,reference:p.reference,referenceOnly:p.reference_only,referenceLabel:p.reference_label,image:p.influencer_profiles?influencerPhoto((p.influencer_profiles as unknown as {slug:string}).slug):null,conditions:p.conditions,source:{workspaceProductId:p.id,...(p.influencer_profile_id?{profileId:p.influencer_profile_id}:{}),...(p.radio_station_id?{stationId:p.radio_station_id}:{}),...(p.publication_id?{publicationId:p.publication_id}:{}),...(p.asset_id?{assetId:p.asset_id}:{})}})));
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
  return preferNegotiatedTelevision(scopeCatalogProducts(products,rates,day,scope.isAdmin&&!previewCompanyId)).map(p=>({...p,...((p.kind==="tv"||p.kind==="radio")&&!p.image?{image:broadcastLogo(p.provider,p.kind==="tv"?"television":"radio",[p.location,...(p.marketKeys??[])].join(" "))}:{}),...(p.source.providerSlug==="basics"?{provider:"Imprescindibles en cobertura"}:{})}));
}
