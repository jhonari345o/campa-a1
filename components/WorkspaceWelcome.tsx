import Link from "next/link";
export function WorkspaceWelcome({ name }: { name: string }) {
  return <section className="workspace-welcome">
    <p>Tu espacio de trabajo</p><h1>{name}</h1>
    <span>Planifica con tu equipo. Cada idea, en su lugar.</span>
    <Link href="/planificador?view=planner" className="btn btn-primary">Crear un plan de medios →</Link>
  </section>;
}
