"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { chatCompletion } from "@/lib/assistant/llm";
import { getLlmConfiguration } from "@/lib/assistant/llm-config";
import { parseBrandProfile, parseSocialCaptions, parseSocialPeriod, socialCaptionMessages, uuid, type SocialBrand, type SocialClient, type SocialPeriod, type SocialResult } from "@/lib/social-media";

function failure(message?: string): { ok: false; error: string } {
  return { ok: false, error: message?.includes("SOCIAL_CONFLICT") ? "Otra persona guardó cambios. Recarga la página antes de guardar; conserva tu texto si lo necesitas."
    : message?.includes("BRAND_REQUIRED") ? "Guarda el logo oficial, el tono y las reglas de marca antes de aprobar."
    : message?.includes("CAPTION_REQUIRED") ? "Guarda un caption antes de aprobar la publicación."
    : "No se pudo completar la operación. Comprueba tu acceso y vuelve a intentarlo." };
}
export async function saveSocialBrand(companyId: string, clientId: string, version: number, input: unknown): Promise<SocialResult<SocialBrand>> {
  const profile = parseBrandProfile(input);
  if (!uuid(companyId) || !uuid(clientId) || !profile || !Number.isSafeInteger(version) || version < 0) return { ok: false, error: "Revisa los datos de la marca." };
  const db = await createClient();
  const { data, error } = await db.rpc("save_social_brand", { p_company: companyId, p_client: clientId, p_version: version, p_profile: profile });
  if (error || !Number.isSafeInteger(data)) return failure(error?.message);
  revalidatePath("/social-media"); return { ok: true, value: { profile, version: data } };
}
export async function saveSocialPeriod(input: unknown): Promise<SocialResult<SocialPeriod>> {
  const period = parseSocialPeriod(input);
  if (!period) return { ok: false, error: "Revisa el período, los canales y las fechas de cada publicación. El período admite hasta 366 días y 120 publicaciones." };
  const db = await createClient();
  const { data, error } = await db.rpc("save_social_period", { p_id: period.id, p_company: period.companyId, p_client: period.clientId, p_version: period.version, p_name: period.name, p_start: period.start, p_end: period.end, p_brief: period.brief, p_posts: period.posts });
  if (error || !data) return failure(error?.message);
  const saved = parseSocialPeriod({ ...period, version: data.version, posts: data.posts });
  if (!saved) return failure();
  revalidatePath("/social-media"); return { ok: true, value: saved };
}
export async function reviewSocialPost(periodId: string, postId: string, version: number, approve: boolean): Promise<SocialResult<{ version: number; posts: SocialPeriod["posts"] }>> {
  if (!uuid(periodId) || !uuid(postId) || !Number.isSafeInteger(version) || version < 1 || typeof approve !== "boolean") return failure();
  const db = await createClient();
  const { data, error } = await db.rpc("review_social_post", { p_period: periodId, p_post: postId, p_version: version, p_approve: approve });
  if (error || !data) return failure(error?.message);
  revalidatePath("/social-media"); return { ok: true, value: data };
}
export async function createSocialClient(companyId: string, name: string, category: string): Promise<SocialResult<SocialClient>> {
  if (!uuid(companyId) || !name.trim() || name.length > 180 || category.length > 180) return { ok: false, error: "Escribe un nombre de cliente de hasta 180 caracteres." };
  const db = await createClient();
  const { data, error } = await db.rpc("create_social_client", { p_company: companyId, p_name: name, p_category: category });
  if (error || !data?.id) return failure(error?.message);
  revalidatePath("/social-media"); return { ok: true, value: data };
}
export async function generateSocialCaptions(input: unknown, postId: string): Promise<SocialResult<string[]>> {
  const period = parseSocialPeriod(input);
  const post = period?.posts.find(p => p.id === postId);
  if (!period || !post) return { ok: false, error: "Completa el tema, el período y la fecha de la publicación." };
  if (!period.brief.objective.trim() || !post.direction.trim()) return { ok: false, error: "Completa el objetivo del briefing y la dirección creativa de esta pieza." };
  const config = getLlmConfiguration();
  if (process.env.AI_ASSISTANT_ENABLED !== "true" || !config) return { ok: false, error: "Mavi no está disponible en este momento. Puedes escribir y guardar el caption manualmente." };
  const db = await createClient();
  const { data: allowed, error: accessError } = await db.rpc("social_access", { p_company: period.companyId, p_mode: "edit" });
  if (accessError || !allowed) return failure();
  const [client, brand] = await Promise.all([
    db.from("workspace_clients").select("name").eq("id", period.clientId).eq("company_id", period.companyId).maybeSingle(),
    db.from("social_brands").select("profile").eq("client_id", period.clientId).eq("company_id", period.companyId).maybeSingle(),
  ]);
  const profile = parseBrandProfile(brand.data?.profile);
  if (!client.data || !profile?.tone.trim() || !profile.rules.trim()) return { ok: false, error: "Guarda primero el tono y las reglas de marca del cliente." };
  const { data: claimed, error } = await db.rpc("claim_social_caption", { p_company: period.companyId });
  if (error || !claimed) return { ok: false, error: "Espera 30 segundos entre solicitudes de captions e inténtalo otra vez." };
  try {
    const raw = await chatCompletion(socialCaptionMessages(client.data.name, profile, period, post), { json: true, maxTokens: 2500, temperature: 0.6, timeoutMs: 19000, fastFreeRouting: config.provider === "openrouter" && config.freeOnly, reasoningEnabled: false });
    const captions = parseSocialCaptions(raw);
    return captions ? { ok: true, value: captions } : { ok: false, error: "Mavi no devolvió tres opciones válidas. Tu caption actual se conserva; vuelve a intentarlo." };
  } catch { return { ok: false, error: "Mavi no pudo completar la solicitud. Tu contenido se conserva; puedes continuar escribiendo." }; }
}
