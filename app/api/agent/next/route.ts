import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * El agente trabajador reclama el siguiente trabajo pendiente.
 * Autenticacion: header  Authorization: Bearer <AGENT_WORKER_TOKEN>
 */
export async function POST(request: Request) {
  const token = process.env.AGENT_WORKER_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Agente no configurado (falta AGENT_WORKER_TOKEN)." }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Falta la clave de servicio." }, { status: 503 });
  }

  const { data: pending } = await admin
    .from("campaign_jobs")
    .select("id, platform, spec")
    .eq("status", "pendiente")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!pending) return NextResponse.json({ job: null });

  // Reclama el trabajo (evita que dos agentes tomen el mismo).
  const { data: claimed } = await admin
    .from("campaign_jobs")
    .update({ status: "en_proceso" })
    .eq("id", pending.id)
    .eq("status", "pendiente")
    .select("id, platform, spec")
    .maybeSingle();

  if (!claimed) return NextResponse.json({ job: null });
  return NextResponse.json({ job: claimed });
}
