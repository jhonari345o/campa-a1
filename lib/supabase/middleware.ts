import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LEGAL_VERSIONS } from "@/lib/legal";

const CONSENT_PROTECTED_ROUTES = [
  "/panel", "/consola", "/mercado", "/planificador", "/asistente",
  "/campanas", "/pautar", "/reportes", "/laboratorio", "/clientes", "/creditos", "/proveedores",
  "/cuenta/configuracion",
];

/**
 * Refresca la sesion de Supabase en cada request y la propaga por cookies.
 * Debe llamarse desde middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin claves configuradas todavia: dejar pasar sin tocar la sesion.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
      ) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refresca el token si hace falta y exige la aceptación legal vigente antes
  // de entrar al workspace. Si la migración todavía no existe, no bloqueamos
  // el sitio durante el despliegue escalonado.
  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const needsConsent = CONSENT_PROTECTED_ROUTES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (user?.app_metadata?.must_change_password === true && needsConsent) {
    const target = request.nextUrl.clone(); target.pathname = "/cuenta/activar"; target.search = "";
    const redirected = NextResponse.redirect(target);
    response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
    return redirected;
  }
  if (user && needsConsent) {
    const { data: acceptance, error } = await supabase
      .from("legal_acceptances")
      .select("id")
      .eq("user_id", user.id)
      .eq("terms_version", LEGAL_VERSIONS.terms)
      .eq("privacy_version", LEGAL_VERSIONS.privacy)
      .eq("treatment_version", LEGAL_VERSIONS.treatment)
      .is("revoked_at", null)
      .maybeSingle();
    if (!error && !acceptance) {
      const consentUrl = request.nextUrl.clone();
      consentUrl.pathname = "/consentimiento";
      consentUrl.search = "";
      consentUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      const redirectResponse = NextResponse.redirect(consentUrl);
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }
  }

  return response;
}
