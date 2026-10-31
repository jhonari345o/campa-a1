"use client";

import { useActionState } from "react";
import { crearAdministrador, type CrearAdministradorResult } from "./actions";

export function CrearAdministradorForm() {
  const [state, formAction, pending] = useActionState<CrearAdministradorResult | null, FormData>(
    crearAdministrador,
    null,
  );

  return (
    <section className="rounded-panel border border-border bg-white p-8 shadow-panel">
      <p className="text-xs font-black uppercase tracking-[.16em] text-signal-dark">Acceso controlado</p>
      <h2 className="mt-1 text-xl font-black tracking-tight">Agregar administrador</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Crea una cuenta con acceso administrativo total a clientes, campañas, reportes y carga de datos. La operación
        queda registrada y la contraseña temporal se muestra una sola vez.
      </p>

      <form action={formAction} className="mt-6 grid gap-4">
        <label className="grid gap-1 text-sm font-black text-forest">
          Nombre completo
          <input
            name="full_name"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            className="rounded-xl border border-border bg-fog px-4 py-3 font-normal outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
            placeholder="Nombre del responsable"
          />
        </label>
        <label className="grid gap-1 text-sm font-black text-forest">
          Correo administrativo
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-xl border border-border bg-fog px-4 py-3 font-normal outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
            placeholder="responsable@empresa.com"
          />
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm font-bold text-forest">
          <input name="confirm_admin" value="yes" type="checkbox" required className="mt-1 size-4 accent-[#00a100]" />
          <span>Confirmo que esta persona puede crear usuarios, operar campañas y modificar datos de toda la plataforma.</span>
        </label>
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
          {pending ? "Creando acceso..." : "Crear administrador →"}
        </button>
      </form>

      {state?.ok === false && (
        <p role="alert" className="mt-5 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm font-bold text-[#a13b31]">
          {state.error}
        </p>
      )}
      {state?.ok === true && (
        <div className="mt-5 rounded-xl border border-signal/40 bg-signal/5 p-5">
          <p className="text-sm font-black text-forest">Administrador creado: {state.email}</p>
          <p className="mt-2 text-xs text-muted">Comparte esta contraseña temporal por un canal seguro y solicita cambiarla al ingresar:</p>
          <code className="mt-2 block overflow-x-auto rounded-lg bg-forest px-3 py-2 text-sm font-black text-white">
            {state.temporaryPassword}
          </code>
        </div>
      )}
    </section>
  );
}
