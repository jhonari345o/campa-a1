"use client";

import { InfomediaCategoryPicker } from "@/components/InfomediaCategoryPicker";
import type { CategoryCatalog } from "@/lib/infomedia-server";
import { resolveCategory } from "@/lib/infomedia";
import Link from "next/link";
import Image from "next/image";
import { MediaSelectionIcon } from "@/components/MediaSelectionIcon";
import { FALLBACK_OOH } from "@/lib/diy-zones";
import { diySelectionSummary, influencerRateFor } from "@/lib/diy-workspace";
import { pressEntriesForRegion, pressRegions, validatePressPicks, type PressCatalog, type PressPlanPick } from "@/lib/press-catalog";
import { oohProvinceGroups, oohRateUnit, oohMatches, type OohCatalog } from "@/lib/ooh-catalog";
import styles from "./DiyPlanner.module.css";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { DIGITAL_PLATFORMS, OOH_PROVIDERS, type InfluencerProfile } from "@/lib/media-catalog";
import type { MediaGroup } from "@/lib/media-groups";
import type { OohLocationOption, SavedMediaPlan } from "@/lib/media-workspace";
import { buildPlanningScenarios, mediaGroupLabel, type PlanningScenario } from "@/lib/plan-optimizer";
import { tvValidity, sameMarket, sourceDescription, radioCompatibility, validateBroadcastSelections, type BroadcastCatalog, type BroadcastBrief } from "@/lib/broadcast-catalog";
import { ECUADOR_PROVINCE_OPTIONS } from "@/lib/form-catalogs";
import { guardarPlanManual, type ManualPlanDraft } from "./workspace-actions";
import { CampaignTwin } from "./CampaignTwin";

type TvPick = { sourceId?: string; context?: string; id: string; channel: string; title: string; schedule: string; market: string; unitPrice: number | null; quantity: number };
type RadioPick = { id?: string; sourceId?: string; context?: string; name: string; spotsPerDay: number; days: number };
type OohPick = { id: string; name: string; city: string; status: string; rate: number | null; months: number; units?: number; rateIndex?: number; unitLabel?: string; reference?: string };
type PressPick = PressPlanPick;
type DigitalPick = { slug: string; name: string; pct: number };
type InfluencerPick = { profileId?: string; id: string; name: string; deliverable: string; rate: number | null; quantity: number };

const MEDIA: Array<{ id: MediaGroup; mark: string; detail: string }> = [
  { id: "television", mark: "TV", detail: "Canales, programas y spots" },
  { id: "radio", mark: "RA", detail: "Emisoras, cuñas y días" },
  { id: "ooh", mark: "VP", detail: "Ubicaciones, formatos y meses" },
  { id: "digital", mark: "DI", detail: "Plataformas y distribución" },
  { id: "press", mark: "PR", detail: "Cabeceras, formatos y ediciones" },
  { id: "influencers", mark: "IN", detail: "Perfiles, entregables y derechos" },
];

const CITY_OPTIONS = ["Guayaquil", "Quito", "Cuenca", "Manta", "Samborondón", "Daule", "Durán", "Machala", "Loja", "Ambato", "Todo Ecuador"];



export function DiyPlanner({
  broadcast,
  pressCatalog,
  oohCatalog,
  influencers,
  oohLocations,
  initialPlan,
  categoryCatalog,
}: {
  broadcast: BroadcastCatalog;
  pressCatalog: PressCatalog;
  oohCatalog: OohCatalog;
  categoryCatalog: CategoryCatalog;
  influencers: InfluencerProfile[];
  oohLocations: OohLocationOption[];
  initialPlan?: SavedMediaPlan | null;
}) {
  const initialBrief = initialPlan?.brief ?? {};
  const initialSelection = initialPlan?.selection ?? {};
  const [startDate,setStartDate]=useState(stringValue(initialBrief.startDate));
  const [endDate,setEndDate]=useState(stringValue(initialBrief.endDate));
  const [ageRange,setAgeRange]=useState(stringValue(initialBrief.ageRange)||"Personas 18+");
  const [sex,setSex]=useState(stringValue(initialBrief.sex)||"Todas las personas");
  const [planId, setPlanId] = useState(initialPlan?.id ?? "");
  const [name, setName] = useState(stringValue(initialPlan?.name) || "Plan multimedia personalizado");
  const [brand, setBrand] = useState(stringValue(initialBrief.brand));
  const initialCategory = resolveCategory(categoryCatalog.categories, stringValue(initialBrief.categoryId), stringValue(initialBrief.keyword));
  const [keyword, setKeyword] = useState(initialCategory?.label ?? "");
  const [categoryId, setCategoryId] = useState(initialCategory?.id ?? "");
  const [objective, setObjective] = useState(stringValue(initialBrief.objective) || "Ventas");
  const [priority, setPriority] = useState(stringValue(initialBrief.priority) || "Balance");
  const [audienceType, setAudienceType] = useState(stringValue(initialBrief.audienceType) || "B2C");
  const [audience, setAudience] = useState(stringValue(initialBrief.audience));
  const [targetPeople, setTargetPeople] = useState(numberValue(initialBrief.targetPeople));
  const [interests, setInterests] = useState(stringValue(initialBrief.interests));
  const [budget, setBudget] = useState(numberValue(initialBrief.budgetUsd) || 5000);
  const [geographies, setGeographies] = useState<string[]>(arrayOfStrings(initialBrief.geographies).length
    ? arrayOfStrings(initialBrief.geographies)
    : stringValue(initialBrief.geography) ? [stringValue(initialBrief.geography)] : ["Guayaquil"]);
  const [geoDraft, setGeoDraft] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaGroup[]>(mediaArray(initialBrief.selectedMedia).length
    ? mediaArray(initialBrief.selectedMedia)
    : ["television"]);
  const [scenarioId, setScenarioId] = useState<PlanningScenario["id"]>(scenarioValue(initialPlan?.analysis?.scenario));
  const [digitalReady, setDigitalReady] = useState(Boolean(initialPlan?.analysis?.digitalReady));
  const [tv, setTv] = useState<TvPick[]>(arrayValue<TvPick>(initialSelection.tv));
  const [radioPicks, setRadioPicks] = useState<RadioPick[]>(arrayValue<RadioPick>(initialSelection.radio));
  const [ooh, setOoh] = useState<OohPick[]>(arrayValue<OohPick>(initialSelection.ooh));
  const [press, setPress] = useState<PressPick[]>(arrayValue<PressPick>(initialSelection.press));
  const [digital, setDigital] = useState<DigitalPick[]>(arrayValue<DigitalPick>(initialSelection.digital));
  const [creatorPicks, setCreatorPicks] = useState<InfluencerPick[]>(arrayValue<InfluencerPick>(initialSelection.influencers));
  const [activeMedium, setActiveMedium] = useState<MediaGroup>(mediaArray([initialPlan?.analysis?.activeMedium])[0] ?? selectedMedia[0] ?? "television");
  const [review, setReview] = useState(false);
  const [briefOpen, setBriefOpen] = useState(!initialPlan);
  const builder = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const locations = oohLocations.length ? oohLocations : FALLBACK_OOH;
  const scenarios = useMemo(() => buildPlanningScenarios({
    budgetUsd: budget,
    selectedMedia,
    objective,
    priority,
    audienceType,
    geographyCount: geographies.length,
    digitalReady,
  }), [audienceType, budget, digitalReady, geographies.length, objective, priority, selectedMedia]);
  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
  const brief: BroadcastBrief = { startDate, endDate, geography: geographies.join(","), ageRange, sex, socioeconomic: "Todos los NSE", audienceType };
  const displayTv = tv.map(pick => { const result = validateBroadcastSelections(broadcast, brief, { tv: [pick] }); return result.ok ? (result.selections.tv as TvPick[])[0] : { ...pick, unitPrice: null }; });
  const displayPress = press.map(pick => { const result = validatePressPicks(pressCatalog, [pick], { startDate, endDate, geographies }); return result.ok ? result.picks[0] : { ...pick, unitPrice: null, referencePriceUsd: null }; });
  const summary = diySelectionSummary(selectedMedia, { tv: displayTv, radio: radioPicks, ooh, press: displayPress, digital, influencers: creatorPicks }, scenario?.allocations.find(item => item.kind === "digital")?.amountUsd ?? 0);
  const signature = JSON.stringify({ name, brand, categoryId, objective, priority, audienceType, audience, targetPeople, interests, budget, geographies, startDate, endDate, ageRange, sex, selectedMedia, scenarioId, digitalReady, tv, radioPicks, ooh, press, digital, creatorPicks });
  const savedSignature = useRef(signature);
  const dirty = savedSignature.current !== signature;
  useEffect(() => { if (!dirty) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  function openMedium(kind: MediaGroup) { setActiveMedium(kind); setReview(false); }
  function openReview() { setReview(true); builder.current?.scrollIntoView({ block: "start", behavior: "instant" }); builder.current?.focus({ preventScroll: true }); }


  function toggleMedium(kind: MediaGroup) {
    setSelectedMedia((current) => current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]);
  }

  function addGeography() {
    const clean = geoDraft.trim();
    if (!clean || geographies.includes(clean)) return;
    setGeographies((items) => [...items, clean].slice(0, 20));
    setGeoDraft("");
  }

  function save(submitForReview: boolean) {
    setMessage(null);
    const input: ManualPlanDraft = {
      planId: planId || null,
      name,
      brand,
      keyword,
      categoryId,
      objective,
      priority,
      audience,
      targetPeople: targetPeople || null,
      interests,
      audienceType,
      budgetUsd: budget,
      geographies, startDate, endDate, ageRange, sex,
      selectedMedia,
      scenarioId: scenario?.id ?? "recommended",
      digitalReady,
      activeMedium,
      submitForReview,
      selections: { tv, radio: radioPicks, ooh, press, digital, influencers: creatorPicks },
    };
    startTransition(async () => {
      const result = await guardarPlanManual(input);
      if (!result.ok) setMessage({ ok: false, text: result.error });
      else {
        savedSignature.current = signature;
        setPlanId(result.id);
        setMessage({ ok: true, text: result.message });
      }
    });
  }

  return <div className={styles.root}>
    <header className={styles.hero}><div><p className={styles.kicker}>Modo autogestionado</p><h1>DIY · Crea tu plan de medios</h1><p>Elige medios, productos, plazas y cantidades. Revisa tu selección en un solo lugar.</p><div className={styles.heroActions}><button type="button" className="btn btn-primary" onClick={() => { setBriefOpen(false); setReview(false); builder.current?.scrollIntoView({ block: "start", behavior: "instant" }); }}>Empezar a configurar →</button><Link href="/planificador?view=planner" className={styles.secondaryLink}>Planificador guiado ↗</Link></div></div><div className={styles.heroSignal}><span>1</span><div><small>TÚ CONFIGURAS</small><strong>Tu selección. Tu plan.</strong><p>Guarda el avance y retómalo desde tu cuenta.</p></div></div></header>
    <div className={styles.selectionDock}><div><span>Mi selección</span><strong>{summary.count} {summary.count === 1 ? "producto seleccionado" : "productos seleccionados"}</strong><small>{dirty ? "Cambios sin guardar" : planId ? "Avance guardado en tu cuenta" : "Guarda para continuar después"}</small></div><div><button type="button" className="btn btn-primary" onClick={openReview}>Revisar y finalizar</button><Link href="/planificador?view=plans" className="btn btn-secondary">Planes guardados</Link></div></div>
    {initialPlan && <p className={styles.resume}>Continuando “{initialPlan.name}” · versión {initialPlan.version}.</p>}
    <details open={briefOpen} onToggle={event => setBriefOpen(event.currentTarget.open)} className={styles.brief}><summary><span>Brief, fechas y público</span><small>{brand || "Define tu marca"} · {geographies.join(" · ")} · {money(budget)}</small></summary><div className={styles.briefBody}>
      <div className={styles.formGrid}><Field label="Nombre del plan" value={name} onChange={setName} /><Field label="Marca" value={brand} onChange={setBrand} /><InfomediaCategoryPicker categories={categoryCatalog.categories} error={categoryCatalog.error} initialId={stringValue(initialBrief.categoryId)} initialLabel={stringValue(initialBrief.keyword)} onSelect={category => { setKeyword(category?.label ?? ""); setCategoryId(category?.id ?? ""); }} /><NumberField label="Presupuesto total (USD)" value={budget} onChange={setBudget} min={1} /><Select label="Objetivo" value={objective} onChange={setObjective} options={["Reconocimiento", "Alcance", "Tráfico", "Interacción", "Mensajes", "Leads", "Ventas", "Visitas al local"].map(item => [item, item])} /><Select label="Prioridad" value={priority} onChange={setPriority} options={["Cobertura", "Frecuencia", "Eficiencia", "Conversión", "Afinidad", "Presencia local", "Balance"].map(item => [item, item])} /><Select label="Tipo de audiencia" value={audienceType} onChange={setAudienceType} options={["B2C", "B2B", "Mixta"].map(item => [item, item])} /><NumberField label="Personas a impactar (referencia)" value={targetPeople} onChange={setTargetPeople} min={0} /></div>
      <div className={styles.formGridTwo}><TextArea label="Audiencia" value={audience} onChange={setAudience} placeholder="Personas, necesidades y comportamientos prioritarios" /><TextArea label="Intereses, comportamientos o cargos" value={interests} onChange={setInterests} placeholder="Intereses, cargos y contextos relevantes" /></div>
      <div className={styles.formGrid}><label className="text-xs font-black">Inicio<input type="date" className={styles.dateField} value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label className="text-xs font-black">Fin<input type="date" className={styles.dateField} value={endDate} onChange={event => setEndDate(event.target.value)} /></label><Select label="Edad" value={ageRange} onChange={setAgeRange} options={["Personas 18+", "18-34", "35+", "25-54"].map(item => [item, item])} /><Select label="Sexo" value={sex} onChange={setSex} options={["Todas las personas", "Mujeres", "Hombres"].map(item => [item, item])} /></div>
      <div className={styles.geography}><strong>Coberturas del plan</strong><div className={styles.geoChips}>{geographies.map(item => <button key={item} type="button" aria-label={`Quitar cobertura ${item}`} onClick={() => setGeographies(current => current.filter(value => value !== item))}>{item} ×</button>)}</div><div className={styles.geoAdd}><label><span className="sr-only">Agregar ciudad o provincia</span><select value={geoDraft} onChange={event => setGeoDraft(event.target.value)}><option value="">Agregar ciudad o provincia</option>{CITY_OPTIONS.map(item => <option key={item}>{item}</option>)}{ECUADOR_PROVINCE_OPTIONS.map(item => <option key={item.value} value={`Provincia de ${item.label}`}>{item.label}</option>)}</select></label><button type="button" onClick={addGeography} className="btn btn-secondary">Agregar cobertura</button></div></div>
    </div></details>
    <nav className={styles.mediumRail} aria-label="Configurar medios del plan">{MEDIA.map(item => { const included = selectedMedia.includes(item.id), active = !review && activeMedium === item.id; return <div key={item.id} className={`${styles.mediumItem} ${active ? styles.mediumActive : ""}`}><button type="button" className={styles.mediumOpen} aria-pressed={active} aria-controls="diy-configurator" onClick={() => openMedium(item.id)}><span className={styles.mediumIcon}><MediaSelectionIcon medium={item.id} /></span><span><strong>{mediaGroupLabel(item.id)}</strong><small>{item.detail}</small></span></button><button type="button" className={styles.includeButton} aria-label={`${included ? "Quitar" : "Añadir"} ${mediaGroupLabel(item.id)} del plan`} aria-pressed={included} onClick={() => toggleMedium(item.id)}>{included ? "✓" : "+"}</button></div>; })}</nav>
    <div className={styles.workspace}><div ref={builder} id="diy-configurator" tabIndex={-1} className={styles.builder}>
      {!review && !selectedMedia.includes(activeMedium) && <div className={styles.includeNotice}><p>{mediaGroupLabel(activeMedium)} está fuera del plan.</p><button type="button" className="btn btn-primary" onClick={() => toggleMedium(activeMedium)}>Añadir {mediaGroupLabel(activeMedium)}</button></div>}
      {review && <section className={styles.review}><p className={styles.kicker}>Mi selección</p><h2>Revisa y finaliza tu plan</h2><p>{name} · {brand || "Marca por definir"}</p>{!summary.count && <p className={styles.empty}>Todavía no hay productos seleccionados.</p>}{selectedMedia.map(kind => { const rows = summary.rows.filter(row => row.medium === kind); return <section key={kind} className={styles.reviewGroup}><header><h3>{mediaGroupLabel(kind)}</h3><button type="button" onClick={() => openMedium(kind)}>Editar →</button></header>{rows.length ? rows.map(row => <div key={row.key} className={styles.reviewRow}><div><strong>{row.label}</strong><small>{row.detail}</small></div><b>{row.cost == null ? "Tarifa pendiente" : money(row.cost)}</b></div>) : <p className={styles.empty}>Sin productos seleccionados en este medio.</p>}</section>; })}</section>}
      <fieldset disabled={!selectedMedia.includes(activeMedium)} hidden={review} className={styles.configuratorFieldset} aria-label="Configuración del medio activo">
        <div hidden={activeMedium !== "television"}><TvConfigurator catalog={broadcast} brief={brief} picks={tv} onChange={setTv} /></div>
        <div hidden={activeMedium !== "radio"}><RadioConfigurator catalog={broadcast} brief={brief} picks={radioPicks} onChange={setRadioPicks} /></div>
        <div hidden={activeMedium !== "ooh"}><OohConfigurator catalog={oohCatalog} locations={locations} picks={ooh} onChange={setOoh} /></div>
        <div hidden={activeMedium !== "digital"}><DigitalConfigurator picks={digital} onChange={setDigital} ready={digitalReady} onReadyChange={setDigitalReady} /></div>
        <div hidden={activeMedium !== "press"}><PressConfigurator catalog={pressCatalog} brief={{ startDate, endDate, geographies }} picks={press} onChange={setPress} /></div>
        <div hidden={activeMedium !== "influencers"}><InfluencerConfigurator profiles={influencers} picks={creatorPicks} onChange={setCreatorPicks} /></div>
      </fieldset>
      {!review && <div className={styles.continueRow}><button type="button" onClick={openReview} className="btn btn-secondary">Revisar mi selección</button><button type="button" onClick={() => openMedium(MEDIA[(MEDIA.findIndex(item => item.id === activeMedium) + 1) % MEDIA.length].id)} className="btn btn-primary">Siguiente medio →</button></div>}
    </div>
    <aside className={styles.summary} aria-label="Resumen del plan"><div className={styles.summarySticky}><p className={styles.kicker}>Mi selección</p><h2>{name}</h2><p>{selectedMedia.length} {selectedMedia.length === 1 ? "medio" : "medios"} · {geographies.length} {geographies.length === 1 ? "cobertura" : "coberturas"}</p><div className={styles.summaryBudget}><small>Inversión de referencia</small><strong>{money(summary.referenceUsd)}</strong><span>{summary.pending ? `${summary.pending} ${summary.pending === 1 ? "producto con tarifa pendiente" : "productos con tarifa pendiente"}` : `${summary.count} ${summary.count === 1 ? "producto seleccionado" : "productos seleccionados"}`}</span></div><dl className={styles.summaryLines}>{selectedMedia.map(kind => <div key={kind}><dt>{mediaGroupLabel(kind)}</dt><dd>{summary.rows.filter(row => row.medium === kind).length} {summary.rows.filter(row => row.medium === kind).length === 1 ? "producto" : "productos"}</dd></div>)}</dl><p className={styles.budgetLine}>Presupuesto del brief <b>{money(budget)}</b></p>{summary.referenceUsd > budget && <p role="status" className={styles.overBudget}>La selección de referencia supera el presupuesto del brief.</p>}<div className={styles.summaryActions}><button type="button" onClick={() => save(false)} disabled={pending} className="btn btn-secondary">{pending ? "Guardando…" : "Guardar avance"}</button><button type="button" onClick={() => review ? save(true) : openReview()} disabled={pending} className="btn btn-primary">{review ? "Enviar a revisión →" : "Revisar y finalizar →"}</button></div><small className={styles.saveState}>{dirty ? "Cambios sin guardar" : planId ? "Guardado en tu cuenta" : "Borrador nuevo"}</small>{message && <p role={message.ok ? "status" : "alert"} className={message.ok ? styles.success : styles.error}>{message.text}{message.ok && <> <Link href="/planificador?view=plans">Ver historial</Link></>}</p>}</div></aside></div>
    <details className={styles.analysis}><summary>Escenarios de inversión y simulador</summary><div><p className={styles.analysisIntro}>Compara distribuciones del presupuesto conservando las mismas fechas, público y coberturas del brief.</p><div className={styles.scenarios}>{scenarios.map(item => <button key={item.id} type="button" aria-pressed={scenario?.id === item.id} onClick={() => setScenarioId(item.id)}><strong>{item.label}</strong><p>{item.description}</p><dl>{item.allocations.map(allocation => <div key={allocation.kind}><dt>{mediaGroupLabel(allocation.kind)}</dt><dd>{percent(allocation.pct)} · {money(allocation.amountUsd)}</dd></div>)}</dl></button>)}</div>{scenario && <CampaignTwin scenario={scenario} budgetUsd={budget} geographies={geographies} digitalReady={digitalReady} onApplyBudget={setBudget} />}</div></details>
  </div>;
}

function TvConfigurator({catalog,brief,picks,onChange}:{catalog:BroadcastCatalog;brief:BroadcastBrief;picks:TvPick[];onChange:(v:TvPick[])=>void}) {
 const sources=catalog.sources.filter(s=>s.kind==='tv'); const [sourceId,setSourceId]=useState(sources[0]?.id??''); const source=sources.find(s=>s.id===sourceId);
 const offers=catalog.tv.filter(o=>o.sourceId===sourceId); const [offerId,setOfferId]=useState(''); const offer=offers.find(o=>o.id===offerId)??offers[0];
 const valid=!!source&&tvValidity(source,brief.startDate,brief.endDate); const scoped=!!source&&sameMarket(source,brief)&&!source.annualContract;
 function add(){if(!offer||!source||!valid||picks.some(p=>p.id===offer.id))return;onChange([...picks,{id:offer.id,sourceId:source.id,context:sourceDescription(source),channel:source.label,title:offer.title,schedule:`${offer.day} · ${offer.schedule}`,market:source.market,unitPrice:scoped?offer.priceUsd:null,quantity:1}]);}
 return <Configurator number="01" eyebrow="Televisión" title="Tarifas por edición y fechas"><div className="grid gap-3 lg:grid-cols-2"><Select label="Canal y vigencia" value={sourceId} onChange={v=>{setSourceId(v);setOfferId('');}} options={sources.map(s=>[s.id,`${s.label} · ${s.periodStart} – ${s.periodEnd}`])}/><Select label="Programa" value={offer?.id??''} onChange={setOfferId} options={offers.map(o=>[o.id,`${o.title} · ${o.day} · ${money(o.priceUsd)}`])}/></div>{source&&<p className="mt-3 text-xs">{sourceDescription(source)} · {source.conditions}</p>}{!valid&&<p className="mt-3 font-bold">Define fechas dentro de la vigencia de este tarifario.</p>}{valid&&!scoped&&<p className="mt-3 text-sm">La plaza o condición contractual requiere validación. Se agregará el programa sin aplicar un costo al plan.</p>}<button type="button" disabled={!valid||!offer} onClick={add} className="btn btn-primary mt-4 disabled:opacity-50">Agregar programa</button><PickList items={picks} empty="Selecciona una edición compatible con las fechas de campaña." render={item=><><div><strong>{item.channel} · {item.title}</strong><small>{item.context??item.market} · {(() => { const v=validateBroadcastSelections(catalog,brief,{tv:[item]}); return !v.ok?v.error:((v.selections.tv as TvPick[])[0].unitPrice==null?'Costo pendiente de validación':money((v.selections.tv as TvPick[])[0].unitPrice!)); })()}</small></div><NumberCompact value={item.quantity} onChange={quantity=>onChange(picks.map(p=>p.id===item.id?{...p,quantity}:p))}/><Remove onClick={()=>onChange(picks.filter(p=>p.id!==item.id))}/></>}/></Configurator>;
}
function RadioConfigurator({catalog,brief,picks,onChange}:{catalog:BroadcastCatalog;brief:BroadcastBrief;picks:RadioPick[];onChange:(v:RadioPick[])=>void}) {
 const sources=catalog.sources.filter(s=>s.kind==='radio');const [sourceId,setSourceId]=useState(sources[0]?.id??'');const source=sources.find(s=>s.id===sourceId);const rows=catalog.radio.filter(r=>r.sourceId===sourceId).sort((a,b)=>(b.rating??-1)-(a.rating??-1));const [rowId,setRowId]=useState('');const row=rows.find(r=>r.id===rowId)??rows[0];const mismatch=source?radioCompatibility(source,brief):'No hay estudio disponible';
 function add(){if(!row||!source||mismatch||picks.some(p=>p.id===row.id))return;onChange([...picks,{id:row.id,sourceId,context:sourceDescription(source),name:row.name,spotsPerDay:6,days:20}]);}
 return <Configurator number="02" eyebrow="Radio" title="Selecciona un estudio compatible"><Select label="Estudio de radio" value={sourceId} onChange={v=>{setSourceId(v);setRowId('');}} options={sources.map(s=>[s.id,sourceDescription(s)])}/><Select label="Emisora del estudio" value={row?.id??''} onChange={setRowId} options={rows.map(r=>[r.id,`${r.name} · rating ${r.rating??'—'}`])}/>{mismatch&&<p className="mt-3 text-sm font-bold">{mismatch}. Puedes consultar el estudio en el catálogo sin aplicarlo al plan.</p>}<button type="button" disabled={!!mismatch||!row} onClick={add} className="btn btn-primary mt-3 disabled:opacity-50">Agregar emisora</button><PickList items={picks} empty="Cada selección conserva la fuente y el público del ranking." render={item=><><div><strong>{item.name}</strong><small>{item.context??'Selección histórica sin estudio asociado'} · {item.spotsPerDay*item.days} cuñas{(() => {const s=catalog.sources.find(s=>s.id===item.sourceId);const m=s?radioCompatibility(s,brief):'Selecciona nuevamente un estudio';return m?` · ${m}`:'';})()}</small></div><NumberCompact value={item.spotsPerDay} onChange={spotsPerDay=>onChange(picks.map(p=>p===item?{...p,spotsPerDay}:p))}/><Remove onClick={()=>onChange(picks.filter(p=>p!==item))}/></>}/></Configurator>;
}

function OohConfigurator({ catalog, locations, picks, onChange }: { catalog: OohCatalog; locations: OohLocationOption[]; picks: OohPick[]; onChange: (value: OohPick[]) => void }) {
  const [provider, setProvider] = useState(""), [province, setProvince] = useState(""), [query, setQuery] = useState(""), [id, setId] = useState(""), [rateIndex, setRateIndex] = useState(0);
  const groups = oohProvinceGroups(catalog.assets);
  const assets = catalog.assets.filter(asset => (!provider || asset.providerSlug === provider) && (!province || groups.find(group => group.key === province)?.assets.some(item => item.id === asset.id)) && oohMatches(asset, query));
  const asset = assets.find(asset => asset.id === id) ?? assets[0];
  const selectedRate = asset?.rates[rateIndex] ?? asset?.rates[0];
  const effectiveRateIndex = selectedRate ? asset.rates.indexOf(selectedRate) : -1;
  const legacy = locations.find(item => item.id === id) ?? locations[0];
  function add() {
    const next: OohPick | undefined = asset ? { id: asset.id, name: asset.name, city: asset.city, status: "inventory", rate: selectedRate?.amount ?? null, months: 1, units: 1, rateIndex: effectiveRateIndex, unitLabel: selectedRate ? oohRateUnit(selectedRate) : "Unidad por definir", reference: asset.reference } : !catalog.assets.length && !catalog.error && legacy ? { id: legacy.id, name: legacy.name, city: legacy.city, status: legacy.status, rate: legacy.status === "inventory" ? legacy.monthlyRateUsd : null, months: 1, units: 1, unitLabel: "mes" } : undefined;
    if (next && !picks.some(pick => pick.id === next.id)) onChange([...picks, next]);
  }
  return <Configurator number="03" eyebrow="Vía pública" title="Proveedor, provincia y ubicación">
    {catalog.error && <p role="alert" className={styles.error}>{catalog.error}</p>}
    {catalog.assets.length ? <><div className={styles.formGridTwo}><Select label="Proveedor" value={provider} onChange={value => { setProvider(value); setId(""); setRateIndex(0); }} options={[["", "Todos los proveedores"], ...[...new Set(catalog.assets.map(asset => asset.providerSlug))].map(slug => [slug, OOH_PROVIDERS.find(provider => provider.slug === slug)?.name ?? slug] as [string, string])]} /><Select label="Provincia" value={province} onChange={value => { setProvince(value); setId(""); setRateIndex(0); }} options={[["", "Todas las provincias"], ...groups.map(group => [group.key, group.name] as [string, string])]} /><Field label="Buscar ubicación o formato" value={query} onChange={setQuery} /><Select label="Elemento del catálogo" value={asset?.id ?? ""} onChange={value => { setId(value); setRateIndex(0); }} options={assets.map(asset => [asset.id, [asset.city, asset.name, asset.code].filter(Boolean).join(" · ")])} /></div>{asset && <div className={styles.assetPreview}>{asset.photo && <div className={styles.assetPhoto}><Image src={`/api/ooh/images/${encodeURIComponent(asset.id)}`} alt={asset.photoKind === "format" ? `Referencia del formato ${asset.format}` : asset.name} fill unoptimized sizes="300px" className="object-contain" /></div>}<div><strong>{asset.name}</strong><p>{[asset.city, asset.address].filter(Boolean).join(" · ")}</p><p>{asset.format} · {asset.dimensions}</p><Select label="Tarifa y unidad de referencia" value={String(effectiveRateIndex)} onChange={value => setRateIndex(Number(value))} options={asset.rates.length ? asset.rates.map((rate, index) => [String(index), `${money(rate.amount)} · ${oohRateUnit(rate)} · ${rate.component}`]) : [["-1", "Tarifa no incorporada"]]} /><small>{asset.reference}</small></div></div>}{!assets.length && <p className={styles.empty}>No hay elementos para estos filtros.</p>}</> : <Select label="Ubicación o corredor" value={legacy?.id ?? ""} onChange={setId} options={locations.map(item => [item.id, `${item.city} · ${item.name} · ${item.status === "inventory" ? "inventario" : "zona candidata"}`])} />}
    <button type="button" onClick={add} disabled={!!catalog.error || (catalog.assets.length > 0 && !asset)} className="btn btn-primary mt-4">Agregar ubicación</button>
    <PickList items={picks} empty="Elige una ubicación para incorporarla a tu plan." render={item => <><div><strong>{item.name}</strong><small>{item.city} · {item.rate == null ? "Tarifa pendiente" : `${money(item.rate)} · ${item.unitLabel ?? "mes"}`} · {item.status === "inventory" ? "Referencia del catálogo" : "Zona candidata"}</small></div><label className="text-xs font-bold">Unidades<NumberCompact value={item.units ?? item.months} onChange={units => onChange(picks.map(pick => pick.id === item.id ? { ...pick, units, months: units } : pick))} /></label><Remove onClick={() => onChange(picks.filter(pick => pick.id !== item.id))} /></>} />
  </Configurator>;
}

function DigitalConfigurator({ picks, onChange, ready, onReadyChange }: { picks: DigitalPick[]; onChange: (value: DigitalPick[]) => void; ready: boolean; onReadyChange: (value: boolean) => void }) {
  function toggle(slug: string, name: string) {
    const exists = picks.some((item) => item.slug === slug);
    const next = exists ? picks.filter((item) => item.slug !== slug) : [...picks, { slug, name, pct: 0 }];
    const pct = next.length ? 1 / next.length : 0;
    onChange(next.map((item) => ({ ...item, pct })));
  }
  return <Configurator number="04" eyebrow="Digital" title="Une objetivo, plataformas y medición"><label className="mb-4 flex items-start gap-3 rounded-xl bg-fog p-4 text-sm"><input type="checkbox" checked={ready} onChange={(event) => onReadyChange(event.target.checked)} className="mt-1" /><span><strong className="block text-forest">Destino, tracking y cuentas preparados</strong><small className="text-muted">Si no está marcado, el escenario conserva la inversión pero exige preparación antes del forecast.</small></span></label><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{DIGITAL_PLATFORMS.map((item) => { const active = picks.some((pick) => pick.slug === item.slug); return <button key={item.slug} type="button" onClick={() => toggle(item.slug, item.name)} className={`rounded-card border p-4 text-left ${active ? "border-signal bg-forest text-white" : "border-border bg-fog"}`}><strong>{item.name}</strong><small className={`mt-1 block ${active ? "text-white/65" : "text-muted"}`}>{item.objective}</small>{active && <b className="mt-3 block text-signal">{percent(picks.find((pick) => pick.slug === item.slug)?.pct ?? 0)} del bloque digital</b>}</button>; })}</div></Configurator>;
}

function PressConfigurator({ catalog, brief, picks, onChange }: { catalog: PressCatalog; brief: { startDate?: string; endDate?: string; geographies: string[] }; picks: PressPick[]; onChange: (value: PressPick[]) => void }) {
  const [region, setRegion] = useState("national"), [entryId, setEntryId] = useState(""), [editionId, setEditionId] = useState(""), [group, setGroup] = useState(""), [offerId, setOfferId] = useState(""), [market, setMarket] = useState(""), [format, setFormat] = useState("Página completa"), [error, setError] = useState("");
  const entries = pressEntriesForRegion(catalog, region), entry = entries.find(entry => entry.id === entryId) ?? entries[0];
  const edition = entry?.editions.find(edition => edition.id === editionId) ?? entry?.editions[0];
  const groups = [...new Set(edition?.offers.map(offer => offer.group) ?? [])], family = groups.includes(group) ? group : groups[0] ?? "";
  const markets = [...new Set(edition?.offers.filter(offer => offer.group === family).map(offer => offer.market) ?? [])], currentMarket = markets.includes(market) ? market : markets[0] ?? "";
  const offers = edition?.offers.filter(offer => offer.group === family && offer.market === currentMarket) ?? [], offer = offers.find(offer => offer.id === offerId) ?? offers[0];
  function add() {
    if (!entry) return;
    const pick: PressPick = { slug: `${entry.id}-request-${picks.length}`, outletId: entry.id, name: entry.name, format, quantity: 1, ...(edition && offer ? { editionId: edition.id, offerId: offer.id } : {}) };
    const checked = validatePressPicks(catalog, [pick], brief);
    if (!checked.ok) { setError(checked.error); return; }
    const next = checked.picks[0], previous = picks.find(pick => pick.slug === next.slug);
    onChange(previous ? picks.map(pick => pick.slug === next.slug ? { ...pick, quantity: Math.min(10000, pick.quantity + 1) } : pick) : [...picks, next]); setError("");
  }
  return <Configurator number="05" eyebrow="Prensa" title="Provincia, cabecera y formato">
    {catalog.error && <p role="alert" className={styles.error}>{catalog.error}</p>}
    <div className={styles.formGridTwo}><Select label="Cobertura de prensa" value={region} onChange={value => { setRegion(value); setEntryId(""); setEditionId(""); setGroup(""); setMarket(""); setOfferId(""); }} options={pressRegions.map(region => [region.key, region.label])} /><Select label="Cabecera" value={entry?.id ?? ""} onChange={value => { setEntryId(value); setEditionId(""); setGroup(""); setMarket(""); setOfferId(""); }} options={entries.map(entry => [entry.id, entry.name])} /></div>
    {entry && <p className={styles.sourceContext}>{entry.coverage}</p>}
    {edition ? <><div className={styles.formGridTwo}><Select label="Edición" value={edition.id} onChange={value => { setEditionId(value); setGroup(""); setMarket(""); setOfferId(""); }} options={entry!.editions.map(edition => [edition.id, `${edition.label} · ${edition.period}`])} /><Select label="Familia de formatos" value={family} onChange={value => { setGroup(value); setMarket(""); setOfferId(""); }} options={groups.map(group => [group, group])} /><Select label="Plaza del formato" value={currentMarket} onChange={value => { setMarket(value); setOfferId(""); }} options={markets.map(market => [market, market])} /><Select label="Formato del tarifario" value={offer?.id ?? ""} onChange={setOfferId} options={offers.map(offer => [offer.id, `${offer.name} · ${offer.priceUsd == null ? "Sin precio declarado" : money(offer.priceUsd)} · ${offer.unit}`])} /></div>{offer && <p className={styles.sourceContext}>{offer.specs}{offer.duration ? ` · ${offer.duration}` : ""}</p>}</> : entry ? <Select label="Formato solicitado" value={format} onChange={setFormat} options={["Página completa", "Media página", "Publirreportaje", "Portada o contraportada", "Display digital", "Contenido patrocinado"].map(format => [format, format])} /> : <p className={styles.empty}>Todavía no hay cabeceras incorporadas en esta provincia.</p>}
    <button type="button" onClick={add} disabled={!entry || !!catalog.error} className="btn btn-primary mt-4">Agregar formato</button>{error && <p role="alert" className={styles.error}>{error}</p>}
    <PickList items={picks} empty="Selecciona una cabecera y un formato para armar tu pauta." render={item => <><div><strong>{item.name} · {item.format}</strong><small>{item.context || "Solicitud de formato"} · {item.unitPrice != null ? money(item.unitPrice) : item.referencePriceUsd != null ? `${money(item.referencePriceUsd)} de referencia` : "Tarifa pendiente"}</small></div><label className="text-xs font-bold">{item.unit === "CPM" ? "Miles de impresiones" : "Unidades"}<NumberCompact value={item.quantity} onChange={quantity => onChange(picks.map(pick => pick.slug === item.slug ? { ...pick, quantity } : pick))} /></label><Remove onClick={() => onChange(picks.filter(pick => pick.slug !== item.slug))} /></>} />
  </Configurator>;
}

function InfluencerConfigurator({ profiles, picks, onChange }: { profiles: InfluencerProfile[]; picks: InfluencerPick[]; onChange: (value: InfluencerPick[]) => void }) {
  const [category, setCategory] = useState<InfluencerProfile["category"]>("foodie");
  const available = profiles.filter((item) => item.category === category);
  const [profileId, setProfileId] = useState("");
  const [deliverable, setDeliverable] = useState("Reel colaborativo");
  function add() { const profile = available.find((item) => item.id === profileId) ?? available[0]; if (!profile) return; const rate = influencerRateFor(profile, deliverable); onChange([...picks, { id: `${profile.id}-${deliverable}-${picks.length}`, profileId: profile.id, name: profile.name, deliverable, rate, quantity: 1 }]); }
  return <Configurator number="06" eyebrow="Influenciadores" title="Arma el roster y sus entregables"><div className="grid gap-3 xl:grid-cols-[.8fr_1.2fr_1fr_auto]"><Select label="Categoría" value={category} onChange={(value) => { setCategory(value as InfluencerProfile["category"]); setProfileId(""); }} options={[["deportes", "Deportes"], ["foodie", "Foodie"], ["beauty", "Beauty"]]} /><Select label="Perfil" value={profileId || available[0]?.id || ""} onChange={setProfileId} options={available.map((item) => [item.id, `${item.name}${item.handle ? ` · @${item.handle.replace(/^@/, "")}` : ""}`])} /><Select label="Entregable" value={deliverable} onChange={setDeliverable} options={["Reel colaborativo", "TikTok", "Historia", "Derecho de pauta"].map((item) => [item, item])} /><button type="button" onClick={add} className="btn btn-primary self-end">Agregar</button></div><PickList items={picks} empty="Selecciona una categoría antes de mezclar perfiles sin relación con la campaña." render={(item) => <><div><strong>{item.name} · {item.deliverable}</strong><small>{item.rate == null ? "Tarifa pendiente" : `${money(item.rate)} referencial sin IVA`} · derechos y disponibilidad por reconfirmar</small></div><NumberCompact value={item.quantity} onChange={(quantity) => onChange(picks.map((pick) => pick.id === item.id ? { ...pick, quantity } : pick))} /><Remove onClick={() => onChange(picks.filter((pick) => pick.id !== item.id))} /></>} /></Configurator>;
}

function Configurator({ number, eyebrow, title, children }: { number: string; eyebrow: string; title: string; children: React.ReactNode }) { return <section className="rounded-panel border border-border bg-white p-6 shadow-panel"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-forest text-sm font-black text-signal">{number}</span><div><p className="text-xs font-black uppercase tracking-wide text-signal-dark">{eyebrow}</p><h2 className="text-xl font-black">{title}</h2></div></div><div className="mt-6">{children}</div></section>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-xs font-black text-forest">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-fog px-4 text-sm font-normal" /></label>; }
function NumberField({ label, value, onChange, min }: { label: string; value: number; onChange: (value: number) => void; min: number }) { return <label className="text-xs font-black text-forest">{label}<input type="number" min={min} value={value || ""} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-fog px-4 text-sm font-normal" /></label>; }
function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="text-xs font-black text-forest">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 text-sm font-normal" /></label>; }
function Select({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (value: string) => void; options: Array<readonly [string, string] | string[]>; placeholder?: string }) { return <label className="min-w-0 flex-1 text-xs font-black text-forest">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-fog px-3 text-sm font-normal">{placeholder && <option value="">{placeholder}</option>}{options.map(([optionValue, optionLabel]) => <option key={`${optionValue}-${optionLabel}`} value={optionValue}>{optionLabel}</option>)}</select></label>; }
function PickList<T>({ items, empty, render }: { items: T[]; empty: string; render: (item: T) => React.ReactNode }) { return items.length ? <div className="mt-5 space-y-2">{items.map((item, index) => <div key={index} className="grid items-center gap-3 rounded-xl border border-border bg-fog p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">{render(item)}</div>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-border bg-fog p-5 text-center text-sm text-muted">{empty}</p>; }
function NumberCompact({ value, onChange }: { value: number; onChange: (value: number) => void }) { return <input type="number" min="1" value={value} onChange={(event) => onChange(Math.max(1, Number(event.target.value)))} className="h-10 w-20 rounded-lg border border-border bg-white px-2 text-center text-sm font-black" />; }
function Remove({ onClick }: { onClick: () => void }) { return <button type="button" onClick={onClick} className="rounded-lg border border-coral/30 px-3 py-2 text-xs font-black text-[#a13b31]">Quitar</button>; }
function percent(value: number) { return `${Math.round(value * 100)}%`; }
function money(value: number | null) { if(value == null) return "Consultar tarifa"; return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function numberValue(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function arrayOfStrings(value: unknown) { return Array.isArray(value) ? value.map(String).filter(Boolean) : []; }
function arrayValue<T>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }
function mediaArray(value: unknown): MediaGroup[] { return arrayOfStrings(value).filter((item): item is MediaGroup => MEDIA.some((medium) => medium.id === item)); }
function scenarioValue(value: unknown): PlanningScenario["id"] { const id = value && typeof value === "object" ? (value as { id?: unknown }).id : null; return id === "efficiency" || id === "presence" ? id : "recommended"; }
