"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { InfomediaCategoryPicker } from "@/components/InfomediaCategoryPicker";
import { TgiResearchPanel } from "@/components/TgiResearchPanel";
import { InfomediaResearchPanel } from "@/components/InfomediaResearchPanel";
import { restoreResearch } from "@/lib/infomedia";
import type { CategoryCatalog } from "@/lib/infomedia-server";
import type { ReactNode } from "react";
import { enviarPlanParaRevision, aprobarPlan, generarPlan, guardarPlan, type PlanResult } from "./actions";
import type { PlanRow } from "@/lib/planner";
import { mediaGroupForLabel } from "@/lib/media-groups";
import type { Campaign } from "@/lib/campaigns";
import { ejecutarCampana } from "@/app/campanas/actions";
import { GeographicCoveragePicker } from "@/components/geography/GeographicCoveragePicker";
import { coverageDescription, restoreCoverage, type CoverageSelection } from "@/lib/geographic-coverage";
import {
  COMMERCIAL_GOAL_UNIT_OPTIONS,
  COMMERCIAL_KPI_OPTIONS,
  CONVERSION_EVENT_OPTIONS,
  PRODUCT_SEASON_OPTIONS,
  WOW_FORMAT_OPTIONS,
  WOW_SURFACE_OPTIONS,
  type CatalogOption,
} from "@/lib/form-catalogs";
import type { SavedMediaPlan } from "@/lib/media-workspace";
import { guardarProgresoBrief } from "./workspace-actions";
import { PlanOrderButton } from "./PlanOrderButton";

const money = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

export function PlanForm({ initialPlan, categoryCatalog, canApprove = false, workspaceName = "Ad Mavericks" }: { initialPlan?: SavedMediaPlan | null; categoryCatalog: CategoryCatalog; canApprove?: boolean; workspaceName?: string }) {
  const savedResearch = restoreResearch(initialPlan?.analysis?.research);
  const initialBrief = initialPlan?.brief ?? {};
  const [state, formAction, pending] = useActionState<PlanResult | null, FormData>(async (previous, data) => {
    try {
      return await generarPlan(previous, data);
    } catch {
      return { ok: false, error: "La conexión con el servidor se interrumpió. Tu brief sigue aquí; vuelve a intentarlo en unos momentos." };
    }
  }, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [planId, setPlanId] = useState(initialPlan?.id ?? "");
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingProgress, startSavingProgress] = useTransition();
  const [coverage, setCoverage] = useState<CoverageSelection[]>(() => restoreCoverage(initialBrief));
  const [coverageChanged, setCoverageChanged] = useState(false);
  const [stage, setStage] = useState<"brief" | "analysis" | "proposal" | "personalize" | "approved">("brief");
  const [approvedPlan, setApprovedPlan] = useState<{ id: string; rows: PlanRow[] } | null>(null);
  const [productMatrixApplies, setProductMatrixApplies] = useState(Boolean(initialBrief.productMatrixApplies));
  const [productRows, setProductRows] = useState([0]);
  const [wowEnabled, setWowEnabled] = useState(Boolean(initialBrief.wowEnabled));
  useEffect(() => {
    if (state?.ok) {
      setStage("analysis");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state]);
  const legacyGeography = !restoreCoverage(initialBrief).length ? stringValue(initialBrief.geography) : "";
  const geography = coverage.length ? coverageDescription(coverage) : !coverageChanged ? legacyGeography : "";
  const initialSelectedMedia = Array.isArray(initialBrief.selectedMedia) ? initialBrief.selectedMedia.map(String) : [];
  const stageIndex = stage === "brief" ? 0 : stage === "analysis" ? 1 : stage === "proposal" ? 2 : stage === "personalize" ? 3 : 4;
  const stageCopy = stage === "brief"
    ? { eyebrow: "Nuevo plan", title: "Cuéntanos qué necesita tu marca.", description: "Completa el brief y Mavi construirá una recomendación con datos, contexto y criterios verificables." }
    : stage === "analysis"
      ? { eyebrow: "Research preparado", title: "Categoría, audiencia y medios bajo un solo criterio.", description: "Revisamos evidencia disponible, KPI válidos y todo lo que todavía requiere una fuente o validación humana." }
      : stage === "proposal"
        ? { eyebrow: "Propuesta", title: "Un plan completo, explicado medio por medio.", description: "La inversión se distribuye sin superar el presupuesto y mantiene separadas las validaciones pendientes." }
        : stage === "personalize"
          ? { eyebrow: "Personaliza", title: "Ajusta el peso de cada ejecución.", description: "Cada cambio redistribuye el presupuesto inmediatamente y conserva el 100% de la inversión." }
          : { eyebrow: canApprove ? "Aprobado" : "En revisión", title: "Plan registrado y listo para coordinación.", description: "Tu versión queda guardada con su brief, análisis, propuesta y distribución final." };

  function saveProgress() {
    if (!formRef.current) return;
    setSaveMessage(null);
    const formData = new FormData(formRef.current);
    const brief = formDataRecord(formData);
    brief.geography = geography;
    brief.coverage = coverage;
    brief.budgetUsd = numberOrNull(brief.budget);
    startSavingProgress(async () => {
      const result = await guardarProgresoBrief({ planId: planId || null, name: stringValue(brief.brand) || initialPlan?.name, brief });
      if (result.ok) {
        setPlanId(result.id);
        setSaveMessage({ ok: true, text: `Progreso guardado · versión ${result.version}` });
      } else setSaveMessage({ ok: false, text: result.error });
    });
  }

  return (
    <div className="planner-portal-shell">
      <nav className="planner-progress" aria-label="Progreso del plan">
        {[["01", "Brief"], ["02", "Análisis"], ["03", "Propuesta"], ["04", "Personaliza"], ["05", canApprove ? "Aprobado" : "En revisión"]].map(([number, label], index) => (
          <div key={number} className={index === stageIndex ? "is-active" : index < stageIndex ? "is-complete" : ""}><span>{index < stageIndex ? "✓" : number}</span><strong>{label}</strong></div>
        ))}
        <button type="button" onClick={saveProgress} disabled={savingProgress}>{savingProgress ? "Guardando…" : "Guardar progreso"}</button>
      </nav>
      {saveMessage && <p className={`mb-4 rounded-xl border px-4 py-3 text-sm font-bold ${saveMessage.ok ? "border-signal/30 bg-signal/10 text-forest" : "border-coral/30 bg-coral/10 text-[#a13b31]"}`}>{saveMessage.text}</p>}

      <header className="planner-hero">
        <div><p>{stageCopy.eyebrow}</p><h1>{stageCopy.title}</h1><span>{stageCopy.description}</span></div>
        <aside><small>Organización activa</small><strong>{workspaceName}</strong><span>Espacio privado · Ecuador</span></aside>
      </header>

      {stage === "brief" && savedResearch && <details className="planner-details"><summary>Consultar investigación guardada</summary><InfomediaResearchPanel research={savedResearch} /><TgiResearchPanel research={savedResearch.tgi} selectedMedia={initialSelectedMedia} /></details>}
      <form ref={formRef} action={formAction} className={`planner-form ${stage === "brief" ? "" : "hidden"}`} aria-hidden={stage !== "brief"}>
        <section className="planner-form-section">
          <SectionNumber number="01" title="Objetivo de la campaña" description="Define la marca, su categoría y el resultado que debe priorizar el plan." />
          <div className="planner-fields planner-fields-two">
            <Field name="brand" label="Marca" placeholder="Nombre de la marca" defaultValue={stringValue(initialBrief.brand)} />
            <InfomediaCategoryPicker showPeriod initialYear={Number(initialBrief.referenceYear) || 0} categories={categoryCatalog.categories} error={categoryCatalog.error} initialId={stringValue(initialBrief.categoryId)} initialLabel={stringValue(initialBrief.keyword)} />
            <SelectField name="objective" label="Objetivo principal" defaultValue={stringValue(initialBrief.objective) || "Ventas"}>
              {["Reconocimiento", "Alcance", "Consideración", "Tráfico", "Interacción", "Reproducciones", "Generación de leads", "Mensajes", "Ventas", "Visitas al local", "Descargas de app", "Retención", "Otro"].map((option) => <option key={option}>{option}</option>)}
            </SelectField>
            <SelectField name="priority" label="Prioridad del plan" defaultValue={stringValue(initialBrief.priority) || "Eficiencia"}>
              {["Cobertura", "Frecuencia", "Eficiencia", "Conversión", "Afinidad", "Presencia local", "Balance"].map((option) => <option key={option}>{option}</option>)}
            </SelectField>
          </div>
          <Field name="audience" label="Personas, necesidades o comportamientos que importan" placeholder="Ej. Jóvenes profesionales que compran en línea y viven cerca de puntos de venta" defaultValue={stringValue(initialBrief.audience)} />
        </section>

        <section className="planner-form-section">
          <SectionNumber number="02" title="Audiencia y geografía" description="Delimita a quién debe llegar la campaña y dónde tiene sentido invertir." />
          <div className="planner-fields planner-fields-four">
            <SelectField name="audienceType" label="Tipo de audiencia" defaultValue={stringValue(initialBrief.audienceType) || "B2C"}><option>B2C</option><option>B2B</option><option>Mixta</option></SelectField>
            <SelectField name="ageRange" label="Edad" defaultValue={stringValue(initialBrief.ageRange) || "Personas 18+"}>{["Todas las edades", "13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+", "15-34", "18-34", "25-54", "35+", "Personas 18+"].map((option) => <option key={option}>{option}</option>)}</SelectField>
            <SelectField name="sex" label="Sexo" defaultValue={stringValue(initialBrief.sex) || "Todas las personas"}>{["Todas las personas", "Mujeres", "Hombres", "No binario", "Mujeres prioritario", "Hombres prioritario", "Por definir"].map((option) => <option key={option}>{option}</option>)}</SelectField>
            <SelectField name="socioeconomic" label="Nivel socioeconómico" defaultValue={stringValue(initialBrief.socioeconomic) || "Todos los NSE"}>{["Todos los NSE", "A", "B", "C+", "C-", "D", "A/B", "B/C+", "C+/C-", "C-/D", "Por definir"].map((option) => <option key={option}>{option}</option>)}</SelectField>
          </div>
          <div className="mt-6">
            <input type="hidden" name="geography" value={geography} />
            <input type="hidden" name="coverage" value={JSON.stringify(coverage)} />
            {legacyGeography && !coverageChanged && (
              <p className="mb-3 rounded-xl border border-amber/40 bg-amber/10 p-3 text-sm" role="status">
                Cobertura guardada anteriormente: <strong>{legacyGeography}</strong>. Se conserva hasta que selecciones provincias o cantones en el listado.
              </p>
            )}
            <GeographicCoveragePicker value={coverage} onChange={(next) => { setCoverage(next); setCoverageChanged(true); }} />
          </div>
        </section>

        <section className="planner-form-section">
          <SectionNumber number="03" title="Fechas, inversión y medios" description="Fija el marco de inversión y los canales que Mavi puede combinar." />
          <div className="planner-fields planner-fields-three">
            <Field name="startDate" label="Inicio" type="date" defaultValue={stringValue(initialBrief.startDate)} />
            <Field name="endDate" label="Fin" type="date" defaultValue={stringValue(initialBrief.endDate)} />
            <Field name="budget" label="Presupuesto antes de impuestos (USD)" placeholder="3000" type="number" defaultValue={stringValue(initialBrief.budgetUsd)} />
          </div>
          <fieldset className="planner-media-selector">
            <legend>Medios a considerar *</legend>
            <div>
              {[["television", "Televisión"], ["radio", "Radio"], ["ooh", "Vía pública"], ["press", "Prensa"], ["digital", "Digital"], ["influencers", "Influenciadores"]].map(([value, label]) => (
                <label key={value}><input name="selectedMedia" value={value} type="checkbox" defaultChecked={initialSelectedMedia.length === 0 || initialSelectedMedia.includes(value)} /><span aria-hidden="true"><MediaSelectionIcon medium={value} /></span><strong>{label}</strong><i aria-hidden="true">✓</i></label>
              ))}
            </div>
          </fieldset>
          <aside className="planner-wow-card planner-independent-module">
            <span>IDEA WOW</span>
            <div><strong>Módulo adicional e independiente.</strong><p>Su presupuesto, factibilidad y métricas se trabajan aparte; nunca modifica la recomendación, la inversión ni los KPI del plan de medios.</p></div>
            <label className="planner-module-toggle"><input name="wowEnabled" type="checkbox" checked={wowEnabled} onChange={(event) => setWowEnabled(event.target.checked)} /><b>{wowEnabled ? "Idea especial activada" : "Sí, quiero evaluar una idea especial"}</b></label>
          </aside>
          {wowEnabled && <div className="planner-optional-panel">
            <div className="planner-fields planner-fields-two">
              <TextArea name="wowIdea" label="Descripción de la idea" placeholder="Ej. mapping, corpóreo, intervención urbana o formato especial" />
              <Field name="wowBudget" label="Presupuesto independiente (USD)" type="number" placeholder="No se descuenta del plan principal" />
              <Field name="wowMunicipality" label="Municipio o ciudad" placeholder="Ej. Guayaquil" />
              <Field name="wowExactLocation" label="Ubicación exacta o coordenadas" placeholder="Dirección, edificio o punto propuesto" />
              <SelectField name="wowFormat" label="Tipo de formato" defaultValue=""><option value="">Seleccionar formato</option><CatalogOptions options={WOW_FORMAT_OPTIONS} /></SelectField>
              <SelectField name="wowSurface" label="Superficie o soporte" defaultValue=""><option value="">Seleccionar soporte</option><CatalogOptions options={WOW_SURFACE_OPTIONS} /></SelectField>
              <SelectField name="wowOwnership" label="Titularidad o autorización" defaultValue=""><option value="">Por confirmar</option><option>Propiedad privada autorizada</option><option>Espacio público</option><option>Autorización en gestión</option><option>Titularidad pendiente</option></SelectField>
              <Field name="wowMeasurements" label="Medidas y factibilidad técnica" placeholder="Dimensiones, iluminación, montaje y restricciones" />
            </div>
            <p className="planner-module-disclaimer">Este intake prepara una prefactibilidad. No reserva espacios, no obtiene permisos y no promete aprobación municipal o técnica.</p>
          </div>}
        </section>

        <section className="planner-form-section">
          <SectionNumber number="04" title="Contexto comercial y portafolio" description="Estos datos son opcionales, pero funcionan como guardrails para priorizar sin convertir el plan en una promesa de ventas o ROI." />
          <details className="planner-details">
            <summary>Contexto comercial · opcional <span>+</span></summary>
            <div>
              <p className="planner-details-note">Ticket, margen, capacidad, competencia y aprendizajes mejoran la revisión estratégica. Puedes omitir cualquier dato sensible.</p>
              <div className="planner-fields planner-fields-two">
                <TextArea name="businessDescription" label="Descripción breve del negocio" placeholder="Qué vende, a quién y cómo genera ingresos." />
                <SelectField name="businessModel" label="Modelo de negocio" defaultValue=""><option value="">Seleccionar</option>{["E-commerce", "Retail", "Lead Gen", "App", "B2B", "Servicios", "Otro"].map((option) => <option key={option}>{option}</option>)}</SelectField>
                <SelectField name="conversionModel" label="Modelo de venta o conversión" defaultValue=""><option value="">Seleccionar</option>{["Checkout online", "Formulario o lead", "WhatsApp", "Tienda física", "Marketplace", "Venta consultiva", "Otro"].map((option) => <option key={option}>{option}</option>)}</SelectField>
                <SelectField name="commercialGoalType" label="Meta comercial" defaultValue=""><option value="">No declarada</option><option value="units">En unidades</option><option value="currency">En valor (USD)</option></SelectField>
                <Field name="commercialGoalAmount" label="Cantidad o valor objetivo" placeholder="Ej. 250000" type="number" />
                <SelectField name="commercialGoalUnit" label="Unidad de medida" defaultValue=""><option value="">Seleccionar unidad</option><CatalogOptions options={COMMERCIAL_GOAL_UNIT_OPTIONS} /></SelectField>
                <Field name="averageTicket" label="Ticket promedio o valor por lead (USD)" placeholder="Ej. 85" type="number" />
                <Field name="grossMargin" label="Margen bruto o comisión (%)" placeholder="Ej. 32" type="number" />
                <SelectField name="operationalCapacity" label="Capacidad operativa" defaultValue=""><option value="">Seleccionar</option><option>Alta</option><option>Media</option><option>Limitada</option><option>Por confirmar</option></SelectField>
                <SelectField name="commercialKpi" label="KPI comercial prioritario" defaultValue=""><option value="">Seleccionar KPI</option><CatalogOptions options={COMMERCIAL_KPI_OPTIONS} /></SelectField>
                <TextArea name="valueProposition" label="Propuesta de valor y razones para creer" placeholder="Diferenciadores, beneficios y pruebas verificables de la marca." />
                <Field name="competitors" label="Competidores principales" placeholder="Marca A, Marca B y sustitutos relevantes" />
                <TextArea name="restrictions" label="Restricciones comerciales, legales o de marca" placeholder="Promociones, claims, regulación, logística o canales que debemos evitar." />
                <TextArea name="learnings" label="Aprendizajes previos" placeholder="Qué funcionó, qué no y cualquier inversión reciente que debamos considerar." />
              </div>
            </div>
          </details>

          <details className="planner-details mt-4">
            <summary>Productos o servicios · si aplica <span>{productMatrixApplies ? `${productRows.length} fila${productRows.length === 1 ? "" : "s"}` : "No aplica"}</span></summary>
            <div>
              <p className="planner-details-note">Registra el portafolio que participará en la campaña. Precio, margen, capacidad y temporada orientan la priorización del planner.</p>
              <input type="hidden" name="productMatrixApplies" value={String(productMatrixApplies)} />
              <div className="planner-segmented-control">
                <button type="button" onClick={() => setProductMatrixApplies(true)} className={productMatrixApplies ? "is-active" : ""}>Sí, agregar matriz</button>
                <button type="button" onClick={() => setProductMatrixApplies(false)} className={!productMatrixApplies ? "is-active" : ""}>No aplica</button>
              </div>
              {productMatrixApplies && <div className="planner-product-matrix">
                {productRows.map((row, index) => <div key={row} className="planner-product-row">
                  <div className="planner-product-row-head"><strong>Producto o servicio {index + 1}</strong><button type="button" disabled={productRows.length === 1} onClick={() => setProductRows((rows) => rows.filter((item) => item !== row))}>Quitar fila</button></div>
                  <div className="planner-fields planner-fields-three">
                    <Field name="productName" label="Nombre" placeholder="Ej. Detergente líquido 1 L" />
                    <Field name="productPrice" label="Precio (USD)" placeholder="0,00" type="number" />
                    <Field name="productMargin" label="Margen (%)" placeholder="0" type="number" />
                    <Field name="productCapacity" label="Stock o capacidad" placeholder="Ej. 5.000 unidades o 80 cupos" />
                    <SelectField name="productSeason" label="Temporada" defaultValue=""><option value="">Seleccionar temporada</option><CatalogOptions options={PRODUCT_SEASON_OPTIONS} /></SelectField>
                    <Field name="productNotes" label="Notas" placeholder="Prioridad, promoción o condición especial" />
                  </div>
                </div>)}
                <button type="button" className="btn btn-secondary w-full" onClick={() => setProductRows((rows) => [...rows, Math.max(...rows) + 1])}>+ Agregar otro producto o servicio</button>
              </div>}
            </div>
          </details>
        </section>

        <section className="planner-form-section">
          <SectionNumber number="05" title="Preparación digital" description="Confirma el destino y el estado de medición antes de convertir el plan en campañas." />
          <details className="planner-details">
            <summary>Configuración digital · opcional <span>+</span></summary>
            <div>
              <p className="planner-details-note">Este bloque prepara la implementación y el forecast. Nunca pediremos contraseñas; si algo falta, se convertirá en requerimiento antes de activar campañas.</p>
              <div className="planner-fields planner-fields-three">
                <SelectField name="digitalObjective" label="Objetivo digital principal" defaultValue=""><option value="">Seleccionar</option>{["Alcance", "Reproducciones de video", "Tráfico", "Interacción", "Mensajes", "Leads", "Ventas", "Instalaciones", "Retención"].map((option) => <option key={option}>{option}</option>)}</SelectField>
                <SelectField name="conversionEvent" label="Conversión o evento principal" defaultValue=""><option value="">Seleccionar evento</option><CatalogOptions options={CONVERSION_EVENT_OPTIONS} /></SelectField>
                <Field name="digitalDestination" label="Destino o landing" placeholder="URL, WhatsApp, app o formulario" />
                <SelectField name="trackingStatus" label="Estado del tracking" defaultValue=""><option value="">Seleccionar</option><option>Implementado y validado</option><option>Implementado parcialmente</option><option>No implementado</option><option>Por confirmar</option></SelectField>
                <SelectField name="adAccountsStatus" label="Estado de las cuentas publicitarias" defaultValue=""><option value="">Seleccionar</option><option>Existen y tenemos acceso</option><option>Existen, falta acceso</option><option>Deben crearse</option><option>Por confirmar</option></SelectField>
                <SelectField name="attributionModel" label="Modelo de atribución" defaultValue=""><option value="">Seleccionar</option><option>Data-driven</option><option>Último clic</option><option>Primera interacción</option><option>MMM</option><option>Otro</option><option>No definido</option></SelectField>
                <SelectField name="consentStatus" label="Consentimiento y privacidad" defaultValue=""><option value="">Seleccionar</option><option>Consentimiento documentado</option><option>Requiere revisión</option><option>No usaremos datos propios</option><option>No sé · lo revisamos juntos</option></SelectField>
                <SelectField name="managementNeed" label="Necesidad de gestión" defaultValue=""><option value="">Seleccionar</option><option>Ad Mavericks implementa y optimiza</option><option>El cliente implementa</option><option>Trabajo compartido</option><option>Solo compra de medios</option><option>Por definir</option></SelectField>
                <Field name="qualifiedLead" label="Definición de lead calificado" placeholder="Condiciones para considerarlo válido o comercialmente útil" />
              </div>
              <Checklist name="digitalPlatforms" label="Plataformas previstas" options={["Meta", "Google Ads", "YouTube", "TikTok", "Programmatic / DV360", "Retail Media"]} />
              <Checklist name="measurementStack" label="Activos de medición disponibles" options={["GA4", "Google Tag Manager", "Meta Pixel", "CAPI", "CRM", "CDP", "POS", "Analytics de app"]} />
              <div className="mt-5"><TextArea name="firstPartyData" label="Datos propios disponibles" placeholder="CRM, emails, clientes, leads, usuarios de app, POS o segmentos existentes." /></div>
            </div>
          </details>
        </section>

        <div className="planner-submit-bar">
          <div><small>Siguiente etapa</small><strong>Análisis de audiencia, mercado y combinación de medios</strong></div>
          <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">{pending ? "Armando tu plan…" : "Analizar categoría y audiencia →"}</button>
        </div>
        {state?.ok === false && <p className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm font-bold text-[#a13b31]">{state.error}</p>}
      </form>

      {state?.ok && stage === "analysis" && <AnalysisStage result={state} onBack={() => setStage("brief")} onContinue={() => setStage("proposal")} />}
      {state?.ok && stage === "proposal" && <ProposalStage result={state} onBack={() => setStage("analysis")} onPersonalize={() => setStage("personalize")} />}
      {state?.ok && stage === "personalize" && <PersonalizeStage canApprove={canApprove} result={state} onBack={() => setStage("proposal")} onApproved={(approved) => { setApprovedPlan(approved); setStage("approved"); }} />}
      {state?.ok && stage === "approved" && approvedPlan && <ApprovedStage canApprove={canApprove} result={state} approved={approvedPlan} />}
    </div>
  );
}

function SectionNumber({ number, title, description }: { number: string; title: string; description: string }) {
  return <header className="planner-section-heading"><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></header>;
}

function AnalysisStage({ result, onBack, onContinue }: { result: Extract<PlanResult, { ok: true }>; onBack: () => void; onContinue: () => void }) {
  const { analysis } = result;
  return <section className="planner-analysis-stage">
    <div className="planner-analysis-intro">
      <div><p>Análisis estratégico</p><h2>{analysis.profileLabel}</h2><span>{analysis.category} · {analysis.periodLabel}</span></div>
      <button type="button" className="btn btn-secondary" onClick={onBack}>Editar brief</button>
    </div>

    <InfomediaResearchPanel research={result.research} brand={result.brief.brand} objective={result.objective} />
    <TgiResearchPanel research={result.research.tgi} selectedMedia={result.brief.selectedMedia} />

    <div className="planner-analysis-context">
      <article><span>Grupo objetivo</span><strong>{analysis.targetLabel}</strong><small>Compatibilidad indicada en cada fuente</small></article>
      <article><span>Cobertura</span><strong>{analysis.coverageLabel}</strong><small>Rutas e inventario se reconfirman</small></article>
      <article><span>Contexto comercial</span><strong>{analysis.commercialReadiness}% completo</strong><small>No bloquea la recomendación</small></article>
      <article><span>Preparación digital</span><strong>{analysis.digitalReadiness == null ? "No aplica" : `${analysis.digitalReadiness}% completa`}</strong><small>Solo influye cuando Digital está seleccionado</small></article>
    </div>

    <div className="planner-analysis-findings">
      {analysis.findings.map((finding) => <article key={finding.label} className={`status-${finding.status}`}>
        <span>{finding.label}</span><strong>{finding.value}</strong><p>{finding.detail}</p><small>{analysisStatus(finding.status)}</small>
      </article>)}
    </div>

    <div className="planner-analysis-section-heading"><div><p>Estrategia</p><h2>Categoría, target y rol de medios en un solo criterio.</h2><span>El consumo y la inversión observados ordenan el mix; no se transforman automáticamente en alcance o resultados.</span></div></div>
    <div className="planner-analysis-media-grid">
      {analysis.signals.map((signal) => <article key={signal.kind} className={`role-${signal.role}`}>
        <header><span>{signal.label}</span><b>{signal.role === "principal" ? "Rol principal" : signal.role === "complementario" ? "Rol de apoyo" : "Rol por validar"}</b></header>
        <div className="planner-analysis-allocation"><strong>{pct(signal.share)}</strong><span>{signal.amount == null ? "Sin inversión declarada" : money(signal.amount)}</span></div>
        <p>{signal.rationale}</p>
        <dl><div><dt>KPI de planificación</dt><dd>{signal.planningKpi}</dd></div><div><dt>Evidencia disponible</dt><dd>{signal.evidence}</dd></div><div><dt>Antes de ordenar</dt><dd>{signal.validation}</dd></div></dl>
        <small className={`analysis-status status-${signal.status}`}>{analysisStatus(signal.status)}</small>
      </article>)}
    </div>

    {analysis.wowCase && <aside className="planner-analysis-wow"><span>IDEA WOW · INDEPENDIENTE</span><div><strong>{analysis.wowCase.idea}</strong><p>{analysis.wowCase.budget} · {analysis.wowCase.status}</p>{analysis.wowCase.missing.length > 0 && <small>Falta: {analysis.wowCase.missing.join(", ")}.</small>}</div></aside>}

    <aside className="planner-analysis-rules"><strong>Reglas de confianza</strong><ul>{analysis.guardrails.map((rule) => <li key={rule}>✓ {rule}</li>)}</ul></aside>
    <div className="planner-submit-bar"><div><small>Siguiente etapa</small><strong>Convertir el análisis en una propuesta comprable</strong></div><button type="button" onClick={onContinue} className="btn btn-primary">Ver recomendación de medios →</button></div>
  </section>;
}

function analysisStatus(status: "listo" | "por_validar" | "requiere_preparacion") {
  return status === "listo" ? "Listo para revisión" : status === "requiere_preparacion" ? "Requiere preparación" : "Validación específica pendiente";
}

function ProposalStage({ result, onBack, onPersonalize }: { result: Extract<PlanResult, { ok: true }>; onBack: () => void; onPersonalize: () => void }) {
  return <section className="planner-result">
    <div className="planner-stage-actions"><button type="button" onClick={onBack} className="btn btn-secondary">← Volver al análisis</button><span>La selección granular ocurre en el siguiente paso.</span></div>
    <PlanResultView result={result} />
    <div className="planner-submit-bar"><div><small>Siguiente etapa</small><strong>Personaliza programas, plataformas, emisoras, ubicaciones y pesos</strong></div><button type="button" onClick={onPersonalize} className="btn btn-primary">Personalizar propuesta →</button></div>
  </section>;
}

function PersonalizeStage({ result, onBack, onApproved, canApprove }: { canApprove: boolean; result: Extract<PlanResult, { ok: true }>; onBack: () => void; onApproved: (approved: { id: string; rows: PlanRow[] }) => void }) {
  const [rows, setRows] = useState(result.plan.plan);
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const budget = result.brief.budgetUsd;

  function updateShare(index: number, percent: number) {
    setRows((current) => {
      const target = Math.min(0.98, Math.max(0.02, percent / 100));
      const otherTotal = current.reduce((sum, row, rowIndex) => rowIndex === index ? sum : sum + row.pct, 0);
      const remaining = 1 - target;
      return current.map((row, rowIndex) => {
        const pct = rowIndex === index
          ? target
          : otherTotal > 0 ? row.pct / otherTotal * remaining : remaining / Math.max(1, current.length - 1);
        return { ...row, pct, amount: budget ? budget * pct : null };
      });
    });
  }

  async function approve() {
    setApproving(true);
    setApprovalError(null);
    try {
      const response = await (canApprove ? aprobarPlan : enviarPlanParaRevision)(result, rows);
      if (!response.ok) setApprovalError(response.error);
      else onApproved({ id: response.id, rows: response.rows });
    } catch {
      setApprovalError("No se pudo registrar la aprobación.");
    } finally {
      setApproving(false);
    }
  }

  return <section className="planner-personalize-stage">
    <div className="planner-stage-actions"><button type="button" onClick={onBack} className="btn btn-secondary">← Volver a propuesta</button><span>El sistema redistribuye el resto para mantener exactamente el 100%.</span></div>
    <div className="planner-personalize-summary"><div><span>Presupuesto principal</span><strong>{money(budget)}</strong></div><div><span>Distribución</span><strong>100%</strong></div><div><span>Ejecuciones</span><strong>{rows.length}</strong></div></div>
    <div className="planner-personalize-grid">
      {rows.map((row, index) => {
        const group = mediaGroupForLabel(row.label);
        return <article key={row.label}>
          <header><div><span>{String(index + 1).padStart(2, "0")}</span><h3>{row.label}</h3></div><strong>{money(row.amount)}</strong></header>
          <p>{row.rationale ?? "El planner validará el producto, disponibilidad y condiciones antes de ordenar."}</p>
          <label><span>Peso dentro del plan</span><output>{pct(row.pct)}</output><input type="range" min="2" max="98" step="1" value={Math.round(row.pct * 100)} onChange={(event) => updateShare(index, Number(event.target.value))} /></label>
          {group && <a href={`/planificador?view=media&section=${catalogSection(group)}`}>Abrir catálogo correspondiente →</a>}
        </article>;
      })}
    </div>
    <aside className="planner-analysis-rules"><strong>Antes de aprobar</strong><ul><li>✓ La personalización conserva el presupuesto principal.</li><li>✓ Tarifas, cupos, permisos, derechos e impuestos siguen sujetos a confirmación.</li><li>✓ La Idea WOW mantiene su presupuesto y factibilidad en un módulo independiente.</li></ul></aside>
    {approvalError && <p className="mt-4 rounded-xl border border-coral/40 bg-coral/10 p-4 text-sm font-bold text-[#a13b31]">{approvalError}</p>}
    <div className="planner-submit-bar"><div><small>Última etapa</small><strong>{canApprove ? "Registrar esta distribución como la versión aprobada" : "Enviar esta distribución al equipo para revisión"}</strong></div><button type="button" onClick={approve} disabled={approving} className="btn btn-primary disabled:opacity-60">{approving ? "Registrando…" : canApprove ? "Aprobar plan →" : "Enviar a revisión →"}</button></div>
  </section>;
}

function ApprovedStage({ result, approved, canApprove }: { canApprove: boolean; result: Extract<PlanResult, { ok: true }>; approved: { id: string; rows: PlanRow[] } }) {
  return <section className="planner-approved-stage">
    <div className="planner-approved-heading"><span>✓</span><div><p>{canApprove ? "Plan de medios aprobado" : "Plan enviado a revisión"}</p><h2>Gracias por construir tu plan con Ad Mavericks One.</h2><small>Versión registrada · {approved.id.slice(0, 8).toUpperCase()}</small></div></div>
    <div className="planner-approved-summary"><div><span>Marca</span><strong>{result.brief.brand || result.keyword}</strong></div><div><span>Presupuesto</span><strong>{money(result.brief.budgetUsd)}</strong></div><div><span>Cobertura</span><strong>{result.brief.geography || "Por confirmar"}</strong></div><div><span>Medios</span><strong>{approved.rows.length}</strong></div></div>
    <div className="planner-approved-lines">{approved.rows.map((row) => <div key={row.label}><span>{row.label}</span><strong>{pct(row.pct)} · {money(row.amount)}</strong></div>)}</div>
    <p className="planner-approved-note">El equipo coordinará disponibilidad, negociación, cumplimiento, medición y ejecución. Tu solicitud no autoriza compras ni activa campañas; requiere revisión del equipo responsable.</p>
    <div className="grid gap-3 sm:grid-cols-3"><a href="/planificador?view=plans" className="btn btn-secondary">Ver planes guardados</a><a href="/campanas" className="btn btn-secondary">Ir a campañas</a><PlanOrderButton planId={approved.id} /></div>
  </section>;
}

function MediaSelectionIcon({ medium }: { medium: string }) {
  const artwork: Record<string, ReactNode> = {
    television: <><path d="M11 31h14M15 26l-1 5m7-5 1 5" /><rect x="3" y="6" width="30" height="21" rx="4" fill="currentColor" /><rect x="6" y="9" width="24" height="14" rx="2" fill="var(--media-icon-paper, #fafcf8)" stroke="none" /><path d="m15 12 7 4-7 4Z" fill="var(--media-icon-accent, #29954a)" stroke="none" /><path d="M9 12h3" stroke="var(--media-icon-accent, #29954a)" opacity=".5" /><circle cx="27" cy="25" r=".7" fill="#fff" stroke="none" /></>,
    radio: <><path d="m9 8 17-5" /><rect x="3" y="9" width="30" height="22" rx="5" fill="var(--media-icon-soft, #dcecdf)" /><rect x="6" y="12" width="24" height="5" rx="1.5" fill="currentColor" stroke="none" /><path d="M9 14.5h13m3-1v2" stroke="var(--media-icon-paper, #fafcf8)" strokeWidth="1" /><circle cx="12" cy="24" r="5" fill="var(--media-icon-paper, #fafcf8)" /><circle cx="12" cy="24" r="2" fill="currentColor" stroke="none" /><circle cx="25.5" cy="22" r="2.5" fill="var(--media-icon-accent, #29954a)" stroke="none" /><path d="M22 27h7M7 32v1m22-1v1" /></>,
    ooh: <><path d="M11 23v9m14-9v9M7 32h8m6 0h8" /><rect x="2" y="6" width="32" height="18" rx="2.5" fill="currentColor" /><rect x="5" y="9" width="26" height="12" rx=".8" fill="var(--media-icon-paper, #fafcf8)" stroke="none" /><path d="m6 20 7-6 6 6Z" fill="var(--media-icon-accent, #29954a)" stroke="none" /><path d="m14 20 5-4 5 4Z" fill="var(--media-icon-soft, #dcecdf)" stroke="none" /><circle cx="25.5" cy="13" r="2" fill="var(--media-icon-accent, #29954a)" stroke="none" /><path d="M8 3v3m10-3v3m10-3v3" /></>,
    press: <><path d="M28 10h5v19a3 3 0 0 1-3 3H9a4 4 0 0 1-4-4V4h23v25a2 2 0 0 0 4 0" fill="var(--media-icon-paper, #fafcf8)" /><path d="M9 9h15" strokeWidth="3" /><rect x="9" y="14" width="7" height="7" rx="1" fill="var(--media-icon-accent, #29954a)" stroke="none" /><path d="m10 20 2-3 3 3" stroke="var(--media-icon-paper, #fafcf8)" strokeWidth="1" /><path d="M20 15h4m-4 5h4M9 25h15M9 28h10" strokeWidth="1.4" /><path d="M30 13v14" opacity=".25" /></>,
    digital: <><rect x="2" y="5" width="26" height="20" rx="3" fill="currentColor" /><rect x="5" y="8" width="20" height="13" rx="1" fill="var(--media-icon-paper, #fafcf8)" stroke="none" /><path d="M10 31h10m-7-6v6m4-6v6" /><circle cx="15" cy="14.5" r="4.5" stroke="var(--media-icon-accent, #29954a)" strokeWidth="1.2" /><path d="M10.5 14.5h9m-4.5-4.5c-3 3-3 6 0 9 3-3 3-6 0-9Z" stroke="var(--media-icon-accent, #29954a)" strokeWidth="1" /><rect x="23" y="14" width="11" height="18" rx="2.5" fill="var(--media-icon-soft, #dcecdf)" /><path d="M27 17h3M27 29h3" strokeWidth="1.2" /><path d="m27 21 4 2-4 2Z" fill="var(--media-icon-accent, #29954a)" stroke="none" /></>,
    influencers: <><rect x="6" y="3" width="22" height="30" rx="4" fill="var(--media-icon-paper, #fafcf8)" /><path d="M14 6h6M14 30h6" strokeWidth="1.3" /><circle cx="17" cy="15" r="4" fill="var(--media-icon-soft, #dcecdf)" /><path d="M10 26v-1a7 7 0 0 1 14 0v1Z" fill="var(--media-icon-accent, #29954a)" stroke="none" /><path d="M27 9c-3-4-7 0-3 3l3 3 3-3c4-3 0-7-3-3Z" fill="var(--media-icon-accent, #29954a)" stroke="var(--media-icon-paper, #fafcf8)" strokeWidth="1.5" /><path d="m3 18 .9 2.1L6 21l-2.1.9L3 24l-.9-2.1L0 21l2.1-.9Z" fill="currentColor" stroke="none" /></>,
  };
  return <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{artwork[medium]}</svg>;
}

function catalogSection(group: string) {
  return group === "television" ? "tv" : group === "ooh" ? "ooh" : group === "influencers" ? "influencers" : group;
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
          {plan.basis === "infomedia"
            ? `Referencia: ${keyword} · ${plan.referencePeriod}. La inversión observada orienta la propuesta; las ponderaciones por objetivo son criterios de planificación.`
            : plan.basis === "giro"
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

      <DetailedPlanView result={result} />

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

      {/* Campañas actuales y calificadas por Mavi */}
      {result.campaigns.length > 0 && <div>
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-xl">🦎</span>
          <h3 className="text-lg font-black tracking-tight">Radar de oportunidades · campañas calificadas por Mavi</h3>
        </div>
        <p className="mt-1 text-sm text-muted">
          El radar cruza rubro, audiencia, objetivo, presupuesto y señales recientes con fecha y fuente. Descarta tendencias sin afinidad antes de proponer una ejecución; la aprobación y publicación siempre se confirman con una persona responsable.
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

function DetailedPlanView({ result }: { result: Extract<PlanResult, { ok: true }> }) {
  const { detail } = result;
  return (
    <section className="planner-detailed-plan">
      <header className="planner-detailed-heading">
        <div>
          <p>Plan específico de ejecución</p>
          <h3>Medios, proveedores, productos, plazas y presupuesto.</h3>
          <span>La recomendación cruza el brief con las bases internas y conserva las validaciones pendientes.</span>
        </div>
        <b>{detail.engine === "datos+ia" ? `DATOS + IA${detail.liveSources.length ? " + INTERNET" : ""}` : detail.liveSources.length ? "DATOS + INTERNET" : "MOTOR DE DATOS"}</b>
      </header>

      {detail.aiNarrative && (
        <aside className="planner-ai-verdict">
          <span aria-hidden>✦</span>
          <div><strong>Dictamen de Mavi</strong><p>{detail.aiNarrative}</p></div>
        </aside>
      )}

      {detail.liveSources.length > 0 && (
        <aside className="planner-live-sources"><strong>Señales actuales consultadas</strong><div>{detail.liveSources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} · {source.source}{source.publishedAt ? ` · ${source.publishedAt}` : ""} ↗</a>)}</div></aside>
      )}

      <div className="planner-detailed-channels">
        {detail.channelPlans.map((channel) => (
          <article key={channel.label}>
            <header>
              <div><span>{channel.label}</span><p>{channel.objective}</p></div>
              <strong>{money(channel.budgetUsd)}</strong>
            </header>
            <p className="planner-detailed-rationale">{channel.rationale}</p>
            <div className="planner-execution-list">
              {channel.executions.map((execution) => (
                <div key={execution.id} className="planner-execution-row">
                  <div className="planner-execution-main">
                    <span className={`planner-execution-status is-${execution.status}`}>{execution.status === "cotizable" ? "Cotizable" : "Validar"}</span>
                    <strong>{execution.provider}</strong>
                    <p>{execution.product}</p>
                  </div>
                  <dl>
                    <div><dt>Ubicación</dt><dd>{execution.location}</dd></div>
                    <div><dt>Franja / periodo</dt><dd>{execution.schedule}</dd></div>
                    <div><dt>Presupuesto</dt><dd>{money(execution.budgetUsd)}</dd></div>
                    <div><dt>Referencia</dt><dd>{execution.referenceUnitPriceUsd == null ? execution.unit : `${money(execution.referenceUnitPriceUsd)} · ${execution.unit}`}{execution.estimatedUnits != null ? ` · aprox. ${execution.estimatedUnits} unidad${execution.estimatedUnits === 1 ? "" : "es"}` : ""}</dd></div>
                  </dl>
                  {execution.geo && <OohLocationPreview title={execution.location} geo={execution.geo} />}
                  <p className="planner-execution-evidence"><b>Evidencia:</b> {execution.evidence}</p>
                  <p className="planner-execution-next"><b>Antes de ordenar:</b> {execution.nextStep}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <aside className="planner-detailed-checks"><strong>Control metodológico</strong><ul>{detail.checks.map((check) => <li key={check}>✓ {check}</li>)}</ul></aside>
    </section>
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
  const currentCopy = c.copy;

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

      <div className="campaign-current-insight">
        <div className="campaign-current-score"><strong>{c.insight.total}</strong><span>/100</span></div>
        <div><b>Calificación estratégica actual</b><p>{c.insight.rationale}</p></div>
      </div>
      <div className="campaign-score-grid">
        <span>Rubro <b>{c.insight.industryFit}</b></span>
        <span>Actualidad <b>{c.insight.currentRelevance}</b></span>
        <span>Audiencia <b>{c.insight.audienceFit}</b></span>
        <span>Factibilidad <b>{c.insight.feasibility}</b></span>
      </div>
      <aside className="campaign-trend-signal"><b>Señal usada</b><p>{c.insight.trendSignal}</p></aside>
      {c.insight.sources.length > 0 && <div className="campaign-source-list">{c.insight.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} · {source.source}{source.publishedAt ? ` · ${source.publishedAt}` : ""} ↗</a>)}</div>}
      <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-fog px-3 py-3 text-xs text-forest">
        {currentCopy}
      </pre>
      {c.extra && (
        <p className="mt-2 text-xs text-muted">
          <span className="font-black text-forest">{c.extra.label}:</span> {c.extra.value}
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <a href="/laboratorio" className="btn btn-secondary text-xs">Probar creatividad</a>
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
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  const fieldId = useId();
  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-black text-forest">
        {label}
      </label>
      <input
        id={fieldId}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
      />
    </div>
  );
}

function OohLocationPreview({ title, geo }: { title: string; geo: NonNullable<import("@/lib/detailed-plan").DetailedExecution["geo"]> }) {
  const embedKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY;
  const latitude = geo.latitude.toFixed(6);
  const longitude = geo.longitude.toFixed(6);
  const embedUrl = embedKey
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(embedKey)}&q=${encodeURIComponent(`${latitude},${longitude}`)}&zoom=17&maptype=satellite`
    : `https://www.openstreetmap.org/export/embed.html?bbox=${geo.longitude - 0.006}%2C${geo.latitude - 0.004}%2C${geo.longitude + 0.006}%2C${geo.latitude + 0.004}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  return <section className="planner-ooh-map-card">
    <div className="planner-ooh-map-frame"><iframe src={embedUrl} title={`Mapa de ${title}`} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" /></div>
    <div className="planner-ooh-map-copy">
      <header><span>{geo.locationStatus === "inventory" ? "ACTIVO EN INVENTARIO" : "ZONA CANDIDATA"}</span><strong>{geo.fitScore}/100</strong></header>
      <p><b>Afinidad:</b> {geo.audienceFit}</p>
      <p><b>Movilidad:</b> {geo.trafficEvidence}</p>
      <p><b>Presupuesto:</b> {geo.priceFit}</p>
      <div><a href={geo.mapUrl} target="_blank" rel="noopener noreferrer">Abrir en Google Maps ↗</a><a href={geo.streetViewUrl} target="_blank" rel="noopener noreferrer">Probar vista 360 ↗</a></div>
      <small>La vista 360 depende de la cobertura disponible en Google Street View.</small>
    </div>
  </section>;
}

function SelectField({
  name,
  label,
  defaultValue,
  required,
  children,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const fieldId = useId();
  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-black text-forest">{label}</label>
      <select
        id={fieldId}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
      >
        {children}
      </select>
    </div>
  );
}

function CatalogOptions({ options }: { options: readonly CatalogOption[] }) {
  return options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>);
}

function TextArea({ name, label, placeholder, defaultValue }: { name: string; label: string; placeholder?: string; defaultValue?: string }) {
  const fieldId = useId();
  return <div><label htmlFor={fieldId} className="block text-sm font-black text-forest">{label}</label><textarea id={fieldId} name={name} rows={3} placeholder={placeholder} defaultValue={defaultValue} className="mt-1 w-full resize-y rounded-xl border border-border bg-fog px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30" /></div>;
}

function formDataRecord(formData: FormData): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, raw] of formData.entries()) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (key in output) output[key] = Array.isArray(output[key]) ? [...output[key] as string[], value] : [String(output[key]), value];
    else output[key] = value;
  }
  return output;
}

function stringValue(value: unknown) { return value == null ? "" : String(value); }
function numberOrNull(value: unknown) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null; }

function Checklist({ name, label, options }: { name: string; label: string; options: string[] }) {
  const baseId = useId();
  return <fieldset className="planner-checklist"><legend>{label}</legend><div>{options.map((option, index) => <label key={option} htmlFor={`${baseId}-${index}`}><input id={`${baseId}-${index}`} type="checkbox" name={name} value={option} /><span>✓</span>{option}</label>)}</div></fieldset>;
}
