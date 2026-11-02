import test from "node:test";
import assert from "node:assert/strict";
import { digitalBudgetKey, digitalBudgetProduct, digitalGoalsForPlatform } from "../lib/digital-budget";
import { canonicalCatalogOrder, catalogCartSummary, catalogProducts, catalogQuoteSignature, normalizeCatalogPicks } from "../lib/catalog-shopping";
import { scopeCatalogProducts } from "../lib/catalog-pricing";

test("digital budgets preserve cents, objective and selected platform as one budget", () => {
  const key = digitalBudgetKey("meta-ads", "whatsapp", 10000050), product = digitalBudgetProduct(key)!;
  const items = [{ productKey: key, quantity: 1 }];
  assert.equal(product.priceCents, 10000050); assert.equal(product.source.digitalGoal, "whatsapp");
  assert.equal(catalogCartSummary(items, [product]).totalCents, 10000050);
  assert.equal(canonicalCatalogOrder(items, [product]).items[0].unitPriceCents, 10000050);
  assert.equal(catalogQuoteSignature(items, [product]), catalogQuoteSignature(items, scopeCatalogProducts([digitalBudgetProduct(key)!], [], "2026-11-01", false)));
  assert.deepEqual(normalizeCatalogPicks(items), items);
});
test("budget keys reject unsupported objectives, tampered prices and multiplied budgets", () => {
  assert.equal(digitalGoalsForPlatform("spotify-ads").some(goal => goal.id === "whatsapp"), false);
  for (const key of ["digital:spotify-ads:budget:whatsapp:100", "digital:unknown:budget:reach:100", "digital:meta-ads:budget:sales:0", "digital:meta-ads:budget:sales:1000000001", "digital:meta-ads:budget:sales:1.5", "digital:meta-ads:budget:sales:1e6"]) assert.equal(digitalBudgetProduct(key), null);
  const key = digitalBudgetKey("meta-ads", "reach", 1);
  assert.throws(() => normalizeCatalogPicks([{ productKey: key, quantity: 2 }]));
});
test("existing dollar-unit digital carts retain their original amounts", () => {
  const products = catalogProducts([], { assets: [] }, { broadcast: { sources: [], tv: [], radio: [] }, radio: { stations: [] }, press: { entries: [] } });
  const key = "digital:meta-ads", legacy = [{ productKey: key, quantity: 10000 }];
  assert.equal(catalogCartSummary(legacy, products).totalCents, 1000000);
  assert.equal(catalogCartSummary(legacy, scopeCatalogProducts(products, [], "2026-11-01", false)).totalCents, 1000000);
});
