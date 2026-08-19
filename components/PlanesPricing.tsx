"use client";

import { useState } from "react";
import { PLANS, planMoney, type Plan } from "@/lib/plans";

export function PlanesPricing() {
  const [plan, setPlan] = useState<Plan | null>(null);

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
            <button
              type="button"
              onClick={() => setPlan(p)}
              className={"mt-6 " + (p.destacado ? "btn btn-primary" : "btn btn-secondary")}
            >
              Suscribirme →
            </button>
          </article>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        Precios en USD. La inversion en anuncios se paga aparte al pautar.
      </p>

      {plan && <SubscribeModal plan={plan} onClose={() => setPlan(null)} />}
    </>
  );
}

function SubscribeModal({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [done, setDone] = useState(false);
  const [processing, setProcessing] = useState(false);

  const digits = number.replace(/\D/g, "");
  const valido = name.trim().length >= 3 && digits.length >= 15 && /^\d{2}\/\d{2}$/.test(exp) && /^\d{3,4}$/.test(cvc);

  function pagar() {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setDone(true);
    }, 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-panel border border-border bg-white p-6 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center">
            <p className="text-4xl">🎉</p>
            <h3 className="mt-3 text-xl font-black text-forest">¡Suscripcion activada!</h3>
            <p className="mt-2 text-sm text-muted">
              Plan <strong className="text-forest">{plan.name}</strong> — {planMoney(plan.price)}/mes.
              (Demostracion: no se realizo ningun cobro real.)
            </p>
            <button type="button" onClick={onClose} className="btn btn-primary mt-5">
              Listo
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-forest">Suscribirme · {plan.name}</h3>
              <button type="button" onClick={onClose} className="text-muted hover:text-forest" aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-fog px-4 py-3">
              <span className="text-sm font-bold text-forest">Total mensual</span>
              <span className="text-lg font-black text-forest">{planMoney(plan.price)}</span>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-wide text-signal-dark">🔒 Pago seguro</p>
              <span className="text-lg" aria-hidden>💳</span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (valido) pagar();
              }}
              className="mt-2 space-y-2"
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre en la tarjeta"
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-forest outline-none focus:border-signal"
              />
              <input
                value={number}
                onChange={(e) => setNumber(fmtCard(e.target.value))}
                inputMode="numeric"
                maxLength={19}
                placeholder="4242 4242 4242 4242"
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-forest outline-none focus:border-signal"
              />
              <div className="flex gap-2">
                <input
                  value={exp}
                  onChange={(e) => setExp(fmtExp(e.target.value))}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="MM/AA"
                  className="w-1/2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-forest outline-none focus:border-signal"
                />
                <input
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="CVC"
                  className="w-1/2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-forest outline-none focus:border-signal"
                />
              </div>
              <button type="submit" disabled={!valido || processing} className="btn btn-primary mt-1 w-full disabled:opacity-50">
                {processing ? "Procesando..." : `Pagar ${planMoney(plan.price)}/mes`}
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] text-muted">
              🔒 Pago cifrado · Demostracion (no se realiza ningun cobro real)
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function fmtCard(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function fmtExp(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
}
