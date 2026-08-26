import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  isAgentAutomationEnabled,
  isAiAssistantEnabled,
  isAiWebTrendsEnabled,
  isCommercialPaymentsEnabled,
  isMetaPausedDraftsEnabled,
  isMetaRealSpendEnabled,
} from "../lib/commercial";
import { canCompanyRole } from "../lib/permissions";
import { filterPlanByMedia, mediaGroupForLabel, strategicProfileFor } from "../lib/planner";
import { shouldUseLiveTrends } from "../lib/assistant/trends";
import {
  DIGITAL_PLATFORMS,
  INFLUENCER_IMAGE_SLUGS,
  OOH_PROVIDERS,
  PRESS_OUTLETS,
  TV_CHANNELS,
} from "../lib/media-catalog";
import { TV_RATE_CATALOGS } from "../lib/tv-rate-catalog";
import { verifyDlocalNotificationSignature } from "../lib/payments/dlocal-signature";
import { computeCharge } from "../lib/pricing";

test("las operaciones economicas permanecen deshabilitadas por defecto", () => {
  delete process.env.COMMERCIAL_PAYMENTS_ENABLED;
  delete process.env.META_PAUSED_DRAFTS_ENABLED;
  delete process.env.META_REAL_SPEND_ENABLED;
  delete process.env.AGENT_AUTOMATION_ENABLED;
  delete process.env.AI_ASSISTANT_ENABLED;
  delete process.env.AI_WEB_TRENDS_ENABLED;

  assert.equal(isCommercialPaymentsEnabled(), false);
  assert.equal(isMetaPausedDraftsEnabled(), false);
  assert.equal(isMetaRealSpendEnabled(), false);
  assert.equal(isAgentAutomationEnabled(), false);
  assert.equal(isAiAssistantEnabled(), false);
  assert.equal(isAiWebTrendsEnabled(), false);
});

test("el cobro separa inversión, 22% y 25% sin reducir el presupuesto Meta", () => {
  const charge = computeCharge(200);
  assert.deepEqual(charge, {
    base: 200,
    taxPct: 0.22,
    tax: 44,
    feePct: 0.25,
    fee: 50,
    total: 294,
  });
});

test("el webhook dLocal Go exige la firma HMAC del cuerpo crudo", () => {
  const apiKey = "test-api-key";
  const secretKey = "test-secret-key";
  const rawBody = '{"payment_id":"DP-123"}';
  const signature = createHmac("sha256", secretKey)
    .update(`${apiKey}${rawBody}`, "utf8")
    .digest("hex");
  const header = `V2-HMAC-SHA256, Signature: ${signature}`;

  assert.equal(verifyDlocalNotificationSignature(rawBody, header, apiKey, secretKey), true);
  assert.equal(verifyDlocalNotificationSignature(`${rawBody} `, header, apiKey, secretKey), false);
  assert.equal(verifyDlocalNotificationSignature(rawBody, "V2-HMAC-SHA256, Signature: 00", apiKey, secretKey), false);
});

test("solo el valor true explicito habilita un interruptor", () => {
  process.env.COMMERCIAL_PAYMENTS_ENABLED = "TRUE";
  assert.equal(isCommercialPaymentsEnabled(), true);
  process.env.COMMERCIAL_PAYMENTS_ENABLED = "1";
  assert.equal(isCommercialPaymentsEnabled(), false);
  delete process.env.COMMERCIAL_PAYMENTS_ENABLED;
});

test("un lector no puede crear ni aprobar campanas", () => {
  assert.equal(canCompanyRole("viewer", "campaign:create"), false);
  assert.equal(canCompanyRole("viewer", "campaign:approve"), false);
  assert.equal(canCompanyRole("planner", "campaign:create"), true);
  assert.equal(canCompanyRole("approver", "campaign:approve"), true);
});

test("el plan respeta los medios seleccionados y conserva el presupuesto", () => {
  const rows = [
    { label: "TV abierta", pct: 0.4, amount: 400 },
    { label: "Radio", pct: 0.2, amount: 200 },
    { label: "Meta — Facebook e Instagram", pct: 0.4, amount: 400 },
  ];
  const filtered = filterPlanByMedia(rows, ["television", "digital"], 1000);

  assert.deepEqual(filtered.map((row) => mediaGroupForLabel(row.label)), ["television", "digital"]);
  assert.equal(Math.round(filtered.reduce((sum, row) => sum + row.pct, 0) * 100), 100);
  assert.equal(filtered.reduce((sum, row) => sum + Number(row.amount), 0), 1000);
});

test("el perfil estratégico cambia según el giro y reconoce plataformas digitales", () => {
  assert.equal(strategicProfileFor("cafetería artesanal").id, "gastronomia");
  assert.equal(strategicProfileFor("software contable", "B2B").id, "b2b");
  assert.equal(strategicProfileFor("farmacia barrial").id, "salud");
  assert.equal(mediaGroupForLabel("Spotify Ads"), "digital");
  assert.equal(mediaGroupForLabel("LinkedIn Ads"), "digital");
});

test("Mavi consulta Internet solo cuando la pregunta pide actualidad", () => {
  assert.equal(shouldUseLiveTrends("¿Qué tendencias hay hoy en Ecuador?"), true);
  assert.equal(shouldUseLiveTrends("Hazme un guion de radio"), false);
});

test("los recursos visuales del catálogo existen en el paquete público", () => {
  const catalogItems = [...DIGITAL_PLATFORMS, ...TV_CHANNELS, ...OOH_PROVIDERS, ...PRESS_OUTLETS];
  for (const item of catalogItems.filter((entry) => entry.imagePath)) {
    assert.equal(
      existsSync(resolve("public", item.imagePath!.replace(/^\//, ""))),
      true,
      `Falta la imagen de ${item.name}`,
    );
  }

  assert.equal(INFLUENCER_IMAGE_SLUGS.size, 30);
  for (const slug of INFLUENCER_IMAGE_SLUGS) {
    assert.equal(existsSync(resolve("public/providers/influencers", `${slug}.webp`)), true);
  }
  assert.equal(existsSync(resolve("public/providers/radio/los40/logo.png")), true);
});

test("el catálogo de televisión conserva programas, horarios y tarifas auditadas", () => {
  assert.equal(TV_RATE_CATALOGS.ecuavisa.offers.length, 45);
  assert.equal(TV_RATE_CATALOGS["red-comercial"].offers.length, 18);
  assert.equal(TV_RATE_CATALOGS.teleamazonas.offers.length, 47);
  assert.equal(TV_RATE_CATALOGS["tc-television"].offers.length, 61);
  assert.equal(TV_RATE_CATALOGS["catomedia-ucsg"].offers.length, 15);

  const ecuavisaDestiny = TV_RATE_CATALOGS.ecuavisa.offers.find(
    (offer) => offer.title === "Destiny" && offer.market === "Guayaquil",
  );
  assert.equal(ecuavisaDestiny?.priceUsd, 4212);
  assert.equal(ecuavisaDestiny?.unit, "spot 30 s");
});
