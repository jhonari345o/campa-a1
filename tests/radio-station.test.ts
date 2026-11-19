import assert from "node:assert/strict";
import test from "node:test";
import { projectRadioProfile, radioStationRankings, radioTariffStatus, type RadioTariff } from "../lib/radio-station";
import type { BroadcastCatalog, BroadcastSource } from "../lib/broadcast-catalog";
const tariff: RadioTariff = { id: "sample", label: "Tarifario", edition: "Marzo 2026", market: "Provincia de prueba", target: "Sin segmentar", validFrom: null, validTo: null, unit: "second", taxIncluded: false, conditions: "", rates: [{ label: "Rotativo", amountUsd: .4, seconds: null }] };
const source: BroadcastSource = { id: "cohort", kind: "radio", label: "Ranking", provider: "Estudio", periodStart: "2026-08-01", periodEnd: "2026-08-31", market: "Quito + Guayaquil (consolidado)", marketKeys: ["quito", "guayaquil"], target: "Mujeres 18–99", ageMin: 18, ageMax: 99, sex: "female", nse: "all", frequency: "FM", daypart: "Lunes a viernes · 06:00–20:00", annualContract: false, conditions: "", spotSeconds: null, minimumSeconds: null, taxIncluded: null };
const row = { id: "measurement", sourceId: "cohort", name: "EMISORA", genre: "Música", rating: 1.2, share: 4.5, audience: 23000, rank: 5 };
const link = { sourceId: "cohort", stationName: "EMISORA", marketKeys: ["guayaquil", "quito"], frequency: "FM" };
test("tariffs without declared validity remain references even when their edition is recent", () => {
  assert.equal(radioTariffStatus(tariff, "2026-03-15"), "Vigencia no declarada");
  const dated = { ...tariff, validFrom: "2026-03-01", validTo: "2026-03-31" };
  assert.equal(radioTariffStatus(dated, "2026-03-31"), "Vigente");
  assert.equal(radioTariffStatus(dated, "2026-04-01"), "Vencida");
  assert.equal(radioTariffStatus(dated, "2026-02-28"), "Próxima vigencia");
  assert.equal(radioTariffStatus(dated, "2026-02-31"), "Vigencia no declarada");
});
test("profiles preserve declared rates and units, exclude missing prices and private metadata", () => {
  const profile = projectRadioProfile({ website: "javascript:alert(1)", rawPath: "/private/source.pdf", email: "internal@example.com", tariffs: [{ ...tariff, rawDocument: "private", rates: [...tariff.rates, { label: "No declarado", amountUsd: null }, { label: "Inválido", amountUsd: -10 }] }] });
  assert.equal(profile.website, null);
  assert.equal(profile.tariffs.length, 1);
  assert.deepEqual(profile.tariffs[0].rates, [{ label: "Rotativo", amountUsd: .4, seconds: null }]);
  assert.equal(JSON.stringify(profile).includes("private"), false);
  assert.equal(JSON.stringify(profile).includes("internal"), false);
  assert.equal(projectRadioProfile({ tariffs: [{ ...tariff, validFrom: "2026-02-31" }] }).tariffs.length, 0);
  assert.equal(projectRadioProfile({ tariffs: [{ ...tariff, validFrom: "2026-04-01", validTo: "2026-03-31" }] }).tariffs.length, 0);
  assert.equal(projectRadioProfile({ website: "https://user:password@example.com" }).website, null);
});
test("station rankings require exact source, identity, territory and frequency", () => {
  const catalog: BroadcastCatalog = { sources: [source], radio: [row], tv: [] };
  const profile = projectRadioProfile({ rankingLinks: [link] });
  assert.equal(radioStationRankings(profile, catalog, "2026-10-31").length, 1);
  for (const badLink of [{ ...link, stationName: "EMISORA QUITO" }, { ...link, marketKeys: ["guayaquil"] }, { ...link, frequency: "AM" }, { ...link, sourceId: "other" }]) {
    assert.equal(radioStationRankings(projectRadioProfile({ rankingLinks: [badLink] }), catalog, "2026-10-31").length, 0);
  }
  assert.equal(radioStationRankings(profile, catalog, "2026-08-15").length, 0);
  assert.equal(radioStationRankings(profile, { ...catalog, radio: [row, { ...row, id: "ambiguous" }] }, "2026-10-31").length, 0);
});
test("the latest measurement is chosen within each cohort without mixing public, place or daypart", () => {
  const older = { ...source, id: "older", periodStart: "2025-11-01", periodEnd: "2025-11-30" };
  const male = { ...source, id: "male", sex: "male", target: "Hombres 18–99" };
  const quito = { ...source, id: "quito", market: "Quito", marketKeys: ["quito"] };
  const night = { ...source, id: "night", daypart: "20:00–24:00" };
  const sources = [older, source, male, quito, night];
  const catalog: BroadcastCatalog = { sources, tv: [], radio: sources.map(s => ({ ...row, id: s.id, sourceId: s.id })) };
  const profile = projectRadioProfile({ rankingLinks: sources.map(s => ({ ...link, sourceId: s.id, marketKeys: s.marketKeys })) });
  const results = radioStationRankings(profile, catalog, "2026-10-31");
  assert.equal(results.length, 4);
  assert.equal(results.some(r => r.source.id === "older"), false);
  assert.equal(results.find(r => r.source.id === "cohort")!.source.market, "Quito + Guayaquil (consolidado)");
  assert.deepEqual(new Set(results.map(r => r.row.audience)), new Set([23000]));
});
