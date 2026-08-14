"use client";

import Link from "next/link";
import { useActionState } from "react";
import { activarCuenta, type RegistroResult } from "./actions";

export function RegistroForm() {
  const [state, formAction, pending] = useActionState<RegistroResult | null, FormData>(
    activarCuenta,
    null,
  );

  if (state?.ok) {
    return (
      <div className="mt-6 rounded-panel border border-signal/40 bg-signal/5 p-6 text-center">
        <p className="text-lg font-black text-forest">¡Cuenta activada!</p>
        <p className="mt-2 text-sm text-muted">
          Ya puedes ingresar con <strong>{state.email}</strong>.
        </p>
        <Link href="/ingresar" className="btn btn-primary mt-5">
          Ingresar →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <Field name="code" label="Codigo de registro *" placeholder="AMK-2026-XXXXX-XXXX" required mono />
      <Field name="full_name" label="Tu nombre" placeholder="Nombre y apellido" />
      <Field name="email" label="Correo *" type="email" placeholder="tu@empresa.com" required />
      <Field name="password" label="Contrasena *" type="password" placeholder="Minimo 8 caracteres" required />
      {state?.ok === false && (
        <p className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm font-bold text-[#a13b31]">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary w-full disabled:opacity-60">
        {pending ? "Activando..." : "Activar mi cuenta →"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  required,
  mono,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-black text-forest">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className={`mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30 ${
          mono ? "font-black tracking-wider uppercase" : ""
        }`}
      />
    </div>
  );
}
