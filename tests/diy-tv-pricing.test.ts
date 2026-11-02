import test from "node:test";
import assert from "node:assert/strict";
import {applyDiyTvPrices,diyTvPrice,diyTvRequests,diyTvResolver} from "../lib/diy-tv-pricing";
import {validateBroadcastSelections} from "../lib/broadcast-catalog";
import {strategyCatalogs,tvSource} from "./media-strategy-fixture";
import type {CatalogProduct} from "../lib/catalog-shopping";
const product:CatalogProduct={key:"tv:source:offer",kind:"tv",provider:"Canal sintético",name:"Programa",format:"Spot",unit:"spot 30 s",priceCents:26600,taxIncluded:false,location:"Guayaquil · Quito",marketKeys:["guayaquil","quito"],reference:"",image:null,conditions:"",validFrom:"2026-11-02",validTo:null,source:{standingPrice:true}};
const brief={geography:"Guayaquil",startDate:"2026-11-03",endDate:"2026-11-30"};
test("DIY uses the account-resolved catalog price instead of the gross or browser price",()=>{
 const pick={id:"offer",sourceId:"source",unitPrice:665,quantity:10};
 const [defaultRow]=applyDiyTvPrices([pick],brief,[product]);
 assert.equal(defaultRow.unitPrice,266);assert.equal(defaultRow.quantity,10);assert.equal(pick.unitPrice,665);
 const [negotiated]=applyDiyTvPrices([pick],brief,[{...product,priceCents:22000,source:{agreementId:"private-account"}}]);
 assert.equal(negotiated.unitPrice,220);
 assert.equal(diyTvPrice("source","offer",{...brief,geography:"Pichincha"},[product])?.priceUsd,266);
});
test("approved account validity replaces the source tariff period and annual condition, never its identifiers",()=>{
 const catalog={...strategyCatalogs().broadcast,sources:[{...tvSource,id:"source",annualContract:true,periodStart:"2026-09-01",periodEnd:"2026-09-30"}],tv:[{id:"offer",sourceId:"source",day:"Lunes",title:"Programa",schedule:"08:00",priceUsd:665,target:"General",note:""}]};
 const input={tv:[{id:"offer",sourceId:"source",quantity:10,unitPrice:1}]};
 assert.equal(validateBroadcastSelections(catalog,brief,input).ok,false);
 const checked=validateBroadcastSelections(catalog,brief,input,diyTvResolver(brief,[product]));
 assert.equal(checked.ok,true);
 if(checked.ok)assert.equal((checked.selections.tv as {unitPrice:number}[])[0].unitPrice,266);
 assert.equal(validateBroadcastSelections(catalog,brief,input,diyTvResolver(brief,[])).ok,false);
 assert.equal(validateBroadcastSelections(catalog,brief,input,diyTvResolver(brief,[{...product,validTo:"2026-11-02"}])).ok,false);
 assert.deepEqual(diyTvRequests(catalog,input.tv),[{productKey:"tv:source:offer",quantity:10}]);
 for(const picks of [[{id:"forged",sourceId:"source",quantity:10}],[{id:"offer",sourceId:"source",quantity:10001}],[{id:"offer",sourceId:"other",quantity:1}],Array(101).fill(input.tv[0])])assert.throws(()=>diyTvRequests(catalog,picks),/INVALID_TV_SELECTION/);
});
test("missing, expired, unpriced or different-market products never reuse a browser price",()=>{
 for(const products of [[],[{...product,validTo:"2026-11-02"}],[{...product,priceCents:null}],[{...product,referenceOnly:true}],[{...product,marketKeys:["cuenca"]}]]){
  assert.equal(applyDiyTvPrices([{id:"offer",sourceId:"source",unitPrice:1}],brief,products)[0].unitPrice,null);
 }
 assert.equal(diyTvPrice("source","forged",brief,[product]),null);
});
