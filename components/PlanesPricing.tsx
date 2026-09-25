import { PLANS, planMoney } from "@/lib/plans";

export function PlanesPricing() {
  return (
    <>
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <article
            key={p.id}
            className={
              "relative flex flex-col rounded-card border bg-white p-6 shadow-panel " +
              (p.destacado ? "border-signal ring-2 ring-signal/30" : "border-border")
            }
          >
            {p.destacado && (
              <span className="absolute -top-3 left-6 rounded-full bg-signal px-3 py-0.5 text-xs font-black text-forest">
                Mas popular
              </span>
            )}
            <h3 className="text-lg font-black tracking-tight text-forest">{p.name}</h3>
            <p className="mt-1 text-xs text-muted">{p.tagline}</p>
            <p className="mt-4">
              <span className="text-3xl font-black text-forest">{planMoney(p.price)}</span>
              <span className="text-sm text-muted"> /mes</span>
            </p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2 text-forest">
                  <span className="text-signal-dark">✓</span> {f}
                </li>
              ))}
            </ul>
            <a
              href={`mailto:hola@admavericks.one?subject=${encodeURIComponent(`Solicitud de plan ${p.name}`)}`}
              className={"mt-6 " + (p.destacado ? "btn btn-primary" : "btn btn-secondary")}
            >
              Solicitar evaluacion →
            </a>
          </article>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted">
        Valores referenciales en USD. El acceso se habilita por invitacion despues de validar alcance,
        contrato y responsables. La inversion publicitaria, las reservas y la facturacion se confirman
        por separado; esta pagina no recoge datos de tarjeta.
      </p>
    </>
  );
}
