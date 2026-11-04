"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, type ReactNode } from "react";
import { brandReady, effectivePostStatus, EMPTY_BRAND, EMPTY_BRIEF, SOCIAL_CHANNELS, SOCIAL_FORMATS, socialCalendarCsv, type BrandProfile, type SocialAsset, type SocialBrand, type SocialBrief, type SocialClient, type SocialCompany, type SocialPeriod, type SocialPost, type SocialWorkspace } from "@/lib/social-media";
import { createSocialClient, generateSocialCaptions, reviewSocialPost, saveSocialBrand, saveSocialPeriod } from "./actions";
import s from "./social-media.module.css";

type Notice = { text: string; error?: boolean } | null;
const statusLabels = { draft: "Borrador", review: "En revisión", approved: "Aprobado" };
const assetUrl = (id: string) => `/api/social-media/assets/${id}`;
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Guayaquil" }).format(new Date());
function newPeriod(companyId: string, clientId: string): SocialPeriod {
  const start = today().slice(0, 7) + "-01", end = new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 0)).toISOString().slice(0, 10);
  return { id: crypto.randomUUID(), companyId, clientId, name: new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${start}T00:00:00Z`)), start, end, brief: { ...EMPTY_BRIEF }, posts: [], version: 0 };
}
function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) { return <label className={wide ? s.wide : ""}><span>{label}</span>{children}</label>; }
function TextField({ label, value, onChange, hint, max = 4000 }: { label: string; value: string; onChange: (v: string) => void; hint?: string; max?: number }) {
  return <Field label={label}><textarea value={value} onChange={e => onChange(e.target.value)} maxLength={max} rows={3} placeholder={hint} /></Field>;
}

export function SocialMediaWorkspace({ initial }: { initial: SocialWorkspace }) {
  const [workspace, setWorkspace] = useState(initial), [clientId, setClientId] = useState(initial.clients[0]?.id ?? ""), [dirty, setDirty] = useState(false);
  const [creating, setCreating] = useState(false), [name, setName] = useState(""), [category, setCategory] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState<Notice>(null);
  const company = workspace.companies.find(c => c.id === workspace.companyId), client = workspace.clients.find(c => c.id === clientId);
  function mayLeave() { return !dirty || window.confirm("Hay cambios sin guardar. ¿Quieres salir y descartarlos?"); }
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return <div className={s.workspace}>
    <header className={s.heading}><div><p className={s.eyebrow}>CONTENIDO CON IDENTIDAD</p><h1>Social Media<span>.</span></h1><p>De la base de marca al calendario de cada cliente.</p></div><span className={s.moduleMark}>SM / ONE</span></header>
    <section className={s.scope} aria-label="Espacio y cliente">
      <Field label="Espacio de trabajo"><select value={workspace.companyId} onChange={e => { if (mayLeave()) window.location.assign(`/social-media?company=${encodeURIComponent(e.target.value)}`); }}><option value="" disabled>Selecciona un espacio</option>{workspace.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      {company && workspace.available && <><Field label="Cliente"><select value={clientId} onChange={e => { if (mayLeave()) { setClientId(e.target.value); setNotice(null); setDirty(false); } }}><option value="" disabled>Selecciona un cliente</option>{workspace.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>{company.canCreateClient && <button className={s.secondary} onClick={() => setCreating(!creating)}>{creating ? "Cerrar" : "+ Nuevo cliente"}</button>}</>}
    </section>
    {notice && <p className={notice.error ? s.error : s.notice} role={notice.error ? "alert" : "status"}>{notice.text}</p>}
    {creating && company && <form className={s.createClient} onSubmit={async e => {
      e.preventDefault(); if (!mayLeave()) return; setBusy(true);
      try { const result = await createSocialClient(company.id, name, category); if (!result.ok) setNotice({ text: result.error, error: true }); else { setWorkspace(w => ({ ...w, clients: [...w.clients.filter(c => c.id !== result.value.id), result.value].sort((a, b) => a.name.localeCompare(b.name)) })); setClientId(result.value.id); setDirty(false); setCreating(false); setName(""); setCategory(""); setNotice(null); } }
      catch { setNotice({ text: "No se pudo crear el cliente. Vuelve a intentarlo.", error: true }); } finally { setBusy(false); }
    }}><Field label="Nombre del cliente"><input required maxLength={180} value={name} onChange={e => setName(e.target.value)} /></Field><Field label="Categoría"><input maxLength={180} value={category} onChange={e => setCategory(e.target.value)} /></Field><button disabled={busy} className={s.primary}>{busy ? "Guardando…" : "Crear cliente"}</button></form>}
    {!company ? <div className={s.empty}><h2>Elige dónde vas a trabajar</h2><p>Selecciona el espacio para ver sus clientes y contenido.</p></div> : !workspace.available ? <div className={s.empty}><h2>El módulo aún no está disponible</h2><p>No se pudo cargar la base de Social Media. Vuelve a intentarlo más tarde.</p></div> : !client ? <div className={s.empty}><h2>Empieza por un cliente</h2><p>{company.canCreateClient ? "Crea su ficha para guardar la marca y preparar el primer período." : "Aún no hay clientes disponibles en este espacio."}</p></div> : <ClientWorkspace key={client.id} company={company} client={client} initialBrand={workspace.brands[client.id]} initialPeriods={workspace.periods.filter(p => p.clientId === client.id)} initialAssets={workspace.assets[client.id] ?? []} onDirty={setDirty}
      onBrand={brand => setWorkspace(w => ({ ...w, brands: { ...w.brands, [client.id]: brand } }))}
      onPeriod={period => setWorkspace(w => ({ ...w, periods: [...w.periods.filter(p => p.id !== period.id), period] }))}
      onAsset={asset => setWorkspace(w => ({ ...w, assets: { ...w.assets, [client.id]: [asset, ...(w.assets[client.id] ?? [])] } }))} />}
  </div>;
}

function ClientWorkspace({ company, client, initialBrand, initialPeriods, initialAssets, onDirty, onBrand, onPeriod, onAsset }: {
  company: SocialCompany; client: SocialClient; initialBrand?: SocialBrand; initialPeriods: SocialPeriod[]; initialAssets: SocialAsset[];
  onDirty: (v: boolean) => void; onBrand: (v: SocialBrand) => void; onPeriod: (v: SocialPeriod) => void; onAsset: (v: SocialAsset) => void;
}) {
  const [tab, setTab] = useState<"brand" | "brief" | "calendar">(initialBrand ? "calendar" : "brand");
  const [brand, setBrand] = useState<SocialBrand>(initialBrand ?? { profile: { ...EMPTY_BRAND }, version: 0 });
  const [savedBrand, setSavedBrand] = useState(JSON.stringify(brand.profile)), [assets, setAssets] = useState(initialAssets);
  const [periods, setPeriods] = useState(initialPeriods), [period, setPeriod] = useState<SocialPeriod | null>(initialPeriods[0] ?? null);
  const [savedPeriod, setSavedPeriod] = useState(JSON.stringify(period)), [selectedId, setSelectedId] = useState(initialPeriods[0]?.posts[0]?.id ?? "");
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState<Notice>(null), [captions, setCaptions] = useState<string[]>([]), [channelFilter, setChannelFilter] = useState("");
  const brandDirty = savedBrand !== JSON.stringify(brand.profile), periodDirty = savedPeriod !== JSON.stringify(period);
  const selected = period?.posts.find(p => p.id === selectedId), editable = company.canEdit && !busy;
  useEffect(() => { onDirty(brandDirty || periodDirty); }, [brandDirty, periodDirty, onDirty]);
  function patchBrand(key: keyof BrandProfile, value: string | null) { setBrand(b => ({ ...b, profile: { ...b.profile, [key]: value } })); }
  function updatePeriod(changes: Partial<SocialPeriod>, affectsBrief = false) { setPeriod(p => p ? { ...p, ...changes, ...(affectsBrief ? { posts: p.posts.map(post => ({ ...post, status: post.status === "approved" ? "draft" : post.status, approvedBrandVersion: null })) } : {}) } : p); }
  function updateBrief(key: keyof SocialBrief, value: string | SocialBrief["channels"]) { if (period) updatePeriod({ brief: { ...period.brief, [key]: value } }, true); }
  function patchPost(changes: Partial<SocialPost>) { setPeriod(p => p ? { ...p, posts: p.posts.map(post => post.id === selectedId ? { ...post, ...changes, status: changes.status ?? (post.status === "approved" ? "draft" : post.status), approvedBrandVersion: null } : post) } : p); setCaptions([]); }
  function commitPeriod(next: SocialPeriod) { setPeriod(next); setSavedPeriod(JSON.stringify(next)); setPeriods(items => [next, ...items.filter(p => p.id !== next.id)]); onPeriod(next); }
  function changePeriod(next: SocialPeriod | null) { if (periodDirty && !window.confirm("El período tiene cambios sin guardar. ¿Quieres descartarlos?")) return; setPeriod(next); setSavedPeriod(JSON.stringify(next)); setSelectedId(next?.posts[0]?.id ?? ""); setCaptions([]); setNotice(null); setChannelFilter(""); }
  async function run(task: () => Promise<void>) { setBusy(true); setNotice(null); try { await task(); } catch { setNotice({ text: "No se pudo completar la operación. Tus cambios se conservan.", error: true }); } finally { setBusy(false); } }
  async function saveBrand() { await run(async () => { const result = await saveSocialBrand(company.id, client.id, brand.version, brand.profile); if (!result.ok) return setNotice({ text: result.error, error: true }); setBrand(result.value); setSavedBrand(JSON.stringify(result.value.profile)); onBrand(result.value); setNotice({ text: "Base de marca guardada." }); }); }
  async function savePeriod() { if (!period) return; await run(async () => { const result = await saveSocialPeriod(period); if (!result.ok) return setNotice({ text: result.error, error: true }); commitPeriod(result.value); setNotice({ text: "Briefing y calendario guardados." }); }); }
  async function upload(file: File, kind: "logo" | "manual") { await run(async () => {
    if (file.size > 4 * 1024 * 1024) return setNotice({ text: "Usa un archivo de hasta 4 MB.", error: true });
    const data = new FormData(); data.set("companyId", company.id); data.set("clientId", client.id); data.set("kind", kind); data.set("file", file);
    const response = await fetch("/api/social-media/assets", { method: "POST", body: data }), result = await response.json();
    if (!response.ok || !result.asset) return setNotice({ text: result.error ?? "No se pudo cargar el archivo.", error: true });
    const asset = result.asset as SocialAsset; setAssets(items => [asset, ...items]); onAsset(asset); patchBrand(kind === "logo" ? "logoAssetId" : "manualAssetId", asset.id);
    setNotice({ text: "Archivo cargado. Guarda la marca para usar esta versión." });
  }); }
  function exportCalendar() {
    if (!period) return; const url = URL.createObjectURL(new Blob([socialCalendarCsv(client.name, period, brand.version)], { type: "text/csv;charset=utf-8" })), a = document.createElement("a");
    a.href = url; a.download = `calendario-${period.start}-${period.end}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const visiblePosts = [...(period?.posts ?? [])].filter(p => !channelFilter || p.channel === channelFilter).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return <>
    <section className={s.clientBar} aria-label="Marca activa"><div className={s.brandIcon}>{brand.profile.logoAssetId ? <img src={assetUrl(brand.profile.logoAssetId)} alt={`Logo de ${client.name}`} /> : <span>{client.name.slice(0, 2).toUpperCase()}</span>}</div><div><p className={s.eyebrow}>{client.category || "BASE DE CLIENTE"}</p><h2>{client.name}</h2></div><div className={s.brandStatus}><span className={brandReady(brand.profile) && !brandDirty ? s.ready : s.pending}>{brandDirty ? "Marca con cambios" : brandReady(brand.profile) ? `Marca · v${brand.version}` : "Completar marca"}</span><small>{company.canEdit ? "Espacio de edición" : company.canApprove ? "Espacio de aprobación" : "Solo lectura"}</small></div></section>
    <div className={s.tabs} role="tablist" aria-label="Social Media">{([["brand", "01", "Marca"], ["brief", "02", "Briefing y período"], ["calendar", "03", "Calendario"]] as const).map(([key, number, label]) => <button key={key} role="tab" id={`tab-${key}`} aria-selected={tab === key} aria-controls={`panel-${key}`} onClick={() => setTab(key)}><small>{number}</small>{label}{key === "brand" && brandDirty || key !== "brand" && periodDirty ? <i aria-label="Cambios sin guardar" /> : null}</button>)}</div>
    {notice && <p className={notice.error ? s.error : s.notice} role={notice.error ? "alert" : "status"}>{notice.text}</p>}
    {tab === "brand" && <section id="panel-brand" role="tabpanel" aria-labelledby="tab-brand" className={s.panel}>
      <div className={s.sectionTitle}><div><h2>Una identidad para cada pieza</h2><p>Guarda los archivos oficiales y las reglas que acompañarán a todos los períodos.</p></div>{company.canEdit && <button className={s.primary} disabled={busy || !brandDirty} onClick={saveBrand}>{busy ? "Guardando…" : "Guardar marca"}</button>}</div>
      <fieldset disabled={!editable} className={s.fields}>
        <div className={s.assets}>{(["logo", "manual"] as const).map(kind => { const id = kind === "logo" ? brand.profile.logoAssetId : brand.profile.manualAssetId; return <div key={kind} className={s.assetCard}><div className={s.assetPreview}>{kind === "logo" ? id ? <img src={assetUrl(id)} alt="Logo oficial seleccionado" /> : <span>Logo oficial</span> : <span className={s.pdf}>PDF<small>MANUAL DE MARCA</small></span>}</div><Field label={kind === "logo" ? "Logo oficial en uso" : "Manual vigente"}><select value={id ?? ""} onChange={e => patchBrand(kind === "logo" ? "logoAssetId" : "manualAssetId", e.target.value || null)}><option value="">Sin seleccionar</option>{assets.filter(a => a.kind === kind).map(a => <option key={a.id} value={a.id}>{a.name} · {a.createdAt.slice(0, 10)}</option>)}</select></Field><label className={s.upload}><span>{kind === "logo" ? "Cargar logo · PNG, JPG, WebP" : "Cargar manual · PDF"}</span><input type="file" accept={kind === "logo" ? "image/png,image/jpeg,image/webp" : "application/pdf"} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file, kind); e.target.value = ""; }} /></label><small>Hasta 4 MB · Se conserva cada versión</small>{id && <a href={assetUrl(id)} target="_blank" rel="noreferrer">Abrir archivo →</a>}</div>; })}</div>
        <div className={s.formGrid}>
          <TextField label="Sobre la marca" value={brand.profile.description} onChange={v => patchBrand("description", v)} hint="Qué ofrece, qué la distingue y datos que sí se pueden comunicar." />
          <TextField label="Audiencia de la marca" value={brand.profile.audience} onChange={v => patchBrand("audience", v)} hint="A quién habla y qué necesita esa audiencia." />
          <TextField label="Tono y trato" value={brand.profile.tone} onChange={v => patchBrand("tone", v)} hint="Cercano, experto, tú o usted; ejemplos de frases aprobadas." />
          <TextField label="Reglas del manual para contenido" value={brand.profile.rules} onChange={v => patchBrand("rules", v)} hint="Transcribe aquí las reglas que Mavi debe aplicar al redactar." />
          <TextField label="Paleta y usos del logo" value={brand.profile.colors} onChange={v => patchBrand("colors", v)} hint="Colores HEX, fondos, márgenes y variantes autorizadas." />
          <TextField label="Tipografías" value={brand.profile.typography} onChange={v => patchBrand("typography", v)} hint="Familias, pesos y jerarquías de la marca." />
          <TextField label="Qué evitar" value={brand.profile.forbidden} onChange={v => patchBrand("forbidden", v)} hint="Palabras, temas, afirmaciones o usos visuales prohibidos." />
          <TextField label="Hashtags y menciones" value={brand.profile.hashtags} onChange={v => patchBrand("hashtags", v)} hint="Escritura exacta de etiquetas y cuentas autorizadas." />
          <TextField label="Ejemplos y referencias aprobadas" value={brand.profile.references} onChange={v => patchBrand("references", v)} hint="Captions de referencia y enlaces del cliente." />
        </div>
      </fieldset>
      <p className={s.helper}>Mavi utiliza las reglas escritas en esta ficha. El PDF queda como referencia para consulta.</p>
    </section>}
    {tab !== "brand" && <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className={s.panel}>
      <div className={s.periodBar}><Field label="Período de contenido"><select disabled={busy} value={period?.id ?? ""} onChange={e => changePeriod(periods.find(p => p.id === e.target.value) ?? null)}><option value="" disabled>Selecciona un período</option>{period && !periods.some(p => p.id === period.id) && <option value={period.id}>{period.name} · sin guardar</option>}{periods.map(p => <option key={p.id} value={p.id}>{p.name} · {p.start} / {p.end}</option>)}</select></Field>{company.canEdit && <button className={s.secondary} disabled={busy} onClick={() => { const next = newPeriod(company.id, client.id); if (periodDirty && !window.confirm("Hay cambios sin guardar. ¿Quieres descartarlos y crear otro período?")) return; setPeriod(next); setSavedPeriod("null"); setSelectedId(""); setCaptions([]); setTab("brief"); setNotice(null); }}>+ Nuevo período</button>}<div className={s.spacer} />{company.canEdit && period && <button disabled={busy || !periodDirty} className={s.primary} onClick={savePeriod}>{busy ? "Guardando…" : "Guardar período"}</button>}</div>
      {!period ? <div className={s.empty}><h2>Prepara tu primer período</h2><p>Define las fechas y el objetivo para comenzar el calendario.</p></div> : tab === "brief" ? <>
        <fieldset disabled={!editable} className={s.fields}><div className={s.formGrid}>
          <Field label="Nombre del período"><input value={period.name} maxLength={120} onChange={e => updatePeriod({ name: e.target.value })} /></Field>
          <div className={s.dateFields}><Field label="Desde"><input type="date" value={period.start} max={period.end} onChange={e => updatePeriod({ start: e.target.value }, true)} /></Field><Field label="Hasta"><input type="date" value={period.end} min={period.start} onChange={e => updatePeriod({ end: e.target.value }, true)} /></Field></div>
          <TextField label="Objetivo del período" value={period.brief.objective} onChange={v => updateBrief("objective", v)} hint="Qué debe conseguir el contenido este período." />
          <TextField label="Público prioritario" value={period.brief.audience} onChange={v => updateBrief("audience", v)} hint="Segmento, ubicación, intereses y necesidades." />
          <TextField label="Mensajes y oferta confirmada" value={period.brief.offer} onChange={v => updateBrief("offer", v)} hint="Productos, promociones, condiciones y datos aprobados." />
          <TextField label="Pilares de contenido" value={period.brief.pillars} onChange={v => updateBrief("pillars", v)} hint="Educación, producto, comunidad, marca…" />
          <TextField label="Fechas y momentos clave" value={period.brief.keyDates} onChange={v => updateBrief("keyDates", v)} hint="Lanzamientos, hitos y fechas comerciales pertinentes." />
          <div><span className={s.label}>Canales del período</span><div className={s.channels}>{SOCIAL_CHANNELS.map(channel => <label key={channel}><input type="checkbox" checked={period.brief.channels.includes(channel)} onChange={e => {
            if (!e.target.checked && period.posts.some(p => p.channel === channel)) return setNotice({ text: `Primero cambia el canal de las publicaciones de ${channel}.`, error: true });
            if (!e.target.checked && period.brief.channels.length === 1) return;
            updateBrief("channels", e.target.checked ? [...period.brief.channels, channel] : period.brief.channels.filter(c => c !== channel));
          }} />{channel}</label>)}</div></div>
        </div></fieldset><div className={s.bottomAction}><p>La base de marca se mantiene entre períodos.</p><button className={s.secondary} onClick={() => setTab("calendar")}>Ir al calendario →</button></div>
      </> : <>
        <div className={s.calendarToolbar}><div><h2>Calendario editorial</h2><p>{period.posts.length} publicaciones · {period.posts.filter(p => effectivePostStatus(p, brand.version) === "approved").length} aprobadas</p></div><select aria-label="Filtrar por canal" value={channelFilter} onChange={e => setChannelFilter(e.target.value)}><option value="">Todos los canales</option>{period.brief.channels.map(c => <option key={c}>{c}</option>)}</select><button className={s.secondary} disabled={busy || periodDirty || brandDirty || !period.version} onClick={exportCalendar}>Exportar CSV</button>{company.canEdit && <button className={s.primary} disabled={busy || period.posts.length >= 120} onClick={() => {
          const post: SocialPost = { id: crypto.randomUUID(), title: "Nueva publicación", date: period.start, time: "", channel: period.brief.channels[0], format: "Imagen", pillar: "", direction: "", caption: "", cta: "", status: "draft", approvedBrandVersion: null };
          updatePeriod({ posts: [...period.posts, post] }); setSelectedId(post.id); setCaptions([]); setChannelFilter("");
        }}>+ Publicación</button>}</div>
        <div className={s.calendarGrid}><div className={s.postList}>
          {!visiblePosts.length && <div className={s.empty}><h3>{period.posts.length ? "No hay piezas en este canal" : "Dale forma a tu calendario"}</h3><p>Añade una publicación con fecha, canal, formato y tema.</p></div>}
          {visiblePosts.map(post => { const status = effectivePostStatus(post, brand.version); return <button key={post.id} disabled={busy} className={`${s.postRow} ${selectedId === post.id ? s.selected : ""}`} onClick={() => { setSelectedId(post.id); setCaptions([]); }}><time dateTime={post.date}><strong>{post.date.slice(8)}</strong><small>{new Intl.DateTimeFormat("es-EC", { month: "short", timeZone: "UTC" }).format(new Date(`${post.date}T00:00:00Z`))}</small></time><div><small>{post.channel} · {post.format}{post.time ? ` · ${post.time}` : ""}</small><strong>{post.title}</strong><span>{post.pillar || "Sin pilar asignado"}</span></div><span className={`${s.status} ${s[status]}`}>{statusLabels[status]}</span></button>; })}
        </div>{selected && <article className={s.editor}>
          <div className={s.editorTitle}><h3>Detalle de la publicación</h3><span className={s.status}>{statusLabels[effectivePostStatus(selected, brand.version)]}</span></div>
          <fieldset disabled={!editable} className={s.fields}><div className={s.postFields}>
            <Field label="Tema"><input value={selected.title} maxLength={180} onChange={e => patchPost({ title: e.target.value })} /></Field>
            <div className={s.dateFields}><Field label="Fecha"><input type="date" min={period.start} max={period.end} value={selected.date} onChange={e => patchPost({ date: e.target.value })} /></Field><Field label="Hora · Ecuador"><input type="time" value={selected.time} onChange={e => patchPost({ time: e.target.value })} /></Field></div>
            <div className={s.dateFields}><Field label="Canal"><select value={selected.channel} onChange={e => patchPost({ channel: e.target.value as SocialPost["channel"] })}>{period.brief.channels.map(c => <option key={c}>{c}</option>)}</select></Field><Field label="Formato"><select value={selected.format} onChange={e => patchPost({ format: e.target.value as SocialPost["format"] })}>{SOCIAL_FORMATS.map(f => <option key={f}>{f}</option>)}</select></Field></div>
            <Field label="Pilar"><input value={selected.pillar} maxLength={200} onChange={e => patchPost({ pillar: e.target.value })} /></Field>
            <TextField label="Dirección creativa" value={selected.direction} onChange={v => patchPost({ direction: v })} hint="Idea, mensaje y qué debe mostrar la pieza." />
            <Field label="Llamado a la acción"><input value={selected.cta} maxLength={500} onChange={e => patchPost({ cta: e.target.value })} /></Field>
            <Field label="Caption"><textarea rows={7} maxLength={4000} value={selected.caption} onChange={e => patchPost({ caption: e.target.value })} /><small>{selected.caption.length} caracteres</small></Field>
            <div className={s.captionActions}><button type="button" className={s.mavi} disabled={brandDirty} onClick={() => run(async () => { const result = await generateSocialCaptions(period, selected.id); if (!result.ok) setNotice({ text: result.error, error: true }); else setCaptions(result.value); })}>✦ Proponer captions con Mavi</button><button className={s.secondary} type="button" onClick={() => patchPost({ status: "review" })}>Pasar a revisión</button></div>
          </div></fieldset>
          {brandDirty && <p className={s.helper}>Guarda los cambios de marca antes de pedir captions.</p>}
          {captions.length > 0 && <div className={s.captionOptions}><h4>Opciones de Mavi</h4>{captions.map((caption, index) => <div key={caption}><small>OPCIÓN {index + 1}</small><p>{caption}</p><button className={s.secondary} disabled={!editable} onClick={() => patchPost({ caption })}>Usar este caption</button></div>)}</div>}
          <div className={s.preview}><div>{brand.profile.logoAssetId && <img src={assetUrl(brand.profile.logoAssetId)} alt="Logo oficial" />}<strong>{client.name}</strong><small>{selected.channel}</small></div><p>{selected.caption || "Aquí verás el caption de la publicación."}</p></div>
          {company.canApprove && <button className={s.primary} disabled={busy || periodDirty || brandDirty || !period.version || !selected.caption.trim()} onClick={() => run(async () => { const approved = effectivePostStatus(selected, brand.version) === "approved"; const result = await reviewSocialPost(period.id, selected.id, period.version, !approved); if (!result.ok) return setNotice({ text: result.error, error: true }); commitPeriod({ ...period, ...result.value }); setNotice({ text: approved ? "Publicación devuelta a revisión." : "Publicación aprobada." }); })}>{effectivePostStatus(selected, brand.version) === "approved" ? "Devolver a revisión" : "Aprobar publicación"}</button>}
          {(periodDirty || brandDirty) && <p className={s.helper}>Guarda los cambios para aprobar o exportar el calendario.</p>}
          {company.canEdit && <button disabled={busy} className={s.remove} onClick={() => { if (window.confirm("¿Quieres quitar esta publicación del calendario?")) { updatePeriod({ posts: period.posts.filter(p => p.id !== selected.id) }); setSelectedId(""); setCaptions([]); } }}>Quitar publicación</button>}
        </article>}</div>
        <p className={s.helper}>Las fechas organizan la planificación. La publicación en redes se realiza desde las cuentas del cliente.</p>
      </>}
    </section>}
  </>;
}
