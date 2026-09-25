import { createClient } from "@supabase/supabase-js";

/**
 * Cliente administrativo con la service_role key. SALTA las politicas RLS.
 *
 * REGLAS:
 *  - Usar SOLO en el servidor (Server Actions / Route Handlers), nunca en el
 *    navegador. La service_role key jamas se envia al cliente.
 *  - Reservado para la Consola de Alta de Clientes del equipo Ad Mavericks:
 *    crear empresas, generar codigos de registro e invitar usuarios.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.",
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
