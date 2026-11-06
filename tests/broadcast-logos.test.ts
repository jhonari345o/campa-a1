import assert from "node:assert/strict";
import test from "node:test";
import {broadcastLogo} from "../lib/broadcast-logos";
test("Centro keeps its verified city identity, rather than reusing Guayaquil's logo for another station",()=>{
 assert.equal(broadcastLogo("Radio Centro 101.3 FM","radio","Guayas"),"/providers/radio/radio-centro/logo.png");
 assert.equal(broadcastLogo("Radio Centro Quito 97.7 FM","radio","Pichincha"),"/providers/radio/radio-centro-quito/logo.webp");
 assert.equal(broadcastLogo("Radio Centro","radio","Tungurahua"),null);
 assert.equal(broadcastLogo("Radio Centro","radio"),null);
});
