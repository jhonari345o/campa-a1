"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { buildMediaPlan, type MediaPlan, type PlanRow } from "@/lib/planner";
import { buildCurrentCampaigns, type Campaign } from "@/lib/campaigns";
import { getMyCompanies } from "@/lib/company";
import { canCompanyRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { buildPlanAnalysis, type PlanAnalysis } from "@/lib/plan-analysis";
import {
  buildDetailedMediaRecommendation,
  type DetailedMediaRecommendation,
} from "@/lib/detailed-plan";
import { BUSINESS_CATEGORY_OPTIONS } from "@/lib/form-catalogs";

export type PlanBrief = {
  brand: string;
  keyword: string;
  objective: string;
  priority: string;
  audienceType: string;
  audience: string;
  ageRange: string;
  sex: string;
  socioeconomic: string;
  geography: string;
  startDate: string;
  endDate: string;
  budgetUsd: number | null;
  selectedMedia: string[];
  businessDescription: string;
  businessModel: string;
  conversionModel: string;
  commercialGoalType: string;
  commercialGoalAmount: string;
  commercialGoalUnit: string;
  averageTicket: string;
  grossMargin: string;
  operationalCapacity: string;
  commercialKpi: string;
  valueProposition: string;
  competitors: string;
  restrictions: string;
  learnings: string;
  productMatrixApplies: boolean;
  products: Array<{ name: string; price: string; margin: string; capacity: string; season: string; notes: string }>;
  digitalObjective: string;
  conversionEvent: string;
  digitalPlatforms: string[];
  digitalDestination: string;
  trackingStatus: string;
  adAccountsStatus: string;
  measurementStack: string[];
  firstPartyData: string;
  qualifiedLead: string;
  attributionModel: string;
  consentStatus: string;
  managementNeed: string;
  wowEnabled: boolean;
  wowIdea: string;
  wowBudget: string;
  wowMunicipality: string;
  wowExactLocation: string;
  wowFormat: string;
  wowSurface: string;
  wowOwnership: string;
  wowMeasurements: string;
};

export type PlanResult =
  | {
      ok: true;
      plan: MediaPlan;
      campaigns: Campaign[];
      analysis: PlanAnalysis;
      detail: DetailedMediaRecommendation;
      keyword: string;
      objective: string;
      audience: string;
      brief: PlanBrief;
    }
  | { ok: false; error: string };

/**
 * Genera un plan de medios para el cliente. Corre del lado del servidor:
 * consulta la data de mercado con privilegios y devuelve SOLO el plan derivado,
 * nunca la data cruda.
 */
export async function generarPlan(
  _prev: PlanResult | null,
  formData: FormData,
): Promise<PlanResult> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, error: "Debes iniciar sesion." };
  if (!profile.is_platform_admin) {
    const companies = await getMyCompanies(profile.id);
    const allowed = companies.some(
      (company) => company.status === "activa" && canCompanyRole(company.role, "plan"),
    );
    if (!allowed) return { ok: false, error: "Tu rol no permite generar planes." };
  }

  const keyword = String(formData.get("keyword") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const audience = String(formData.get("audience") ?? "").trim();
  const budgetRaw = String(formData.get("budget") ?? "").replace(/[^0-9.]/g, "");
  const budgetUsd = budgetRaw ? Number(budgetRaw) : null;

  if (!BUSINESS_CATEGORY_OPTIONS.some((option) => option.value === keyword)) {
    return { ok: false, error: "Selecciona el rubro o giro principal de tu negocio." };
  }

  const selectedMedia = formData.getAll("selectedMedia").map(String);
  if (!selectedMedia.length) {
    return { ok: false, error: "Selecciona al menos un medio para el plan." };
  }
  const brief: PlanBrief = {
    brand: String(formData.get("brand") ?? "").trim(),
    keyword,
    objective,
    priority: String(formData.get("priority") ?? "").trim(),
    audienceType: String(formData.get("audienceType") ?? "B2C"),
    audience,
    ageRange: String(formData.get("ageRange") ?? "Personas 18+"),
    sex: String(formData.get("sex") ?? "Todas las personas"),
    socioeconomic: String(formData.get("socioeconomic") ?? "Todos los NSE"),
    geography: String(formData.get("geography") ?? "").trim(),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    budgetUsd,
    selectedMedia,
    businessDescription: text(formData, "businessDescription"),
    businessModel: String(formData.get("businessModel") ?? ""),
    conversionModel: String(formData.get("conversionModel") ?? ""),
    commercialGoalType: text(formData, "commercialGoalType"),
    commercialGoalAmount: text(formData, "commercialGoalAmount"),
    commercialGoalUnit: text(formData, "commercialGoalUnit"),
    averageTicket: text(formData, "averageTicket"),
    grossMargin: text(formData, "grossMargin"),
    operationalCapacity: text(formData, "operationalCapacity"),
    commercialKpi: text(formData, "commercialKpi"),
    valueProposition: text(formData, "valueProposition"),
    competitors: text(formData, "competitors"),
    restrictions: text(formData, "restrictions"),
    learnings: text(formData, "learnings"),
    productMatrixApplies: formData.get("productMatrixApplies") === "true",
    products: readProducts(formData),
    digitalObjective: text(formData, "digitalObjective"),
    conversionEvent: text(formData, "conversionEvent"),
    digitalPlatforms: formData.getAll("digitalPlatforms").map(String),
    digitalDestination: String(formData.get("digitalDestination") ?? "").trim(),
    trackingStatus: String(formData.get("trackingStatus") ?? ""),
    adAccountsStatus: String(formData.get("adAccountsStatus") ?? ""),
    measurementStack: formData.getAll("measurementStack").map(String),
    firstPartyData: text(formData, "firstPartyData"),
    qualifiedLead: text(formData, "qualifiedLead"),
    attributionModel: text(formData, "attributionModel"),
    consentStatus: text(formData, "consentStatus"),
    managementNeed: text(formData, "managementNeed"),
    wowEnabled: formData.get("wowEnabled") === "on",
    wowIdea: text(formData, "wowIdea"),
    wowBudget: text(formData, "wowBudget"),
    wowMunicipality: text(formData, "wowMunicipality"),
    wowExactLocation: text(formData, "wowExactLocation"),
    wowFormat: text(formData, "wowFormat"),
    wowSurface: text(formData, "wowSurface"),
    wowOwnership: text(formData, "wowOwnership"),
    wowMeasurements: text(formData, "wowMeasurements"),
  };

  try {
    const plan = await buildMediaPlan({
      keyword,
      budgetUsd,
      selectedMedia,
      objective: brief.objective,
      priority: brief.priority,
      audienceType: brief.audienceType,
      geography: brief.geography,
      businessModel: brief.businessModel,
      conversionModel: brief.conversionModel,
      trackingStatus: brief.trackingStatus,
    });
    const campaigns = selectedMedia.includes("digital")
      ? await buildCurrentCampaigns({
          keyword,
          audience,
          objective,
          brand: brief.brand,
          geography: brief.geography,
          audienceType: brief.audienceType,
          ageRange: brief.ageRange,
          socioeconomic: brief.socioeconomic,
          businessModel: brief.businessModel,
          conversionModel: brief.conversionModel,
        }, plan)
      : [];
    const analysis = buildPlanAnalysis(brief, plan);
    const detail = await buildDetailedMediaRecommendation(brief, plan);
    const safePlan = profile.is_platform_admin
      ? plan
      : { ...plan, matched: 0, totalRef: 0 };
    return { ok: true, plan: safePlan, campaigns, analysis, detail, keyword, objective, audience, brief };
  } catch (err) {
    if (err instanceof Error && err.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return { ok: false, error: "El planificador aun no esta habilitado (falta la clave de servicio)." };
    }
    return { ok: false, error: "No pudimos generar el plan. Intenta de nuevo." };
  }
}

export async function guardarPlan(input: Extract<PlanResult, { ok: true }>): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, error: "Debes iniciar sesión." };

  const companies = await getMyCompanies(profile.id);
  const company = companies.find(
    (item) => item.status === "activa" && canCompanyRole(item.role, "plan"),
  );
  if (!profile.is_platform_admin && !company) {
    return { ok: false, error: "Tu rol no permite guardar planes." };
  }

  const db = await createClient();
  const name = (input.brief.brand || input.keyword || "Plan sin marca").slice(0, 120);
  const snapshot = {
    brief: input.brief,
    plan: input.plan,
    campaigns: input.campaigns,
    detail: input.detail,
  };
  const { data, error } = await db
    .from("media_plans")
    .insert({
      owner_id: profile.id,
      company_id: company?.id ?? null,
      name,
      status: "borrador",
      mode: "guiado",
      stage: "propuesta",
      version: 1,
      progress: 60,
      brief: input.brief,
      analysis: {
        ...input.analysis,
        basis: input.plan.basis,
        benchmark: input.plan.benchmark,
        strategySummary: input.plan.strategySummary,
      },
      proposal: { plan: input.plan.plan, campaigns: input.campaigns, detail: input.detail },
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "No se pudo guardar el borrador." };

  await db.from("media_plan_versions").insert({
    plan_id: data.id,
    version: 1,
    actor_id: profile.id,
    snapshot,
  });
  revalidatePath("/planificador");
  return { ok: true, id: String(data.id) };
}

export async function aprobarPlan(
  input: Extract<PlanResult, { ok: true }>,
  customizedRows: PlanRow[],
): Promise<{ ok: true; id: string; rows: PlanRow[] } | { ok: false; error: string }> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, error: "Debes iniciar sesión." };
  const companies = await getMyCompanies(profile.id);
  const approvingCompany = companies.find(
    (item) => item.status === "activa" && canCompanyRole(item.role, "plan") && canCompanyRole(item.role, "campaign:approve"),
  );
  const company = profile.is_platform_admin
    ? companies.find((item) => item.status === "activa" && canCompanyRole(item.role, "plan"))
    : approvingCompany;
  const canApprove = profile.is_platform_admin || Boolean(approvingCompany);
  if (!canApprove) return { ok: false, error: "El plan debe ser aprobado por un usuario autorizador." };

  let canonicalPlan: MediaPlan;
  try {
    canonicalPlan = await buildMediaPlan({
      keyword: input.brief.keyword,
      budgetUsd: input.brief.budgetUsd,
      selectedMedia: input.brief.selectedMedia,
      objective: input.brief.objective,
      priority: input.brief.priority,
      audienceType: input.brief.audienceType,
      geography: input.brief.geography,
      businessModel: input.brief.businessModel,
      conversionModel: input.brief.conversionModel,
      trackingStatus: input.brief.trackingStatus,
    });
  } catch {
    return { ok: false, error: "No se pudo volver a validar la propuesta antes de aprobarla." };
  }

  const canonicalRows = new Map(canonicalPlan.plan.map((row) => [row.label, row]));
  const allowedLabels = new Set(canonicalRows.keys());
  const clean = customizedRows
    .filter((row) => allowedLabels.has(row.label) && Number.isFinite(row.pct) && row.pct >= 0)
    .map((row) => ({
      label: row.label,
      pct: Number(row.pct),
      amount: null,
      rationale: canonicalRows.get(row.label)?.rationale,
    }));
  const total = clean.reduce((sum, row) => sum + row.pct, 0);
  const uniqueLabels = new Set(clean.map((row) => row.label));
  if (clean.length !== canonicalPlan.plan.length || uniqueLabels.size !== clean.length || Math.abs(total - 1) > 0.002) {
    return { ok: false, error: "La personalización debe distribuir exactamente el 100% entre los medios propuestos." };
  }
  const budget = input.brief.budgetUsd && input.brief.budgetUsd > 0 ? input.brief.budgetUsd : null;
  const rows = clean.map((row) => ({ ...row, amount: budget ? row.pct * budget : null }));
  const campaigns = input.brief.selectedMedia.includes("digital")
    ? await buildCurrentCampaigns({
        keyword: input.brief.keyword,
        audience: input.brief.audience,
        objective: input.brief.objective,
        brand: input.brief.brand,
        geography: input.brief.geography,
        audienceType: input.brief.audienceType,
        ageRange: input.brief.ageRange,
        socioeconomic: input.brief.socioeconomic,
        businessModel: input.brief.businessModel,
        conversionModel: input.brief.conversionModel,
      }, { ...canonicalPlan, plan: rows })
    : [];
  const analysis = buildPlanAnalysis(input.brief, { ...canonicalPlan, plan: rows });
  const detail = await buildDetailedMediaRecommendation(input.brief, { ...canonicalPlan, plan: rows });
  const db = await createClient();
  const name = (input.brief.brand || input.keyword || "Plan sin marca").slice(0, 120);
  const snapshot = { brief: input.brief, analysis, proposal: { ...canonicalPlan, plan: rows, detail }, campaigns };
  const { data, error } = await db.from("media_plans").insert({
    owner_id: profile.id,
    company_id: company?.id ?? null,
    name,
    status: "aprobado",
    mode: "guiado",
    stage: "aprobado",
    version: 1,
    progress: 100,
    brief: input.brief,
    analysis,
    proposal: { plan: rows, campaigns, detail, approved_at: new Date().toISOString() },
  }).select("id").single();
  if (error || !data) return { ok: false, error: "No se pudo registrar la aprobación del plan." };
  await db.from("media_plan_versions").insert({ plan_id: data.id, version: 1, actor_id: profile.id, snapshot });
  revalidatePath("/planificador");
  return { ok: true, id: String(data.id), rows };
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readProducts(formData: FormData): PlanBrief["products"] {
  const names = formData.getAll("productName").map(String);
  const prices = formData.getAll("productPrice").map(String);
  const margins = formData.getAll("productMargin").map(String);
  const capacities = formData.getAll("productCapacity").map(String);
  const seasons = formData.getAll("productSeason").map(String);
  const notes = formData.getAll("productNotes").map(String);
  return names.map((name, index) => ({
    name: name.trim(), price: prices[index]?.trim() ?? "", margin: margins[index]?.trim() ?? "",
    capacity: capacities[index]?.trim() ?? "", season: seasons[index]?.trim() ?? "", notes: notes[index]?.trim() ?? "",
  })).filter((product) => Object.values(product).some(Boolean));
}
