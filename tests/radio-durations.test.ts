import test from "node:test";
import assert from "node:assert/strict";
import { radioSpotDurations } from "../lib/radio-durations";
import type { RadioTariff } from "../lib/radio-station";

const tariff = (rates: RadioTariff["rates"]): RadioTariff => ({ id: "synthetic", label: "Tarifa sintética", edition: "2026", market: "Plaza de prueba", target: "General", validFrom: "2026-01-01", validTo: "2026-12-31", taxIncluded: false, unit: "spot", conditions: "", rates });
test("a spot gets both default durations in cents without replacing separately negotiated rates", () => {
  assert.deepEqual(radioSpotDurations(tariff([{ label: "Rotativo", seconds: 30, amountUsd: 11.13 }]), 0), [{ seconds: 20, amountUsd: 7.42, proportionalFrom: 30 }, { seconds: 30, amountUsd: 11.13 }]);
  const explicit = tariff([{ label: "Rotativo · 20 s", seconds: 20, amountUsd: 8.03 }, { label: "Rotativo · 30 s", seconds: 30, amountUsd: 10.01 }]);
  assert.deepEqual(radioSpotDurations(explicit, 0), [{ seconds: 20, amountUsd: 8.03 }]);
  assert.deepEqual(radioSpotDurations(explicit, 1), [{ seconds: 30, amountUsd: 10.01 }]);
});
test("duration conversion does not borrow a program price or convert a mention or package into a spot", () => {
  const source = tariff([{ label: "Noticiero", seconds: 20, amountUsd: 8.03 }, { label: "Rotativo", seconds: 30, amountUsd: 10.01 }, { label: "Mención en vivo", seconds: 20, amountUsd: 9.01 }, { label: "Paquete de cuñas", seconds: 30, amountUsd: 200 }]);
  assert.equal(radioSpotDurations(source, 0).find(row => row.seconds === 30)?.amountUsd, 12.05);
  assert.deepEqual(radioSpotDurations(source, 2), [{ seconds: 20, amountUsd: 9.01 }]);
  assert.deepEqual(radioSpotDurations(source, 3), [{ seconds: 30, amountUsd: 200 }]);
});
