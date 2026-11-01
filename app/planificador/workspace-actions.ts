"use server";

import { getInfomediaCatalog, getCategoryResearch } from "@/lib/infomedia-server";
import { getBroadcastCatalog } from "@/lib/broadcast-server";
import { getPressCatalog } from "@/lib/press-server";
import { validatePressPicks } from "@/lib/press-catalog";
import { getOohCatalog } from "@/lib/ooh-server";
import { getOohLocationCatalog, getInfluencerCatalog } from "@/lib/media-workspace";
import { validateManualExtras } from "@/lib/diy-workspace";
import { FALLBACK_OOH } from "@/lib/diy-zones";
import { validateBroadcastSelections } from "@/lib/broadcast-catalog";
import { revalidatePath } from "next/cache";
import { normalizeCoverageBrief } from "@/lib/geographic-coverage";
import { getSessionProfile } from "@/lib/auth";
import { getMyCompanies } from "@/lib/company";
import { canWorkspaceRole } from "@/lib/permissions";
import { buildPlanningScenarios, type PlanningScenario } from "@/lib/plan-optimizer";
import type { MediaGroup } from "@/lib/media-groups";
import { createClient } from "@/lib/supabase/server";

export type SaveProgressInput = {
  planId?: string | null;
  name?: string;
  brief: Record<string, unknown>;
};

export type ManualPlanDraft = {
  activeMedium?: MediaGroup;
  startDate?: string; endDate?: string; ageRange?: string; sex?: string;
  categoryId: string;
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
  const brief: Record<string, unknown> = { ...cleanObject(input.brief), ...normalizeCoverageBrief(input.brief) };
  if (brief.categoryId) {
    const catalog = await getInfomediaCatalog();
    const category = catalog.categories.find((item) => item.id === brief.categoryId);
    if (!category) return { ok: false, error: "La categoría ya no está disponible. Selecciónala nuevamente." };
    brief.keyword = category.label;
  }
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
  let category;
  try { category = (await getCategoryResearch(input.categoryId)).category; } catch { return { ok: false, error: "Selecciona una categoría válida de Infomedia." }; }
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
    keyword: category.label,
    categoryId: category.id,
    objective: cleanText(input.objective, 120),
    priority: cleanText(input.priority, 120),
    audience: cleanText(input.audience, 1000),
    targetPeople: input.targetPeople && Number.isFinite(input.targetPeople) ? Math.max(1, Math.round(input.targetPeople)) : null,
    interests: cleanText(input.interests, 1000),
    audienceType: cleanText(input.audienceType, 40),
    budgetUsd,
    geography: geographies.join(" · "),
    geographies, startDate: input.startDate, endDate: input.endDate, ageRange: input.ageRange, sex: input.sex,
    selectedMedia,
  };
  const rawSelections = cleanObject(input.selections);
  const [broadcast, press, ooh, legacyOoh, influencers] = await Promise.all([
    getBroadcastCatalog(),
    selectedMedia.includes("press") ? getPressCatalog() : Promise.resolve({ entries: [] }),
    selectedMedia.includes("ooh") ? getOohCatalog() : Promise.resolve({ assets: [] }),
    selectedMedia.includes("ooh") ? getOohLocationCatalog() : Promise.resolve([]),
    selectedMedia.includes("influencers") ? getInfluencerCatalog() : Promise.resolve([]),
  ]);
  const checked = validateBroadcastSelections(broadcast, {...brief, socioeconomic:"Todos los NSE"}, {
    tv: selectedMedia.includes("television") ? rawSelections.tv : [],
    radio: selectedMedia.includes("radio") ? rawSelections.radio : [],
  });
  if (!checked.ok) return checked;
  const checkedPress = validatePressPicks(press, selectedMedia.includes("press") ? rawSelections.press ?? [] : [], brief);
  if (!checkedPress.ok) return checkedPress;
  const checkedExtras = validateManualExtras({ selectedMedia, selections: { ...checked.selections, press: checkedPress.picks, ooh: rawSelections.ooh, digital: rawSelections.digital, influencers: rawSelections.influencers }, ooh, legacyOoh: legacyOoh.length ? legacyOoh : FALLBACK_OOH, influencers });
  if (!checkedExtras.ok) return checkedExtras;
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
      digitalReady: Boolean(input.digitalReady),
      activeMedium: input.activeMedium && isMediaGroup(input.activeMedium) ? input.activeMedium : selectedMedia[0],
      alternatives: scenarios,
      methodology: "Distribución determinística por objetivo, prioridad, tipo de audiencia, medios y cobertura; requiere validación comercial.",
    },
    proposal: { allocations: selectedScenario.allocations, validations: selectedScenario.validations },
    selection: checkedExtras.selections,
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
  if (!profile.is_platform_admin) {
    const companies = await getMyCompanies(profile.id);
    const canRequest = companies.some(c => c.id === plan.company_id && c.status === "activa" && canWorkspaceRole(c, "campaign:create"));
    if (plan.owner_id !== profile.id || !canRequest) return { ok: false, error: "Tu rol no permite solicitar esta campaña." };
  }
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

export async function decidirPlan(planId: string, decision: "approved" | "changes_requested", note: string): Promise<
  { ok: true; message: string } | { ok: false; error: string }
> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, error: "Debes iniciar sesión." };
  if (!isUuid(planId) || !["approved", "changes_requested"].includes(decision)) return { ok: false, error: "La decisión no es válida." };
  const db = await createClient();
  const { data: plan, error: planError } = await db.from("media_plans").select("id, owner_id, company_id, version").eq("id", planId).maybeSingle();
  if (planError || !plan) return { ok: false, error: "No se encontró el plan." };
  const companies = await getMyCompanies(profile.id);
  const companyApproval = companies.some((company) => company.id === plan.company_id && company.status === "activa" && canWorkspaceRole(company, "campaign:approve"));
  if (!profile.is_platform_admin && !companyApproval) return { ok: false, error: "Tu rol no permite decidir sobre este plan." };
  const cleanNote = cleanText(note, 2000) || null;
  const { error } = await db.from("media_plan_approvals").insert({ plan_id: planId, actor_id: profile.id, decision, note: cleanNote, plan_version: Number(plan.version) });
  if (error) return { ok: false, error: schemaMessage(error.message, "No se pudo registrar la decisión.") };
  const { error: updateError } = await db.from("media_plans").update(decision === "approved"
    ? { status: "aprobado", stage: "aprobado", progress: 100 }
    : { status: "revision", stage: "personaliza", progress: 85 }).eq("id", planId);
  if (updateError) return { ok: false, error: "La decisión quedó registrada, pero no se pudo actualizar el estado del plan. Solicita revisión al administrador." };
  revalidatePath("/planificador");
  revalidatePath("/campanas");
  return { ok: true, message: decision === "approved" ? "Plan aprobado con trazabilidad." : "Cambios solicitados y enviados al historial." };
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
  const company = companies.find((item) => item.status === "activa" && canWorkspaceRole(item, "plan"));
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
