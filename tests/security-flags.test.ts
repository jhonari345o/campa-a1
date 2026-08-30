import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
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
import { buildPlanningScenarios } from "../lib/plan-optimizer";
import { detectAssistantAction } from "../lib/assistant/actions";
import { creativePreflight } from "../lib/creative-preflight";
import { buildCampaignTwin } from "../lib/campaign-twin";
import { directCampaign } from "../lib/campaign-director";
import { reviewCreativeAsset } from "../lib/creative-lab";
import { BILLING_EMAIL, LEGAL_VERSIONS } from "../lib/legal";
import { parseMp4Metadata } from "../lib/local-media";
import { buildReportNarrative } from "../lib/report-narrative";
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

test("Amplify entrega OpenRouter al servidor sin incorporar credenciales AWS estáticas", () => {
  const buildSpec = readFileSync(resolve("amplify.yml"), "utf8");
  assert.match(buildSpec, /AI_PROVIDER\|OPENROUTER_API_KEY\|OPENROUTER_MODEL/);
  assert.doesNotMatch(buildSpec, /BEDROCK_ACCESS_KEY_ID|BEDROCK_SECRET_ACCESS_KEY/);
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

test("los escenarios comparables conservan exactamente presupuesto y 100%", () => {
  const scenarios = buildPlanningScenarios({
    budgetUsd: 12_345,
    selectedMedia: ["television", "radio", "ooh", "digital"],
    objective: "Ventas",
    priority: "Eficiencia",
    audienceType: "B2C",
    geographyCount: 3,
    digitalReady: true,
  });
  assert.equal(scenarios.length, 3);
  for (const scenario of scenarios) {
    assert.equal(scenario.allocations.reduce((sum, item) => sum + item.amountUsd, 0), 12_345);
    assert.ok(Math.abs(scenario.allocations.reduce((sum, item) => sum + item.pct, 0) - 1) < 0.0001);
  }
});

test("Mavi convierte una solicitud natural de pauta en datos accionables", () => {
  assert.deepEqual(
    detectAssistantAction("Mavi, pauta este reel de Instagram por $500 para mensajes https://www.instagram.com/reel/ABC123/"),
    { kind: "prepare_campaign", network: "instagram", budget: 500, objective: "Mensajes", postUrl: "https://www.instagram.com/reel/ABC123/" },
  );
  assert.equal(detectAssistantAction("Explícame la televisión abierta"), null);
});

test("el preflight creativo bloquea una URL de la plataforma equivocada", () => {
  const blocked = creativePreflight({ postUrl: "https://www.youtube.com/watch?v=123", platform: "instagram" });
  const accepted = creativePreflight({ postUrl: "https://www.instagram.com/reel/ABC123/", platform: "instagram", trackingReady: true });
  assert.equal(blocked.status, "blocked");
  assert.ok(blocked.checks.some((check) => check.id === "platform" && check.status === "fail"));
  assert.notEqual(accepted.status, "blocked");
});

test("el gemelo digital conserva presupuesto y marca concentración", () => {
  const twin = buildCampaignTwin({ budgetUsd: 10_000, allocations: [{ kind: "digital", pct: .75, amountUsd: 7500 }, { kind: "ooh", pct: .25, amountUsd: 2500 }], geographies: ["Guayaquil", "Quito"], digitalReady: true });
  assert.equal(twin.media.reduce((sum, item) => sum + item.amountUsd, 0), 10_000);
  assert.equal(twin.geographies.reduce((sum, item) => sum + item.amountUsd, 0), 10_000);
  assert.equal(twin.media.find((item) => item.kind === "digital")?.risk, "saturado");
  assert.ok(twin.modeledImpressions.high > twin.modeledImpressions.low);
});

test("Mavi Directora advierte cobertura amplia y conversión sin tracking", () => {
  const creative = creativePreflight({ postUrl: "https://www.instagram.com/reel/ABC123/", platform: "instagram" });
  const director = directCampaign({ platform: "instagram", budgetUsd: 150, targetScope: "country", radiusKm: null, objective: "Ventas", trackingReady: false, creative });
  assert.equal(director.status, "warning");
  assert.ok(director.findings.some((item) => item.label === "Cobertura"));
  assert.ok(director.findings.some((item) => item.label === "Medición"));
});

test("el laboratorio bloquea derechos sin confirmar y evalúa formato vertical", () => {
  const review = reviewCreativeAsset({ placement: "meta_reels", mimeType: "video/mp4", sizeBytes: 4_000_000, width: 1080, height: 1920, durationSeconds: 22, hasRights: false, hasSound: true, hasCaptions: true, cta: "Comprar" });
  assert.equal(review.status, "blocked");
  assert.ok(review.checks.some((item) => item.label === "Formato vertical" && item.status === "pass"));
  const lab = readFileSync(resolve("app/laboratorio/CreativeLab.tsx"), "utf8");
  assert.match(lab, /localAnalysisConsent/);
  assert.match(lab, /URL\.createObjectURL\(file\)/);
  assert.match(lab, /El archivo original no se enviará ni se almacenará/);
  assert.match(lab, /parseMp4Metadata/);
});

test("el analizador local obtiene metadatos MP4 aunque el navegador no decodifique el codec", () => {
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(1000, 12);
  mvhd.writeUInt32BE(15000, 16);
  const tkhd = Buffer.alloc(84);
  tkhd.writeUInt32BE(1080 * 65_536, 76);
  tkhd.writeUInt32BE(1920 * 65_536, 80);
  const hdlr = Buffer.alloc(12);
  hdlr.write("vide", 8, "ascii");
  const moov = mp4Box("moov", Buffer.concat([
    mp4Box("mvhd", mvhd),
    mp4Box("trak", Buffer.concat([mp4Box("tkhd", tkhd), mp4Box("mdia", mp4Box("hdlr", hdlr))])),
  ]));
  const buffer = moov.buffer.slice(moov.byteOffset, moov.byteOffset + moov.byteLength) as ArrayBuffer;
  assert.deepEqual(parseMp4Metadata(buffer), { width: 1080, height: 1920, durationSeconds: 15 });
});

function mp4Box(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length + 8, 0);
  header.write(type, 4, "ascii");
  return Buffer.concat([header, payload]);
}

test("el reporte narrado usa únicamente métricas observadas", () => {
  const narrative = buildReportNarrative({ orderCount: 1, jobs: [{ platform: "meta", status: "publicada", spec: { presupuesto_usd: 500, metrics: { impresiones: 10_000, clics: 250, gasto_usd: 300 } } }, { platform: "google", status: "publicada", spec: { presupuesto_usd: 400, metrics: { impresiones: 8_000, clics: 80, gasto_usd: 200 } } }] });
  assert.match(narrative.headline, /Meta/);
  assert.match(narrative.summary, /2\.50%/);
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

test("Laboratorio y el centro de procesos Mavi permanecen visibles en la navegación", () => {
  const header = readFileSync(resolve("components/AppHeader.tsx"), "utf8");
  const assistant = readFileSync(resolve("components/MaviFloatingAssistant.tsx"), "utf8");
  const route = readFileSync(resolve("app/api/asistente/route.ts"), "utf8");
  const llm = readFileSync(resolve("lib/assistant/llm.ts"), "utf8");
  assert.match(header, /label: "Laboratorio creativo"/);
  assert.match(header, /label: "Centro Mavi"/);
  assert.match(assistant, /Todos tus procesos aquí/);
  assert.match(assistant, /Crear plan guiado/);
  assert.match(assistant, /Revisar creatividad/);
  assert.match(assistant, /Preparar pauta/);
  assert.match(assistant, /response\.text\(\)/);
  assert.match(route, /Promise\.all/);
  assert.match(route, /CONTEXT_TIMEOUT_MS = 5_000/);
  assert.match(route, /TRENDS_TIMEOUT_MS = 6_000/);
  assert.match(route, /maxTokens: 512/);
  assert.match(llm, /LLM_REQUEST_TIMEOUT_MS/);
  assert.match(llm, /PROVIDER_TIMEOUT/);
  assert.match(llm, /minimax\/minimax-m3:free/);
});

test("el consentimiento y checkout conservan versiones legales auditables", () => {
  assert.match(LEGAL_VERSIONS.terms, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(LEGAL_VERSIONS.privacy, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(LEGAL_VERSIONS.treatment, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(BILLING_EMAIL, "direccion@adsmaverick.me");
  assert.equal(LEGAL_VERSIONS.privacy, "2026-08-30");
  assert.equal(LEGAL_VERSIONS.treatment, "2026-08-30");
  const privacy = readFileSync(resolve("app/privacidad/page.tsx"), "utf8");
  assert.match(privacy, /Laboratorio creativo y análisis local/);
  assert.match(privacy, /no carga el archivo original en AWS, Supabase, OpenRouter ni Mavi/);
  const migration = readFileSync(resolve("supabase/migrations/0014_legal_acceptances.sql"), "utf8");
  assert.match(migration, /benchmark_contribution boolean not null default false/);
  assert.match(migration, /revoked_at timestamptz/);
});

test("las cabeceras permiten mapas y geolocalización propia sin abrir permisos generales", () => {
  const config = readFileSync(resolve("next.config.mjs"), "utf8");
  assert.match(config, /frame-src 'self' https:\/\/www\.openstreetmap\.org/);
  assert.match(config, /geolocation=\(self\)/);
  assert.match(config, /"\/laboratorio"/);
});

test("la consola de credenciales es local, enmascara valores y conserva bloqueos financieros", () => {
  const server = readFileSync(resolve("admin-console/server.mjs"), "utf8");
  const page = readFileSync(resolve("admin-console/public/index.html"), "utf8");
  assert.match(server, /server\.listen\(config\.port, "127\.0\.0\.1"/);
  assert.match(server, /AMPLIFY_SAFE_VALUES/);
  assert.match(server, /API Key de inferencia/);
  assert.match(server, /StartJobCommand/);
  assert.doesNotMatch(server, /COMMERCIAL_PAYMENTS_ENABLED:\s*"true"/);
  assert.doesNotMatch(server, /META_REAL_SPEND_ENABLED:\s*"true"/);
  assert.match(page, /data-credential-group="openrouter"/);
  assert.match(page, /name="DLOCALGO_SECRET_KEY" type="password"/);
  assert.match(page, /name="META_ACCESS_TOKEN" type="password"/);
});
