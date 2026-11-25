import test from "node:test";
import assert from "node:assert/strict";
import { digitalProductionGroups, mergeDigitalProductions } from "../lib/digital-productions";
import { scopeCatalogProducts } from "../lib/catalog-pricing";
import { canonicalCatalogOrder, catalogQuoteSignature, type CatalogProduct } from "../lib/catalog-shopping";
import { digitalBudgetProduct } from "../lib/digital-budget";

const program: CatalogProduct = { key:"digital:production:test-show:monthly",kind:"digital",provider:"Test programme",name:"Monthly sponsorship",format:"Sponsorship",unit:"mes",priceCents:250000,taxIncluded:false,location:"Digital",reference:"",image:null,conditions:"",source:{defaultPrice:true,standingPrice:true},validFrom:"2026-11-03",validTo:null,digitalProduction:{id:"test-show",network:"Test network",description:"Interviews",rights:["Four programmes","Four posts"],programsPerPeriod:4} };

test("a digital programme retains its package price and never becomes a one-dollar platform unit",()=>{
 const [p]=scopeCatalogProducts(mergeDigitalProductions([], [program]),[],"2026-11-03",false);
 assert.equal(p.priceCents,250000);
 const budget=digitalBudgetProduct("digital:meta-ads:budget:views:70000")!;
 const cart=canonicalCatalogOrder([{productKey:p.key,quantity:2},{productKey:budget.key,quantity:1}],[p,budget]);
 assert.equal(cart.totalCents,570000);assert.equal(cart.items.find(i=>i.productKey===p.key)?.unit,"mes");
 assert.deepEqual(cart.items.find(i=>i.productKey===p.key)?.digitalProduction?.rights,program.digitalProduction?.rights);
 const changedRights={...p,digitalProduction:{...p.digitalProduction!,rights:["Two programmes"]}};
 assert.notEqual(catalogQuoteSignature([{productKey:p.key,quantity:2}],[p]),catalogQuoteSignature([{productKey:p.key,quantity:2}],[changedRights]));
 const unrecognized={...program,key:"digital:unknown",digitalProduction:undefined,source:{}};
 assert.equal(scopeCatalogProducts([unrecognized],[],"2026-11-03",false)[0].priceCents,null);
});
test("the client's negotiated programme price takes precedence and conflicting or expired prices cannot fall back",()=>{
 const rate={agreementId:"test",productKey:program.key,priceCents:220000,taxIncluded:true,conditions:"Client terms",validFrom:"2026-11-03",validTo:"2026-12-31"};
 const [p]=scopeCatalogProducts([program],[rate],"2026-11-03",false);
 assert.equal(p.priceCents,220000);assert.equal(p.source.agreementId,"test");assert.equal(p.taxIncluded,true);
 assert.equal(scopeCatalogProducts([program],[rate],"2027-01-01",false)[0].priceCents,null);
 assert.equal(scopeCatalogProducts([program],[rate,{...rate,agreementId:"conflict",priceCents:210000}],"2026-11-03",false)[0].priceCents,null);
 assert.equal(scopeCatalogProducts([program],[],"2026-11-02",false)[0].priceCents,null);
});
test("productions group their packages separately from people and platform budgets",()=>{
 const second={...program,key:"digital:production:test-show:gold",name:"Gold",priceCents:100000};
 const groups=digitalProductionGroups([program,second,digitalBudgetProduct("digital:meta-ads:budget:views:70000")!,{...program,key:"creator:test",kind:"influencer"}]);
 assert.equal(groups.length,1);assert.equal(groups[0].packages.length,2);assert.equal(groups[0].name,"Test programme");
 assert.equal(mergeDigitalProductions([], [{...program,priceCents:0},{...program,source:{}},{...program,digitalProduction:{...program.digitalProduction!,id:"different"}},{...program,key:program.key+":budget:100"},{...program,digitalProduction:{...program.digitalProduction!,rights:[]}}]).length,0);
});
