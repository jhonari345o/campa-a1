import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ALLOWED = new Set([
  "pendiente",
  "en_proceso",
  "listo_para_revision",
  "publicada",
  "error",
  "cancelada",
]);

/**
 * El agente trabajador reporta el estado de un trabajo.
 * Body: { id, status, log? }. Auth: Bearer <AGENT_WORKER_TOKEN>.
 */
export async function POST(request: Request) {
  const token = process.env.AGENT_WORKER_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Agente no configurado." }, { status: 503 });
  }
  if ((request.headers.get("authorization") ?? "") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  let body: { id?: string; status?: string; log?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo invalido." }, { status: 400 });
  }
  if (!body.id || !body.status || !ALLOWED.has(body.status)) {
    return NextResponse.json({ error: "id o status invalido." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Falta la clave de servicio." }, { status: 503 });
  }

  const { error } = await admin
    .from("campaign_jobs")
    .update({ status: body.status, log: body.log ?? null })
    .eq("id", body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
