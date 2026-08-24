import "server-only";

import { getMaxMetaBudgetUsd } from "@/lib/ads/config";
import {
  activateMetaCampaign,
  createPausedMetaCampaign,
  getMetaAdInsights,
  pauseMetaCampaign,
  type MetaCampaignIds,
} from "@/lib/ads/meta";
import { createAdminClient } from "@/lib/supabase/admin";

type DeliveryRow = {
  id: string;
  status: string;
  updated_at: string;
  provider_campaign_id: string | null;
  provider_adset_id: string | null;
  provider_creative_id: string | null;
  provider_ad_id: string | null;
  metadata: Record<string, unknown> | null;
};

export async function preparePaidMetaJob(jobId: string) {
  const admin = createAdminClient();
  const context = await loadPaidJob(admin, jobId);
  const delivery = await getOrCreateDelivery(admin, context.job.id, context.job.company_id);

  if (delivery.status === "active") return { status: "active" as const };
  if (delivery.status === "paused" && delivery.provider_ad_id) return { status: "paused" as const };
  if (delivery.status === "creating" && Date.now() - new Date(delivery.updated_at).getTime() < 5 * 60 * 1000) {
    throw new Error("Meta ya esta creando esta pauta. Espera unos minutos antes de reintentar.");
  }

  const spec = asRecord(context.job.spec);
  const geoTarget = asRecord(spec.geo_target);
  const center = asRecord(geoTarget.center);
  const red = spec.red === "facebook" ? "facebook" : spec.red === "instagram" ? "instagram" : null;
  const postUrl = typeof spec.post_url === "string" ? spec.post_url : null;
  const latitude = Number(center.latitude);
  const longitude = Number(center.longitude);
  const radiusKm = Number(geoTarget.radius_km);
  if (!red || !postUrl || ![latitude, longitude, radiusKm].every(Number.isFinite)) {
    throw new Error("La orden no contiene una publicacion o geolocalizacion valida.");
  }

  await admin
    .from("campaign_deliveries")
    .update({ status: "creating", error: null })
    .eq("id", delivery.id);
  await admin
    .from("campaign_jobs")
    .update({ status: "publicando", log: "Creando borrador pausado en Meta..." })
    .eq("id", jobId);

  const existing = deliveryToMetaIds(delivery);
  try {
    const ids = await createPausedMetaCampaign(
      {
        jobId,
        red,
        postUrl,
        latitude,
        longitude,
        radiusKm,
        budgetCents: context.payment.base_cents,
        objective: typeof spec.objetivo === "string" ? spec.objetivo : undefined,
      },
      {
        existing,
        onProgress: async (progress) => {
          await saveMetaProgress(admin, delivery.id, progress);
        },
      },
    );

    await Promise.all([
      admin
        .from("campaign_deliveries")
        .update({
          status: "paused",
          error: null,
          provider_campaign_id: ids.campaignId,
          provider_adset_id: ids.adsetId,
          provider_creative_id: ids.creativeId,
          provider_ad_id: ids.adId,
          metadata: { source_post_id: ids.sourcePostId, safety: "created_paused" },
        })
        .eq("id", delivery.id),
      admin
        .from("campaign_jobs")
        .update({
          status: "listo_para_revision",
          log: "Borrador creado en Meta y mantenido en pausa. Requiere activacion administrativa.",
        })
        .eq("id", jobId),
    ]);
    return { status: "paused" as const, ids };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta no pudo crear la pauta.";
    await Promise.all([
      admin
        .from("campaign_deliveries")
        .update({ status: "error", error: message.slice(0, 1000) })
        .eq("id", delivery.id),
      admin
        .from("campaign_jobs")
        .update({ status: "error", log: message.slice(0, 1000) })
        .eq("id", jobId),
    ]);
    throw new Error(message);
  }
}

export async function activatePaidMetaJob(jobId: string) {
  const admin = createAdminClient();
  const context = await loadPaidJob(admin, jobId);
  const maxCents = Math.round(getMaxMetaBudgetUsd() * 100);
  if (context.payment.base_cents > maxCents) {
    throw new Error(`El presupuesto supera el tope de activacion de $${(maxCents / 100).toFixed(2)}.`);
  }
  const delivery = await getDelivery(admin, jobId);
  const ids = requireDeliveryIds(delivery);
  if (delivery.status === "active") return;
  if (delivery.status !== "paused") {
    throw new Error("Primero crea y revisa el borrador pausado de Meta.");
  }

  await admin.from("campaign_deliveries").update({ status: "creating", error: null }).eq("id", delivery.id);
  await admin
    .from("campaign_jobs")
    .update({ status: "publicando", log: "Activando pauta en Meta..." })
    .eq("id", jobId);
  try {
    await activateMetaCampaign(ids);
    await Promise.all([
      admin.from("campaign_deliveries").update({ status: "active", error: null }).eq("id", delivery.id),
      admin
        .from("campaign_jobs")
        .update({ status: "publicada", log: "Pauta activa en Meta." })
        .eq("id", jobId),
    ]);
  } catch (error) {
    await pauseMetaCampaign(ids).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Meta no pudo activar la pauta.";
    await Promise.all([
      admin.from("campaign_deliveries").update({ status: "error", error: message.slice(0, 1000) }).eq("id", delivery.id),
      admin.from("campaign_jobs").update({ status: "error", log: message.slice(0, 1000) }).eq("id", jobId),
    ]);
    throw new Error(message);
  }
}

export async function pausePaidMetaJob(jobId: string) {
  const admin = createAdminClient();
  const delivery = await getDelivery(admin, jobId);
  const ids = requireDeliveryIds(delivery);
  await pauseMetaCampaign(ids);
  await Promise.all([
    admin.from("campaign_deliveries").update({ status: "paused", error: null }).eq("id", delivery.id),
    admin
      .from("campaign_jobs")
      .update({ status: "listo_para_revision", log: "Pauta pausada en Meta por el equipo." })
      .eq("id", jobId),
  ]);
}

export async function syncPaidMetaJobMetrics(jobId: string) {
  const admin = createAdminClient();
  const delivery = await getDelivery(admin, jobId);
  const ids = requireDeliveryIds(delivery);
  const metrics = await getMetaAdInsights(ids.adId);
  const { data: job } = await admin.from("campaign_jobs").select("spec").eq("id", jobId).single();
  await admin
    .from("campaign_jobs")
    .update({ spec: { ...asRecord(job?.spec), metrics, metrics_actualizadas_at: new Date().toISOString() } })
    .eq("id", jobId);
  return metrics;
}

async function loadPaidJob(admin: ReturnType<typeof createAdminClient>, jobId: string) {
  const [{ data: job }, { data: payment }] = await Promise.all([
    admin.from("campaign_jobs").select("id, company_id, platform, spec").eq("id", jobId).single(),
    admin
      .from("campaign_payments")
      .select("id, status, base_cents, total_cents")
      .eq("job_id", jobId)
      .single(),
  ]);
  if (!job || job.platform !== "meta") throw new Error("La orden de Meta no existe.");
  if (!payment || payment.status !== "paid") throw new Error("PayPhone aun no ha confirmado este pago.");
  return { job, payment };
}

async function getOrCreateDelivery(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
  companyId: string,
) {
  const existing = await admin
    .from("campaign_deliveries")
    .select("id, status, updated_at, provider_campaign_id, provider_adset_id, provider_creative_id, provider_ad_id, metadata")
    .eq("job_id", jobId)
    .eq("provider", "meta")
    .maybeSingle();
  if (existing.data) return existing.data as DeliveryRow;
  const created = await admin
    .from("campaign_deliveries")
    .insert({ job_id: jobId, company_id: companyId, provider: "meta", status: "ready" })
    .select("id, status, updated_at, provider_campaign_id, provider_adset_id, provider_creative_id, provider_ad_id, metadata")
    .single();
  if (!created.data) throw new Error("No se pudo inicializar la entrega en Meta.");
  return created.data as DeliveryRow;
}

async function getDelivery(admin: ReturnType<typeof createAdminClient>, jobId: string): Promise<DeliveryRow> {
  const { data } = await admin
    .from("campaign_deliveries")
    .select("id, status, updated_at, provider_campaign_id, provider_adset_id, provider_creative_id, provider_ad_id, metadata")
    .eq("job_id", jobId)
    .eq("provider", "meta")
    .single();
  if (!data) throw new Error("No existe la entrega de Meta para esta orden.");
  return data as DeliveryRow;
}

async function saveMetaProgress(
  admin: ReturnType<typeof createAdminClient>,
  deliveryId: string,
  progress: Partial<MetaCampaignIds>,
) {
  const update: Record<string, unknown> = { status: "creating" };
  if (progress.campaignId) update.provider_campaign_id = progress.campaignId;
  if (progress.adsetId) update.provider_adset_id = progress.adsetId;
  if (progress.creativeId) update.provider_creative_id = progress.creativeId;
  if (progress.adId) update.provider_ad_id = progress.adId;
  if (progress.sourcePostId) update.metadata = { source_post_id: progress.sourcePostId };
  await admin.from("campaign_deliveries").update(update).eq("id", deliveryId);
}

function deliveryToMetaIds(delivery: DeliveryRow): Partial<MetaCampaignIds> {
  return {
    campaignId: delivery.provider_campaign_id ?? undefined,
    adsetId: delivery.provider_adset_id ?? undefined,
    creativeId: delivery.provider_creative_id ?? undefined,
    adId: delivery.provider_ad_id ?? undefined,
    sourcePostId:
      typeof delivery.metadata?.source_post_id === "string"
        ? delivery.metadata.source_post_id
        : undefined,
  };
}

function requireDeliveryIds(delivery: DeliveryRow): MetaCampaignIds {
  const existing = deliveryToMetaIds(delivery);
  if (!existing.campaignId || !existing.adsetId || !existing.creativeId || !existing.adId) {
    throw new Error("El borrador de Meta esta incompleto.");
  }
  return {
    campaignId: existing.campaignId,
    adsetId: existing.adsetId,
    creativeId: existing.creativeId,
    adId: existing.adId,
    sourcePostId: existing.sourcePostId ?? "",
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
