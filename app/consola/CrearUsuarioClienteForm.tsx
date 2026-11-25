"use client";
import { useActionState } from "react";
import { crearUsuarioCliente, type CustomerResult } from "./customer-actions";

type Company = { id: string; name: string; status: string };
export function CrearUsuarioClienteForm({ companies, ready }: { companies: Company[]; ready: boolean }) {
  const [state, action, pending] = useActionState<CustomerResult | null, FormData>(crearUsuarioCliente, null);
  const active = companies.filter((company) => company.status === "activa");
  return <section className="mt-8 rounded-panel border border-border bg-white p-8 shadow-panel">
    <p className="text-xs font-black uppercase tracking-widest text-signal-dark">Acceso de cliente</p>
    <h2 className="mt-1 text-xl font-black">Agregar usuario a una empresa</h2>
    <p className="mt-2 text-sm text-muted">El usuario trabajará únicamente en la empresa seleccionada. Esta alta no envía correos ni concede administración general.</p>
    {!ready && <p role="status" className="mt-4 rounded-xl bg-amber/10 p-4 text-sm font-bold">Pendiente: aplicar y validar la migración de seguridad 0017 en Supabase antes de habilitar accesos de clientes.</p>}
    <form action={action} className="mt-6 grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1 text-sm font-bold">Empresa<select name="company_id" required className="rounded-xl border border-border bg-fog p-3" defaultValue=""><option value="" disabled>Selecciona una empresa</option>{active.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-bold">Permisos<select name="role" defaultValue="planner" className="rounded-xl border border-border bg-fog p-3"><option value="planner">Planificador · planes y solicitudes</option><option value="viewer">Lector · solo consulta</option></select></label>
      <label className="grid gap-1 text-sm font-bold">Nombre del usuario<input name="full_name" required minLength={2} maxLength={120} autoComplete="off" className="rounded-xl border border-border bg-fog p-3" /></label>
      <label className="grid gap-1 text-sm font-bold">Correo del cliente<input name="email" required type="email" maxLength={254} autoComplete="off" className="rounded-xl border border-border bg-fog p-3" /></label>
      <label className="flex items-start gap-3 rounded-xl bg-fog p-4 text-sm sm:col-span-2"><input name="confirm_scope" value="yes" required type="checkbox" className="mt-1" /><span>Confirmo el acceso exclusivo a esta empresa, sin aprobación de compras ni administración de usuarios.</span></label>
      <button disabled={pending || !ready || !active.length} className="btn btn-primary disabled:opacity-50">{pending ? "Creando acceso…" : "Crear acceso de cliente →"}</button>
    </form>
    {state?.ok === false && <p role="alert" className="mt-4 rounded-xl bg-coral/10 p-4 text-sm">{state.error}</p>}
    {state?.ok && <div role="status" className="mt-5 rounded-xl border border-border bg-fog p-5"><strong>{state.email} · {state.companyName}</strong><p className="mt-2 text-sm">Acceso creado. Conserva la contraseña en un gestor seguro; no se enviará por correo automáticamente.</p><code className="mt-3 block break-all rounded-lg bg-forest p-4 text-white">{state.temporaryPassword}</code></div>}
  </section>;
}
