"use client";

import { useActionState } from "react";
import { acceptLegalTerms, type ConsentResult } from "./actions";
import { REQUIRED_PROCESSING_PURPOSES } from "@/lib/legal";

export function ConsentForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState<ConsentResult, FormData>(acceptLegalTerms, null);
  return <form action={action} className="mt-6 space-y-4">
    <input type="hidden" name="next" value={nextPath} />
    <label className="flex items-start gap-3 rounded-xl border border-border bg-white p-4 text-sm text-forest">
      <input type="checkbox" name="terms" value="accepted" required className="mt-1 accent-[#00a100]" />
      <span><strong className="block">Acepto los Términos y la Política de Privacidad</strong>Confirmo que pude leer los <a href="/terminos" target="_blank" className="font-black underline">Términos</a> y la <a href="/privacidad" target="_blank" className="font-black underline">Política de Privacidad</a>.</span>
    </label>
    <label className="flex items-start gap-3 rounded-xl border border-border bg-white p-4 text-sm text-forest">
      <input type="checkbox" name="processing" value="accepted" required className="mt-1 accent-[#00a100]" />
      <span><strong className="block">Autorizo el tratamiento necesario para prestar el servicio</strong>Incluye cuenta, planificación, campañas, pagos, seguridad, proveedores y conservación conforme a las finalidades informadas.</span>
    </label>
    <details className="rounded-xl border border-border bg-fog p-4 text-xs text-muted">
      <summary className="cursor-pointer font-black text-forest">Ver finalidades y conservación</summary>
      <ul className="mt-3 list-disc space-y-2 pl-5">{REQUIRED_PROCESSING_PURPOSES.map((purpose) => <li key={purpose}>{purpose}</li>)}</ul>
      <p className="mt-3">Puedes revocar el consentimiento y ejercer tus derechos. La revocación puede impedir que sigamos prestando funciones que necesitan esos datos.</p>
    </details>
    <label className="flex items-start gap-3 rounded-xl border border-signal/30 bg-signal/5 p-4 text-sm text-forest">
      <input type="checkbox" name="benchmark" value="accepted" className="mt-1 accent-[#00a100]" />
      <span><strong className="block">Opcional: contribuir a benchmarks agregados</strong>Autorizo usar aprendizajes estadísticos anonimizados y agregados para mejorar recomendaciones. No es obligatorio y no autoriza compartir datos personales ni piezas privadas.</span>
    </label>
    {state?.error && <p className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm font-bold text-[#a13b31]">{state.error}</p>}
    <button type="submit" disabled={pending} className="btn btn-primary w-full disabled:opacity-50">{pending ? "Registrando aceptación…" : "Aceptar y continuar →"}</button>
  </form>;
}
