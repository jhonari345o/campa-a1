import type { PlanBrief } from "@/app/planificador/actions";

export type SavePlanInput = { brief: PlanBrief; fingerprint: string; requireAi: boolean };
export type SavePlanResult = { ok: true; id: string } | { ok: false; error: string };

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
const failure = (error: string, status: number) => Response.json({ ok: false, error }, { status, headers });
const maxBytes = 32_000;

/** Sends only the brief and expected revision; all prices and selections are rebuilt on the server. */
export async function handlePlanSaveRequest(request: Request, save: (input: SavePlanInput) => Promise<SavePlanResult>, siteUrl?: string): Promise<Response> {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).origin !== new URL(siteUrl || request.url).origin) return failure("Origen no permitido.", 403);
  } catch { return failure("Origen no permitido.", 403); }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return failure("Tipo de contenido no admitido.", 415);
  if (Number(request.headers.get("content-length")) > maxBytes) return failure("El brief es demasiado extenso.", 413);

  let value: unknown;
  const reader = request.body?.getReader();
  if (!reader) return failure("No se recibió el brief.", 400);
  try {
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      size += chunk.byteLength;
      if (size > maxBytes) { await reader.cancel(); return failure("El brief es demasiado extenso.", 413); }
      chunks.push(chunk);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return failure("El brief no se pudo leer.", 400); }
  finally { reader.releaseLock(); }

  if (!value || typeof value !== "object" || Array.isArray(value)) return failure("Solicitud inválida.", 400);
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !["brief", "fingerprint", "requireAi"].includes(key)) ||
      !input.brief || typeof input.brief !== "object" || Array.isArray(input.brief) ||
      typeof input.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(input.fingerprint) ||
      typeof input.requireAi !== "boolean") return failure("Genera la recomendación antes de guardar el plan.", 400);
  try {
    // A write has no automatic retry or racing timeout: its outcome must not be reported as a confirmed failure while it can still commit.
    return Response.json(await save(input as SavePlanInput), { headers });
  } catch {
    return failure("No se pudo confirmar el guardado. Revisa tus planes antes de intentarlo nuevamente.", 503);
  }
}
