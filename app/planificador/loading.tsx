export default function LoadingPlanner() {
  return <main className="portal-page portal-page-wide" aria-busy="true" aria-label="Cargando medios">
    <p role="status" className="mb-5 text-sm font-bold text-forest">Abriendo tu espacio…</p>
    <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({length:6},(_,i)=><div key={i} className="h-44 animate-pulse rounded-2xl bg-[#e8e4de]" />)}</div>
  </main>;
}
