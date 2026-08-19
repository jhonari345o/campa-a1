"use client";

import { useActionState } from "react";
import { agregarUsuario, type AddUserResult } from "./actions";

/**
 * Formulario para que el ADMIN de una empresa agregue a su propio equipo.
 * Solo se muestra si quedan cupos y el usuario es admin de la empresa.
 */
export function AgregarUsuarioForm({
  companyId,
  remaining,
}: {
  companyId: string;
  remaining: number;
}) {
  const [state, formAction, pending] = useActionState<AddUserResult | null, FormData>(
    agregarUsuario,
    null,
  );

  return (
    <div className="mt-6 rounded-xl border border-border bg-fog/50 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-wide text-muted">Agregar usuario</h3>
        <span className="rounded-full bg-signal/15 px-3 py-0.5 text-xs font-black text-signal-dark">
          {remaining} cupo{remaining === 1 ? "" : "s"} disponible{remaining === 1 ? "" : "s"}
        </span>
      </div>

      {state?.ok ? (
        <p className="mt-3 rounded-xl border border-signal/40 bg-signal/5 px-4 py-3 text-sm font-bold text-forest">
          Usuario <strong>{state.email}</strong> agregado. Comparte con esa persona su correo y
          contrasena para que ingrese. Solo vera la informacion de esta empresa.
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted">
          Crea la cuenta de tu companero. Entra con el correo y contrasena que definas aqui.
        </p>
      )}

      <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="company_id" value={companyId} />
        <Field name="full_name" label="Nombre" placeholder="Nombre y apellido" />
        <Field name="email" label="Correo *" type="email" placeholder="persona@empresa.com" required />
        <Field name="password" label="Contrasena *" type="password" placeholder="Minimo 8 caracteres" required />
        <label className="block text-sm">
          <span className="mb-1 block font-bold text-forest">Rol</span>
          <select
            name="role"
            defaultValue="viewer"
            className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-forest outline-none focus:border-signal"
          >
            <option value="viewer">Lector</option>
            <option value="analyst">Analista</option>
            <option value="planner">Planificador</option>
            <option value="admin">Administrador</option>
          </select>
        </label>

        {state?.ok === false && (
          <p className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm font-bold text-[#a13b31] sm:col-span-2">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary sm:col-span-2 disabled:opacity-60"
        >
          {pending ? "Agregando..." : "Agregar al equipo →"}
        </button>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-bold text-forest">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-forest outline-none placeholder:text-muted/60 focus:border-signal"
      />
    </label>
  );
}
