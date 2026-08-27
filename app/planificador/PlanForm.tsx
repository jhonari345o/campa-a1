"use client";

import { useActionState, useState } from "react";
import type { ReactNode } from "react";
import { generarPlan, guardarPlan, type PlanResult } from "./actions";
import type { PlanRow } from "@/lib/planner";
import type { Campaign } from "@/lib/campaigns";
import { ejecutarCampana } from "@/app/campanas/actions";
import { EcuadorTargetMap, type GeoTarget } from "@/app/pautar/EcuadorTargetMap";

const money = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

export function PlanForm() {
  const [state, formAction, pending] = useActionState<PlanResult | null, FormData>(generarPlan, null);
  const [geoTarget, setGeoTarget] = useState<GeoTarget | null>(null);
  const geography = !geoTarget
    ? ""
    : geoTarget.scope === "country"
      ? "Todo Ecuador"
      : `${geoTarget.label} · ${geoTarget.radiusKm} km alrededor`;

  return (
    <div className="planner-portal-shell">
      <nav className="planner-progress" aria-label="Progreso del plan">
        {[["01", "Brief"], ["02", "Análisis"], ["03", "Propuesta"], ["04", "Personaliza"], ["05", "Aprobado"]].map(([number, label], index) => (
          <div key={number} className={index === 0 ? "is-active" : ""}><span>{number}</span><strong>{label}</strong></div>
        ))}
        <button type="button">Guardar progreso</button>
      </nav>

      <header className="planner-hero">
        <div><p>Nuevo plan</p><h1>Cuéntanos qué necesita tu marca.</h1><span>Completa el brief y Mavi construirá una recomendación con datos, contexto y criterios verificables.</span></div>
        <aside><small>Organización activa</small><strong>Ad Mavericks</strong><span>Workspace privado · Ecuador</span></aside>
      </header>

      <form action={formAction} className="planner-form">
        <section className="planner-form-section">
          <SectionNumber number="01" title="Objetivo de la campaña" description="Define la marca, su categoría y el resultado que debe priorizar el plan." />
          <div className="planner-fields planner-fields-two">
            <Field name="brand" label="Marca" placeholder="Nombre de la marca" />
            <Field name="keyword" label="Giro o categoría *" placeholder="Busca entre categorías: cafetería, banco, farmacia…" required />
            <SelectField name="objective" label="Objetivo principal" defaultValue="Ventas">
              {["Reconocimiento", "Alcance", "Consideración", "Tráfico", "Interacción", "Reproducciones", "Generación de leads", "Mensajes", "Ventas", "Visitas al local", "Descargas de app", "Retención", "Otro"].map((option) => <option key={option}>{option}</option>)}
            </SelectField>
            <SelectField name="priority" label="Prioridad del plan" defaultValue="Eficiencia">
              {["Cobertura", "Frecuencia", "Eficiencia", "Conversión", "Afinidad", "Presencia local", "Balance"].map((option) => <option key={option}>{option}</option>)}
            </SelectField>
          </div>
          <Field name="audience" label="Personas, necesidades o comportamientos que importan" placeholder="Ej. Jóvenes profesionales que compran en línea y viven cerca de puntos de venta" />
        </section>

        <section className="planner-form-section">
          <SectionNumber number="02" title="Audiencia y geografía" description="Delimita a quién debe llegar la campaña y dónde tiene sentido invertir." />
          <div className="planner-fields planner-fields-four">
            <SelectField name="audienceType" label="Tipo de audiencia" defaultValue="B2C"><option>B2C</option><option>B2B</option><option>Mixta</option></SelectField>
            <SelectField name="ageRange" label="Edad" defaultValue="Personas 18+">{["Todas las edades", "13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+", "18-34", "25-54", "Personas 18+"].map((option) => <option key={option}>{option}</option>)}</SelectField>
            <SelectField name="sex" label="Sexo" defaultValue="Todas las personas">{["Todas las personas", "Mujeres", "Hombres", "No binario", "Mujeres prioritario", "Hombres prioritario", "Por definir"].map((option) => <option key={option}>{option}</option>)}</SelectField>
            <SelectField name="socioeconomic" label="Nivel socioeconómico" defaultValue="Todos los NSE">{["Todos los NSE", "A", "B", "C+", "C-", "D", "A/B", "B/C+", "C+/C-", "C-/D", "Por definir"].map((option) => <option key={option}>{option}</option>)}</SelectField>
          </div>
          <div className="planner-map-card">
            <div><strong>Movilidad geográfica</strong><span>Busca una ciudad, marca un punto o selecciona todo Ecuador; el círculo representa el radio real de cobertura.</span></div>
            <input type="hidden" name="geography" value={geography} />
            <EcuadorTargetMap value={geoTarget} onChange={setGeoTarget} />
          </div>
        </section>

        <section className="planner-form-section">
          <SectionNumber number="03" title="Fechas, inversión y medios" description="Fija el marco de inversión y los canales que Mavi puede combinar." />
          <div className="planner-fields planner-fields-three">
            <Field name="startDate" label="Inicio" type="date" />
            <Field name="endDate" label="Fin" type="date" />
            <Field name="budget" label="Presupuesto antes de impuestos (USD)" placeholder="3000" type="number" />
          </div>
          <fieldset className="planner-media-selector">
            <legend>Medios a considerar *</legend>
            <div>
              {[["television", "TV", "Televisión"], ["radio", "RA", "Radio"], ["ooh", "VP", "Vía pública"], ["press", "PR", "Prensa"], ["digital", "DI", "Digital"], ["influencers", "IN", "Influenciadores"]].map(([value, mark, label]) => (
                <label key={value}><input name="selectedMedia" value={value} type="checkbox" defaultChecked /><span>{mark}</span><strong>{label}</strong><i>✓</i></label>
              ))}
            </div>
          </fieldset>
          <aside className="planner-wow-card"><span>IDEA WOW</span><div><strong>Deja espacio para una activación memorable.</strong><p>Mavi podrá proponer una idea especial cruzando audiencia, territorio, calendario y medios seleccionados.</p></div></aside>
        </section>

        <section className="planner-form-section">
          <SectionNumber number="04" title="Contexto del negocio" description="Información opcional que mejora la precisión de la estrategia y sus llamados a la acción." />
          <details className="planner-details" open>
            <summary>Modelo comercial y conversión <span>−</span></summary>
            <div className="planner-fields planner-fields-two">
              <SelectField name="businessModel" label="Modelo de negocio" defaultValue=""><option value="">Por definir</option>{["E-commerce", "Retail", "Generación de leads", "App", "B2B", "Servicios", "Otro"].map((option) => <option key={option}>{option}</option>)}</SelectField>
              <SelectField name="conversionModel" label="Modelo de conversión" defaultValue=""><option value="">Por definir</option>{["Checkout", "Formulario", "WhatsApp", "Tienda física", "Marketplace", "Venta consultiva", "Otro"].map((option) => <option key={option}>{option}</option>)}</SelectField>
            </div>
          </details>
        </section>

        <section className="planner-form-section">
          <SectionNumber number="05" title="Preparación digital" description="Confirma el destino y el estado de medición antes de convertir el plan en campañas." />
          <details className="planner-details" open>
            <summary>Destino, tracking y cuentas <span>−</span></summary>
            <div className="planner-fields planner-fields-three">
              <Field name="digitalDestination" label="Destino o landing" placeholder="https://…" type="url" />
              <SelectField name="trackingStatus" label="Estado de medición" defaultValue=""><option value="">Por definir</option><option>Implementado</option><option>Parcial</option><option>No implementado</option></SelectField>
              <SelectField name="adAccountsStatus" label="Cuentas publicitarias" defaultValue=""><option value="">Por definir</option><option>Listas y con acceso</option><option>Existen sin acceso</option><option>Por crear</option></SelectField>
            </div>
          </details>
        </section>

        <div className="planner-submit-bar">
          <div><small>Siguiente etapa</small><strong>Análisis de audiencia, mercado y combinación de medios</strong></div>
          <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">{pending ? "Armando tu plan…" : "Generar plan de medios →"}</button>
        </div>
        {state?.ok === false && <p className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm font-bold text-[#a13b31]">{state.error}</p>}
      </form>

      <section className="planner-result">
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

function SectionNumber({ number, title, description }: { number: string; title: string; description: string }) {
  return <header className="planner-section-heading"><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></header>;
}

function PlanResultView({ result }: { result: Extract<PlanResult, { ok: true }> }) {
  const { plan, keyword } = result;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<null | { ok: boolean; message: string; id?: string }>(null);

  async function saveDraft() {
    setSaving(true);
    setSaved(null);
    try {
      const response = await guardarPlan(result);
      setSaved(response.ok
        ? { ok: true, id: response.id, message: "Plan guardado como borrador privado." }
        : { ok: false, message: response.error });
    } catch {
      setSaved({ ok: false, message: "No se pudo guardar el plan." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-panel border border-border bg-white p-6 shadow-panel">
        <h2 className="text-xl font-black tracking-tight">Tu plan de medios</h2>
        <p className="mt-1 text-sm text-muted">
          {plan.basis === "giro"
            ? `Basado en patrones agregados de negocios comparables a "${keyword}".`
            : plan.basis === "sector"
              ? `Basado en el sector ${plan.profileLabel.toLowerCase()} y en el brief ingresado.`
              : `Usamos el mercado agregado como referencia y lo ajustamos al perfil ${plan.profileLabel.toLowerCase()}, al objetivo y a la prioridad del brief.`}
        </p>
        <p className="mt-4 rounded-xl border border-signal/25 bg-signal/5 p-4 text-sm font-bold text-forest">
          {plan.strategySummary}
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
              {r.rationale && <p className="mt-1 text-xs leading-relaxed text-muted">{r.rationale}</p>}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button type="button" onClick={saveDraft} disabled={saving} className="btn btn-primary disabled:opacity-60">
            {saving ? "Guardando…" : "Guardar plan privado"}
          </button>
          {saved?.ok && <a href="/planificador?view=plans" className="btn btn-secondary">Ver planes guardados →</a>}
          {saved && <p className={`text-sm font-bold ${saved.ok ? "text-signal-dark" : "text-[#a13b31]"}`}>{saved.message}</p>}
        </div>
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
      {result.campaigns.length > 0 && <div>
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-xl">🦎</span>
          <h3 className="text-lg font-black tracking-tight">Campanas sugeridas por Mavi</h3>
        </div>
        <p className="mt-1 text-sm text-muted">
          Borradores para revisar segun tu plan. Mavi ayuda a prepararlos; la disponibilidad,
          aprobacion y publicacion siempre se confirman con una persona responsable.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {result.campaigns.map((c) => (
            <CampaignCard key={c.platform} c={c} />
          ))}
        </div>
      </div>}

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
  const ideas = c.ideas?.length ? c.ideas : [c.copy];
  const [ideaIndex, setIdeaIndex] = useState(0);
  const currentCopy = ideas[ideaIndex] ?? c.copy;

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
        copy: currentCopy,
      });
      setSent(
        res.ok
          ? { ok: true, msg: "Solicitud enviada para revision. Sigue el estado en Campanas." }
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
    `\n${currentCopy}` +
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

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-wide text-muted">
          Idea {ideaIndex + 1} de {ideas.length}
        </span>
        {ideas.length > 1 && (
          <button
            type="button"
            onClick={() => setIdeaIndex((i) => (i + 1) % ideas.length)}
            className="text-xs font-black text-signal-dark hover:underline"
          >
            Otra idea ✨
          </button>
        )}
      </div>
      <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-fog px-3 py-3 text-xs text-forest">
        {currentCopy}
      </pre>
      {c.extra && (
        <p className="mt-2 text-xs text-muted">
          <span className="font-black text-forest">{c.extra.label}:</span> {c.extra.value}
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {pautarHref(c) && (
          <a href={pautarHref(c)!} className="btn btn-primary text-xs">
            Preparar solicitud →
          </a>
        )}
        <button onClick={ejecutar} type="button" disabled={sending} className="btn btn-secondary text-xs disabled:opacity-60">
          {sending ? "Enviando…" : "Enviar a revision 🦎"}
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

function SelectField({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-black text-forest">{label}</label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
      >
        {children}
      </select>
    </div>
  );
}
