import assert from "node:assert/strict";
import test from "node:test";
import { projectRadioDirectory, radioDirectoryMatches, radioEntriesForRegion, radioRegions } from "../lib/radio-directory";

const directory = projectRadioDirectory([
  { id: "national-example", name: "Cadena nacional de prueba", region_keys: ["national"], dial: null, rating: 99, price: 800, source: "private" },
  { id: "guayas-example", name: "Radio del Puerto", region_keys: ["guayas"], city: "Guayaquil", dial: "99.9 FM", genres: ["Música"], logo_path: "/providers/radio/los40/logo.png" },
  { id: "regional-example", name: "Regional de prueba", region_keys: ["cotopaxi", "tungurahua"], city: "Ambato" },
  { id: "azuay-example", name: "Radio Cuenca", region_keys: ["azuay"], city: "Cuenca" },
]);
test("Nacionales is first and the 24 canonical provinces follow in Spanish alphabetical order", () => {
  assert.equal(radioRegions.length, 25);
  assert.deepEqual(radioRegions[0], { key: "national", label: "Nacionales" });
  assert.equal(new Set(radioRegions.map(region => region.key)).size, 25);
  const labels = radioRegions.slice(1).map(region => region.label);
  assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })));
  assert.ok(labels.indexOf("Cañar") < labels.indexOf("Carchi"));
});
test("territorial selection uses only declared scopes and does not make regional stations national", () => {
  assert.deepEqual(radioEntriesForRegion(directory, "national").map(row => row.id), ["national-example"]);
  assert.deepEqual(radioEntriesForRegion(directory, "guayas").map(row => row.id), ["guayas-example"]);
  assert.deepEqual(radioEntriesForRegion(directory, "cotopaxi").map(row => row.id), ["regional-example"]);
  assert.deepEqual(radioEntriesForRegion(directory, "tungurahua").map(row => row.id), ["regional-example"]);
  assert.deepEqual(radioEntriesForRegion(directory, "unknown"), []);
  assert.deepEqual(radioEntriesForRegion(directory, "galapagos"), []);
});
test("station search handles accents, city and dial without changing the region", () => {
  const rows = radioEntriesForRegion(directory, "guayas");
  assert.equal(rows.filter(row => radioDirectoryMatches(row, "musica guayaquil")).length, 1);
  assert.equal(rows.filter(row => radioDirectoryMatches(row, "99.9")).length, 1);
  assert.equal(rows.filter(row => radioDirectoryMatches(row, "Cuenca")).length, 0);
});
test("the directory projection excludes source metrics and unsafe records or image paths", () => {
  assert.equal(JSON.stringify(directory).includes("private"), false);
  assert.equal("rating" in directory[0], false);
  assert.equal("price" in directory[0], false);
  assert.equal(directory[0].dial, null);
  assert.deepEqual(projectRadioDirectory([{ id: "invalid", name: "Unknown", region_keys: ["unregistered"] }]), []);
  const [row] = projectRadioDirectory([{ id: "safe", name: "Safe", region_keys: ["guayas", "unknown"], logo_path: "https://other.example/logo.png" }]);
  assert.deepEqual(row.regionKeys, ["guayas"]);
  assert.equal(row.logoPath, null);
  assert.equal(projectRadioDirectory([{ id: "bad/id", name: "Bad", region_keys: ["guayas"] }]).length, 0);
});
