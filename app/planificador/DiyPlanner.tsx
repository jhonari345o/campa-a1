"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { DIGITAL_PLATFORMS, PRESS_OUTLETS, type InfluencerProfile, type RadioStation } from "@/lib/media-catalog";
import type { MediaGroup } from "@/lib/media-groups";
import type { OohLocationOption, SavedMediaPlan } from "@/lib/media-workspace";
import { buildPlanningScenarios, mediaGroupLabel, type PlanningScenario } from "@/lib/plan-optimizer";
import { TV_RATE_CATALOGS } from "@/lib/tv-rate-catalog";
import { BUSINESS_CATEGORY_OPTIONS, ECUADOR_PROVINCE_OPTIONS } from "@/lib/form-catalogs";
import { guardarPlanManual, type ManualPlanDraft } from "./workspace-actions";

type TvPick = { id: string; channel: string; title: string; schedule: string; market: string; unitPrice: number | null; quantity: number };
type RadioPick = { name: string; spotsPerDay: number; days: number };
type OohPick = { id: string; name: string; city: string; status: string; rate: number | null; months: number };
type PressPick = { slug: string; name: string; format: string; quantity: number };
type DigitalPick = { slug: string; name: string; pct: number };
type InfluencerPick = { id: string; name: string; deliverable: string; rate: number | null; quantity: number };

const MEDIA: Array<{ id: MediaGroup; mark: string; detail: string }> = [
  { id: "television", mark: "TV", detail: "Canales, programas y spots" },
  { id: "radio", mark: "RA", detail: "Emisoras, cuñas y días" },
  { id: "ooh", mark: "VP", detail: "Ubicaciones, formatos y meses" },
  { id: "digital", mark: "DI", detail: "Plataformas y distribución" },
  { id: "press", mark: "PR", detail: "Cabeceras, formatos y ediciones" },
  { id: "influencers", mark: "IN", detail: "Perfiles, entregables y derechos" },
];

const CITY_OPTIONS = ["Guayaquil", "Quito", "Cuenca", "Manta", "Samborondón", "Daule", "Durán", "Machala", "Loja", "Ambato", "Todo Ecuador"];

const FALLBACK_OOH: OohLocationOption[] = [
  zone("mall-del-sol", "Entorno Mall del Sol", "Guayaquil", -2.155041, -79.892686),
  zone("san-marino", "Entorno San Marino Shopping", "Guayaquil", -2.169141, -79.898269),
  zone("carlos-julio", "Av. Carlos Julio Arosemena · Albán Borja", "Guayaquil", -2.168693, -79.916651),
  zone("orellana", "Av. Francisco de Orellana · WTC", "Guayaquil", -2.163501, -79.897987),
  zone("25-julio", "Av. 25 de Julio · Mall del Sur", "Guayaquil", -2.227227, -79.897963),
  zone("urdesa", "Urdesa · Víctor Emilio Estrada", "Guayaquil", -2.176354, -79.905004),
  zone("plaza-lagos", "Plaza Lagos · Av. Samborondón", "Samborondón", -2.098392, -79.875193),
];

export function DiyPlanner({
  radio,
  influencers,
  oohLocations,
  initialPlan,
}: {
  radio: RadioStation[];
  influencers: InfluencerProfile[];
  oohLocations: OohLocationOption[];
  initialPlan?: SavedMediaPlan | null;
}) {
  const initialBrief = initialPlan?.brief ?? {};
  const initialSelection = initialPlan?.selection ?? {};
  const [planId, setPlanId] = useState(initialPlan?.id ?? "");
  const [name, setName] = useState(stringValue(initialPlan?.name) || "Plan multimedia personalizado");
  const [brand, setBrand] = useState(stringValue(initialBrief.brand));
  const [keyword, setKeyword] = useState(stringValue(initialBrief.keyword));
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
    : ["television", "radio", "ooh", "digital", "press", "influencers"]);
  const [scenarioId, setScenarioId] = useState<PlanningScenario["id"]>(scenarioValue(initialPlan?.analysis?.scenario));
  const [digitalReady, setDigitalReady] = useState(Boolean(initialPlan?.analysis?.digitalReady));
  const [tv, setTv] = useState<TvPick[]>(arrayValue<TvPick>(initialSelection.tv));
  const [radioPicks, setRadioPicks] = useState<RadioPick[]>(arrayValue<RadioPick>(initialSelection.radio));
  const [ooh, setOoh] = useState<OohPick[]>(arrayValue<OohPick>(initialSelection.ooh));
  const [press, setPress] = useState<PressPick[]>(arrayValue<PressPick>(initialSelection.press));
  const [digital, setDigital] = useState<DigitalPick[]>(arrayValue<DigitalPick>(initialSelection.digital));
  const [creatorPicks, setCreatorPicks] = useState<InfluencerPick[]>(arrayValue<InfluencerPick>(initialSelection.influencers));
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
      objective,
      priority,
      audience,
      targetPeople: targetPeople || null,
      interests,
      audienceType,
      budgetUsd: budget,
      geographies,
      selectedMedia,
      scenarioId: scenario?.id ?? "recommended",
      digitalReady,
      submitForReview,
      selections: { tv, radio: radioPicks, ooh, press, digital, influencers: creatorPicks },
    };
    startTransition(async () => {
      const result = await guardarPlanManual(input);
      if (!result.ok) setMessage({ ok: false, text: result.error });
      else {
        setPlanId(result.id);
        setMessage({ ok: true, text: result.message });
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-border bg-white p-6 shadow-panel sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[.18em] text-signal-dark">DIY · constructor operativo</p><h1 className="mt-2 text-3xl font-black">Crea el plan a tu manera</h1><p className="mt-2 max-w-3xl text-sm text-muted">Selecciona medios, productos, plazas y cantidades. Mavi arma escenarios sin inventar alcance, disponibilidad ni tarifas faltantes.</p></div>
          <Link href="/planificador?view=planner" className="btn btn-secondary">Usar planificador guiado</Link>
        </div>
        {initialPlan && <p className="mt-4 rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm font-bold text-forest">Continuando “{initialPlan.name}” · versión {initialPlan.version}.</p>}
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Nombre del plan" value={name} onChange={setName} />
          <Field label="Marca" value={brand} onChange={setBrand} />
          <Select label="Rubro o giro" value={keyword} onChange={setKeyword} options={BUSINESS_CATEGORY_OPTIONS.map((item) => [item.value, item.label])} placeholder="Seleccionar rubro" />
          <Select label="Objetivo" value={objective} onChange={setObjective} options={["Reconocimiento", "Alcance", "Tráfico", "Interacción", "Mensajes", "Leads", "Ventas", "Visitas al local"].map((item) => [item, item])} />
          <Select label="Prioridad" value={priority} onChange={setPriority} options={["Cobertura", "Frecuencia", "Eficiencia", "Conversión", "Afinidad", "Presencia local", "Balance"].map((item) => [item, item])} />
          <Select label="Tipo de audiencia" value={audienceType} onChange={setAudienceType} options={["B2C", "B2B", "Mixta"].map((item) => [item, item])} />
          <NumberField label="Presupuesto total (USD)" value={budget} onChange={setBudget} min={1} />
          <NumberField label="Personas a impactar (referencia)" value={targetPeople} onChange={setTargetPeople} min={0} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TextArea label="Audiencia" value={audience} onChange={setAudience} placeholder="Personas, necesidades y comportamientos prioritarios" />
          <TextArea label="Intereses, comportamientos o cargos" value={interests} onChange={setInterests} placeholder="Intereses, cargos B2B, hábitos de compra o contextos" />
        </div>
      </section>

      <section className="rounded-panel border border-border bg-white p-6 shadow-panel">
        <SectionTitle number="01" title="Coberturas múltiples" description="Combina ciudades, provincias y cobertura nacional. Las órdenes conservarán cada plaza por separado." />
        <div className="mt-5 flex flex-wrap gap-2">{geographies.map((item) => <button key={item} type="button" onClick={() => setGeographies((current) => current.filter((value) => value !== item))} className="rounded-full border border-signal/30 bg-signal/10 px-3 py-2 text-xs font-black text-forest">{item} ×</button>)}</div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row"><select value={geoDraft} onChange={(event) => setGeoDraft(event.target.value)} className="min-h-11 flex-1 rounded-xl border border-border bg-fog px-4 text-sm"><option value="">Agregar ciudad o provincia</option>{CITY_OPTIONS.map((item) => <option key={item}>{item}</option>)}{ECUADOR_PROVINCE_OPTIONS.map((item) => <option key={item.value} value={`Provincia de ${item.label}`}>{item.label}</option>)}</select><button type="button" onClick={addGeography} className="btn btn-secondary">Agregar cobertura</button></div>
      </section>

      <section className="rounded-panel border border-border bg-white p-6 shadow-panel">
        <SectionTitle number="02" title="Medios del plan" description="Activa sólo los medios que deben participar. Cada uno conserva sus propias unidades y validaciones." />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{MEDIA.map((item) => <button key={item.id} type="button" onClick={() => toggleMedium(item.id)} className={`rounded-card border p-4 text-left ${selectedMedia.includes(item.id) ? "border-signal bg-forest text-white" : "border-border bg-fog text-forest"}`}><span className="text-xs font-black text-signal">{item.mark}</span><strong className="mt-1 block">{mediaGroupLabel(item.id)}</strong><small className={selectedMedia.includes(item.id) ? "text-white/65" : "text-muted"}>{item.detail}</small></button>)}</div>
      </section>

      <section className="rounded-panel border border-border bg-white p-6 shadow-panel">
        <SectionTitle number="03" title="Escenarios de inversión" description="Tres distribuciones comparables. Los montos son presupuesto de trabajo, no promesas de resultados." />
        <div className="mt-5 grid gap-4 lg:grid-cols-3">{scenarios.map((item) => <button key={item.id} type="button" onClick={() => setScenarioId(item.id)} className={`rounded-card border p-5 text-left ${scenario?.id === item.id ? "border-signal bg-forest text-white shadow-panel" : "border-border bg-fog"}`}><div className="flex items-center justify-between gap-2"><strong>{item.label}</strong><span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-black uppercase">Confianza {item.confidence}</span></div><p className={`mt-2 text-xs ${scenario?.id === item.id ? "text-white/70" : "text-muted"}`}>{item.description}</p><dl className="mt-4 space-y-1 text-xs">{item.allocations.map((allocation) => <div key={allocation.kind} className="flex justify-between"><dt>{mediaGroupLabel(allocation.kind)}</dt><dd className="font-black">{percent(allocation.pct)} · {money(allocation.amountUsd)}</dd></div>)}</dl></button>)}</div>
      </section>

      {selectedMedia.includes("television") && <TvConfigurator picks={tv} onChange={setTv} />}
      {selectedMedia.includes("radio") && <RadioConfigurator stations={radio} picks={radioPicks} onChange={setRadioPicks} />}
      {selectedMedia.includes("ooh") && <OohConfigurator locations={locations} picks={ooh} onChange={setOoh} />}
      {selectedMedia.includes("digital") && <DigitalConfigurator picks={digital} onChange={setDigital} ready={digitalReady} onReadyChange={setDigitalReady} />}
      {selectedMedia.includes("press") && <PressConfigurator picks={press} onChange={setPress} />}
      {selectedMedia.includes("influencers") && <InfluencerConfigurator profiles={influencers} picks={creatorPicks} onChange={setCreatorPicks} />}

      <section className="sticky bottom-4 z-20 rounded-panel border border-forest/20 bg-white/95 p-4 shadow-panel backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><small className="font-black uppercase tracking-wide text-muted">Resumen</small><strong className="block text-lg text-forest">{selectedMedia.length} medios · {geographies.length} coberturas · {money(budget)}</strong><span className="text-xs text-muted">{scenario?.label ?? "Selecciona un escenario"}</span></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => save(false)} disabled={pending} className="btn btn-secondary">{pending ? "Guardando…" : "Guardar avance"}</button><button type="button" onClick={() => save(true)} disabled={pending} className="btn btn-primary">Enviar a revisión →</button></div></div>
        {message && <p className={`mt-3 rounded-xl px-4 py-2 text-sm font-bold ${message.ok ? "bg-signal/10 text-forest" : "bg-coral/10 text-[#a13b31]"}`}>{message.text}{message.ok && <> <Link href="/planificador?view=plans" className="underline">Ver historial</Link></>}</p>}
      </section>
    </div>
  );
}

function TvConfigurator({ picks, onChange }: { picks: TvPick[]; onChange: (value: TvPick[]) => void }) {
  const catalogs = Object.entries(TV_RATE_CATALOGS);
  const [catalogKey, setCatalogKey] = useState(catalogs[0]?.[0] ?? "");
  const catalog = TV_RATE_CATALOGS[catalogKey];
  const [offerIndex, setOfferIndex] = useState(0);
  const offer = catalog?.offers[offerIndex];
  function add() {
    if (!catalog || !offer) return;
    const id = `${catalogKey}-${offerIndex}`;
    if (picks.some((item) => item.id === id)) return;
    onChange([...picks, { id, channel: channelLabel(catalog.channelSlug), title: offer.title, schedule: `${offer.day} · ${offer.schedule}`, market: offer.market ?? "Por confirmar", unitPrice: offer.priceUsd, quantity: 1 }]);
  }
  return <Configurator number="04" eyebrow="Televisión" title="Selecciona canales, programas y presión"><div className="grid gap-3 lg:grid-cols-[1fr_2fr_auto]"><Select label="Canal" value={catalogKey} onChange={(value) => { setCatalogKey(value); setOfferIndex(0); }} options={catalogs.map(([key, item]) => [key, channelLabel(item.channelSlug)])} /><Select label="Programa o paquete" value={String(offerIndex)} onChange={(value) => setOfferIndex(Number(value))} options={(catalog?.offers ?? []).map((item, index) => [String(index), `${item.title} · ${item.schedule} · ${item.priceUsd == null ? "cotizar" : money(item.priceUsd)}`])} /><button type="button" onClick={add} className="btn btn-primary self-end">Agregar</button></div><PickList items={picks} empty="Selecciona programas para construir spots y costo tarifable." render={(item) => <><div><strong>{item.channel} · {item.title}</strong><small>{item.schedule} · {item.market} · {item.unitPrice == null ? "Tarifa pendiente" : `${money(item.unitPrice)} por unidad`}</small></div><NumberCompact value={item.quantity} onChange={(quantity) => onChange(picks.map((pick) => pick.id === item.id ? { ...pick, quantity } : pick))} /><Remove onClick={() => onChange(picks.filter((pick) => pick.id !== item.id))} /></>} /></Configurator>;
}

function RadioConfigurator({ stations, picks, onChange }: { stations: RadioStation[]; picks: RadioPick[]; onChange: (value: RadioPick[]) => void }) {
  const [name, setName] = useState(stations[0]?.name ?? "");
  function add() { if (name && !picks.some((item) => item.name === name)) onChange([...picks, { name, spotsPerDay: 6, days: 20 }]); }
  return <Configurator number="05" eyebrow="Radio" title="Construye frecuencia territorial"><div className="flex flex-col gap-3 sm:flex-row"><Select label="Emisora" value={name} onChange={setName} options={stations.map((item) => [item.name, `${item.name}${item.audienceRank ? ` · ranking ${item.audienceRank}` : ""}`])} /><button type="button" onClick={add} className="btn btn-primary self-end">Agregar</button></div><PickList items={picks} empty="Elige emisoras; ranking no equivale a alcance acumulado." render={(item) => <><div><strong>{item.name}</strong><small>{item.spotsPerDay * item.days} cuñas planificadas · tarifa por confirmar</small></div><label className="text-xs font-bold">Cuñas/día<NumberCompact value={item.spotsPerDay} onChange={(spotsPerDay) => onChange(picks.map((pick) => pick.name === item.name ? { ...pick, spotsPerDay } : pick))} /></label><label className="text-xs font-bold">Días<NumberCompact value={item.days} onChange={(days) => onChange(picks.map((pick) => pick.name === item.name ? { ...pick, days } : pick))} /></label><Remove onClick={() => onChange(picks.filter((pick) => pick.name !== item.name))} /></>} /></Configurator>;
}

function OohConfigurator({ locations, picks, onChange }: { locations: OohLocationOption[]; picks: OohPick[]; onChange: (value: OohPick[]) => void }) {
  const [id, setId] = useState(locations[0]?.id ?? "");
  const selected = locations.find((item) => item.id === id);
  function add() { if (selected && !picks.some((item) => item.id === selected.id)) onChange([...picks, { id: selected.id, name: selected.name, city: selected.city, status: selected.status, rate: selected.monthlyRateUsd, months: 1 }]); }
  return <Configurator number="06" eyebrow="Vía pública" title="Elige ubicaciones verificables y zonas candidatas"><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><Select label="Ubicación o corredor" value={id} onChange={setId} options={locations.map((item) => [item.id, `${item.city} · ${item.name} · ${item.status === "inventory" ? "inventario" : "zona candidata"}`])} /><button type="button" onClick={add} className="btn btn-primary self-end">Agregar</button></div><PickList items={picks} empty="Una zona candidata no se muestra como valla disponible ni recibe una tarifa inventada." render={(item) => <><div><strong>{item.name}</strong><small>{item.city} · {item.status === "inventory" ? "Inventario comercial" : "Prospección, disponibilidad pendiente"} · {item.rate == null ? "Tarifa pendiente" : `${money(item.rate)}/mes`}</small></div><label className="text-xs font-bold">Meses<NumberCompact value={item.months} onChange={(months) => onChange(picks.map((pick) => pick.id === item.id ? { ...pick, months } : pick))} /></label><Remove onClick={() => onChange(picks.filter((pick) => pick.id !== item.id))} /></>} /></Configurator>;
}

function DigitalConfigurator({ picks, onChange, ready, onReadyChange }: { picks: DigitalPick[]; onChange: (value: DigitalPick[]) => void; ready: boolean; onReadyChange: (value: boolean) => void }) {
  function toggle(slug: string, name: string) {
    const exists = picks.some((item) => item.slug === slug);
    const next = exists ? picks.filter((item) => item.slug !== slug) : [...picks, { slug, name, pct: 0 }];
    const pct = next.length ? 1 / next.length : 0;
    onChange(next.map((item) => ({ ...item, pct })));
  }
  return <Configurator number="07" eyebrow="Digital" title="Une objetivo, plataformas y medición"><label className="mb-4 flex items-start gap-3 rounded-xl bg-fog p-4 text-sm"><input type="checkbox" checked={ready} onChange={(event) => onReadyChange(event.target.checked)} className="mt-1" /><span><strong className="block text-forest">Destino, tracking y cuentas preparados</strong><small className="text-muted">Si no está marcado, el escenario conserva la inversión pero exige preparación antes del forecast.</small></span></label><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{DIGITAL_PLATFORMS.map((item) => { const active = picks.some((pick) => pick.slug === item.slug); return <button key={item.slug} type="button" onClick={() => toggle(item.slug, item.name)} className={`rounded-card border p-4 text-left ${active ? "border-signal bg-forest text-white" : "border-border bg-fog"}`}><strong>{item.name}</strong><small className={`mt-1 block ${active ? "text-white/65" : "text-muted"}`}>{item.objective}</small>{active && <b className="mt-3 block text-signal">{percent(picks.find((pick) => pick.slug === item.slug)?.pct ?? 0)} del bloque digital</b>}</button>; })}</div></Configurator>;
}

function PressConfigurator({ picks, onChange }: { picks: PressPick[]; onChange: (value: PressPick[]) => void }) {
  const [slug, setSlug] = useState(PRESS_OUTLETS[0]?.slug ?? "");
  const [format, setFormat] = useState("Página completa");
  function add() { const outlet = PRESS_OUTLETS.find((item) => item.slug === slug); if (outlet) onChange([...picks, { slug: `${slug}-${format}-${picks.length}`, name: outlet.name, format, quantity: 1 }]); }
  return <Configurator number="08" eyebrow="Prensa" title="Elige cobertura, cabeceras y formatos"><div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]"><Select label="Medio" value={slug} onChange={setSlug} options={PRESS_OUTLETS.map((item) => [item.slug, `${item.name} · ${item.statusNote}`])} /><Select label="Formato" value={format} onChange={setFormat} options={["Página completa", "Media página", "Publirreportaje", "Portada o contraportada", "Display digital", "Contenido patrocinado"].map((item) => [item, item])} /><button type="button" onClick={add} className="btn btn-primary self-end">Agregar</button></div><PickList items={picks} empty="Las tarifas y fechas de cierre se reconfirman antes de ordenar." render={(item) => <><div><strong>{item.name} · {item.format}</strong><small>Edición, tarifa, circulación/lectura e IVA por confirmar</small></div><NumberCompact value={item.quantity} onChange={(quantity) => onChange(picks.map((pick) => pick.slug === item.slug ? { ...pick, quantity } : pick))} /><Remove onClick={() => onChange(picks.filter((pick) => pick.slug !== item.slug))} /></>} /></Configurator>;
}

function InfluencerConfigurator({ profiles, picks, onChange }: { profiles: InfluencerProfile[]; picks: InfluencerPick[]; onChange: (value: InfluencerPick[]) => void }) {
  const [category, setCategory] = useState<InfluencerProfile["category"]>("foodie");
  const available = profiles.filter((item) => item.category === category);
  const [profileId, setProfileId] = useState("");
  const [deliverable, setDeliverable] = useState("Reel colaborativo");
  function add() { const profile = available.find((item) => item.id === profileId) ?? available[0]; if (!profile) return; const rate = profile.rates.find((item) => normalize(item.format).includes(normalize(deliverable)))?.amountUsd ?? profile.rates[0]?.amountUsd ?? null; onChange([...picks, { id: `${profile.id}-${deliverable}-${picks.length}`, name: profile.name, deliverable, rate, quantity: 1 }]); }
  return <Configurator number="09" eyebrow="Influenciadores" title="Arma el roster y sus entregables"><div className="grid gap-3 xl:grid-cols-[.8fr_1.2fr_1fr_auto]"><Select label="Categoría" value={category} onChange={(value) => { setCategory(value as InfluencerProfile["category"]); setProfileId(""); }} options={[["deportes", "Deportes"], ["foodie", "Foodie"], ["beauty", "Beauty"]]} /><Select label="Perfil" value={profileId || available[0]?.id || ""} onChange={setProfileId} options={available.map((item) => [item.id, `${item.name}${item.handle ? ` · @${item.handle.replace(/^@/, "")}` : ""}`])} /><Select label="Entregable" value={deliverable} onChange={setDeliverable} options={["Reel colaborativo", "TikTok", "Historia", "Derecho de pauta"].map((item) => [item, item])} /><button type="button" onClick={add} className="btn btn-primary self-end">Agregar</button></div><PickList items={picks} empty="Selecciona una categoría antes de mezclar perfiles sin relación con la campaña." render={(item) => <><div><strong>{item.name} · {item.deliverable}</strong><small>{item.rate == null ? "Tarifa pendiente" : `${money(item.rate)} referencial sin IVA`} · derechos y disponibilidad por reconfirmar</small></div><NumberCompact value={item.quantity} onChange={(quantity) => onChange(picks.map((pick) => pick.id === item.id ? { ...pick, quantity } : pick))} /><Remove onClick={() => onChange(picks.filter((pick) => pick.id !== item.id))} /></>} /></Configurator>;
}

function Configurator({ number, eyebrow, title, children }: { number: string; eyebrow: string; title: string; children: React.ReactNode }) { return <section className="rounded-panel border border-border bg-white p-6 shadow-panel"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-forest text-sm font-black text-signal">{number}</span><div><p className="text-xs font-black uppercase tracking-wide text-signal-dark">{eyebrow}</p><h2 className="text-xl font-black">{title}</h2></div></div><div className="mt-6">{children}</div></section>; }
function SectionTitle({ number, title, description }: { number: string; title: string; description: string }) { return <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-forest text-xs font-black text-signal">{number}</span><div><h2 className="text-xl font-black">{title}</h2><p className="mt-1 text-sm text-muted">{description}</p></div></div>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-xs font-black text-forest">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-fog px-4 text-sm font-normal" /></label>; }
function NumberField({ label, value, onChange, min }: { label: string; value: number; onChange: (value: number) => void; min: number }) { return <label className="text-xs font-black text-forest">{label}<input type="number" min={min} value={value || ""} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-fog px-4 text-sm font-normal" /></label>; }
function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="text-xs font-black text-forest">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 text-sm font-normal" /></label>; }
function Select({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (value: string) => void; options: Array<readonly [string, string] | string[]>; placeholder?: string }) { return <label className="min-w-0 flex-1 text-xs font-black text-forest">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-fog px-3 text-sm font-normal">{placeholder && <option value="">{placeholder}</option>}{options.map(([optionValue, optionLabel]) => <option key={`${optionValue}-${optionLabel}`} value={optionValue}>{optionLabel}</option>)}</select></label>; }
function PickList<T>({ items, empty, render }: { items: T[]; empty: string; render: (item: T) => React.ReactNode }) { return items.length ? <div className="mt-5 space-y-2">{items.map((item, index) => <div key={index} className="grid items-center gap-3 rounded-xl border border-border bg-fog p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">{render(item)}</div>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-border bg-fog p-5 text-center text-sm text-muted">{empty}</p>; }
function NumberCompact({ value, onChange }: { value: number; onChange: (value: number) => void }) { return <input type="number" min="1" value={value} onChange={(event) => onChange(Math.max(1, Number(event.target.value)))} className="h-10 w-20 rounded-lg border border-border bg-white px-2 text-center text-sm font-black" />; }
function Remove({ onClick }: { onClick: () => void }) { return <button type="button" onClick={onClick} className="rounded-lg border border-coral/30 px-3 py-2 text-xs font-black text-[#a13b31]">Quitar</button>; }
function percent(value: number) { return `${Math.round(value * 100)}%`; }
function money(value: number) { return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function numberValue(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function arrayOfStrings(value: unknown) { return Array.isArray(value) ? value.map(String).filter(Boolean) : []; }
function arrayValue<T>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }
function mediaArray(value: unknown): MediaGroup[] { return arrayOfStrings(value).filter((item): item is MediaGroup => MEDIA.some((medium) => medium.id === item)); }
function scenarioValue(value: unknown): PlanningScenario["id"] { const id = value && typeof value === "object" ? (value as { id?: unknown }).id : null; return id === "efficiency" || id === "presence" ? id : "recommended"; }
function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function zone(id: string, name: string, city: string, latitude: number, longitude: number): OohLocationOption { return { id, assetCode: id, status: "zone_candidate", providerName: null, name, city, province: "Guayas", address: name, latitude, longitude, format: "Zona para búsqueda de inventario", monthlyRateUsd: null, productionRateUsd: null, audienceTags: ["adultos 25-45 · hipótesis"], contextTags: ["movilidad urbana"], affluenceIndex: null, sourceNote: "Zona candidata; requiere proveedor, flujo, tarifa y disponibilidad.", verifiedAt: "2026-08-27" }; }
function channelLabel(slug: string) { return slug === "ecuavisa" ? "Ecuavisa" : slug === "red-comercial" ? "RTS / TVC" : slug.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
