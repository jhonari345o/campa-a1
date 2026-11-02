"use server";
import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseDigitalCampaignBrief } from "@/lib/digital-campaign-brief";
export async function saveDigitalCampaignBrief(orderId: string, version: number, input: unknown): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, error: "Inicia sesión para guardar la campaña." };
  if (!/^[a-f\d-]{36}$/i.test(orderId) || !Number.isSafeInteger(version) || version < 0) return { ok: false, error: "Recarga el espacio de campaña." };
  try {
    const brief = parseDigitalCampaignBrief(input), db = await createClient();
    const { data, error } = await db.rpc("save_catalog_digital_brief", { p_order: orderId, p_expected_version: version, p_brief: brief });
    if (error || !data) return { ok: false, error: error?.message.includes("BRIEF_CHANGED") ? "La configuración cambió en otra pestaña. Recarga antes de guardar." : "No se pudo guardar. Revisa el acceso y el estado de la compra." };
    revalidatePath(`/digital/${orderId}`);
    return { ok: true, version: Number(data.version) };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Revisa los datos de la campaña." }; }
}
