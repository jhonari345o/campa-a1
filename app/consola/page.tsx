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
        <MetaConnectionCenter />
        <IntegrationReadiness />
        <LaunchChecklist />
      </main>
    </div>
  );
}

function MetaConnectionCenter() {
  const configured = isMetaConfigured();
  const creditConfirmed = process.env.META_CREDIT_LINE_CONFIRMED === "true";
  const accountId = maskMetaId(process.env.META_AD_ACCOUNT_ID);
  const pageId = maskMetaId(process.env.META_PAGE_ID);
  const instagramId = maskMetaId(process.env.META_INSTAGRAM_USER_ID);
  const steps = [
    { number: "01", title: "Autorizar", detail: "Pegar un token de sistema o larga duración. Nunca se muestra después." },
    { number: "02", title: "Elegir activos", detail: "Descubrir y seleccionar cuenta publicitaria, página e Instagram." },
    { number: "03", title: "Confirmar crédito", detail: "Verificar en Meta la línea de crédito o método de pago de esa cuenta." },
    { number: "04", title: "Validar y desplegar", detail: "Comprobar permisos en solo lectura y publicar la conexión en Amplify." },
  ];
  return <section className="mt-8 overflow-hidden rounded-panel border border-forest/20 bg-white shadow-panel">
    <div className="grid gap-7 bg-forest p-7 text-white lg:grid-cols-[1.25fr_.75fr]">
      <div>
        <p className="text-xs font-black uppercase tracking-[.16em] text-signal">Conexión financiera y publicitaria</p>
        <h2 className="mt-2 text-2xl font-black">Meta Ads y línea de crédito</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
          La línea de crédito pertenece a la cuenta publicitaria de Meta, no al token. El asistente seguro permite elegir la cuenta correcta, validar la página e Instagram y desplegarla sin guardar secretos en Supabase.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href="http://127.0.0.1:4177" target="_blank" rel="noreferrer" className="btn btn-primary">Abrir asistente seguro →</a>
          <a href="https://business.facebook.com/settings/ad-accounts" target="_blank" rel="noreferrer" className="btn border-white/20 bg-white/10 text-white hover:bg-white/15">Revisar crédito en Meta ↗</a>
        </div>
        <p className="mt-3 text-[10px] text-white/40">Disponible únicamente cuando la consola local está ejecutándose con <b className="text-white/60">npm run admin:dev</b>.</p>
      </div>
      <div className="grid gap-2 self-start">
        <MetaStatus label="Conexión base" ready={configured} value={configured ? "Token y activos presentes" : "Faltan credenciales"} />
        <MetaStatus label="Cuenta publicitaria" ready={Boolean(accountId)} value={accountId || "Sin seleccionar"} />
        <MetaStatus label="Página / Instagram" ready={Boolean(pageId && instagramId)} value={pageId && instagramId ? `${pageId} · ${instagramId}` : "Vinculación incompleta"} />
        <MetaStatus label="Línea de crédito" ready={creditConfirmed} value={creditConfirmed ? "Confirmada por el operador" : "Requiere confirmación en Meta"} />
      </div>
    </div>
    <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step) => <article key={step.number} className="rounded-xl border border-border bg-fog p-4"><span className="text-xs font-black text-signal-dark">{step.number}</span><strong className="mt-2 block text-sm text-forest">{step.title}</strong><p className="mt-1 text-xs leading-relaxed text-muted">{step.detail}</p></article>)}
    </div>
    <p className="border-t border-border bg-amber/10 px-6 py-3 text-xs font-bold text-forest">Guardar esta conexión no transfiere crédito, no activa anuncios y no habilita gasto real. Meta cobrará a la cuenta publicitaria seleccionada según su facturación configurada.</p>
  </section>;
}

function MetaStatus({ label, ready, value }: { label: string; ready: boolean; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3"><div><span className="block text-[9px] font-black uppercase tracking-wide text-white/40">{label}</span><strong className="mt-1 block text-xs text-white">{value}</strong></div><span className={`size-3 shrink-0 rounded-full ${ready ? "bg-signal shadow-[0_0_0_4px_rgba(0,161,0,.18)]" : "bg-coral shadow-[0_0_0_4px_rgba(255,111,97,.12)]"}`} /></div>;
}

function LaunchChecklist() {
  const items = [
    { priority: "P0", label: "Conexión Meta validada", ready: isMetaConfigured(), detail: "Token, cuenta publicitaria, página e Instagram." },
    { priority: "P0", label: "Línea de crédito confirmada", ready: process.env.META_CREDIT_LINE_CONFIRMED === "true", detail: "La cuenta elegida factura a la empresa correcta." },
    { priority: "P0", label: "Borrador Meta en PAUSED", ready: isMetaPausedDraftsEnabled(), detail: "Prueba sin gasto antes de activar campañas." },
    { priority: "P0", label: "dLocal Go productivo", ready: isDlocalConfigured() && process.env.DLOCALGO_ENV === "live", detail: "Credenciales live, webhook y conciliación controlada." },
    { priority: "P0", label: "Cobro real autorizado", ready: isCommercialPaymentsEnabled(), detail: "Activar solo después de la prueba financiera." },
    { priority: "P0", label: "Gasto real Meta autorizado", ready: isMetaRealSpendEnabled(), detail: "Doble aprobación y tope inicial de inversión." },
    { priority: "P0", label: "Seguridad y recuperación", ready: false, detail: "Adjuntar evidencia de WAF, MFA, staging, restauración y pentest." },
    { priority: "P1", label: "Consola de coordinación", ready: false, detail: "Asignación, SLA, cotización, proveedor, adjuntos y cambio de estado." },
    { priority: "P1", label: "Ledger y facturación", ready: false, detail: "Conciliar dLocal, reserva de medios, factura Meta, comisión y procesador." },
    { priority: "P1", label: "Catálogo e inventario vigentes", ready: false, detail: "Disponibilidad, reserva anti-duplicidad, fecha y responsable del dato." },
    { priority: "P1", label: "Aprobación legal y contable", ready: false, detail: "Tratamiento del 22%, DPA, devoluciones y contracargos." },
  ];
  const completed = items.filter((item) => item.ready).length;
  return <section className="mt-8 rounded-panel border border-border bg-white p-7 shadow-panel">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-signal-dark">Lista de cierre</p><h2 className="mt-1 text-xl font-black">Qué falta para operar directamente</h2><p className="mt-1 text-sm text-muted">Los controles externos permanecen pendientes hasta adjuntar evidencia; no se marcan completos por suposición.</p></div><span className="rounded-full bg-forest px-4 py-2 text-xs font-black text-white">{completed}/{items.length} verificados</span></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">{items.map((item) => <article key={item.label} className={`rounded-xl border p-4 ${item.ready ? "border-signal/30 bg-signal/5" : "border-border bg-fog"}`}><div className="flex items-center justify-between gap-3"><strong className="text-sm text-forest">{item.label}</strong><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${item.ready ? "bg-signal/15 text-signal-dark" : "bg-coral/10 text-[#a13b31]"}`}>{item.ready ? "Verificado" : `${item.priority} pendiente`}</span></div><p className="mt-2 text-xs leading-relaxed text-muted">{item.detail}</p></article>)}</div>
  </section>;
}

function maskMetaId(value?: string) {
  const clean = value?.trim();
  if (!clean) return "";
  return clean.length <= 8 ? clean : `${clean.slice(0, 4)}…${clean.slice(-4)}`;
}

function IntegrationReadiness() {
  const checks = [
    { label: "Mavi IA", ready: isAiAssistantEnabled() && Boolean(process.env.OPENROUTER_API_KEY || process.env.BEDROCK_MODEL_ID || process.env.DEEPSEEK_API_KEY), detail: isAiWebTrendsEnabled() ? "IA y señales web habilitadas" : "IA activa; tendencias web deshabilitadas" },
    { label: "Mapas", ready: true, detail: process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY ? "OpenStreetMap + Google Maps configurado" : "OpenStreetMap activo; Google satélite/360 sin clave embebida" },
    { label: "dLocal Go", ready: isDlocalConfigured(), detail: isDlocalConfigured() ? `${process.env.DLOCALGO_ENV === "live" ? "Producción" : "Sandbox"} configurado` : "Faltan API Key y Secret Key" },
    { label: "Cobros reales", ready: isCommercialPaymentsEnabled(), detail: isCommercialPaymentsEnabled() ? "Interruptor activo" : "Interruptor bloqueado" },
    { label: "Meta Marketing API", ready: isMetaConfigured(), detail: isMetaConfigured() ? "Credenciales base presentes" : "Faltan token, cuenta publicitaria o página" },
    { label: "Facturación Meta", ready: process.env.META_CREDIT_LINE_CONFIRMED === "true", detail: process.env.META_CREDIT_LINE_CONFIRMED === "true" ? "Cuenta publicitaria y línea de crédito confirmadas" : "Falta confirmar la facturación de la cuenta elegida" },
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
