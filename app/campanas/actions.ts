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
  revalidatePath("/campanas");
  return { ok: true, id: data.id };
}
