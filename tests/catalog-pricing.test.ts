import test from "node:test";
import assert from "node:assert/strict";
import { scopeCatalogProducts, type AgreedCatalogRate } from "../lib/catalog-pricing";
import { catalogCartSummary, catalogProducts, catalogQuoteSignature, type CatalogProduct } from "../lib/catalog-shopping";
import type { BroadcastCatalog } from "../lib/broadcast-catalog";
import type { RadioDirectoryCatalog } from "../lib/radio-directory";
import type { PressCatalog } from "../lib/press-catalog";
const base:CatalogProduct={key:"ooh:synthetic:0",kind:"ooh",provider:"Test",name:"Board",format:"Valla",unit:"mes",priceCents:123456,taxIncluded:false,conditions:"Private purchase term",location:"Guayas",reference:"Private source",image:null,source:{assetId:"synthetic",rateIndex:0,rate:{amount:1234.56,period:"month",basis:"per_unit",component:"Rental"}}};
const rate:AgreedCatalogRate={agreementId:"agreement-a",productKey:base.key,priceCents:40000,taxIncluded:true,conditions:"Client term",validFrom:"2026-10-01",validTo:"2026-10-31"};
test("customer projection strips acquisition prices and only uses its exact active agreement",()=>{
 const [p]=scopeCatalogProducts([base],[rate],"2026-10-31",false);
 assert.equal(p.priceCents,40000);assert.equal(p.taxIncluded,true);assert.equal(p.source.agreementId,"agreement-a");assert.equal(p.source.rate,undefined);
 assert.ok(!JSON.stringify(p).includes("1234.56"));assert.ok(!JSON.stringify(p).includes("Private"));
 assert.deepEqual(scopeCatalogProducts([base],[],"2026-10-31",true),[base]);
});
test("missing, expired and overlapping agreements never fall back to a global or cheapest client tariff",()=>{
 for(const rates of [[],[{...rate,validTo:"2026-10-30"}],[rate,{...rate,agreementId:"another-client",priceCents:1}]]){
  const [p]=scopeCatalogProducts([base],rates,"2026-10-31",false);assert.equal(p.priceCents,null);assert.equal(p.taxIncluded,null);assert.equal(p.source.agreementId,undefined);
 }
 const old=scopeCatalogProducts([base],[rate],"2026-10-31",false),changed=scopeCatalogProducts([base],[{...rate,priceCents:50000}],"2026-10-31",false);
 assert.notEqual(catalogQuoteSignature([{productKey:base.key,quantity:2}],old),catalogQuoteSignature([{productKey:base.key,quantity:2}],changed));
});
test("radio seconds, spot counts, press insertions and digital budgets stay distinct in a mixed cart",()=>{
 const radio={stations:[{id:"station-a",name:"Radio test",city:"Guayaquil",logoPath:null,profile:{tariffs:[{id:"tariff-a",unit:"second",market:"Guayaquil",edition:"2026",target:"Adultos",taxIncluded:false,conditions:"",validFrom:"2026-01-01",validTo:"2026-12-31",rates:[{label:"Rotativo",amountUsd:0.2}]}]}}]} as RadioDirectoryCatalog;
 const products=catalogProducts([],{assets:[]},{radio,broadcast:{sources:[],tv:[],radio:[]} as BroadcastCatalog,press:{entries:[]} as PressCatalog});
 const ten=products.find(p=>p.key.endsWith(":10"))!,thirty=products.find(p=>p.key.endsWith(":30"))!,digital=products.find(p=>p.kind==="digital")!;
 assert.equal(ten.priceCents,200);assert.equal(thirty.priceCents,600);assert.equal(digital.priceCents,100);
 const totals=catalogCartSummary([{productKey:thirty.key,quantity:30},{productKey:digital.key,quantity:1000}],products);
 assert.equal(totals.knownSubtotalCents,118000);assert.equal(totals.unavailable,0);
 const sanitized=scopeCatalogProducts(products,[],"2026-10-31",false);assert.equal(sanitized.find(p=>p.key===thirty.key)!.priceCents,null);assert.equal(sanitized.find(p=>p.key===digital.key)!.priceCents,100);
});
