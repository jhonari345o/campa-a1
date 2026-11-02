import test from "node:test";
import assert from "node:assert/strict";
import { campaignRentalMonths, catalogPriceCoversDates, planningProductPrice } from "../lib/catalog-planning";
import { resolveDiyCatalog } from "../lib/diy-catalog";
import type { CatalogProduct } from "../lib/catalog-shopping";

// Synthetic prices and identifiers only.
const product: CatalogProduct = {
  key: "ooh:synthetic:0", kind: "ooh", provider: "Proveedor sintético", name: "Pantalla sintética",
  format: "Pantalla", unit: "mes · por pantalla", billingPeriod: "month", priceCents: 123400,
  taxIncluded: false, location: "Quito", reference: "", image: null, conditions: "",
  validFrom: "2026-11-02", validTo: null, source: { agreementId: "synthetic-account-agreement" },
};

test("unbounded commercial prices require explicit authority and cannot predate that authority", () => {
  assert.equal(catalogPriceCoversDates(product, "2026-11-02", "2027-12-31"), true);
  assert.equal(catalogPriceCoversDates(product, "2026-11-01", "2026-11-30"), false);
  assert.equal(catalogPriceCoversDates({ ...product, source: {} }, "2026-11-02", "2026-11-30"), false);
  assert.equal(catalogPriceCoversDates({ ...product, source: { standingPrice: true } }, "2026-11-02", "2026-11-30"), true);
  assert.equal(catalogPriceCoversDates({ ...product, validFrom: null }, "2026-11-02", "2026-11-30"), false);
  assert.equal(catalogPriceCoversDates({ ...product, validTo: "2026-11-30" }, "2026-11-02", "2026-12-01"), false);
  assert.equal(catalogPriceCoversDates({ ...product, validTo: "invalid" }, "2026-11-02", "2026-11-30"), false);
});

test("rental periods cover inclusive campaign dates across month and leap-year boundaries", () => {
  for (const [start, end, months] of [
    ["2026-01-01", "2026-01-31", 1], ["2026-11-01", "2026-12-31", 2],
    ["2026-12-15", "2027-01-14", 1], ["2026-12-15", "2027-01-15", 2],
    ["2028-02-01", "2028-02-29", 1], ["2026-01-31", "2026-02-27", 1],
    ["2026-01-31", "2026-02-28", 2], ["2026-01-01", "2026-01-01", 1],
  ] as const) assert.equal(campaignRentalMonths(start, end), months, `${start} to ${end}`);
  assert.equal(campaignRentalMonths("2026-11-02", "2026-11-01"), null);
  assert.equal(campaignRentalMonths("invalid", "2026-11-30"), null);
});

test("monthly OOH planning covers the full campaign, while production stays a one-off charge", () => {
  const price = planningProductPrice(product, "2026-11-02", "2027-01-01");
  assert.equal(price?.priceUsd, 2468);
  assert.equal(price?.periods, 2);
  assert.equal(price?.unit, "contratación de 2 meses · por pantalla");
  assert.equal(planningProductPrice({ ...product, billingPeriod: "3_months" }, "2026-11-02", "2027-01-01")?.periods, 1);
  assert.equal(planningProductPrice({ ...product, billingPeriod: "one_off", unit: "pago único · producción" }, "2026-11-02", "2027-01-01")?.priceUsd, 1234);
  assert.equal(planningProductPrice({ ...product, kind: "radio", unit: "cuña de 20 s" }, "2026-11-02", "2027-01-01")?.priceUsd, 1234);
  for (const priceCents of [NaN, Infinity, -1, 0, 0.5]) assert.equal(planningProductPrice({ ...product, priceCents }, "2026-11-02", "2026-11-30"), null);
  assert.equal(planningProductPrice({ ...product, referenceOnly: true }, "2026-11-02", "2026-11-30"), null);
});

test("DIY uses the same authorized price dates and keeps the catalog unit selected by the user", () => {
  const picks = [{ productKey: product.key, quantity: 2 }];
  const [row] = resolveDiyCatalog(picks, [product], ["ooh"], "2026-11-02", "2026-11-30");
  assert.equal(row.unitPriceCents, 123400);
  assert.equal(row.quantity, 2);
  assert.equal(row.unit, "mes · por pantalla");
  assert.equal(resolveDiyCatalog(picks, [product], ["ooh"], "2026-11-01", "2026-11-30")[0].unitPriceCents, null);
});
