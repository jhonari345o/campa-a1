import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/social-media";
import { MAX_SOCIAL_ASSET_BYTES, SOCIAL_ASSET_BUCKET, validateSocialAsset } from "@/lib/social-media-assets";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request) {
  const respond = (error: string, status = 400) => NextResponse.json({ error }, { status, headers });
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).origin !== new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin) return respond("Solicitud no válida.", 403);
  } catch { return respond("Solicitud no válida.", 403); }
  const db = await createClient(), { data: { user } } = await db.auth.getUser();
  if (!user || user.app_metadata?.must_change_password === true) return respond("Inicia sesión para continuar.", 401);
  const limit = MAX_SOCIAL_ASSET_BYTES + 64 * 1024;
  if (Number(request.headers.get("content-length")) > limit || !request.body) return respond("Usa un archivo de hasta 4 MB.", 413);
  try {
    const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); return respond("Usa un archivo de hasta 4 MB.", 413); } chunks.push(value); }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
    const companyId = String(form.get("companyId") ?? ""), clientId = String(form.get("clientId") ?? ""), kind = form.get("kind"), file = form.get("file");
    if (!uuid(companyId) || !uuid(clientId) || kind !== "logo" && kind !== "manual" || !(file instanceof File)) return respond("Revisa el cliente y el archivo.");
    const { data: access } = await db.rpc("social_access", { p_company: companyId, p_mode: "edit" });
    const { data: client } = await db.from("workspace_clients").select("id").eq("id", clientId).eq("company_id", companyId).maybeSingle();
    if (!access || !client) return respond("No tienes permiso para cargar archivos para este cliente.", 403);
    const bytes = new Uint8Array(await file.arrayBuffer()), validation = await validateSocialAsset(bytes, file.type, kind);
    if (validation) return respond(validation);
    const id = crypto.randomUUID(), ext = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf" } as Record<string, string>)[file.type];
    const path = `${companyId}/${clientId}/${id}.${ext}`, name = file.name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 180) || `archivo.${ext}`;
    const { error: uploadError } = await db.storage.from(SOCIAL_ASSET_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError) return respond("No se pudo cargar el archivo. Vuelve a intentarlo.", 503);
    const { data, error } = await db.from("social_assets").insert({ id, company_id: companyId, client_id: clientId, kind, name, mime: file.type, size: bytes.length, storage_path: path }).select("id,kind,name,mime,size,created_at").single();
    if (error || !data) { await db.storage.from(SOCIAL_ASSET_BUCKET).remove([path]); return respond("No se pudo guardar el archivo. Vuelve a intentarlo.", 503); }
    return NextResponse.json({ asset: { id: data.id, kind: data.kind, name: data.name, mime: data.mime, size: data.size, createdAt: data.created_at } }, { headers });
  } catch { return respond("No se pudo procesar el archivo. Vuelve a intentarlo.", 400); }
}
