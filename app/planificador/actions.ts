"use server";

import { getSessionProfile } from "@/lib/auth";
import { buildMediaPlan, type MediaPlan } from "@/lib/planner";
import { buildCampaigns, type Campaign } from "@/lib/campaigns";

export type PlanResult =
  | {
      ok: true;
      plan: MediaPlan;
      campaigns: Campaign[];
      keyword: string;
      objective: string;
      audience: string;
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

  const keyword = String(formData.get("keyword") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const audience = String(formData.get("audience") ?? "").trim();
  const budgetRaw = String(formData.get("budget") ?? "").replace(/[^0-9.]/g, "");
  const budgetUsd = budgetRaw ? Number(budgetRaw) : null;

  if (keyword.length < 2) {
    return { ok: false, error: "Escribe el giro de tu negocio (ej. cafeteria, banco, farmacia)." };
  }

  try {
    const plan = await buildMediaPlan({ keyword, budgetUsd });
    const campaigns = buildCampaigns({ keyword, audience, objective }, plan);
    return { ok: true, plan, campaigns, keyword, objective, audience };
  } catch (err) {
    if (err instanceof Error && err.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return { ok: false, error: "El planificador aun no esta habilitado (falta la clave de servicio)." };
    }
    return { ok: false, error: "No pudimos generar el plan. Intenta de nuevo." };
  }
}
