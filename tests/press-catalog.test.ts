import assert from "node:assert/strict";
import test from "node:test";
import { pressRegions, projectPressCatalog, pressEntriesForRegion, pressOfferMatches, pressEditionStatus, pressValidity, pressMarketMatches, validatePressPicks, type PressEdition, type PressOffer } from "../lib/press-catalog";
const offer: PressOffer = { id: "page", group: "Impreso", name: "Página completa", specs: "27 x 21 cm", market: "ECU · Quito + Guayaquil + Cuenca", marketOptions: [["quito", "guayaquil", "cuenca"]], target: "Sin segmentar", unit: "inserción", priceUsd: 200, duration: "", notes: "" };
const edition: PressEdition = { id: "edition", label: "Tarifario de prueba", period: "Edición 2026", validFrom: null, validTo: null, taxIncluded: false, conditions: [], offers: [offer] };
const rows = [{ id: "press-example", name: "Diario de prueba", region_keys: ["national", "guayas"], city: "Guayaquil", editions: [edition], logo_path: "/providers/press/example.png" }, { id: "press-local", name: "Cabecera local", region_keys: ["azuay"], editions: [] }];
const catalog = { entries: projectPressCatalog(rows) };
test("Prensa offers Nationals first and all 24 canonical provinces without inventing national coverage", () => {
  assert.equal(pressRegions.length, 25);
  assert.equal(pressRegions[0].key, "national");
  assert.deepEqual(pressRegions.slice(1).map(x => x.label), pressRegions.slice(1).map(x => x.label).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })));
  assert.deepEqual(pressEntriesForRegion(catalog, "national").map(x => x.id), ["press-example"]);
  assert.deepEqual(pressEntriesForRegion(catalog, "azuay").map(x => x.id), ["press-local"]);
  assert.deepEqual(pressEntriesForRegion(catalog, "invalid"), []);
  assert.equal(pressOfferMatches(offer, "pagina 27"), true);
});
test("ECU and alternative-city columns retain their exact territorial meaning", () => {
  assert.equal(pressMarketMatches(offer, ["Todo Ecuador"]), false);
  assert.equal(pressMarketMatches(offer, ["Guayaquil"]), false);
  assert.equal(pressMarketMatches(offer, ["Cuenca", "Quito", "Guayaquil"]), true);
  const alternative = { ...offer, market: "Quito o Guayaquil", marketOptions: [["quito"], ["guayaquil"]] };
  assert.equal(pressMarketMatches(alternative, ["Guayaquil"]), true);
  assert.equal(pressMarketMatches(alternative, ["Quito", "Guayaquil"]), false);
});
test("a year-only tariff is a reference, never an automatically current quote", () => {
  assert.equal(pressEditionStatus(edition, "2026-10-31"), "Vigencia no declarada");
  assert.equal(pressValidity(edition, "2026-10-01", "2026-10-31"), false);
  const dated = { ...edition, validFrom: "2026-10-01", validTo: "2026-10-31" };
  assert.equal(pressValidity(dated, "2026-10-01", "2026-11-01"), false);
  assert.equal(pressValidity(dated, "2026-10-02", "2026-10-30"), true);
  assert.equal(pressEditionStatus(dated, "2026-11-01"), "Vencida");
});
test("saving resolves press identity and price from the source instead of trusting the browser", () => {
  const selection = [{ outletId: "press-example", editionId: "edition", offerId: "page", quantity: 2, name: "Forged", format: "Forged", unitPrice: 99999, referencePriceUsd: 99999 }];
  const result = validatePressPicks(catalog, selection, { startDate: "2026-10-01", endDate: "2026-10-31", geographies: ["Quito", "Guayaquil", "Cuenca"] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.picks[0].name, "Diario de prueba");
  assert.equal(result.picks[0].format, "Página completa");
  assert.equal(result.picks[0].unitPrice, null);
  assert.equal(result.picks[0].referencePriceUsd, 200);
  const mismatch = validatePressPicks(catalog, selection, { geographies: ["Todo Ecuador"] });
  assert.equal(mismatch.ok && mismatch.picks[0].referencePriceUsd, null);
  assert.equal(validatePressPicks(catalog, [{ ...selection[0], quantity: -1 }], { geographies: [] }).ok, false);
  assert.equal(validatePressPicks({ ...catalog, error: "blocked" }, selection, { geographies: [] }).ok, false);
});
test("press projections discard raw sources, unsafe URLs and malformed editions; legacy requests keep no old prices", () => {
  const [entry] = projectPressCatalog([{ ...rows[0], website: "javascript:alert(1)", logo_path: "https://other.example/logo.png", source_path: "/private/source.pdf", editions: [{ ...edition, validFrom: "2026-02-31" }] }]);
  assert.equal(entry.logoPath, null);
  assert.equal(entry.website, null);
  assert.deepEqual(entry.editions, []);
  assert.equal(JSON.stringify(entry).includes("private"), false);
  const result = validatePressPicks(catalog, [{ slug: "example-Página completa-0", name: "Forged", format: "Página completa", quantity: 1, unitPrice: 999 }], { geographies: ["Guayaquil"] });
  assert.equal(result.ok && result.picks[0].unitPrice, null);
});
