import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { JOB_STATUS, PLATFORM_LABEL, type JobStatus } from "@/lib/jobs";
import { clsx } from "@/lib/clsx";
import { MaviScene } from "@/components/Mavi";
import { MaviShowcase } from "@/components/MaviShowcase";
import { isMetaPausedDraftsEnabled, isMetaRealSpendEnabled } from "@/lib/commercial";
import {
  activarPautaMeta,
  actualizarMetricasMeta,
  pausarPautaMeta,
  prepararPautaMeta,
} from "./actions";

export const metadata = { title: "Mis campanas" };

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

type Job = {
  id: string;
  platform: string;
  status: JobStatus;
  log: string | null;
  created_at: string;
  spec: {
    objetivo?: string;
    presupuesto_usd?: number | null;
    tipo?: string;
    red?: string;
    geo?: string;
    post_url?: string;
    comision_usd?: number;
    total_pagado_usd?: number;
    metrics?: {
      impresiones?: number;
      alcance?: number;
      clics?: number;
      gasto_usd?: number;
    } | null;
    metrics_actualizadas_at?: string;
  } | null;
  companies: { name: string } | null;
  payment?: { provider: string; status: string; total_cents: number } | null;
  delivery?: {
    status: string;
    provider_campaign_id: string | null;
    provider_ad_id: string | null;
    error: string | null;
  } | null;
};

type PaymentRow = { job_id: string; provider: string; status: string; total_cents: number };
type DeliveryRow = {
  job_id: string;
  status: string;
  provider_campaign_id: string | null;
  provider_ad_id: string | null;
  error: string | null;
};

const nfmt = (n: number) => new Intl.NumberFormat("es-EC").format(n);

export default async function CampanasPage({
  searchParams,
}: {
  searchParams: Promise<{ meta?: string; detail?: string }>;
}) {
  if (!supabaseConfigured) redirect("/consola");
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");
  const isAdmin = profile.is_platform_admin;
  const metaDraftsEnabled = isMetaPausedDraftsEnabled();
  const metaSpendEnabled = isMetaRealSpendEnabled();

  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_jobs")
    .select("id, platform, status, log, created_at, spec, companies(name)")
    .order("created_at", { ascending: false })
    .limit(50);
  const jobs = (data ?? []) as unknown as Job[];
  const jobIds = jobs.map((job) => job.id);
  if (jobIds.length > 0) {
    const [{ data: payments }, { data: deliveries }] = await Promise.all([
      supabase.from("campaign_payments").select("job_id, provider, status, total_cents").in("job_id", jobIds),
      supabase
        .from("campaign_deliveries")
        .select("job_id, status, provider_campaign_id, provider_ad_id, error")
        .in("job_id", jobIds),
    ]);
    const paymentByJob = new Map((payments as PaymentRow[] | null)?.map((row) => [row.job_id, row]));
    const deliveryByJob = new Map((deliveries as DeliveryRow[] | null)?.map((row) => [row.job_id, row]));
    jobs.forEach((job) => {
      job.payment = paymentByJob.get(job.id) ?? null;
      job.delivery = deliveryByJob.get(job.id) ?? null;
    });
  }
  const pendientes = jobs.filter((j) =>
    ["pendiente", "en_proceso", "esperando_pago", "pagada", "lista_para_publicar", "publicando"].includes(j.status),
  ).length;
  const sp = await searchParams;

  return (
    <div className="min-h-screen">
      <AppHeader
        name={profile.full_name ?? profile.email ?? "Ad Mavericks"}
        isAdmin={profile.is_platform_admin}
        active="campanas"
      />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center gap-4">
          <MaviScene
            height={92}
            motion={pendientes > 0 ? "peek" : "float"}
            prop={pendientes > 0 ? "⏰" : "🚀"}
            className="hidden shrink-0 sm:block"
          />
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              {isAdmin ? "Campanas de tus clientes" : "Mis campanas"}
            </h1>
            <p className="mt-1 text-muted">
              {isAdmin
                ? `Cola de TODOS los clientes${pendientes > 0 ? ` — ${pendientes} en espera.` : "."} Cada cliente solo ve las suyas.`
                : pendientes > 0
                  ? `Tienes ${pendientes} solicitud${pendientes === 1 ? "" : "es"} en revision.`
                  : "Estado de las solicitudes preparadas para revision humana."}
            </p>
          </div>
        </div>

        {isAdmin && (!metaDraftsEnabled || !metaSpendEnabled) && (
          <div className="mt-5 rounded-xl border border-amber/50 bg-amber/10 px-4 py-3 text-sm text-forest">
            <p className="font-black">Control de lanzamiento activo</p>
            <p className="mt-1">
              {metaDraftsEnabled
                ? "Los borradores pausados estan habilitados; el gasto real sigue bloqueado."
                : "La creacion de borradores y el gasto real siguen bloqueados hasta completar la validacion tecnica y comercial."}
            </p>
          </div>
        )}

        {sp.meta && <MetaResultNotice result={sp.meta} detail={sp.detail} />}

        {jobs.length === 0 ? (
          <>
            <MaviShowcase />
            <p className="mt-6 rounded-panel border border-border bg-fog px-4 py-8 text-center text-sm text-muted">
              Aun no has enviado campanas. Ve al{" "}
              <a href="/planificador" className="font-black text-signal-dark hover:underline">
                Planificador
              </a>{" "}
              y prepara una solicitud para revision.
            </p>
          </>
        ) : (
          <ul className="mt-8 space-y-3">
            {jobs.map((j) => {
              const st = JOB_STATUS[j.status];
              return (
                <li key={j.id} className="rounded-panel border border-border bg-white p-5 shadow-panel">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-forest">{PLATFORM_LABEL[j.platform] ?? j.platform}</span>
                      {isAdmin && j.companies?.name && (
                        <span className="rounded-full bg-forest/10 px-2.5 py-0.5 text-xs font-black text-forest">
                          {j.companies.name}
                        </span>
                      )}
                    </div>
                    <StatusBadge tone={st.tone} label={st.label} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    {j.spec?.objetivo && <span>{j.spec.objetivo}</span>}
                    {j.spec?.geo && <span>📍 {j.spec.geo}</span>}
                    {j.spec?.presupuesto_usd != null && <span>Recarga: ${j.spec.presupuesto_usd}</span>}
                    {j.spec?.total_pagado_usd != null && (
                      <span className="font-bold text-forest">
                        Pagado: ${j.spec.total_pagado_usd}
                        {isAdmin && j.spec?.comision_usd != null ? ` (ganancia $${j.spec.comision_usd})` : ""}
                      </span>
                    )}
                    <span>{new Date(j.created_at).toLocaleString("es-EC")}</span>
                  </div>
                  {j.spec?.post_url && (
                    <a
                      href={j.spec.post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-black text-signal-dark hover:underline"
                    >
                      Ver publicacion pautada ↗
                    </a>
                  )}

                  {j.payment && (
                    <p className="mt-2 text-xs font-bold text-forest">
                      {paymentProviderLabel(j.payment.provider)}: {paymentLabel(j.payment.status)} · ${(j.payment.total_cents / 100).toFixed(2)}
                    </p>
                  )}

                  {isAdmin && j.platform === "meta" && j.payment?.status === "paid" && (
                    <MetaControls
                      job={j}
                      draftsEnabled={metaDraftsEnabled}
                      spendEnabled={metaSpendEnabled}
                    />
                  )}

                  {/* Dashboard de metricas de la pauta */}
                  <MetricsPanel
                    metrics={j.spec?.metrics ?? null}
                    active={j.status === "publicada"}
                    updatedAt={j.spec?.metrics_actualizadas_at}
                  />

                  {j.log && <p className="mt-2 whitespace-pre-wrap text-xs text-muted">{j.log}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function MetaControls({
  job,
  draftsEnabled,
  spendEnabled,
}: {
  job: Job;
  draftsEnabled: boolean;
  spendEnabled: boolean;
}) {
  const delivery = job.delivery;
  const canPrepare = !delivery || ["ready", "error"].includes(delivery.status);
  return (
    <div className="mt-3 rounded-xl border border-forest/20 bg-forest/5 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-forest">Control real de Meta</p>
      {delivery?.provider_campaign_id && (
        <p className="mt-1 text-[11px] text-muted">Campaña Meta: {delivery.provider_campaign_id}</p>
      )}
      {delivery?.error && <p className="mt-1 text-xs font-bold text-[#a13b31]">{delivery.error}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {canPrepare && draftsEnabled && (
          <form action={prepararPautaMeta}>
            <input type="hidden" name="job_id" value={job.id} />
            <button type="submit" className="btn btn-secondary text-xs">
              {delivery?.status === "error" ? "Reintentar borrador pausado" : "Crear borrador pausado"}
            </button>
          </form>
        )}
        {delivery?.status === "paused" && spendEnabled && (
          <form action={activarPautaMeta} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="job_id" value={job.id} />
            <label className="flex items-center gap-1 text-[11px] font-bold text-forest">
              <input type="checkbox" name="confirm" value="ACTIVAR_PAUTA_REAL" required />
              Confirmo que empieza gasto real
            </label>
            <button type="submit" className="btn btn-primary text-xs">Activar en Meta</button>
          </form>
        )}
        {delivery?.status === "active" && (
          <>
            <form action={pausarPautaMeta}>
              <input type="hidden" name="job_id" value={job.id} />
              <button type="submit" className="btn btn-secondary text-xs">Pausar gasto</button>
            </form>
            <form action={actualizarMetricasMeta}>
              <input type="hidden" name="job_id" value={job.id} />
              <button type="submit" className="btn btn-secondary text-xs">Actualizar metricas</button>
            </form>
          </>
        )}
      </div>
      {!draftsEnabled && (
        <p className="mt-2 text-xs font-bold text-[#9a6a00]">
          La creacion en Meta esta bloqueada hasta aprobar los controles de lanzamiento.
        </p>
      )}
      {draftsEnabled && delivery?.status === "paused" && !spendEnabled && (
        <p className="mt-2 text-xs font-bold text-[#9a6a00]">
          Borrador disponible para revision; la activacion con gasto real permanece bloqueada.
        </p>
      )}
    </div>
  );
}

function MetaResultNotice({ result, detail }: { result: string; detail?: string }) {
  const messages: Record<string, string> = {
    borrador_listo: "Borrador creado en Meta y mantenido en pausa.",
    activada: "Pauta activada en Meta. El presupuesto ya puede empezar a consumirse.",
    pausada: "Pauta pausada en Meta.",
    metricas_actualizadas: "Metricas actualizadas desde Meta.",
    falta_confirmacion: "Debes confirmar expresamente el inicio del gasto real.",
    no_autorizado: "Solo el equipo administrador puede operar Meta.",
    orden_invalida: "La orden seleccionada no es valida.",
    bloqueada_cumplimiento:
      "Operacion bloqueada por el control de lanzamiento. Completa las validaciones antes de habilitar pauta real.",
  };
  const isError = ["error", "falta_confirmacion", "bloqueada_cumplimiento"].includes(result);
  return (
    <p
      className={`mt-5 rounded-xl border px-4 py-3 text-sm font-bold ${
        isError ? "border-coral/40 bg-coral/10 text-[#a13b31]" : "border-signal/40 bg-signal/10 text-forest"
      }`}
    >
      {detail || messages[result] || "Operacion de Meta completada."}
    </p>
  );
}

function paymentLabel(status: string): string {
  const labels: Record<string, string> = {
    payment_preparing: "iniciando",
    payment_open: "esperando pago",
    paid: "pago confirmado",
    cancelled: "cancelado",
    failed: "fallido",
    requires_attention: "requiere revision",
    reversed: "reversado",
  };
  return labels[status] ?? status;
}

function paymentProviderLabel(provider: string): string {
  return provider === "dlocal" ? "dLocal Go" : provider === "payphone" ? "PayPhone (histórico)" : provider;
}

function MetricsPanel({
  metrics,
  active,
  updatedAt,
}: {
  metrics: { impresiones?: number; alcance?: number; clics?: number; gasto_usd?: number } | null;
  active: boolean;
  updatedAt?: string;
}) {
  const cells = [
    { label: "Impresiones", value: metrics?.impresiones },
    { label: "Alcance", value: metrics?.alcance },
    { label: "Clics", value: metrics?.clics },
    { label: "Gasto", value: metrics?.gasto_usd, money: true },
  ];
  return (
    <div className="mt-3 rounded-xl border border-border bg-fog/50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wide text-muted">Metricas</span>
        <span className="text-[10px] font-black uppercase text-muted">
          {updatedAt
            ? `Actualizadas ${new Date(updatedAt).toLocaleString("es-EC")}`
            : active
              ? "Pendientes de sincronizacion"
              : "Se habilitan tras publicar"}
        </span>
      </div>
      <p className="mt-2 text-[10px] text-muted">
        Fuente: Meta Marketing API · periodo acumulado de la campana · metodo reportado por la plataforma.
      </p>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
        {cells.map((c) => (
          <div key={c.label} className="rounded-lg bg-white px-1 py-2">
            <p className="text-sm font-black text-forest">
              {c.value == null ? "—" : c.money ? `$${nfmt(c.value)}` : nfmt(c.value)}
            </p>
            <p className="text-[10px] font-bold uppercase text-muted">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ tone, label }: { tone: string; label: string }) {
  const map: Record<string, string> = {
    amber: "bg-amber/20 text-[#9a6a00]",
    sky: "bg-sky/15 text-[#1f6fd6]",
    signal: "bg-signal/15 text-signal-dark",
    coral: "bg-coral/15 text-[#a13b31]",
    muted: "bg-fog text-muted",
  };
  return (
    <span className={clsx("rounded-full px-3 py-0.5 text-xs font-black", map[tone] ?? map.muted)}>
      {label}
    </span>
  );
}
