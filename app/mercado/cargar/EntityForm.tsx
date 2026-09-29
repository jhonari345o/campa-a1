"use client";

import { useActionState } from "react";
import type { ActionResult } from "../actions";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "email";
  options?: readonly { value: string; label: string }[]; // si viene, es un <select>
  required?: boolean;
  placeholder?: string;
  colSpan?: 1 | 2;
};

type EntityFormProps = {
  title: string;
  description: string;
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  fields: Field[];
  submitLabel: string;
};

export function EntityForm({ title, description, action, fields, submitLabel }: EntityFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);

  return (
    <section className="rounded-panel border border-border bg-white p-6 shadow-panel">
      <h2 className="text-lg font-black tracking-tight">{title}</h2>
      <p className="mt-0.5 text-sm text-muted">{description}</p>

      <form action={formAction} className="mt-5 grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className={f.colSpan === 2 ? "sm:col-span-2" : ""}>
            <label htmlFor={f.name} className="block text-sm font-black text-forest">
              {f.label}
              {f.required && " *"}
            </label>
            {f.options ? (
              <select
                id={f.name}
                name={f.name}
                required={f.required}
                defaultValue=""
                className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
              >
                <option value="" disabled={f.required}>
                  {f.required ? "Selecciona…" : "Sin especificar"}
                </option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={f.name}
                name={f.name}
                type={f.type ?? "text"}
                required={f.required}
                placeholder={f.placeholder}
                className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
              />
            )}
          </div>
        ))}

        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
            {pending ? "Guardando…" : submitLabel}
          </button>
        </div>
      </form>

      {state?.ok === false && (
        <p className="mt-4 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm font-bold text-[#a13b31]">
          {state.error}
        </p>
      )}
      {state?.ok === true && (
        <p className="mt-4 rounded-xl border border-signal/40 bg-signal/5 px-4 py-3 text-sm font-bold text-signal-dark">
          {state.message}
        </p>
      )}
    </section>
  );
}

const STATUS_OPTIONS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "verificado", label: "Verificado" },
];

export { STATUS_OPTIONS };
