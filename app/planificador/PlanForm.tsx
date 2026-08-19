"use client";

import { useActionState, useState } from "react";
import { generarPlan, type PlanResult } from "./actions";
import type { PlanRow } from "@/lib/planner";
import type { Campaign } from "@/lib/campaigns";
import { ejecutarCampana } from "@/app/campanas/actions";

const money = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

export function PlanForm() {
  const [state, formAction, pending] = useActionState<PlanResult | null, FormData>(generarPlan, null);

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
      {/* Formulario */}
      <section className="rounded-panel border border-border bg-white p-6 shadow-panel">
        <h2 className="text-lg font-black tracking-tight">Cuentanos de tu negocio</h2>
        <p className="mt-1 text-sm text-muted">
          Con esto buscamos cuanto invierten negocios similares y armamos tu plan.
        </p>
        <form action={formAction} className="mt-5 space-y-4">
          <Field name="keyword" label="Giro del negocio *" placeholder="Cafeteria, banco, farmacia…" required />
          <Field name="audience" label="Publico al que quieres llegar" placeholder="Jovenes 18-30, Guayaquil…" />
          <Field name="objective" label="Objetivo" placeholder="Mas ventas, dar a conocer la marca…" />
          <Field name="budget" label="Presupuesto mensual (USD)" placeholder="3000" type="number" />
          <button type="submit" disabled={pending} className="btn btn-primary w-full disabled:opacity-60">
            {pending ? "Armando tu plan…" : "Generar plan de medios →"}
          </button>
        </form>
        {state?.ok === false && (
          <p className="mt-4 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm font-bold text-[#a13b31]">
            {state.error}
          </p>
        )}
      </section>

      {/* Resultado */}
      <section>
        {state?.ok ? (
          <PlanResultView result={state} />
        ) : (
          <div className="flex h-full min-h-[300px] items-center justify-center rounded-panel border border-dashed border-border bg-fog/60 p-8 text-center text-muted">
            Llena el formulario y genera tu plan de medios personalizado.
          </div>
        )}
      </section>
    </div>
  );
}

function PlanResultView({ result }: { result: Extract<PlanResult, { ok: true }> }) {
  const { plan, keyword } = result;
  return (
    <div className="space-y-6">
      <div className="rounded-panel border border-border bg-white p-6 shadow-panel">
        <h2 className="text-xl font-black tracking-tight">Tu plan de medios</h2>
        <p className="mt-1 text-sm text-muted">
          {plan.basis === "giro"
            ? `Basado en ${plan.matched} negocios similares a "${keyword}".`
            : `No encontramos suficientes negocios de "${keyword}"; usamos el promedio del mercado como referencia.`}
        </p>

        <h3 className="mt-6 text-sm font-black uppercase tracking-wide text-muted">Distribucion recomendada por canal</h3>
        <ul className="mt-3 space-y-2">
          {plan.plan.map((r: PlanRow) => (
            <li key={r.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-forest">{r.label}</span>
                <span className="text-muted">
                  {pct(r.pct)}
                  {r.amount != null && <span className="ml-2 font-black text-forest">{money(r.amount)}</span>}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-fog">
                <div className="h-2 rounded-full bg-signal" style={{ width: `${Math.min(100, r.pct * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-panel border border-border bg-white p-6 shadow-panel">
        <h3 className="text-sm font-black uppercase tracking-wide text-muted">
          Como invierte tu giro (referencia)
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="text-xs font-black uppercase tracking-wide text-muted">
                <th className="pb-2">Medio</th>
                <th className="pb-2">Participacion</th>
                {result.plan.plan.some((r) => r.amount != null) && <th className="pb-2">Sugerido</th>}
              </tr>
            </thead>
            <tbody>
              {plan.benchmark.map((r) => (
                <tr key={r.label} className="border-t border-border">
                  <td className="py-2 pr-4 font-bold text-forest">{r.label}</td>
                  <td className="py-2 pr-4">{pct(r.pct)}</td>
                  {result.plan.plan.some((p) => p.amount != null) && <td className="py-2">{money(r.amount)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          El desglose digital (Meta, Google, WhatsApp, TikTok) es una recomendacion de Ad Mavericks;
          la referencia por medio proviene de datos de inversion del mercado.
        </p>
      </div>

      {/* Campanas sugeridas por Mavi */}
      <div>
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-xl">🦎</span>
          <h3 className="text-lg font-black tracking-tight">Campanas sugeridas por Mavi</h3>
        </div>
        <p className="mt-1 text-sm text-muted">
          Listas para lanzar en cada plataforma segun tu plan. Copialas o abre la plataforma.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {result.campaigns.map((c) => (
            <CampaignCard key={c.platform} c={c} />
          ))}
        </div>
      </div>

      {/* Contacto con Ad Mavericks */}
      <div className="rounded-panel bg-forest p-6 text-white">
        <h3 className="text-lg font-black">¿Quieres ejecutar este plan?</h3>
        <p className="mt-1 text-sm text-white/75">
          El equipo de Ad Mavericks lo revisa contigo, confirma disponibilidad y lo pone en marcha.
        </p>
        <a
          href={`mailto:hola@admavericks.one?subject=Plan de medios - ${encodeURIComponent(keyword)}`}
          className="btn btn-primary mt-4"
        >
          Contactar a Ad Mavericks →
        </a>
      </div>
    </div>
  );
}

/**
 * Enlaza la campana generada con el flujo de pauta+pago, prellenando red y
 * presupuesto. Solo para las redes que soportan pauta social (Meta/TikTok).
 */
function pautarHref(c: Campaign): string | null {
  const red = c.key === "meta" ? "instagram" : c.key === "tiktok" ? "tiktok" : null;
  if (!red || c.budget == null) return null;
  const params = new URLSearchParams({ red, monto: String(c.budget) });
  if (c.objetivo) params.set("objetivo", c.objetivo);
  return `/pautar?${params.toString()}`;
}

function CampaignCard({ c }: { c: Campaign }) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<null | { ok: boolean; msg: string }>(null);

  async function ejecutar() {
    setSending(true);
    setSent(null);
    try {
      const res = await ejecutarCampana({
        platform: c.key,
        objetivo: c.objetivo,
        publico: c.publico,
        formato: c.formato,
        presupuesto: c.budget,
        copy: c.copy,
      });
      setSent(
        res.ok
          ? { ok: true, msg: "Enviada a Mavi. Sigue el estado en Campanas." }
          : { ok: false, msg: res.error },
      );
    } catch {
      setSent({ ok: false, msg: "No se pudo enviar. Intenta de nuevo." });
    } finally {
      setSending(false);
    }
  }

  const fullText =
    `Campana: ${c.platform}\n` +
    `Objetivo: ${c.objetivo}\n` +
    `Publico: ${c.publico}\n` +
    `Formato: ${c.formato}\n` +
    (c.budget != null ? `Presupuesto: ${money(c.budget)}\n` : "") +
    `\n${c.copy}` +
    (c.extra ? `\n\n${c.extra.label}: ${c.extra.value}` : "");

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard no disponible */
    }
  }

  return (
    <article className="flex flex-col rounded-panel border border-border bg-white p-5 shadow-panel">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-black text-forest">
          <span aria-hidden className="text-lg">{c.icon}</span>
          {c.platform}
        </span>
        {c.budget != null && <span className="text-sm font-black text-signal-dark">{money(c.budget)}</span>}
      </div>

      <dl className="mt-3 space-y-1 text-xs text-muted">
        <div><dt className="inline font-black text-forest">Objetivo: </dt><dd className="inline">{c.objetivo}</dd></div>
        <div><dt className="inline font-black text-forest">Publico: </dt><dd className="inline">{c.publico}</dd></div>
        <div><dt className="inline font-black text-forest">Formato: </dt><dd className="inline">{c.formato}</dd></div>
      </dl>

      <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-border bg-fog px-3 py-3 text-xs text-forest">
        {c.copy}
      </pre>
      {c.extra && (
        <p className="mt-2 text-xs text-muted">
          <span className="font-black text-forest">{c.extra.label}:</span> {c.extra.value}
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {pautarHref(c) && (
          <a href={pautarHref(c)!} className="btn btn-primary text-xs">
            Pautar y pagar →
          </a>
        )}
        <button onClick={ejecutar} type="button" disabled={sending} className="btn btn-secondary text-xs disabled:opacity-60">
          {sending ? "Enviando…" : "Ejecutar con Mavi 🦎"}
        </button>
        <button onClick={copy} type="button" className="btn btn-secondary text-xs">
          {copied ? "Copiado ✓" : "Copiar"}
        </button>
        <a href={c.link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-xs">
          {c.linkLabel} →
        </a>
      </div>
      {sent && (
        <p
          className={`mt-2 text-xs font-bold ${sent.ok ? "text-signal-dark" : "text-[#a13b31]"}`}
        >
          {sent.msg}
        </p>
      )}
    </article>
  );
}

function Field({
  name,
  label,
  placeholder,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
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
        className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
      />
    </div>
  );
}
