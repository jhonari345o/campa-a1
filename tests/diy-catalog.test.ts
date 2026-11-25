import test from "node:test";
import assert from "node:assert/strict";
import {resolveDiyCatalog} from "../lib/diy-catalog";
import {diySelectionSummary} from "../lib/diy-workspace";
import type {CatalogProduct} from "../lib/catalog-shopping";
const special:CatalogProduct={key:"ooh:workspace:synthetic-special",kind:"ooh",provider:"Test",name:"Tótems especiales",format:"Paquete de cinco",formatGroup:"totem_special",unit:"paquete mensual de 5 tótems",priceCents:null,referencePriceCents:173245,taxIncluded:null,location:"Guayaquil",reference:"",image:null,conditions:"",validFrom:"2025-08-01",validTo:"2025-09-30",source:{workspaceProductId:"synthetic-special"}};
test("DIY preserves negotiated package quantities and only applies prices inside the documented period",()=>{
 const picks=[{productKey:special.key,quantity:2}],rows=resolveDiyCatalog(picks,[special],["ooh"],"2025-08-01","2025-09-30");
 assert.equal(rows[0].unitPriceCents,173245);assert.equal(rows[0].unit,"paquete mensual de 5 tótems");
 assert.equal(diySelectionSummary(["ooh"],{catalog:rows}).referenceUsd,3464.9);
 const expired=resolveDiyCatalog(picks,[special],["ooh"],"2026-11-01","2026-11-30");assert.equal(expired[0].unitPriceCents,null);assert.equal(diySelectionSummary(["ooh"],{catalog:expired}).pending,1);
 assert.deepEqual(resolveDiyCatalog(picks,[special],["radio"],"2025-08-01","2025-09-30"),[]);
});
test("DIY rejects browser prices, unknown products and invalid quantities before saving a plan",()=>{
 for(const value of [[{productKey:special.key,quantity:1,unitPriceCents:1}],[{productKey:"ooh:unknown",quantity:1}],[{productKey:special.key,quantity:0}]])assert.throws(()=>resolveDiyCatalog(value,[special],["ooh"],"2025-08-01","2025-09-30"));
});
