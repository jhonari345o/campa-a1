import test from "node:test";
import assert from "node:assert/strict";
import { personalGreeting } from "../lib/personal-greeting";

test("the greeting follows the connected person's name within the same workspace", () => {
  assert.equal(personalGreeting("Johnny Demo", "Léttera"), "Hola, Johnny.");
  assert.equal(personalGreeting("Stella Demo", "Léttera"), "Hola, Stella.");
  assert.equal(personalGreeting("  Belén   Demo ", "UCSG"), "Hola, Belén.");
});
test("a workspace, shared mailbox or preview is not presented as a person's name", () => {
  for (const name of ["Léttera", "Léttera Medios", "Equipo Léttera", "medios@example.test", "Vista previa", "", null]) assert.equal(personalGreeting(name, "Léttera"), "Hola.");
  assert.equal(personalGreeting("UCSG", "UCSG"), "Hola.");
  assert.equal(personalGreeting("Ad Mavericks"), "Hola.");
});
