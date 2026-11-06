"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEGAL_VERSIONS, REQUIRED_PROCESSING_PURPOSES, safeInternalReturnPath } from "@/lib/legal";

export type ConsentResult = { ok: false; error: string } | null;

export async function acceptLegalTerms(_previous: ConsentResult, formData: FormData): Promise<ConsentResult> {
  if (formData.get("terms") !== "accepted" || formData.get("processing") !== "accepted") {
    return { ok: false, error: "Debes aceptar los términos y el tratamiento necesario para utilizar la plataforma." };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu sesión expiró. Inicia sesión nuevamente." };
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 500) || null;
  const benchmarkContribution = formData.get("benchmark") === "accepted";
  const admin = createAdminClient();
  const { data: acceptance, error } = await admin.from("legal_acceptances").upsert({
    user_id: user.id,
    terms_version: LEGAL_VERSIONS.terms,
    privacy_version: LEGAL_VERSIONS.privacy,
    treatment_version: LEGAL_VERSIONS.treatment,
    required_processing: true,
    benchmark_contribution: benchmarkContribution,
    purposes: REQUIRED_PROCESSING_PURPOSES,
    accepted_at: new Date().toISOString(),
    revoked_at: null,
    acceptance_channel: "web",
    user_agent: userAgent,
  }, { onConflict: "user_id,terms_version,privacy_version,treatment_version" }).select("id").single();
  if (error) return { ok: false, error: "No pudimos registrar tu aceptación. Intenta nuevamente." };
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "legal.accepted",
    entity: "legal_acceptances",
    entity_id: acceptance?.id ?? user.id,
    metadata: { versions: LEGAL_VERSIONS, benchmark_contribution: benchmarkContribution },
  });
  redirect(safeInternalReturnPath(formData.get("next")));
}

export async function revokeLegalConsent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");
  const admin = createAdminClient();
  await admin.from("legal_acceptances").update({ revoked_at: new Date().toISOString() }).eq("user_id", user.id).is("revoked_at", null);
  await admin.from("audit_log").insert({ actor_id: user.id, action: "legal.consent_revoked", entity: "legal_acceptances", entity_id: user.id, metadata: { versions: LEGAL_VERSIONS } });
  await supabase.auth.signOut();
  redirect("/ingresar?consent=revoked");
}
