import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getSessionProfile } from "@/lib/auth";
import {
  getOverview,
  getAdvertisers,
  getInvestments,
  getMetrics,
  MEDIA_TYPE_LABELS,
  money,
  period,
} from "@/lib/market";

export const metadata = { title: "Inteligencia de mercado" };

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default async function MercadoPage() {
  if (!supabaseConfigured) redirect("/consola");

  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");
  // La data de mercado es solo para el equipo Ad Mavericks.
  if (!profile.is_platform_admin) redirect("/planificador");

  const [overview, advertisers, investments, metrics] = await Promise.all([
    getOverview(),
    getAdvertisers(12),
    getInvestments(12),
    getMetrics(10),
  ]);

  return (
    <div className="min-h-screen">
      <AppHeader
        name={profile.full_name ?? profile.email ?? "Ad Mavericks"}
        isAdmin={profile.is_platform_admin}
        active="mercado"
      />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Inteligencia de mercado</h1>
            <p className="mt-1 text-muted">
              Como las principales empresas distribuyen su inversion en medios.
            </p>
          </div>
          {profile.is_platform_admin && (
            <Link href="/mercado/cargar" className="btn btn-primary text-sm">
              Cargar datos →
            </Link>
          )}
        </div>

        {/* KPIs */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Anunciantes" value={overview.advertisers.toLocaleString("es-EC")} />
          <Kpi label="Medios / canales" value={overview.channels.toLocaleString("es-EC")} />
          <Kpi label="Inversion registrada" value={money(overview.investmentTotal)} />
          <Kpi
            label="Datos verificados"
            value={`${Math.round(overview.verifiedShare * 100)}%`}
            hint={`${overview.investments} registros de inversion`}
          />
        </div>

        {/* Inversion publicitaria */}
        <Panel title="Inversion publicitaria" subtitle="Ultimos registros por anunciante, medio y periodo.">
          {investments.length === 0 ? (
            <Empty admin={profile.is_platform_admin} />
          ) : (
            <Table head={["Anunciante", "Medio", "Periodo", "Monto", "Estado"]}>
              {investments.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <Td>{r.advertisers?.name ?? "—"}</Td>
                  <Td>{r.media_type ? MEDIA_TYPE_LABELS[r.media_type] ?? r.media_type : "—"}</Td>
                  <Td>{period(r.period_year, r.period_month)}</Td>
                  <Td className="font-black">{money(r.amount_usd)}</Td>
                  <Td><StatusBadge status={r.status} /></Td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Anunciantes */}
          <Panel title="Anunciantes" subtitle="Empresas que invierten en publicidad.">
            {advertisers.length === 0 ? (
              <Empty admin={profile.is_platform_admin} />
            ) : (
              <Table head={["Nombre", "Sector", "Estado"]}>
                {advertisers.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <Td className="font-bold">{a.name}</Td>
                    <Td>{a.sector ?? "—"}</Td>
                    <Td><StatusBadge status={a.status} /></Td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>

          {/* Metricas digitales */}
          <Panel title="Metricas digitales" subtitle="Google Ads, Meta Ads y analitica.">
            {metrics.length === 0 ? (
              <Empty admin={profile.is_platform_admin} />
            ) : (
              <Table head={["Anunciante", "Plataforma", "Inversion", "Estado"]}>
                {metrics.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <Td className="font-bold">{m.advertisers?.name ?? "—"}</Td>
                    <Td>{m.platform}</Td>
                    <Td>{money(m.spend_usd)}</Td>
                    <Td><StatusBadge status={m.status} /></Td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
        </div>
      </main>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-border bg-white p-5 shadow-panel">
      <p className="text-xs font-black uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-forest">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 rounded-panel border border-border bg-white p-6 shadow-panel">
      <h2 className="text-lg font-black tracking-tight">{title}</h2>
      <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
      <div className="mt-4 overflow-x-auto">{children}</div>
    </section>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full min-w-[420px] text-left text-sm">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} className="pb-2 text-xs font-black uppercase tracking-wide text-muted">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-2.5 pr-4 ${className ?? ""}`}>{children}</td>;
}

function Empty({ admin }: { admin: boolean }) {
  return (
    <p className="rounded-xl border border-border bg-fog px-4 py-6 text-center text-sm text-muted">
      Aun no hay datos.{" "}
      {admin ? (
        <Link href="/mercado/cargar" className="font-black text-signal-dark hover:underline">
          Cargar el primero
        </Link>
      ) : (
        "Pronto habra informacion aqui."
      )}
    </p>
  );
}
