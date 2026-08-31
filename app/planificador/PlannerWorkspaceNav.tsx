import Link from "next/link";

export function PlannerWorkspaceNav({ view }: { view: "planner" | "media" | "plans" }) {
  const items = [
    { id: "planner", href: "/planificador?view=planner", label: "Crear plan", detail: "Brief y recomendación" },
    { id: "media", href: "/planificador?view=media&section=digital", label: "Catálogo", detail: "Inventario general" },
    { id: "plans", href: "/planificador?view=plans", label: "Planes guardados", detail: "Historial privado" },
  ] as const;
  return (
    <nav className="mb-6 grid gap-2 rounded-panel border border-border bg-white p-2 shadow-panel sm:grid-cols-3" aria-label="Workspace del planificador">
      {items.map((item) => (
        <Link key={item.id} href={item.href} aria-current={view === item.id ? "page" : undefined} className={`min-h-[64px] rounded-[20px] px-5 py-3 ${view === item.id ? "bg-forest text-white" : "bg-fog text-forest hover:bg-concrete"}`}>
          <strong className="block text-sm font-black">{item.label}</strong>
          <span className={`block text-xs ${view === item.id ? "text-white/65" : "text-muted"}`}>{item.detail}</span>
        </Link>
      ))}
    </nav>
  );
}
