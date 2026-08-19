import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { JOB_STATUS, PLATFORM_LABEL, type JobStatus } from "@/lib/jobs";
import { clsx } from "@/lib/clsx";

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
  spec: { objetivo?: string; presupuesto_usd?: number | null } | null;
};

export default async function CampanasPage() {
  if (!supabaseConfigured) redirect("/consola");
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");

  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_jobs")
    .select("id, platform, status, log, created_at, spec")
    .order("created_at", { ascending: false })
    .limit(50);
  const jobs = (data ?? []) as Job[];

  return (
    <div className="min-h-screen">
      <AppHeader
        name={profile.full_name ?? profile.email ?? "Ad Mavericks"}
        isAdmin={profile.is_platform_admin}
        active="campanas"
      />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-black tracking-tight">Mis campanas</h1>
        <p className="mt-1 text-muted">
          Estado de las campanas que enviaste a ejecutar con Mavi.
        </p>

        {jobs.length === 0 ? (
          <p className="mt-8 rounded-panel border border-border bg-fog px-4 py-8 text-center text-sm text-muted">
            Aun no has enviado campanas. Ve al{" "}
            <a href="/planificador" className="font-black text-signal-dark hover:underline">
              Planificador
            </a>{" "}
            y usa "Ejecutar con Mavi".
          </p>
        ) : (
          <ul className="mt-8 space-y-3">
            {jobs.map((j) => {
              const st = JOB_STATUS[j.status];
              return (
                <li key={j.id} className="rounded-panel border border-border bg-white p-5 shadow-panel">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-black text-forest">{PLATFORM_LABEL[j.platform] ?? j.platform}</span>
                    <StatusBadge tone={st.tone} label={st.label} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    {j.spec?.objetivo && <span>{j.spec.objetivo}</span>}
                    {j.spec?.presupuesto_usd != null && <span>Presupuesto: ${j.spec.presupuesto_usd}</span>}
                    <span>{new Date(j.created_at).toLocaleString("es-EC")}</span>
                  </div>
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
