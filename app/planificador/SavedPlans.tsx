import Link from "next/link";
import type { SavedMediaPlan } from "@/lib/media-workspace";

const STAGE_LABELS: Record<string, string> = {
  brief: "Brief",
  analisis: "Análisis",
  propuesta: "Propuesta",
  personaliza: "Personaliza",
  aprobado: "Aprobado",
};

export function SavedPlans({ plans }: { plans: SavedMediaPlan[] }) {
  return (
    <section className="rounded-panel border border-border bg-white p-6 shadow-panel sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-signal-dark">Tu cuenta · historial privado</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Tus planes, listos para continuar</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">Cada guardado conserva el brief, análisis, selección, versión y etapa. Otro usuario no puede listar ni abrir estos proyectos.</p>
        </div>
        <Link href="/planificador?view=planner" className="btn btn-primary">Crear nuevo plan →</Link>
      </div>
      {plans.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-border bg-fog p-8 text-center"><h2 className="font-black">Aún no tienes planes guardados</h2><p className="mt-1 text-sm text-muted">Genera una recomendación y usa “Guardar borrador”.</p></div>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <li key={plan.id} className="rounded-card border border-border bg-fog p-5">
              <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-signal/10 px-3 py-1 text-[10px] font-black uppercase text-signal-dark">{plan.status}</span><span className="text-xs font-black text-muted">v{plan.version}</span></div>
              <h2 className="mt-4 text-xl font-black">{plan.name}</h2>
              <p className="mt-1 text-sm text-muted">{String(plan.brief.objective || "Plan de medios guiado")}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-concrete"><div className="h-full rounded-full bg-signal" style={{ width: `${plan.progress}%` }} /></div>
              <div className="mt-2 flex justify-between text-xs text-muted"><span>{plan.progress}%</span><strong className="text-forest">{STAGE_LABELS[plan.stage] ?? plan.stage}</strong></div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted">Último guardado</dt><dd className="font-bold">{new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(new Date(plan.updated_at))}</dd></div><div><dt className="text-muted">Modo</dt><dd className="font-bold capitalize">{plan.mode}</dd></div></dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
