"use client";

import { useActionState } from "react";
import { useState } from "react";
import { crearCliente, type CrearClienteResult } from "./actions";
import { PLANS, planMoney } from "@/lib/plans";

export function CrearClienteForm() {
  const [state, formAction, pending] = useActionState<CrearClienteResult | null, FormData>(
    crearCliente,
    null,
  );
  const [planId, setPlanId] = useState("premium");
  const selected = PLANS.find((p) => p.id === planId);

  return (
    <div className="rounded-panel border border-border bg-white p-8 shadow-panel">
      <h2 className="text-xl font-black tracking-tight">Dar de alta un cliente</h2>
      <p className="mt-1 text-sm text-muted">
        Escribe el nombre del cliente y unos pocos datos. El sistema crea la
        empresa y genera un codigo unico de registro.
      </p>

      <form action={formAction} className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="block text-sm font-black text-forest">
            Nombre del cliente *
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="Cerveceria del Litoral"
            className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
          />
        </div>
        <div>
          <label htmlFor="legal_id" className="block text-sm font-black text-forest">
            RUC / identificacion
          </label>
          <input
            id="legal_id"
            name="legal_id"
            placeholder="0990000000001"
            className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-black text-forest">
            Correo de contacto
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="contacto@cliente.com"
            className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
          />
        </div>
        <div>
          <label htmlFor="plan" className="block text-sm font-black text-forest">
            Plan
          </label>
          <select
            id="plan"
            name="plan"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
          >
            {PLANS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {planMoney(p.price)}/mes · {p.seats} usuarios
              </option>
            ))}
          </select>
          {selected && (
            <p className="mt-1 text-xs text-muted">
              Incluye {selected.seats} usuarios. {selected.tagline}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
            {pending ? "Generando..." : "Generar cliente →"}
          </button>
        </div>
      </form>

      {state?.ok === false && (
        <p className="mt-5 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm font-bold text-[#a13b31]">
          {state.error}
        </p>
      )}

      {state?.ok === true && (
        <CodeResult code={state.code} companyName={state.companyName} planName={state.planName} />
      )}
    </div>
  );
}

function CodeResult({ code, companyName, planName }: { code: string; companyName: string; planName?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard no disponible */
    }
  }

  return (
    <div className="mt-6 rounded-panel border border-signal/40 bg-signal/5 p-6">
      <p className="text-sm font-bold text-signal-dark">
        Cliente <strong>{companyName}</strong>
        {planName ? ` (plan ${planName})` : ""} creado. Comparte este codigo:
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <code className="rounded-xl border border-border bg-white px-4 py-3 text-lg font-black tracking-wider text-forest">
          {code}
        </code>
        <button onClick={copy} type="button" className="btn btn-secondary text-sm">
          {copied ? "Copiado ✓" : "Copiar"}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">
        El cliente usa este codigo para activar su cuenta aislada. Queda registro
        de quien lo dio de alta y cuando.
      </p>
    </div>
  );
}
