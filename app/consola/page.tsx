import { redirect } from "next/navigation";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CrearClienteForm } from "./CrearClienteForm";
import { cerrarSesion } from "./actions";
import { isDlocalConfigured } from "@/lib/payments/dlocal";
import { isMetaConfigured } from "@/lib/ads/meta";
import { isAiAssistantEnabled, isAiWebTrendsEnabled, isCommercialPaymentsEnabled, isMetaPausedDraftsEnabled, isMetaRealSpendEnabled } from "@/lib/commercial";
import { BILLING_EMAIL } from "@/lib/legal";

export const metadata = { title: "Consola de Alta" };

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default async function ConsolaPage() {
  if (!supabaseConfigured) return <SetupNotice />;

  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");
  if (!profile.is_platform_admin) return <AccessDenied />;

  const supabase = await createClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, status, seats, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="min-h-screen">
      <ConsolaHeader name={profile.full_name ?? profile.email ?? "Ad Mavericks"} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
          <CrearClienteForm />
          <RecentClients companies={companies ?? []} />
        </div>
        <IntegrationReadiness />
      </main>
    </div>
  );
}

function IntegrationReadiness() {
  const checks = [
    { label: "Mavi IA", ready: isAiAssistantEnabled() && Boolean(process.env.OPENROUTER_API_KEY || process.env.BEDROCK_MODEL_ID || process.env.DEEPSEEK_API_KEY), detail: isAiWebTrendsEnabled() ? "IA y señales web habilitadas" : "IA activa; tendencias web deshabilitadas" },
    { label: "Mapas", ready: true, detail: process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY ? "OpenStreetMap + Google Maps configurado" : "OpenStreetMap activo; Google satélite/360 sin clave embebida" },
    { label: "dLocal Go", ready: isDlocalConfigured(), detail: isDlocalConfigured() ? `${process.env.DLOCALGO_ENV === "live" ? "Producción" : "Sandbox"} configurado` : "Faltan API Key y Secret Key" },
    { label: "Cobros reales", ready: isCommercialPaymentsEnabled(), detail: isCommercialPaymentsEnabled() ? "Interruptor activo" : "Interruptor bloqueado" },
    { label: "Meta Marketing API", ready: isMetaConfigured(), detail: isMetaConfigured() ? "Credenciales base presentes" : "Faltan token, cuenta publicitaria o página" },
    { label: "Borrador Meta en pausa", ready: isMetaPausedDraftsEnabled(), detail: isMetaPausedDraftsEnabled() ? "Prueba pausada habilitada" : "Bloqueado" },
    { label: "Gasto real Meta", ready: isMetaRealSpendEnabled(), detail: isMetaRealSpendEnabled() ? "Gasto habilitado" : "Bloqueado hasta aprobación final" },
  ];
  return <section className="mt-8 rounded-panel border border-border bg-white p-7 shadow-panel">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-signal-dark">Solo equipo</p><h2 className="mt-1 text-xl font-black">Preparación para producción</h2><p className="mt-1 text-sm text-muted">Este panel muestra presencia e interruptores; nunca expone secretos.</p></div><a className="btn btn-secondary" href={`mailto:${BILLING_EMAIL}?subject=Soporte%20de%20integraciones`}>Soporte e incidencias →</a></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{checks.map((check) => <article key={check.label} className="rounded-xl border border-border bg-fog p-4"><span className={`text-[10px] font-black uppercase ${check.ready ? "text-signal-dark" : "text-[#a13b31]"}`}>{check.ready ? "✓ Configurado" : "! Pendiente"}</span><strong className="mt-1 block text-sm text-forest">{check.label}</strong><p className="mt-1 text-xs text-muted">{check.detail}</p></article>)}</div>
  </section>;
}

function ConsolaHeader({ name }: { name: string }) {
  return (
    <header className="border-b border-border bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Wordmark one className="text-lg" />
          <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-forest">
            Consola de Alta
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm font-bold text-muted sm:block">{name}</span>
          <form action={cerrarSesion}>
            <button type="submit" className="text-sm font-black text-forest hover:text-signal-dark">
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

type Company = { id: string; name: string; status: string; seats: number; created_at: string };
function RecentClients({ companies }: { companies: Company[] }) {
  return (
    <section className="rounded-panel border border-border bg-white p-8 shadow-panel">
      <h2 className="text-xl font-black tracking-tight">Clientes recientes</h2>
      <p className="mt-1 text-sm text-muted">Ultimos clientes dados de alta.</p>
      {companies.length === 0 ? (
        <p className="mt-6 rounded-xl border border-border bg-fog px-4 py-6 text-center text-sm text-muted">
          Aun no hay clientes. Crea el primero con el formulario.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {companies.map((c) => {
            return (
              <li key={c.id} className="rounded-xl border border-border bg-fog px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-black text-forest">{c.name}</span>
                  <span className="text-xs font-black uppercase text-signal-dark">{c.status}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{c.seats} usuarios · altas desde consola local</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AccessDenied() {
  return (
    <CenteredPanel title="Acceso restringido">
      <p className="text-sm text-muted">
        Esta consola es solo para el equipo de Ad Mavericks. Tu cuenta no tiene
        permisos de administrador de plataforma.
      </p>
      <div className="mt-6 flex gap-3">
        <form action={cerrarSesion}>
          <button type="submit" className="btn btn-secondary text-sm">
            Salir
          </button>
        </form>
        <Link href="/" className="btn btn-ghost text-sm">
          Ir al inicio
        </Link>
      </div>
    </CenteredPanel>
  );
}

function SetupNotice() {
  return (
    <CenteredPanel title="Falta configurar Supabase">
      <p className="text-sm text-muted">
        Agrega <code>NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> y{" "}
        <code>SUPABASE_SERVICE_ROLE_KEY</code> en el entorno, y ejecuta{" "}
        <code>supabase/schema.sql</code> en el proyecto para habilitar la Consola.
      </p>
      <div className="mt-6">
        <Link href="/" className="btn btn-secondary text-sm">
          Volver al inicio
        </Link>
      </div>
    </CenteredPanel>
  );
}

function CenteredPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="rounded-panel border border-border bg-white p-8 shadow-panel">
        <Wordmark one className="text-base" />
        <h1 className="mt-6 text-2xl font-black tracking-tight">{title}</h1>
        <div className="mt-3">{children}</div>
      </div>
    </main>
  );
}
