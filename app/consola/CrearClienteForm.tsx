"use client";

import { useActionState } from "react";
import { useState } from "react";
import { crearCliente, type CrearClienteResult } from "./actions";
import { PLANS } from "@/lib/plans";

export function CrearClienteForm({ brandingReady = false }: { brandingReady?: boolean }) {
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
        empresa; los administradores y usuarios se agregan desde esta consola.
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
                {p.name} · {p.seats} usuarios
              </option>
            ))}
          </select>
          {selected && (
            <p className="mt-1 text-xs text-muted">
              Incluye {selected.seats} usuarios. {selected.tagline}
            </p>
          )}
        </div>
        <label className="grid gap-1 text-sm font-black sm:col-span-2">Identidad del espacio
          <select name="brand_key" defaultValue="one" className="rounded-xl border border-border bg-fog px-4 py-3">
            <option value="one">Ad Mavericks One</option><option value="lettera" disabled={!brandingReady}>Léttera</option><option value="ucsg" disabled={!brandingReady}>UCSG</option><option value="mobil" disabled={!brandingReady}>Mobil</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-black">Tipo de portal<select name="portal_kind" className="rounded-xl border border-border bg-fog p-3"><option value="agency">Agencia · planificación y coordinación</option><option value="client">Cliente · catálogo y reportes</option><option value="provider">Proveedor · medios y actualizaciones</option></select></label>
        <label className="grid gap-1 text-sm font-black">Dominios de correo autorizados<input name="allowed_domains" maxLength={1000} placeholder="empresa.com, agencia.ec" className="rounded-xl border border-border bg-fog p-3"/><small className="font-normal text-muted">Las cuentas se crean desde administración.</small></label>
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
        <CompanyResult companyName={state.companyName} planName={state.planName} />
      )}
    </div>
  );
}

function CompanyResult({ companyName, planName }: { companyName: string; planName?: string }) {
  return (
    <div className="mt-6 rounded-panel border border-signal/40 bg-signal/5 p-6">
      <p className="text-sm font-bold text-signal-dark">
        Cliente <strong>{companyName}</strong>
        {planName ? ` (plan ${planName})` : ""} creado correctamente.
      </p>
      <p className="mt-3 text-xs text-muted">
        Usa «Agregar usuario a una empresa» para crear accesos de cliente. No existe autorregistro publico.
      </p>
    </div>
  );
}
