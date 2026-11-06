import test from "node:test";
import assert from "node:assert/strict";
import { mergeTvDefaults, preferNegotiatedTelevision, televisionProductIdentity } from "../lib/tv-default-pricing";
import { scopeCatalogProducts, type AgreedCatalogRate } from "../lib/catalog-pricing";
import { canonicalCatalogOrder, type CatalogProduct } from "../lib/catalog-shopping";
const base:CatalogProduct={key:"tv:test:news",kind:"tv",provider:"TC Televisión",name:"El Noticiero II (TARIFA PORTACUÑA 30\")",format:"Lunes a viernes · 12H00 - 14H00",unit:"cuña de 30 s",location:"Guayaquil · Quito",marketKeys:["guayaquil","quito"],priceCents:65000,taxIncluded:false,conditions:"",reference:"Tarifa de tu cuenta",image:null,validFrom:"2026-11-02",validTo:null,source:{defaultPrice:true,standingPrice:true,offerId:"news"}};
const rate:AgreedCatalogRate={agreementId:"workspace-contract",productKey:base.key,priceCents:50000,taxIncluded:false,conditions:"Acuerdo del cliente",validFrom:"2026-11-02",validTo:"infinity"};
test("explicit TV sale defaults replace supplier prices and produce a quoted cart",()=>{
 const [merged]=mergeTvDefaults([{...base,priceCents:100000,conditions:"Private supplier condition",source:{offerId:"news"}}],[base]);
 const [p]=scopeCatalogProducts([merged],[],"2026-11-02",false);
 assert.equal(p.priceCents,65000);assert.equal(p.conditions,"");assert.equal(p.source.rate,undefined);
 assert.equal(canonicalCatalogOrder([{productKey:p.key,quantity:30}],[p]).totalCents,1950000);
 assert.equal(scopeCatalogProducts([base],[],"2026-11-01",false)[0].priceCents,null);
 assert.deepEqual(mergeTvDefaults([], [{...base,kind:"radio"},{...base,source:{standingPrice:true}},{...base,priceCents:NaN}]),[]);
});
test("account agreements override defaults, while expired or conflicting exact agreements cannot be bypassed",()=>{
 assert.equal(scopeCatalogProducts([base],[rate],"2026-11-02",false)[0].priceCents,50000);
 for(const rates of [[{...rate,validTo:"2026-11-01"}],[rate,{...rate,agreementId:"conflict",priceCents:60000}]])assert.equal(scopeCatalogProducts([base],rates,"2026-11-02",false)[0].priceCents,null);
});
test("equivalent program spellings use the customer's price and preserve a curated ratings link",()=>{
 const negotiated:CatalogProduct={...base,key:"tv:workspace:owned",name:"El Noticiero II",format:"El Noticiero II · AA* · LMXJV–– · 12:00 · 30 s",priceCents:50000,source:{workspaceProductId:"owned",agreementId:"negotiated"}};
 const output=preferNegotiatedTelevision([base,negotiated]);
 assert.equal(output.length,1);assert.equal(output[0].key,negotiated.key);assert.equal(output[0].priceCents,50000);assert.equal(output[0].source.offerId,"news");
 for(const patch of [{format:"Sábado · 12:00"},{format:"Lunes a viernes · 19:00"},{unit:"mención"},{unit:"cuña de 20 s"},{marketKeys:["guayaquil"]}])assert.equal(preferNegotiatedTelevision([base,{...negotiated,...patch}]).length,2);
 assert.notEqual(televisionProductIdentity({...base,format:"Sábado · 12:00"}),televisionProductIdentity({...base,format:"Domingo · 12:00"}));
});
