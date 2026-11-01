import assert from "node:assert/strict";
import test from "node:test";
import { CART_LIMITS, canonicalCatalogOrder, catalogCartSummary, catalogProducts, catalogQuoteSignature, changeCatalogQuantity, normalizeCatalogPicks, oohProductKey } from "../lib/catalog-shopping";
import type { InfluencerProfile } from "../lib/media-catalog";
import { parseOohAsset } from "../lib/ooh-catalog";
const profile: InfluencerProfile = { id:"00000000-0000-4000-8000-000000000001",slug:"synthetic-creator",name:"Creador de prueba",category:"foodie",handle:null,platform:"Instagram",profileUrl:null,followers:null,avgViews:null,engagementPct:null,followerQualityPct:null,
 rates:[{id:"00000000-0000-4000-8000-000000000002",format:"Reel",amountUsd:12.34,taxIncluded:false},{id:"00000000-0000-4000-8000-000000000003",format:"Story",amountUsd:3.21,taxIncluded:true}] };
const asset=parseOohAsset({id:"synthetic-board",provider_slug:"test-provider",provinces:["Guayas"],details:{name:"Valla sintética",city:"Guayaquil",taxLabel:"Sin IVA",rates:[{amount:99.99,period:"month",basis:"per_unit",component:"Alquiler",kind:"tariff"},{amount:25,period:"one_time",basis:"per_unit",component:"Producción"}]}})!;
const products=catalogProducts([profile],{assets:[asset]});
test("each creator format and OOH period/component is a distinct purchasable product",()=>{
 assert.equal(products.length,4);assert.equal(new Set(products.map(p=>p.key)).size,4);
 assert.equal(products[2].priceCents,9999);assert.equal(products[2].unit,"mes · por unidad");
 assert.deepEqual(products[2].source.rate,{amount:99.99,period:"month",basis:"per_unit",component:"Alquiler"});
 assert.equal(catalogProducts([{...profile,rates:[{format:"Reel",amountUsd:12}]}],{assets:[]}).length,0);
});
test("repeated clicks increment the same product without merging different formats",()=>{
 let items=changeCatalogQuantity([],products[0].key,1);items=changeCatalogQuantity(items,products[0].key,1);items=changeCatalogQuantity(items,products[1].key,1);
 assert.deepEqual(items.map(i=>i.quantity),[2,1]);
 items=changeCatalogQuantity(items,products[0].key,-1);assert.equal(items[0].quantity,1);
 items=changeCatalogQuantity(items,products[0].key,-1);assert.equal(items.length,1);assert.equal(items[0].productKey,products[1].key);
 for(let i=0;i<120;i++)items=changeCatalogQuantity(items,products[1].key,1);
 assert.equal(items[0].quantity,CART_LIMITS.quantity);
});
test("mixed quantities total in integer cents and preserve individual tax bases",()=>{
 const summary=catalogCartSummary([{productKey:products[0].key,quantity:3},{productKey:products[1].key,quantity:2},{productKey:products[2].key,quantity:1}],products);
 assert.equal(summary.knownSubtotalCents,14343);assert.equal(summary.totalCents,14343);assert.equal(summary.quantity,6);assert.equal(summary.totalLabel,"Subtotal de catálogo");
 assert.equal(catalogCartSummary([{productKey:products[0].key,quantity:1}],products).totalLabel,"Subtotal sin IVA");
});
test("unknown OOH prices remain quotes while an explicit zero price stays zero",()=>{
 const p=catalogProducts([],{assets:[{...asset,id:"quote-board",rates:[]},{...asset,id:"zero-board",rates:[{...asset.rates[0],amount:0}]}]});
 assert.equal(p[0].priceCents,null);assert.equal(p[1].priceCents,0);
 const order=canonicalCatalogOrder(p.map(product=>({productKey:product.key,quantity:2})),p);
 assert.equal(order.totalCents,null);assert.equal(order.knownSubtotalCents,0);assert.equal(order.pendingPrice,1);assert.equal(order.unavailable,0);
});
test("draft inputs cannot supply prices, duplicate lines, invalid quantities or arbitrary objects",()=>{
 for(const input of [null,{},[{productKey:products[0].key,quantity:1,priceCents:1}],[{productKey:products[0].key,quantity:1},{productKey:products[0].key,quantity:2}],...[0,-1,1.5,100,"2",null].map(quantity=>[{productKey:products[0].key,quantity}]),[{productKey:"untrusted:thing",quantity:1}],[{productKey:"ooh:bad\u0000",quantity:1}]])assert.throws(()=>normalizeCatalogPicks(input));
 assert.throws(()=>normalizeCatalogPicks(Array.from({length:101},(_,i)=>({productKey:"ooh:"+i,quantity:1}))));
});
test("price, tax, quantity and product changes invalidate the displayed quote",()=>{
 const items=[{productKey:products[0].key,quantity:1}],signature=catalogQuoteSignature(items,products);
 assert.equal(catalogQuoteSignature([...items].reverse(),[...products].reverse()),signature);
 for(const patch of [{priceCents:12},{taxIncluded:true},{name:"Updated"},{unit:"paquete"},{reference:"New source"}])assert.notEqual(catalogQuoteSignature(items,products.map((p,i)=>i===0?{...p,...patch}:p)),signature);
 assert.notEqual(catalogQuoteSignature([{...items[0],quantity:2}],products),signature);
});
test("withdrawn or changed OOH rates cannot silently become another product",()=>{
 const items=[{productKey:products[2].key,quantity:1}],changed=catalogProducts([profile],{assets:[{...asset,rates:asset.rates.map(r=>({...r,amount:r.amount+1}))}]});
 assert.notEqual(oohProductKey(asset.id,asset.rates[0]),changed[2].key);
 assert.equal(catalogCartSummary(items,changed).unavailable,1);assert.throws(()=>canonicalCatalogOrder(items,changed));
});
test("canonical orders use current server products and reject empty or excessive totals",()=>{
 const order=canonicalCatalogOrder([{productKey:products[0].key,quantity:2}],products);
 assert.equal(order.items[0].unitPriceCents,1234);assert.equal(order.items[0].taxIncluded,false);assert.equal(order.knownSubtotalCents,2468);
 assert.throws(()=>canonicalCatalogOrder([],products));
 assert.throws(()=>canonicalCatalogOrder([{productKey:products[0].key,quantity:99}],[{...products[0],priceCents:1000000000}]));
});
