import test from "node:test";
import assert from "node:assert/strict";
import { scopeCatalogProducts, type AgreedCatalogRate } from "../lib/catalog-pricing";
import { catalogReferenceDisclosure } from "../lib/catalog-rate-display";
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
test('undated references remain visible without becoming live quotes or package budgets',()=>{
 const p={...base,key:'ooh:workspace:reference',referenceOnly:true,referenceLabel:'Referencia sin vigencia declarada',source:{workspaceProductId:'reference'}};
 const [row]=scopeCatalogProducts([p],[{...rate,productKey:p.key}], '2026-10-20',false);
 assert.equal(row.priceCents,null);assert.equal(row.referencePriceCents,rate.priceCents);assert.equal(row.source.agreementId,undefined);assert.equal(row.taxIncluded,true);
 assert.equal(catalogReferenceDisclosure(row)?.label,"Última tarifa negociada");
 const cart=catalogCartSummary([{productKey:row.key,quantity:30}],[row]);
 assert.equal(cart.totalCents,null);assert.equal(cart.knownSubtotalCents,0);assert.equal(cart.pendingPrice,1);
});
test("explicit agreement expiry remains visible as a period tariff and cannot authorize a purchase",()=>{
 const p={...base,source:{workspaceProductId:"dated-product"}};
 const [row]=scopeCatalogProducts([p],[rate],"2026-11-01",false);
 assert.equal(row.validFrom,"2026-10-01");assert.equal(row.validTo,"2026-10-31");
 assert.equal(row.priceCents,null);assert.equal(row.source.agreementId,undefined);
 assert.equal(catalogReferenceDisclosure(row)?.label,"Tarifa del período");
 assert.equal(catalogCartSummary([{productKey:row.key,quantity:2}],[row]).totalCents,null);
});
test("current firm prices and missing references never receive a historical-rate disclosure",()=>{
 const [active]=scopeCatalogProducts([base],[rate],"2026-10-31",false);
 const [missing]=scopeCatalogProducts([base],[],"2026-10-31",false);
 assert.equal(catalogReferenceDisclosure(active),null);assert.equal(catalogReferenceDisclosure(missing),null);
 const freeReference={...base,priceCents:null,referencePriceCents:0,referenceOnly:true};
 assert.equal(catalogReferenceDisclosure(freeReference)?.priceCents,0);
});
