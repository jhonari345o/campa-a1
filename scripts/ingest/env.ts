import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente administrativo (service_role) para los scripts de ingesta.
 * Ejecutar con las claves cargadas, p.ej.:
 *   npx tsx --env-file=.env.local scripts/ingest/import.ts ...
 */
export function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Corre con: npx tsx --env-file=.env.local scripts/ingest/import.ts ...",
    );
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function logStep(msg: string) {
  process.stdout.write(`  · ${msg}\n`);
}
