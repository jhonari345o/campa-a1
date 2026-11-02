import assert from "node:assert/strict";
import test from "node:test";
import {mergeRadioDefaults} from "../lib/radio-default-pricing";
import {scopeCatalogProducts,type AgreedCatalogRate} from "../lib/catalog-pricing";
import {planningProductPrice} from "../lib/catalog-planning";
import type {CatalogProduct} from "../lib/catalog-shopping";

const base:CatalogProduct={key:`radio:cne:${"a".repeat(32)}`,kind:"radio",provider:"Radio sintética",name:"Rotativo",format:"Cuña de 20 s",unit:"cuña de 20 s",location:"Guayas",marketKeys:["guayas"],priceCents:2000,taxIncluded:false,reference:"Tarifa de tu cuenta",conditions:"",image:null,validFrom:"2026-11-02",validTo:null,source:{stationId:"synthetic-station",defaultPrice:true,standingPrice:true,seconds:20}};
test("radio defaults require authorized sale identity and explicit duration, never a workspace's private price",()=>{
 assert.deepEqual(mergeRadioDefaults([],[base]),[base]);
 for(const p of [{...base,key:"radio:workspace:private"},{...base,source:{...base.source,agreementId:"private"}},{...base,source:{...base.source,standingPrice:false}},{...base,source:{...base.source,seconds:10}},{...base,priceCents:NaN}])assert.deepEqual(mergeRadioDefaults([],[p]),[]);
});
test("CNE defaults can price future campaigns without inheriting the source campaign's dates",()=>{
 const [p]=scopeCatalogProducts([base],[],"2026-11-02",false);
 assert.equal(planningProductPrice(p,"2026-11-03","2026-11-30")?.priceUsd,20);
 assert.equal(p.source.agreementId,undefined);
 assert.equal(scopeCatalogProducts([base],[],"2026-11-01",false)[0].priceCents,null);
 const expired={...base,validTo:"2026-11-15"};
 assert.equal(planningProductPrice(expired,"2026-11-03","2026-11-30"),null);
});
test("the account's exact negotiation wins over shared CNE prices and old profile quotes",()=>{
 const negotiated={...base,key:"radio:workspace:synthetic",priceCents:null,source:{workspaceProductId:"synthetic",stationId:"synthetic-station",seconds:20}};
 const rate:AgreedCatalogRate={productKey:negotiated.key,agreementId:"account",priceCents:1700,taxIncluded:false,conditions:"",validFrom:"2026-11-01",validTo:"infinity",radioPreference:{origin:"client",clientSpecific:true,observedOn:"2026-11-01"}};
 const raw={...base,key:"radio:synthetic:legacy",priceCents:2300,source:{stationId:"synthetic-station",seconds:20}};
 const result=scopeCatalogProducts([base,raw,negotiated],[rate],"2026-11-02",false);
 assert.equal(result.length,1);assert.equal(result[0].priceCents,1700);assert.equal(result[0].source.agreementId,"account");
 assert.equal(scopeCatalogProducts([raw,base],[],"2026-11-02",true).length,1);
 assert.equal(scopeCatalogProducts([raw,base],[],"2026-11-02",true)[0].priceCents,2000);
 const blocked=scopeCatalogProducts([base,negotiated],[{...rate,validTo:"2026-11-01"}],"2026-11-02",false);
 assert.equal(blocked.length,1);assert.equal(blocked[0].priceCents,null);
});
