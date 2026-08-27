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
import { buildPlanAnalysis, type PlanAnalysisInput } from "../lib/plan-analysis";
import { buildDetailedMediaRecommendation } from "../lib/detailed-plan";
import { buildCampaigns } from "../lib/campaigns";
import {
  BUSINESS_CATEGORY_OPTIONS,
  COMMERCIAL_GOAL_UNIT_OPTIONS,
  COMMERCIAL_KPI_OPTIONS,
  CONVERSION_EVENT_OPTIONS,
  ECUADOR_PROVINCE_OPTIONS,
  PRODUCT_SEASON_OPTIONS,
  WOW_FORMAT_OPTIONS,
  WOW_SURFACE_OPTIONS,
} from "../lib/form-catalogs";

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

test("los campos categóricos usan catálogos cerrados, completos y sin duplicados", () => {
  const catalogs = [
    BUSINESS_CATEGORY_OPTIONS,
    COMMERCIAL_GOAL_UNIT_OPTIONS,
    COMMERCIAL_KPI_OPTIONS,
    CONVERSION_EVENT_OPTIONS,
    ECUADOR_PROVINCE_OPTIONS,
    PRODUCT_SEASON_OPTIONS,
    WOW_FORMAT_OPTIONS,
    WOW_SURFACE_OPTIONS,
  ];
  for (const catalog of catalogs) {
    assert.ok(catalog.length > 0);
    assert.equal(new Set(catalog.map((option) => option.value)).size, catalog.length);
    assert.ok(catalog.every((option) => option.value.trim() && option.label.trim()));
  }
  assert.equal(ECUADOR_PROVINCE_OPTIONS.length, 24);
  assert.ok(BUSINESS_CATEGORY_OPTIONS.some((option) => option.value.includes("Restaurantes")));
});

test("Mavi consulta Internet para actualidad y recomendaciones de medios", () => {
  assert.equal(shouldUseLiveTrends("¿Qué tendencias hay hoy en Ecuador?"), true);
  assert.equal(shouldUseLiveTrends("Tengo una cafetería, ¿en qué medios invierto este trimestre?"), true);
  assert.equal(shouldUseLiveTrends("Recomiéndame canales según mi presupuesto y audiencia"), true);
  assert.equal(shouldUseLiveTrends("Hazme un guion de radio"), false);
});

test("las campañas son únicas por plataforma y exponen una calificación estratégica", () => {
  const plan = {
    matched: 4,
    totalRef: 10_000,
    basis: "sector" as const,
    benchmark: [],
    profileLabel: "Gastronomía",
    strategySummary: "Prueba",
    plan: [
      { label: "Meta — Facebook e Instagram", pct: 0.5, amount: 500 },
      { label: "Google — Búsqueda y YouTube", pct: 0.5, amount: 500 },
    ],
  };
  const campaigns = buildCampaigns({
    keyword: "Restaurantes, alimentos y bebidas",
    audience: "Profesionales de 25 a 45 años",
    objective: "Ventas",
    geography: "Guayaquil · 20 km alrededor",
    brand: "Marca prueba",
  }, plan);
  assert.deepEqual(campaigns.map((campaign) => campaign.key), ["meta", "google"]);
  assert.ok(campaigns.every((campaign) => campaign.ideas.length === 1));
  assert.equal(new Set(campaigns.map((campaign) => campaign.copy)).size, campaigns.length);
  assert.ok(campaigns.every((campaign) => campaign.insight.total >= 0 && campaign.insight.total <= 100));
  assert.ok(campaigns.every((campaign) => campaign.insight.basis === "datos"));
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

test("el análisis conserva KPI por medio y separa Idea WOW del presupuesto", async () => {
  const input: PlanAnalysisInput = {
    keyword: "retail", objective: "Ventas", priority: "Maximizar alcance único", audienceType: "B2C",
    audience: "Compradores frecuentes", ageRange: "Personas 18+", sex: "Todas las personas",
    socioeconomic: "Todos los NSE", geography: "Guayaquil · 60 km alrededor", budgetUsd: 10_000,
    selectedMedia: ["television", "digital"], businessDescription: "Cadena de tiendas", businessModel: "Retail",
    conversionModel: "Checkout online", commercialGoalAmount: "500", averageTicket: "85", grossMargin: "30",
    operationalCapacity: "Alta", commercialKpi: "Ventas", valueProposition: "Disponibilidad inmediata",
    competitors: "Marca A", restrictions: "Claims verificables", learnings: "Video rindió mejor", products: [],
    digitalObjective: "Ventas", conversionEvent: "Compra", digitalPlatforms: ["Meta"], digitalDestination: "https://example.com",
    trackingStatus: "Implementado parcialmente", adAccountsStatus: "Existen, falta acceso", measurementStack: ["GA4"],
    firstPartyData: "CRM", qualifiedLead: "", attributionModel: "Data-driven", consentStatus: "Requiere revisión",
    managementNeed: "Ad Mavericks implementa y optimiza", wowEnabled: true, wowIdea: "Mapping de fachada", wowBudget: "2000",
    wowMunicipality: "Guayaquil", wowExactLocation: "Centro", wowFormat: "Mapping", wowSurface: "Fachada",
    wowOwnership: "Autorización en gestión", wowMeasurements: "20 x 10 m",
  };
  const plan = {
    matched: 4, totalRef: 50_000, basis: "sector" as const, benchmark: [], profileLabel: "Retail y comercio",
    strategySummary: "Mix verificable", plan: [
      { label: "Televisión", pct: 0.6, amount: 6000, rationale: "Alcance audiovisual" },
      { label: "Meta — Facebook e Instagram", pct: 0.4, amount: 4000, rationale: "Conversión medible" },
    ],
  };
  const analysis = buildPlanAnalysis(input, plan);

  assert.equal(analysis.signals.find((signal) => signal.kind === "television")?.planningKpi, "Alcance 1+ y frecuencia");
  assert.equal(analysis.signals.find((signal) => signal.kind === "digital")?.status, "requiere_preparacion");
  assert.equal(analysis.wowCase?.budget, "2000");
  assert.equal(plan.plan.reduce((sum, row) => sum + Number(row.amount), 0), 10_000);

  delete process.env.AI_ASSISTANT_ENABLED;
  const detail = await buildDetailedMediaRecommendation(input, plan);
  const television = detail.channelPlans.find((channel) => channel.kind === "television");
  assert.equal(television?.executions.length, 3);
  assert.equal(new Set(television?.executions.map((item) => item.provider)).size, 3);
  assert.equal(television?.executions.reduce((sum, item) => sum + Number(item.budgetUsd), 0), 6000);
  assert.ok(television?.executions.every((item) => item.product && item.referenceUnitPriceUsd));
  assert.equal(detail.channelPlans.find((channel) => channel.kind === "digital")?.executions[0].status, "validacion");
});
