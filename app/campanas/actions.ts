"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { getMyCompanies } from "@/lib/company";
import {
  activatePaidMetaJob,
  pausePaidMetaJob,
  preparePaidMetaJob,
  syncPaidMetaJobMetrics,
} from "@/lib/ads/delivery";
import {
  isAgentAutomationEnabled,
  isMetaPausedDraftsEnabled,
  isMetaRealSpendEnabled,
} from "@/lib/commercial";
import { canCompanyRole } from "@/lib/permissions";
import { validateMetaConnection } from "@/lib/ads/meta";

export type JobInput = {
  platform: string;
  objetivo: string;
  publico: string;
  formato?: string;
  presupuesto?: number | null;
  copy: string;
};

export type JobResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Crea un trabajo de campana (pendiente) para que el agente Mavi lo ejecute.
 * Lo crea la cuenta de la empresa; el agente trabajador lo toma despues.
 */
export async function ejecutarCampana(input: JobInput): Promise<JobResult> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, error: "Debes iniciar sesion." };

  const companies = await getMyCompanies(profile.id);
  const company = companies[0];
  if (!company || company.status !== "activa") {
    return { ok: false, error: "Solo una cuenta de empresa puede ejecutar campanas." };
  }
  if (!canCompanyRole(company.role, "campaign:create")) {
    return { ok: false, error: "Tu rol no permite solicitar una campana." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_jobs")
    .insert({
      company_id: company.id,
      platform: input.platform,
      status: "pendiente",
      created_by: profile.id,
      spec: {
        objetivo: input.objetivo,
        publico: input.publico,
        formato: input.formato ?? null,
        presupuesto_usd: input.presupuesto ?? null,
        copy: input.copy,
      },
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "No se pudo crear el trabajo." };

  // Disparador "bajo demanda": si hay un runner configurado, se le avisa para
  // que abra el navegador en la nube solo en ese momento. Es best-effort: si
  // falla o no esta configurado, el trabajo igual queda en cola (pantalla Campanas).
  const triggerUrl = process.env.AGENT_TRIGGER_URL;
  if (triggerUrl && isAgentAutomationEnabled()) {
    try {
      await fetch(triggerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.AGENT_WORKER_TOKEN
            ? { Authorization: `Bearer ${process.env.AGENT_WORKER_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({ jobId: data.id, platform: input.platform }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      /* el runner lo tomara luego via /api/agent/next */
    }
  }

  revalidatePath("/campanas");
  return { ok: true, id: data.id };
}

export async function prepararPautaMeta(formData: FormData): Promise<void> {
  const jobId = await requireAdminJobId(formData);
  if (!isMetaPausedDraftsEnabled()) redirect("/campanas?meta=bloqueada_cumplimiento");
  try {
    await preparePaidMetaJob(jobId);
  } catch {
    redirectWithMetaResult("error");
  }
  revalidatePath("/campanas");
  redirect("/campanas?meta=borrador_listo");
}

export async function activarPautaMeta(formData: FormData): Promise<void> {
  const jobId = await requireAdminJobId(formData);
  if (!isMetaRealSpendEnabled()) redirect("/campanas?meta=bloqueada_cumplimiento");
  if (formData.get("confirm") !== "ACTIVAR_PAUTA_REAL") {
    redirect("/campanas?meta=falta_confirmacion");
  }
  try {
    await activatePaidMetaJob(jobId);
  } catch {
    redirectWithMetaResult("error");
  }
  revalidatePath("/campanas");
  redirect("/campanas?meta=activada");
}

export async function pausarPautaMeta(formData: FormData): Promise<void> {
  const jobId = await requireAdminJobId(formData);
  try {
    await pausePaidMetaJob(jobId);
  } catch {
    redirectWithMetaResult("error");
  }
  revalidatePath("/campanas");
  redirect("/campanas?meta=pausada");
}

export async function actualizarMetricasMeta(formData: FormData): Promise<void> {
  const jobId = await requireAdminJobId(formData);
  try {
    await syncPaidMetaJobMetrics(jobId);
  } catch {
    redirectWithMetaResult("error");
  }
  revalidatePath("/campanas");
  redirect("/campanas?meta=metricas_actualizadas");
}

export async function verificarConexionMeta(): Promise<void> {
  const profile = await getSessionProfile();
  if (!profile?.is_platform_admin) redirect("/campanas?meta=no_autorizado");

  let result = "conexion_error";
  let detail = "Meta no pudo validar la credencial y los activos configurados. Revisa el token, la cuenta publicitaria y la pagina.";
  try {
    const status = await validateMetaConnection();
    if (status.connected) {
      result = "conexion_lista";
      detail = `Meta respondio correctamente con ${status.apiVersion}: Facebook${status.instagramReady ? " e Instagram" : ""} estan listos para una prueba pausada.`;
    } else {
      result = "conexion_permisos";
      detail = `La credencial responde, pero faltan permisos otorgados: ${status.missingPermissions.join(", ") || "activos de Instagram"}.`;
    }
  } catch {
    // El detalle del proveedor no se envia por URL ni al navegador.
  }
  redirect(`/campanas?meta=${encodeURIComponent(result)}&detail=${encodeURIComponent(detail)}`);
}

async function requireAdminJobId(formData: FormData): Promise<string> {
  const profile = await getSessionProfile();
  if (!profile?.is_platform_admin) redirect("/campanas?meta=no_autorizado");
  const jobId = String(formData.get("job_id") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(jobId)) redirect("/campanas?meta=orden_invalida");
  return jobId;
}

function redirectWithMetaResult(kind: string): never {
  redirect(`/campanas?meta=${encodeURIComponent(kind)}&detail=${encodeURIComponent("Meta no pudo completar la operacion. Revisa el registro interno antes de reintentar.")}`);
}
