"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { buildMediaPlan, type MediaPlan } from "@/lib/planner";
import { buildCampaigns, type Campaign } from "@/lib/campaigns";
import { getMyCompanies } from "@/lib/company";
import { canCompanyRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

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
  businessModel: string;
  conversionModel: string;
  digitalDestination: string;
  trackingStatus: string;
  adAccountsStatus: string;
};

export type PlanResult =
  | {
      ok: true;
      plan: MediaPlan;
      campaigns: Campaign[];
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

  if (keyword.length < 2) {
    return { ok: false, error: "Escribe el giro de tu negocio (ej. cafeteria, banco, farmacia)." };
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
    businessModel: String(formData.get("businessModel") ?? ""),
    conversionModel: String(formData.get("conversionModel") ?? ""),
    digitalDestination: String(formData.get("digitalDestination") ?? "").trim(),
    trackingStatus: String(formData.get("trackingStatus") ?? ""),
    adAccountsStatus: String(formData.get("adAccountsStatus") ?? ""),
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
      ? buildCampaigns({
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
    const safePlan = profile.is_platform_admin
      ? plan
      : { ...plan, matched: 0, totalRef: 0 };
    return { ok: true, plan: safePlan, campaigns, keyword, objective, audience, brief };
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
        basis: input.plan.basis,
        benchmark: input.plan.benchmark,
        profileLabel: input.plan.profileLabel,
        strategySummary: input.plan.strategySummary,
      },
      proposal: { plan: input.plan.plan, campaigns: input.campaigns },
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
