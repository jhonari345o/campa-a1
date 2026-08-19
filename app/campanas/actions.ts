"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { getMyCompanies } from "@/lib/company";

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
  if (!company) {
    return { ok: false, error: "Solo una cuenta de empresa puede ejecutar campanas." };
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

  if (error || !data) return { ok: false, error: error?.message ?? "No se pudo crear el trabajo." };

  // Disparador "bajo demanda": si hay un runner configurado, se le avisa para
  // que abra el navegador en la nube solo en ese momento. Es best-effort: si
  // falla o no esta configurado, el trabajo igual queda en cola (pantalla Campanas).
  const triggerUrl = process.env.AGENT_TRIGGER_URL;
  if (triggerUrl) {
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
