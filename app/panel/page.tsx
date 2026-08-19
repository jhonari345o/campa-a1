import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import { getMyCompanies, getCompanyTeam, ROLE_LABELS, type TeamMember } from "@/lib/company";
import { MaviFull } from "@/components/Mavi";
import { AgregarUsuarioForm } from "./AgregarUsuarioForm";

export const metadata = { title: "Mi panel" };

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default async function PanelPage() {
  if (!supabaseConfigured) redirect("/consola");
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");

  const companies = await getMyCompanies(profile.id);
  const teams = await Promise.all(companies.map((c) => getCompanyTeam(c.id)));
  const name = profile.full_name ?? profile.email ?? "Ad Mavericks";

  return (
    <div className="min-h-screen">
      <AppHeader name={name} isAdmin={profile.is_platform_admin} active="panel" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center gap-4">
          <MaviFull height={104} className="hidden sm:block" />
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              Hola{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.
            </h1>
            <p className="mt-1 text-muted">
              {companies.length > 0
                ? "Este es el espacio de tu empresa. Solo tu equipo tiene acceso."
                : "Bienvenido a Ad Mavericks One."}
            </p>
          </div>
        </div>

        {companies.length === 0 ? (
          profile.is_platform_admin ? (
            <AdminWelcome />
          ) : (
            <NoCompany />
          )
        ) : (
          <div className="mt-8 space-y-6">
            {companies.map((c, i) => (
              <CompanyCard key={c.id} company={c} team={teams[i]} />
            ))}
            <QuickLinks />
          </div>
        )}
      </main>
    </div>
  );
}

function CompanyCard({
  company,
  team,
}: {
  company: { id: string; name: string; status: string; seats: number; role: string; created_at: string };
  team: TeamMember[];
}) {
  const remaining = Math.max(0, company.seats - team.length);
  const canManage = company.role === "admin";
  return (
    <section className="rounded-panel border border-border bg-white p-8 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">{company.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-signal/15 px-3 py-0.5 font-black uppercase text-signal-dark">
              {company.status}
            </span>
            <span className="text-muted">
              Tu rol: <strong className="text-forest">{ROLE_LABELS[company.role] ?? company.role}</strong>
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-forest">
            {team.length}
            <span className="text-lg text-muted">/{company.seats}</span>
          </p>
          <p className="text-xs font-black uppercase tracking-wide text-muted">Usuarios</p>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-black uppercase tracking-wide text-muted">Tu equipo</h3>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {team.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-bold text-forest">{m.full_name || m.email || "Usuario"}</p>
                {m.full_name && m.email && <p className="text-xs text-muted">{m.email}</p>}
              </div>
              <span className="rounded-full bg-fog px-3 py-0.5 text-xs font-black text-forest">
                {ROLE_LABELS[m.role] ?? m.role}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {canManage &&
        (remaining > 0 ? (
          <AgregarUsuarioForm companyId={company.id} remaining={remaining} />
        ) : (
          <p className="mt-6 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm font-bold text-forest">
            Ya ocupaste los {company.seats} cupos de tu plan. Para agregar mas usuarios,
            contacta a Ad Mavericks.
          </p>
        ))}
    </section>
  );
}

function QuickLinks() {
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <Link
        href="/planificador"
        className="rounded-panel border border-border bg-forest p-6 text-white shadow-panel transition-transform hover:-translate-y-0.5"
      >
        <h3 className="text-lg font-black">Planificador de medios →</h3>
        <p className="mt-1 text-sm text-white/70">
          Arma un plan de medios para tu negocio con base en el mercado.
        </p>
      </Link>
      <Link
        href="/asistente"
        className="rounded-panel border border-border bg-white p-6 shadow-panel transition-transform hover:-translate-y-0.5"
      >
        <h3 className="text-lg font-black text-forest">Pregunta a Mavi →</h3>
        <p className="mt-1 text-sm text-muted">
          Tu guia de medios: resuelve dudas de publicidad y planificacion.
        </p>
      </Link>
    </section>
  );
}

function AdminWelcome() {
  return (
    <section className="mt-8 rounded-panel border border-border bg-white p-8 shadow-panel">
      <h2 className="text-xl font-black tracking-tight">Cuenta de plataforma</h2>
      <p className="mt-1 text-muted">
        Tu cuenta es del equipo Ad Mavericks. Desde aqui administras clientes y datos.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/consola" className="btn btn-primary">
          Consola de Alta →
        </Link>
        <Link href="/mercado" className="btn btn-secondary">
          Inteligencia de mercado →
        </Link>
      </div>
    </section>
  );
}

function NoCompany() {
  return (
    <section className="mt-8 rounded-panel border border-amber/40 bg-amber/10 p-8">
      <h2 className="text-xl font-black tracking-tight text-forest">Tu cuenta aun no tiene empresa</h2>
      <p className="mt-1 text-muted">
        Si tienes un codigo de registro, activa tu cuenta. Si no, contacta a Ad Mavericks.
      </p>
      <Link href="/registro" className="btn btn-primary mt-6">
        Activar con un codigo →
      </Link>
    </section>
  );
}
