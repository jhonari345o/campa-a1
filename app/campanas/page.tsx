import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { JOB_STATUS, PLATFORM_LABEL, type JobStatus } from "@/lib/jobs";
import { clsx } from "@/lib/clsx";
import { MaviScene } from "@/components/Mavi";
import { MaviShowcase } from "@/components/MaviShowcase";

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
  } | null;
  companies: { name: string } | null;
};

const nfmt = (n: number) => new Intl.NumberFormat("es-EC").format(n);

export default async function CampanasPage() {
  if (!supabaseConfigured) redirect("/consola");
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");
  const isAdmin = profile.is_platform_admin;

  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_jobs")
    .select("id, platform, status, log, created_at, spec, companies(name)")
    .order("created_at", { ascending: false })
    .limit(50);
  const jobs = (data ?? []) as unknown as Job[];
  const pendientes = jobs.filter((j) => j.status === "pendiente" || j.status === "en_proceso").length;

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
                  ? `Estoy pendiente del reloj: tienes ${pendientes} campana${pendientes === 1 ? "" : "s"} en cola.`
                  : "Estado de las campanas que enviaste a ejecutar conmigo."}
            </p>
          </div>
        </div>

        {jobs.length === 0 ? (
          <>
            <MaviShowcase />
            <p className="mt-6 rounded-panel border border-border bg-fog px-4 py-8 text-center text-sm text-muted">
              Aun no has enviado campanas. Ve al{" "}
              <a href="/planificador" className="font-black text-signal-dark hover:underline">
                Planificador
              </a>{" "}
              y usa "Ejecutar con Mavi".
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

                  {/* Dashboard de metricas de la pauta */}
                  <MetricsPanel metrics={j.spec?.metrics ?? null} live={j.status === "publicada"} />

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

function MetricsPanel({
  metrics,
  live,
}: {
  metrics: { impresiones?: number; alcance?: number; clics?: number; gasto_usd?: number } | null;
  live: boolean;
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
          {live ? "En vivo" : "Se activan al publicar"}
        </span>
      </div>
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
