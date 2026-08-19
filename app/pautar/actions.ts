"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { getMyCompanies } from "@/lib/company";

export type PautaInput = {
  red: string; // instagram | facebook | tiktok
  postUrl: string;
  geo: string;
  presupuesto: number;
  objetivo?: string;
};

export type PautaResult = { ok: true; id: string } | { ok: false; error: string };

/** instagram/facebook -> meta (misma API). tiktok -> tiktok. */
function platformFromRed(red: string): string {
  const r = red.toLowerCase();
  if (r === "instagram" || r === "facebook") return "meta";
  return r;
}

/**
 * Crea una orden de pauta desde el chat de Mavi. Guarda los datos en
 * campaign_jobs (sin nuevas tablas): red, link del post, geo y presupuesto.
 * Queda "pendiente" hasta que el motor (API de Meta) este conectado.
 */
export async function crearPauta(input: PautaInput): Promise<PautaResult> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, error: "Debes iniciar sesion." };

  const companies = await getMyCompanies(profile.id);
  const company = companies[0];
  if (!company) {
    return { ok: false, error: "Solo una cuenta de empresa puede pautar." };
  }

  const presupuesto = Number(input.presupuesto);
  if (!input.postUrl || !/^https?:\/\//i.test(input.postUrl)) {
    return { ok: false, error: "Pega un link valido de la publicacion (empieza con http)." };
  }
  if (!Number.isFinite(presupuesto) || presupuesto <= 0) {
    return { ok: false, error: "Indica un presupuesto valido en dolares." };
  }
  if (!input.geo?.trim()) {
    return { ok: false, error: "Indica la ubicacion donde quieres pautar." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_jobs")
    .insert({
      company_id: company.id,
      platform: platformFromRed(input.red),
      status: "pendiente",
      created_by: profile.id,
      spec: {
        tipo: "pauta",
        red: input.red,
        post_url: input.postUrl.trim(),
        geo: input.geo.trim(),
        presupuesto_usd: presupuesto,
        objetivo: input.objetivo?.trim() || "Promocionar publicacion",
      },
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "No se pudo crear la orden de pauta." };
  }

  // Disparador opcional bajo demanda (mismo patron que ejecutarCampana).
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
        body: JSON.stringify({ jobId: data.id, platform: platformFromRed(input.red) }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      /* queda en cola de todos modos */
    }
  }

  revalidatePath("/campanas");
  return { ok: true, id: data.id };
}
