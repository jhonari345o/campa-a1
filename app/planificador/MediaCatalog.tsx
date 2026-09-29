"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  CATALOG_SECTIONS,
  DIGITAL_PLATFORMS,
  INFLUENCER_IMAGE_SLUGS,
  OOH_PROVIDERS,
  PRESS_OUTLETS,
  STATUS_LABELS,
  TV_CHANNELS,
  type CatalogItem,
  type CatalogSection,
  type CatalogStatus,
  type DigitalPlatform,
  type InfluencerProfile,
  type RadioStation,
} from "@/lib/media-catalog";
import { TV_RATE_CATALOGS, type TvOffer, type TvRateCatalog } from "@/lib/tv-rate-catalog";
import type { CatalogHealth } from "@/lib/media-workspace";

export function MediaCatalog({
  section,
  radio,
  influencers,
  health,
}: {
  section: CatalogSection;
  radio: RadioStation[];
  influencers: InfluencerProfile[];
  health: CatalogHealth | null;
}) {
  return (
    <div className="media-portal-shell">
      <header className="media-portal-header">
        <div className="media-portal-header-copy">
          <p>Medios</p>
          <h1>Directorio para construir tu plan</h1>
          <p className="media-portal-header-description">
              Explora canales, emisoras, proveedores, cabeceras, plataformas y creadores antes
              de armar una recomendación multimedios.
          </p>
          <div className="media-portal-header-legend" aria-label="Estados de la información del catálogo">
            <Status status="cotizable" />
            <Status status="validacion" />
            <Status status="directorio" />
          </div>
        </div>
        <Link href="/planificador?view=planner" className="media-portal-plan-button">Armar plan de medios <span>→</span></Link>
      </header>

      {health && (
        <aside className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-5 py-4 shadow-panel sm:mx-8">
          <div><strong className="text-sm text-forest">Control de vigencia 2026</strong><p className="mt-1 text-xs text-muted">Solo “cotizable” representa una referencia comercial; tarifa, cupo y disponibilidad se confirman antes de ordenar.</p></div>
          <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase"><span className="rounded-full bg-signal/15 px-3 py-1 text-signal-dark">{health.cotizable} cotizables</span><span className="rounded-full bg-amber/15 px-3 py-1 text-[#805900]">{health.validation} por validar</span><span className="rounded-full bg-coral/10 px-3 py-1 text-[#a13b31]">{health.stale + health.withoutDate} sin vigencia actual</span></div>
        </aside>
      )}

      <nav className="media-portal-tabs" aria-label="Tipos de medios" role="tablist">
        {CATALOG_SECTIONS.map((item) => (
          <Link
            key={item.id}
            href={`/planificador?view=media&section=${item.id}`}
            aria-current={section === item.id ? "page" : undefined}
            role="tab"
            aria-selected={section === item.id}
            className={`media-portal-tab ${section === item.id ? "is-active" : ""}`}
          >
            <strong>{item.label}</strong><span>{item.description}</span>
          </Link>
        ))}
      </nav>

      <div className="media-portal-panel" role="tabpanel">
        {section === "digital" && <DigitalSection />}
        {section === "influencers" && <InfluencerSection profiles={influencers} />}
        {section === "radio" && <RadioSection stations={radio} />}
        {section === "tv" && (
          <DirectorySection eyebrow="Televisión" title="Canales para construir el mix" description="Explora cada canal y luego llévalo al plan para definir programas, frecuencia e inversión." items={TV_CHANNELS} countLabel="7 opciones" catalogs={TV_RATE_CATALOGS} />
        )}
        {section === "ooh" && (
          <DirectorySection eyebrow="Vía pública" title="Proveedor, provincia y activo" description="Navega por proveedor y cobertura. Ubicaciones, producción, impuestos y disponibilidad se reconfirman antes de emitir una orden." items={OOH_PROVIDERS} countLabel="7 proveedores · 312 fichas incorporadas" />
        )}
        {section === "press" && (
          <DirectorySection eyebrow="Prensa" title="Prensa por cobertura" description="Revisa cabeceras nacionales y publicaciones locales; fecha de publicación, edición, circulación, IVA y disponibilidad se confirman al cotizar." items={PRESS_OUTLETS} countLabel="7 medios en directorio" />
        )}
      </div>
    </div>
  );
}

function DigitalSection() {
  return (
    <section className="media-portal-section">
      <SectionHeading
        eyebrow="Digital"
        title="Plataformas según el objetivo"
        description="La selección combina objetivo, audiencia, medición disponible, destino e inversión."
        count={`${DIGITAL_PLATFORMS.length} plataformas`}
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DIGITAL_PLATFORMS.map((item) => <DigitalCard key={item.slug} item={item} />)}
      </div>
    </section>
  );
}

function DigitalCard({ item }: { item: DigitalPlatform }) {
  return (
    <article className="media-portal-digital-card">
      <div className="flex items-start justify-between gap-3">
        <ProviderMark item={item} size="small" />
        <span className="rounded-full bg-signal/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-signal-dark">
          {item.statusNote}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-black tracking-tight">{item.name}</h3>
      <p className="mt-2 text-sm text-muted">{item.summary}</p>
      <p className="mt-4 border-t border-border pt-4 text-sm text-muted">{item.formats}</p>
      <p className="mt-4 rounded-xl bg-fog p-3 text-xs text-muted">
        <strong className="text-forest">Medición:</strong> {item.measurement}
      </p>
    </article>
  );
}

function InfluencerSection({ profiles }: { profiles: InfluencerProfile[] }) {
  const [category, setCategory] = useState<InfluencerProfile["category"]>("foodie");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    return profiles.filter((profile) =>
      profile.category === category
      && (!needle || `${profile.name} ${profile.handle ?? ""}`.toLocaleLowerCase("es").includes(needle)),
    );
  }, [category, profiles, query]);
  const shown = expanded ? matches : matches.slice(0, 9);

  return (
    <section className="media-portal-section">
      <SectionHeading
        eyebrow="Influenciadores"
        title="Encuentra el perfil desde su territorio creativo"
        description="Compara métricas históricas y formatos comerciales. Cada condición se reconfirma antes de pautar."
        count={`${profiles.length || 39} perfiles`}
      />
      <div className="mt-6 grid gap-3 sm:grid-cols-3" role="group" aria-label="Categorías de influenciadores">
        {([
          ["deportes", "Deportes", "Fútbol, actualidad deportiva, conversación y entretenimiento"],
          ["foodie", "Foodie", "Gastronomía, recorridos, recetas y experiencias de consumo"],
          ["beauty", "Beauty", "Belleza, estilo, maquillaje y cuidado personal"],
        ] as const).map(([id, label, description]) => (
          <button
            key={id}
            type="button"
            onClick={() => { setCategory(id); setExpanded(false); }}
            aria-pressed={category === id}
            className={`min-h-[92px] rounded-card border p-4 text-left ${category === id ? "border-signal bg-forest text-white" : "border-border bg-fog"}`}
          >
            <strong className="block font-black">{label}</strong>
            <span className={`mt-1 block text-xs ${category === id ? "text-white/70" : "text-muted"}`}>{description}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <label className="min-w-0 flex-1 text-sm font-black text-forest">
          Buscar perfil o handle
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre o @usuario"
            className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 font-normal outline-none focus:border-signal focus:ring-2 focus:ring-signal/20"
          />
        </label>
        <span className="rounded-xl bg-forest px-4 py-3 text-sm font-black text-white">{matches.length} perfiles</span>
      </div>
      {profiles.length === 0 ? (
        <EmptyData message="La estructura está lista. Aplica la migración 0008 y carga el SQL privado del catálogo para mostrar los 39 perfiles." />
      ) : (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {shown.map((profile) => <InfluencerCard key={profile.id} profile={profile} />)}
          </div>
          {!expanded && matches.length > shown.length && (
            <button type="button" onClick={() => setExpanded(true)} className="btn btn-secondary mt-6 w-full">
              Ver {matches.length - shown.length} perfiles más
            </button>
          )}
        </>
      )}
      <CatalogConditions />
    </section>
  );
}

function InfluencerCard({ profile }: { profile: InfluencerProfile }) {
  const hasImage = INFLUENCER_IMAGE_SLUGS.has(profile.slug);
  return (
    <article className="media-portal-influencer-card flex flex-col text-white">
      <div className="flex items-start gap-3">
        <div className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-signal bg-white text-lg font-black text-forest shadow-sm">
          {hasImage ? (
            <Image
              src={`/providers/influencers/${profile.slug}.webp`}
              alt={`Foto de ${profile.name}`}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : initials(profile.name)}
        </div>
        <div className="min-w-0">
          <span className="text-[10px] font-black uppercase tracking-wide text-[#91f58d]">{profile.category}</span>
          <h3 className="truncate text-lg font-black">{profile.name}</h3>
          {profile.profileUrl && profile.handle ? (
            <a href={profile.profileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-sky hover:underline">
              @{profile.handle.replace(/^@/, "")} ↗
            </a>
          ) : <span className="text-xs text-white/60">Perfil por confirmar</span>}
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-2 text-xs">
        <Metric label="Seguidores" value={compact(profile.followers)} />
        <Metric label="Views promedio" value={compact(profile.avgViews)} />
        <Metric label="Engagement" value={percent(profile.engagementPct)} />
        <Metric label="Follower quality" value={percent(profile.followerQualityPct)} />
      </dl>
      <div className="mt-5 border-t border-white/15 pt-4">
        <div className="flex items-center justify-between gap-2">
          <strong className="text-sm">Tarifas referenciales</strong>
          <span className="rounded-full bg-[#c8ffc5] px-2 py-1 text-[9px] font-black uppercase text-forest">Sin IVA</span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2">
          {profile.rates.map((rate) => (
            <div key={rate.format} className="rounded-xl border border-white/15 bg-white/10 p-3">
              <dt className="text-[9px] font-black uppercase text-white/60">{rate.format}</dt>
              <dd className="mt-1 font-black">{money(rate.amountUsd)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-4 text-[10px] text-white/55">Vigencia, disponibilidad y derecho de pauta por reconfirmar.</p>
    </article>
  );
}

function RadioSection({ stations }: { stations: RadioStation[] }) {
  const [mode, setMode] = useState<"audience" | "reach">("audience");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    return stations
      .filter((station) => !needle || `${station.name} ${station.genre ?? ""}`.toLocaleLowerCase("es").includes(needle))
      .slice()
      .sort((a, b) => mode === "audience"
        ? (a.audienceRank ?? 999) - (b.audienceRank ?? 999)
        : (a.reachRank ?? 999) - (b.reachRank ?? 999));
  }, [mode, query, stations]);
  const shown = expanded ? sorted : sorted.slice(0, 10);

  return (
    <section className="media-portal-section">
      <SectionHeading eyebrow="Radio" title="Audiencia y alcance por emisora" description="Dos lecturas complementarias para ordenar alternativas sin sumar audiencias ni inventar alcance deduplicado." count={`${stations.length || 104} emisoras`} />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Emisoras observadas" value={String(stations.length || 104)} note="Directorio analizado" />
        <Summary label="Líder en audiencia" value={stations.find((s) => s.audienceRank === 1)?.name ?? "Tropicálida"} note="Promedio del corte recibido" />
        <Summary label="Líder en alcance" value={stations.find((s) => s.reachRank === 1)?.name ?? "Galaxia Super Stereo"} note="Alcance por emisora" />
        <Summary label="Estado del corte" value="Por confirmar" note="Target, plaza, período y franja" />
      </div>
      <div className="mt-5 rounded-card border border-border bg-fog p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-white">
              <Image src="/providers/radio/los40/logo.png" alt="Logo de LOS40 Ecuador" fill sizes="64px" className="object-contain p-2" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-signal-dark">Directorio público destacado</p>
              <h3 className="mt-1 text-xl font-black">LOS40 Ecuador</h3>
              <p className="text-sm text-muted">Música, entretenimiento y actualidad para cobertura nacional.</p>
            </div>
          </div>
          <span className="rounded-full bg-signal/15 px-3 py-1 text-[10px] font-black uppercase text-signal-dark">Cotizable</span>
        </div>
        <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
          <p><strong>Cobertura:</strong> Ecuador</p>
          <p><strong>Formatos:</strong> cuñas, menciones y contenido</p>
          <p><strong>Condición:</strong> disponibilidad y tarifa por confirmar</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Lectura del ranking">
        <Toggle pressed={mode === "audience"} onClick={() => { setMode("audience"); setExpanded(false); }}>Audiencia promedio</Toggle>
        <Toggle pressed={mode === "reach"} onClick={() => { setMode("reach"); setExpanded(false); }}>Alcance por emisora</Toggle>
      </div>
      <label className="mt-5 block text-sm font-black">
        Buscar emisora
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 font-normal outline-none focus:border-signal" />
      </label>
      {stations.length === 0 ? <EmptyData message="La base de radio está protegida; aplica las importaciones Excel y la migración de catálogo para mostrarla." /> : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {shown.map((station, index) => (
            <article key={station.name} className="rounded-card border border-border bg-fog p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {station.imagePath ? (
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-border bg-white">
                      <Image src={station.imagePath} alt={`Logo de ${station.name}`} fill sizes="48px" className="object-contain p-1" />
                    </div>
                  ) : <StationMonogram name={station.name} />}
                  <div><span className="text-xs font-black text-signal-dark">{String(index + 1).padStart(2, "0")}</span><h3 className="font-black">{station.name}</h3><p className="text-xs text-muted">{station.genre ?? "Género por confirmar"}</p></div>
                </div>
                <strong className="text-right text-lg">{mode === "audience" ? compact(station.audience) : percent(station.reachPct)}</strong>
              </div>
              <dl className="mt-3 flex gap-4 text-xs text-muted">
                <span>Rating <strong className="text-forest">{percent(station.rating)}</strong></span>
                <span>Share <strong className="text-forest">{percent(station.share)}</strong></span>
              </dl>
            </article>
          ))}
        </div>
      )}
      {!expanded && sorted.length > shown.length && <button type="button" onClick={() => setExpanded(true)} className="btn btn-secondary mt-5 w-full">Ver las {sorted.length} emisoras</button>}
      <p className="mt-5 rounded-xl bg-fog p-4 text-xs text-muted"><strong className="text-forest">Lectura metodológica:</strong> el ranking ordena alternativas; no suma emisoras ni sustituye el alcance deduplicado de campaña.</p>
    </section>
  );
}

function DirectorySection({ eyebrow, title, description, items, countLabel, catalogs }: { eyebrow: string; title: string; description: string; items: CatalogItem[]; countLabel: string; catalogs?: Record<string, TvRateCatalog> }) {
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(catalogs ? (items[0]?.slug ?? null) : null);
  const matches = items.filter((item) => `${item.name} ${item.summary} ${item.coverage ?? ""}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
  const selectedItem = items.find((item) => item.slug === selectedSlug) ?? null;
  return (
    <section className="media-portal-section">
      <SectionHeading eyebrow={eyebrow} title={title} description={description} count={countLabel} />
      {catalogs ? (
        <>
          <div className="media-tv-selector" aria-label="Canales disponibles">
            {items.map((item) => (
              <button key={item.slug} type="button" aria-pressed={selectedSlug === item.slug} onClick={() => setSelectedSlug(item.slug)} className={selectedSlug === item.slug ? "is-active" : ""}>
                <ProviderMark item={item} size="small" /><span><strong>{item.name}</strong><small>{catalogs[item.slug]?.offers.length ?? 0} opciones</small></span>
              </button>
            ))}
          </div>
          {selectedItem && <article className="media-tv-channel-summary"><ProviderMark item={selectedItem} size="large" /><div><Status status={selectedItem.status} /><h3>{selectedItem.name}</h3><p>{selectedItem.summary}</p><span>{selectedItem.coverage ?? "Cobertura por confirmar"}</span></div></article>}
        </>
      ) : (
        <>
          <label className="media-catalog-search">Buscar en el catálogo<input value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <div className="media-directory-grid">
            {matches.map((item) => (
              <article key={item.slug} className={`media-directory-card ${selectedSlug === item.slug ? "is-active" : ""}`}>
                <div className="flex items-start justify-between gap-3"><ProviderMark item={item} size="large" /><Status status={item.status} /></div>
                <h3>{item.name}</h3><p className="media-directory-status">{item.statusNote}</p><p>{item.summary}</p><p className="media-directory-detail">{item.detail}</p>
                {item.coverage && <p><strong>Cobertura:</strong> {item.coverage}</p>}
                {item.incorporated && <ListBlock title="Incorporado" items={item.incorporated} />}
                {item.pending && <ListBlock title="Antes de ordenar" items={item.pending} />}
                {item.count != null && <span className="media-directory-count">{item.count} registros incorporados</span>}
                <button type="button" aria-expanded={selectedSlug === item.slug} aria-controls="catalog-detail" onClick={() => setSelectedSlug((current) => current === item.slug ? null : item.slug)} className="btn btn-secondary mt-5 w-full">{selectedSlug === item.slug ? "Cerrar ficha" : "Ver ficha completa"}</button>
              </article>
            ))}
          </div>
        </>
      )}
      {selectedItem && (
        catalogs?.[selectedItem.slug]
          ? <TvCatalogPanel item={selectedItem} catalog={catalogs[selectedItem.slug]} />
          : <GenericCatalogPanel item={selectedItem} onClose={() => setSelectedSlug(null)} />
      )}
      <CatalogConditions />
    </section>
  );
}

function TvCatalogPanel({ item, catalog }: { item: CatalogItem; catalog: TvRateCatalog }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"todos" | TvOffer["kind"]>("todos");
  const [day, setDay] = useState("todos");
  const firstPriced = catalog.offers.find((offer) => offer.priceUsd != null)?.id ?? null;
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(firstPriced);
  const [quantity, setQuantity] = useState(1);
  const days = Array.from(new Set(catalog.offers.map((offer) => offer.day)));
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const filtered = catalog.offers.filter((offer) => {
    const text = `${offer.title} ${offer.schedule} ${offer.market ?? ""} ${offer.day}`.toLocaleLowerCase("es");
    return (kind === "todos" || offer.kind === kind)
      && (day === "todos" || offer.day === day)
      && (!normalizedQuery || text.includes(normalizedQuery));
  });
  const selectedOffer = filtered.find((offer) => offer.id === selectedOfferId && offer.priceUsd != null)
    ?? filtered.find((offer) => offer.priceUsd != null)
    ?? null;
  const effectiveSelectedOfferId = selectedOffer?.id ?? null;
  const estimatedSubtotal = (selectedOffer?.priceUsd ?? 0) * quantity;
  const pricedCount = catalog.offers.filter((offer) => offer.priceUsd != null).length;

  return (
    <section id="catalog-detail" aria-labelledby="catalog-detail-title" className="mt-7 scroll-mt-24 overflow-hidden rounded-card border border-forest bg-white shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-forest p-5 text-white sm:p-6">
        <div className="flex items-start gap-4">
          <ProviderMark item={item} size="large" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#91f58d]">Catálogo comercial auditado</p>
            <h3 id="catalog-detail-title" className="mt-1 text-2xl font-black">{item.name}</h3>
            <p className="mt-1 text-sm text-white/70">{catalog.priceBasis} · Verificado: {catalog.lastVerified}</p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Summary label="Oferta auditada" value={`${catalog.offers.length} registros`} note="Programas, formatos y paquetes" />
          <Summary label="Con precio" value={`${pricedCount} registros`} note="Referenciales, no constituyen reserva" />
          <Summary label="Por confirmar" value={`${catalog.offers.length - pricedCount} registros`} note="Se cotizan directamente con el medio" />
        </div>

        <p className="mt-4 rounded-xl border border-amber/30 bg-amber/10 p-4 text-xs text-[#654900]">
          <strong>Importante:</strong> {catalog.sourceNote}
        </p>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="text-sm font-black">Buscar programa u horario
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej. noticiero, 21:00 o Quito" className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 font-normal outline-none focus:border-signal" />
          </label>
          <label className="text-sm font-black">Tipo
            <select value={kind} onChange={(event) => setKind(event.target.value as "todos" | TvOffer["kind"])} className="mt-1 block w-full rounded-xl border border-border bg-fog px-4 py-3 font-normal outline-none focus:border-signal">
              <option value="todos">Todos</option>
              <option value="programa">Programas</option>
              <option value="paquete">Paquetes</option>
              <option value="formato">Formatos</option>
            </select>
          </label>
          <label className="text-sm font-black">Día / grupo
            <select value={day} onChange={(event) => setDay(event.target.value)} className="mt-1 block w-full rounded-xl border border-border bg-fog px-4 py-3 font-normal outline-none focus:border-signal">
              <option value="todos">Todos</option>
              {days.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-fog text-[10px] uppercase tracking-wide text-muted">
              <tr><th className="p-3">Presupuestar</th><th className="p-3">Programa / producto</th><th className="p-3">Día</th><th className="p-3">Horario / detalle</th><th className="p-3">Plaza</th><th className="p-3 text-right">Tarifa</th></tr>
            </thead>
            <tbody>
              {filtered.map((offer) => (
                <tr key={offer.id} className={`border-t border-border ${effectiveSelectedOfferId === offer.id ? "bg-signal/5" : "bg-white"}`}>
                  <td className="p-3">
                    <button type="button" disabled={offer.priceUsd == null} aria-pressed={effectiveSelectedOfferId === offer.id} onClick={() => setSelectedOfferId(offer.id)} className={`rounded-lg px-3 py-2 text-xs font-black ${offer.priceUsd == null ? "cursor-not-allowed bg-concrete text-muted" : effectiveSelectedOfferId === offer.id ? "bg-signal text-forest" : "border border-border bg-white text-forest hover:border-signal"}`}>
                      {offer.priceUsd == null ? "Pendiente" : effectiveSelectedOfferId === offer.id ? "Elegido" : "Elegir"}
                    </button>
                  </td>
                  <td className="p-3"><strong className="block text-forest">{offer.title}</strong><span className="text-[10px] uppercase text-muted">{offer.kind}</span></td>
                  <td className="p-3 text-muted">{offer.day}</td>
                  <td className="p-3 text-muted">{offer.schedule}{offer.note ? <span className="mt-1 block text-[10px] text-[#735000]">{offer.note}</span> : null}</td>
                  <td className="p-3 text-muted">{offer.market ?? "—"}</td>
                  <td className="p-3 text-right"><strong>{offer.priceUsd == null ? "Por confirmar" : moneyPrecise(offer.priceUsd)}</strong><span className="block text-[10px] text-muted">{offer.unit}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="p-6 text-center text-sm text-muted">No hay registros que coincidan con esos filtros.</p>}
        </div>

        <div className="mt-5 grid gap-4 rounded-card border border-signal/40 bg-forest p-5 text-white lg:grid-cols-[1fr_160px_240px] lg:items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-[#91f58d]">Estimación rápida</p>
            <h4 className="mt-1 text-lg font-black">{selectedOffer?.title ?? "Elige una fila con tarifa"}</h4>
            <p className="text-xs text-white/65">{selectedOffer ? `${moneyPrecise(selectedOffer.priceUsd!)} por ${selectedOffer.unit}` : "Los registros pendientes requieren cotización directa."}</p>
          </div>
          <label className="text-sm font-black">Cantidad
            <input type="number" min={1} max={999} value={quantity} onChange={(event) => setQuantity(Math.min(999, Math.max(1, Number(event.target.value) || 1)))} className="mt-1 w-full rounded-xl border border-white/20 bg-white px-4 py-3 text-forest outline-none focus:border-signal" />
          </label>
          <div className="rounded-xl bg-white/10 p-4 text-right"><span className="block text-[10px] font-black uppercase text-white/60">Subtotal referencial</span><strong className="text-2xl">{selectedOffer ? moneyPrecise(estimatedSubtotal) : "—"}</strong><span className="block text-[10px] text-white/55">Sin IVA ni negociación final</span></div>
        </div>
      </div>
    </section>
  );
}

function GenericCatalogPanel({ item, onClose }: { item: CatalogItem; onClose: () => void }) {
  return (
    <section id="catalog-detail" aria-labelledby="catalog-detail-title" className="mt-7 rounded-card border border-border bg-fog p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-wide text-signal-dark">Ficha comercial</p><h3 id="catalog-detail-title" className="mt-1 text-2xl font-black">{item.name}</h3><p className="mt-2 max-w-3xl text-sm text-muted">{item.detail}</p></div>
        <button type="button" onClick={onClose} className="btn btn-secondary">Cerrar ×</button>
      </div>
      <p className="mt-5 rounded-xl border border-dashed border-border bg-white p-5 text-sm text-muted">El medio está incorporado al directorio, pero su catálogo detallado todavía no tiene tarifas verificadas. Se solicitará cotización vigente antes de añadirlo como inversión confirmada.</p>
    </section>
  );
}

function SectionHeading({ eyebrow, title, description, count }: { eyebrow: string; title: string; description: string; count: string }) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-signal-dark">{eyebrow}</p><h2 className="mt-1 text-2xl font-black tracking-tight">{title}</h2><p className="mt-1 max-w-3xl text-sm text-muted">{description}</p></div><span className="rounded-xl bg-forest px-4 py-2 text-sm font-black text-white">{count}</span></div>;
}

function Status({ status }: { status: CatalogStatus }) {
  const styles = status === "cotizable" ? "bg-signal/15 text-signal-dark" : status === "validacion" ? "bg-amber/20 text-[#735000]" : "bg-concrete text-muted";
  return <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${styles}`}>{STATUS_LABELS[status]}</span>;
}

function CatalogConditions() {
  return <aside className="mt-8 rounded-card border border-border bg-fog p-5"><h3 className="font-black">Lo que se confirma antes de pautar</h3><ul className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2"><li>✓ Vigencia, disponibilidad y condiciones comerciales.</li><li>✓ Valores e impuestos aplicables.</li><li>✓ Métricas, target, plaza, período y metodología.</li><li>✓ Derechos, territorio, usos y aprobación humana.</li></ul></aside>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/15 bg-white/10 p-3"><dt className="text-[9px] font-black uppercase text-white/55">{label}</dt><dd className="mt-1 font-black">{value}</dd></div>; }
function Summary({ label, value, note }: { label: string; value: string; note: string }) { return <article className="rounded-card border border-border bg-fog p-4"><span className="text-[10px] font-black uppercase text-muted">{label}</span><strong className="mt-1 block text-lg">{value}</strong><span className="text-xs text-muted">{note}</span></article>; }
function Toggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) { return <button type="button" aria-pressed={pressed} onClick={onClick} className={`btn ${pressed ? "btn-ghost" : "btn-secondary"}`}>{children}</button>; }
function EmptyData({ message }: { message: string }) { return <p className="mt-6 rounded-card border border-dashed border-border bg-fog p-6 text-center text-sm text-muted">{message}</p>; }
function ListBlock({ title, items }: { title: string; items: string[] }) { return <div className="mt-4"><strong className="text-xs">{title}</strong><ul className="mt-1 space-y-1 text-xs text-muted">{items.map((item) => <li key={item}>✓ {item}</li>)}</ul></div>; }
function ProviderMark({ item, size }: { item: CatalogItem; size: "small" | "large" }) {
  const box = size === "small" ? "size-12" : "h-16 w-24";
  const background = item.slug === "duoprint" ? "bg-forest" : "bg-white";
  return <div className={`relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-border font-black text-forest ${background} ${box}`}>
    {item.imagePath ? <Image src={item.imagePath} alt={`Logo de ${item.name}`} fill sizes={size === "small" ? "48px" : "96px"} className="object-contain p-2" /> : initials(item.name)}
  </div>;
}
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function StationMonogram({ name }: { name: string }) { return <div aria-hidden className="grid size-12 shrink-0 place-items-center rounded-xl bg-forest text-sm font-black text-white">{initials(name)}</div>; }
function compact(value: number | null) { return value == null ? "Por confirmar" : new Intl.NumberFormat("es-EC", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function percent(value: number | null) { return value == null ? "Por confirmar" : `${new Intl.NumberFormat("es-EC", { maximumFractionDigits: 2 }).format(value)}%`; }
function money(value: number) { return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function moneyPrecise(value: number) { return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }
