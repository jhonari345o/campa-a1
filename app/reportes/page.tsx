import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Reportes" };

type ReportJob = {
  id: string;
  platform: string;
  status: string;
  created_at: string;
  spec: {
    objetivo?: string;
    presupuesto_usd?: number;
    total_pagado_usd?: number;
    metrics?: { impresiones?: number; alcance?: number; clics?: number; gasto_usd?: number } | null;
  } | null;
};

export default async function ReportesPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");
  const db = await createClient();
  const { data } = await db
    .from("campaign_jobs")
    .select("id, platform, status, created_at, spec")
    .order("created_at", { ascending: false })
    .limit(100);
  const jobs = (data ?? []) as ReportJob[];
  const metrics = jobs.reduce((total, job) => {
    const item = job.spec?.metrics;
    total.impressions += Number(item?.impresiones ?? 0);
    total.reach += Number(item?.alcance ?? 0);
    total.clicks += Number(item?.clics ?? 0);
    total.spend += Number(item?.gasto_usd ?? 0);
    total.paid += Number(job.spec?.total_pagado_usd ?? 0);
    return total;
  }, { impressions: 0, reach: 0, clicks: 0, spend: 0, paid: 0 });
  const withMetrics = jobs.filter((job) => job.spec?.metrics).length;

  return (
    <div className="min-h-screen">
      <AppHeader name={profile.full_name ?? profile.email ?? "Ad Mavericks"} isAdmin={profile.is_platform_admin} active="reportes" />
      <main id="workspace-content" className="portal-page portal-page-planner">
        {jobs.length === 0 ? (
          <section className="reports-locked">
            <span>05</span>
            <p>Reportes</p>
            <h1>Se habilitan con tu primera campaña.</h1>
            <strong>Cuando exista una orden de campaña, aquí aparecerán inversión, entrega, alcance, clics y estado de sincronización.</strong>
            <div><a href="/planificador" className="btn btn-primary">Crear un plan →</a><a href="/pautar" className="btn btn-secondary">Preparar una pauta aparte</a></div>
          </section>
        ) : (
          <>
            <header className="reports-heading"><div><p>Inteligencia de campaña</p><h1>Reportes</h1><span>Lectura consolidada de las campañas visibles para tu cuenta.</span></div><b>{jobs.length} campaña{jobs.length === 1 ? "" : "s"}</b></header>
            <section className="reports-summary">
              <Metric label="Impresiones" value={integer(metrics.impressions)} note="Suma reportada por plataforma" />
              <Metric label="Alcance" value={integer(metrics.reach)} note="No deduplicado entre campañas" />
              <Metric label="Clics" value={integer(metrics.clicks)} note="Interacciones de enlace reportadas" />
              <Metric label="Gasto en medios" value={money(metrics.spend)} note="Consumo informado por plataformas" />
              <Metric label="Total pagado" value={money(metrics.paid)} note="Incluye los componentes del checkout" />
              <Metric label="Con métricas" value={`${withMetrics}/${jobs.length}`} note="Campañas sincronizadas" />
            </section>
            <section className="reports-table-card">
              <div><h2>Campañas y órdenes</h2><p>Las cifras aparecen cuando la plataforma publicitaria entrega datos.</p></div>
              <div className="reports-table-wrap"><table><thead><tr><th>Fecha</th><th>Plataforma</th><th>Objetivo</th><th>Estado</th><th>Presupuesto</th><th>Impresiones</th><th>Clics</th><th>Gasto</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id}><td>{new Date(job.created_at).toLocaleDateString("es-EC")}</td><td>{platformLabel(job.platform)}</td><td>{job.spec?.objetivo || "—"}</td><td><span>{statusLabel(job.status)}</span></td><td>{money(job.spec?.presupuesto_usd ?? 0)}</td><td>{integer(job.spec?.metrics?.impresiones ?? 0)}</td><td>{integer(job.spec?.metrics?.clics ?? 0)}</td><td>{money(job.spec?.metrics?.gasto_usd ?? 0)}</td></tr>)}</tbody></table></div>
              <small>Metodología: no se deduplican personas entre plataformas o campañas. Cada métrica conserva la definición y ventana de su fuente.</small>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function integer(value: number) {
  return new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 }).format(value);
}

function money(value: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function platformLabel(platform: string) {
  return ({ meta: "Meta", instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp", tiktok: "TikTok", google: "Google" } as Record<string, string>)[platform] ?? platform;
}

function statusLabel(status: string) {
  return ({ pendiente: "Pendiente", en_proceso: "En proceso", esperando_pago: "Esperando pago", pagada: "Pagada", lista_para_publicar: "Lista", publicando: "Publicando", publicada: "Publicada", pausada: "Pausada", error: "Requiere revisión" } as Record<string, string>)[status] ?? status;
}
