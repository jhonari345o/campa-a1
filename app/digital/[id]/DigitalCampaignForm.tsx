"use client";
import { useState, useTransition } from "react";
import type { DigitalCampaignBrief } from "@/lib/digital-campaign-brief";
import { PlanScheduleFields } from "@/components/PlanScheduleFields";
import { saveDigitalCampaignBrief } from "./actions";

export function DigitalCampaignForm({ orderId, initial, version: initialVersion, editable }: { orderId: string; initial: DigitalCampaignBrief; version: number; editable: boolean }) {
  const [version, setVersion] = useState(initialVersion), [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startSaving] = useTransition();
  const fields = [
    ["campaignName", "Nombre de campaña", "Marca y referencia de la campaña"],
    ["geography", "Ubicaciones", "Provincias, ciudades, zonas o cobertura nacional"],
    ["audience", "Perfil de audiencia", "Edades, características y necesidades del público"],
    ["interests", "Intereses y comportamientos", "Afinidades, intención y exclusiones"],
    ["destination", "Página de destino", "https://"], ["whatsapp", "WhatsApp de destino", "+593"],
    ["creativeLinks", "Enlaces a las piezas", "Un enlace https:// por línea"],
    ["copy", "Mensajes y llamados a la acción", "Texto y acción esperada"],
    ["measurement", "Medición", "Evento de conversión, formulario o indicadores a seguir"],
    ["notes", "Indicaciones adicionales", "Horarios, exclusiones y otras condiciones de la pauta"],
  ] as const;
  return <form className="rounded-panel border border-border bg-white p-6 shadow-panel sm:p-8" onSubmit={event => {
    event.preventDefault(); const data = new FormData(event.currentTarget), input = Object.fromEntries(data);
    delete input.budget;
    startSaving(async () => { const result = await saveDigitalCampaignBrief(orderId, version, input); if (result.ok) { setVersion(result.version); setMessage({ ok: true, text: "Configuración guardada." }); } else setMessage({ ok: false, text: result.error }); });
  }}><fieldset disabled={!editable || pending}>
    <legend className="text-2xl font-black">Configura tu pauta</legend><p className="mt-2 text-sm text-muted">Completa el perfil, los destinos y las piezas de la campaña.</p>
    <div className="mt-7 grid gap-5 md:grid-cols-2">{fields.map(([key, label, placeholder]) => <label key={key} className={`block min-w-0 text-sm font-bold ${["creativeLinks", "copy", "notes"].includes(key) ? "md:col-span-2" : ""}`}>{label}<textarea name={key} rows={key === "creativeLinks" || key === "copy" ? 3 : 2} maxLength={4000} defaultValue={initial[key] ?? ""} placeholder={placeholder} className="mt-2 block w-full resize-y rounded-xl border border-border bg-fog p-3 font-normal outline-none focus:border-signal-dark"/></label>)}</div>
    <div className="planner-fields planner-fields-two mt-6"><PlanScheduleFields initialStart={initial.startDate} initialEnd={initial.endDate} showBudget={false}/></div>
    {editable && <button className="btn btn-primary mt-7" disabled={pending}>{pending ? "Guardando…" : "Guardar configuración"}</button>}
  </fieldset>{message && <p className={`mt-5 rounded-xl p-4 text-sm font-bold ${message.ok ? "bg-[#e4f2df] text-[#235c2f]" : "bg-[#fff0ca] text-[#6c4700]"}`} role="status">{message.text}</p>}</form>;
}
