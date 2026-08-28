"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { getMyCompanies } from "@/lib/company";
import { canCompanyRole } from "@/lib/permissions";
import { buildPlanningScenarios, type PlanningScenario } from "@/lib/plan-optimizer";
import type { MediaGroup } from "@/lib/media-groups";
import { createClient } from "@/lib/supabase/server";

export type SaveProgressInput = {
  planId?: string | null;
  name?: string;
  brief: Record<string, unknown>;
};

export type ManualPlanDraft = {
  planId?: string | null;
  name: string;
  brand: string;
  keyword: string;
  objective: string;
  priority: string;
  audience: string;
  targetPeople: number | null;
  interests: string;
  audienceType: string;
  budgetUsd: number;
  geographies: string[];
  selectedMedia: MediaGroup[];
  scenarioId: PlanningScenario["id"];
  digitalReady: boolean;
  selections: Record<string, unknown>;
  submitForReview?: boolean;
};

type SaveResult = { ok: true; id: string; version: number; message: string } | { ok: false; error: string };

export async function guardarProgresoBrief(input: SaveProgressInput): Promise<SaveResult> {
  const access = await planAccess();
  if (!access.ok) return access;
  const brief = cleanObject(input.brief);
  const name = cleanText(input.name || String(brief.brand ?? "") || "Plan sin marca", 120);
  const required = [brief.keyword, brief.objective, brief.geography, brief.budgetUsd ?? brief.budget];
  const progress = Math.min(35, 8 + required.filter(Boolean).length * 7);
  return savePlanRecord({
    planId: input.planId,
    ownerId: access.profileId,
    companyId: access.companyId,
    name,
    mode: "guiado",
    stage: "brief",
    status: "borrador",
    progress,
    brief,
    analysis: {},
    proposal: {},
    selection: {},
  });
}

export async function guardarPlanManual(input: ManualPlanDraft): Promise<SaveResult> {
  const access = await planAccess();
  if (!access.ok) return access;
  const budgetUsd = Number(input.budgetUsd);
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 10_000_000) {
    return { ok: false, error: "Define un presupuesto válido para el plan manual." };
  }
  const selectedMedia = [...new Set(input.selectedMedia)].filter(isMediaGroup);
  if (!selectedMedia.length) return { ok: false, error: "Selecciona al menos un medio." };
  const geographies = [...new Set(input.geographies.map((item) => cleanText(item, 120)).filter(Boolean))].slice(0, 20);
  if (!geographies.length) return { ok: false, error: "Selecciona al menos una cobertura geográfica." };
  const scenarios = buildPlanningScenarios({
    budgetUsd,
    selectedMedia,
    objective: input.objective,
    priority: input.priority,
    audienceType: input.audienceType,
    geographyCount: geographies.length,
    digitalReady: Boolean(input.digitalReady),
  });
  const selectedScenario = scenarios.find((item) => item.id === input.scenarioId) ?? scenarios[0];
  if (!selectedScenario) return { ok: false, error: "No se pudo construir un escenario de inversión." };

  const brief = {
    brand: cleanText(input.brand, 120),
    keyword: cleanText(input.keyword, 160),
    objective: cleanText(input.objective, 120),
    priority: cleanText(input.priority, 120),
    audience: cleanText(input.audience, 1000),
    targetPeople: input.targetPeople && Number.isFinite(input.targetPeople) ? Math.max(1, Math.round(input.targetPeople)) : null,
    interests: cleanText(input.interests, 1000),
    audienceType: cleanText(input.audienceType, 40),
    budgetUsd,
    geography: geographies.join(" · "),
    geographies,
    selectedMedia,
  };
  const status = input.submitForReview ? "revision" : "borrador";
  const stage = input.submitForReview ? "personaliza" : "propuesta";
  return savePlanRecord({
    planId: input.planId,
    ownerId: access.profileId,
    companyId: access.companyId,
    name: cleanText(input.name || input.brand || "Plan manual", 120),
    mode: "manual",
    stage,
    status,
    progress: input.submitForReview ? 85 : 65,
    brief,
    analysis: {
      scenario: selectedScenario,
      alternatives: scenarios,
      methodology: "Distribución determinística por objetivo, prioridad, tipo de audiencia, medios y cobertura; requiere validación comercial.",
    },
    proposal: { allocations: selectedScenario.allocations, validations: selectedScenario.validations },
    selection: cleanObject(input.selections),
  });
}

export async function crearOrdenDesdePlan(planId: string): Promise<
  { ok: true; id: string; message: string } | { ok: false; error: string }
> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, error: "Debes iniciar sesión." };
  if (!isUuid(planId)) return { ok: false, error: "El plan seleccionado no es válido." };
  const db = await createClient();
  const { data: plan, error } = await db
    .from("media_plans")
    .select("id, owner_id, company_id, name, status, version, brief, proposal, selection")
    .eq("id", planId)
    .maybeSingle();
  if (error || !plan) return { ok: false, error: "No se encontró el plan." };
  if (!profile.is_platform_admin && plan.owner_id !== profile.id) return { ok: false, error: "No puedes ordenar este plan." };
  if (!['revision', 'aprobado'].includes(String(plan.status))) {
    return { ok: false, error: "Guarda el plan para revisión o apruébalo antes de crear una orden." };
  }
  const brief = cleanObject(plan.brief as Record<string, unknown>);
  const mediaBudget = Number(brief.budgetUsd ?? brief.budget ?? 0);
  const summary = {
    plan_name: plan.name,
    plan_version: plan.version,
    brief,
    proposal: cleanObject(plan.proposal as Record<string, unknown>),
    selection: cleanObject(plan.selection as Record<string, unknown>),
  };
  const { data: order, error: orderError } = await db.from("media_orders").upsert({
    plan_id: plan.id,
    owner_id: plan.owner_id,
    company_id: plan.company_id,
    status: "pending_review",
    media_budget_usd: Number.isFinite(mediaBudget) && mediaBudget > 0 ? mediaBudget : 0,
    summary,
  }, { onConflict: "plan_id" }).select("id").single();
  if (orderError || !order) {
    return { ok: false, error: schemaMessage(orderError?.message, "No se pudo crear la orden de coordinación.") };
  }
  await db.from("media_order_events").insert({
    order_id: order.id,
    actor_id: profile.id,
    event_type: "order_created",
    to_status: "pending_review",
    detail: { plan_id: plan.id, plan_version: plan.version },
  });
  revalidatePath("/campanas");
  revalidatePath("/planificador");
  return { ok: true, id: String(order.id), message: "Orden creada y enviada a revisión comercial." };
}

export async function comentarPlan(planId: string, body: string): Promise<
  { ok: true; message: string } | { ok: false; error: string }
> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, error: "Debes iniciar sesión." };
  if (!isUuid(planId)) return { ok: false, error: "El plan no es válido." };
  const clean = cleanText(body, 2000);
  if (!clean) return { ok: false, error: "Escribe un comentario." };
  const db = await createClient();
  const { error } = await db.from("media_plan_comments").insert({ plan_id: planId, author_id: profile.id, body: clean });
  if (error) return { ok: false, error: schemaMessage(error.message, "No se pudo guardar el comentario.") };
  revalidatePath("/planificador");
  return { ok: true, message: "Comentario registrado en la trazabilidad del plan." };
}

async function savePlanRecord(input: {
  planId?: string | null;
  ownerId: string;
  companyId: string | null;
  name: string;
  mode: "guiado" | "manual";
  stage: "brief" | "analisis" | "propuesta" | "personaliza" | "aprobado";
  status: "borrador" | "revision" | "aprobado" | "archivado";
  progress: number;
  brief: Record<string, unknown>;
  analysis: Record<string, unknown>;
  proposal: Record<string, unknown>;
  selection: Record<string, unknown>;
}): Promise<SaveResult> {
  const db = await createClient();
  let planId = input.planId && isUuid(input.planId) ? input.planId : null;
  let version = 1;
  if (planId) {
    const { data: current, error: currentError } = await db
      .from("media_plans")
      .select("id, owner_id, version")
      .eq("id", planId)
      .eq("owner_id", input.ownerId)
      .maybeSingle();
    if (currentError || !current) return { ok: false, error: "No se encontró el borrador que quieres actualizar." };
    version = Number(current.version) + 1;
    const { error } = await db.from("media_plans").update({
      name: input.name,
      status: input.status,
      mode: input.mode,
      stage: input.stage,
      version,
      progress: input.progress,
      brief: input.brief,
      analysis: input.analysis,
      proposal: input.proposal,
      selection: input.selection,
    }).eq("id", planId).eq("owner_id", input.ownerId);
    if (error) return { ok: false, error: "No se pudo actualizar el plan." };
  } else {
    const { data, error } = await db.from("media_plans").insert({
      owner_id: input.ownerId,
      company_id: input.companyId,
      name: input.name,
      status: input.status,
      mode: input.mode,
      stage: input.stage,
      version,
      progress: input.progress,
      brief: input.brief,
      analysis: input.analysis,
      proposal: input.proposal,
      selection: input.selection,
    }).select("id").single();
    if (error || !data) return { ok: false, error: "No se pudo crear el plan." };
    planId = String(data.id);
  }
  const snapshot = {
    name: input.name,
    status: input.status,
    mode: input.mode,
    stage: input.stage,
    progress: input.progress,
    brief: input.brief,
    analysis: input.analysis,
    proposal: input.proposal,
    selection: input.selection,
  };
  const { error: versionError } = await db.from("media_plan_versions").insert({
    plan_id: planId,
    version,
    actor_id: input.ownerId,
    snapshot,
  });
  if (versionError) return { ok: false, error: "El plan se guardó, pero no pudimos registrar su nueva versión." };
  revalidatePath("/planificador");
  return {
    ok: true,
    id: planId!,
    version,
    message: input.status === "revision" ? "Plan enviado a revisión con trazabilidad." : `Progreso guardado como versión ${version}.`,
  };
}

async function planAccess(): Promise<
  { ok: true; profileId: string; companyId: string | null } | { ok: false; error: string }
> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, error: "Debes iniciar sesión." };
  const companies = await getMyCompanies(profile.id);
  const company = companies.find((item) => item.status === "activa" && canCompanyRole(item.role, "plan"));
  if (!profile.is_platform_admin && !company) return { ok: false, error: "Tu rol no permite guardar planes." };
  return { ok: true, profileId: profile.id, companyId: company?.id ?? null };
}

function isMediaGroup(value: string): value is MediaGroup {
  return ["television", "radio", "ooh", "press", "digital", "influencers"].includes(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function cleanText(value: string, max: number) {
  return value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max);
}

function cleanObject(input: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(input ?? {})) as Record<string, unknown>;
}

function schemaMessage(message: string | undefined, fallback: string) {
  return message?.includes("does not exist") || message?.includes("schema cache")
    ? "La función está preparada; falta aplicar la migración 0012 en Supabase."
    : fallback;
}
