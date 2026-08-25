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

export function MediaCatalog({
  section,
  radio,
  influencers,
}: {
  section: CatalogSection;
  radio: RadioStation[];
  influencers: InfluencerProfile[];
}) {
  return (
    <div className="space-y-6">
      <header className="rounded-panel border border-border bg-white p-6 shadow-panel sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-signal-dark">Medios</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Directorio para construir tu plan</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              Explora canales, emisoras, proveedores, cabeceras, plataformas y creadores antes
              de armar una recomendación multimedios.
            </p>
          </div>
          <Link href="/planificador?view=planner" className="btn btn-primary">
            Armar plan de medios →
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Estados de la información del catálogo">
          <Status status="cotizable" />
          <Status status="validacion" />
          <Status status="directorio" />
        </div>
      </header>

      <nav className="grid gap-2 rounded-panel border border-border bg-white p-2 shadow-panel sm:grid-cols-2 lg:grid-cols-6" aria-label="Tipos de medios">
        {CATALOG_SECTIONS.map((item) => (
          <Link
            key={item.id}
            href={`/planificador?view=media&section=${item.id}`}
            aria-current={section === item.id ? "page" : undefined}
            className={`min-h-[74px] rounded-[20px] border px-4 py-3 transition-colors ${
              section === item.id
                ? "border-forest bg-forest text-white"
                : "border-transparent bg-fog text-forest hover:border-border"
            }`}
          >
            <strong className="block text-sm font-black">{item.label}</strong>
            <span className={`mt-1 block text-xs ${section === item.id ? "text-white/70" : "text-muted"}`}>
              {item.description}
            </span>
          </Link>
        ))}
      </nav>

      {section === "digital" && <DigitalSection />}
      {section === "influencers" && <InfluencerSection profiles={influencers} />}
      {section === "radio" && <RadioSection stations={radio} />}
      {section === "tv" && (
        <DirectorySection
          eyebrow="Televisión"
          title="Canales para construir el mix"
          description="Explora cada canal y llévalo al plan para definir programas, frecuencia e inversión. Las tarifas no constituyen reserva ni orden de compra."
          items={TV_CHANNELS}
          countLabel="7 canales nacionales · 23 canales locales por provincia"
        />
      )}
      {section === "ooh" && (
        <DirectorySection
          eyebrow="Vía pública"
          title="Proveedor, provincia y activo"
          description="Navega por proveedor y cobertura. Ubicaciones, producción, impuestos y disponibilidad se reconfirman antes de emitir una orden."
          items={OOH_PROVIDERS}
          countLabel="7 proveedores · 312 fichas incorporadas"
        />
      )}
      {section === "press" && (
        <DirectorySection
          eyebrow="Prensa"
          title="Prensa por cobertura"
          description="Revisa cabeceras nacionales y publicaciones locales; fecha de publicación, edición, circulación, IVA y disponibilidad se confirman al cotizar."
          items={PRESS_OUTLETS}
          countLabel="7 medios en directorio"
        />
      )}
    </div>
  );
}

function DigitalSection() {
  return (
    <section className="rounded-panel border border-border bg-white p-6 shadow-panel sm:p-8">
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
    <article className="flex flex-col rounded-card border border-border bg-gradient-to-br from-white to-sky/5 p-5">
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
    <section className="rounded-panel border border-border bg-white p-6 shadow-panel sm:p-8">
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
    <article className="flex flex-col rounded-card border border-signal/40 bg-forest p-5 text-white shadow-[0_6px_0_#071b12]">
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
    <section className="rounded-panel border border-border bg-white p-6 shadow-panel sm:p-8">
      <SectionHeading eyebrow="Radio" title="Audiencia y alcance por emisora" description="Dos lecturas complementarias para ordenar alternativas sin sumar audiencias ni inventar alcance deduplicado." count={`${stations.length || 104} emisoras`} />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Emisoras observadas" value={String(stations.length || 104)} note="Directorio analizado" />
        <Summary label="Líder en audiencia" value={stations.find((s) => s.audienceRank === 1)?.name ?? "Tropicálida"} note="Promedio del corte recibido" />
        <Summary label="Líder en alcance" value={stations.find((s) => s.reachRank === 1)?.name ?? "Galaxia Super Stereo"} note="Alcance por emisora" />
        <Summary label="Estado del corte" value="Por confirmar" note="Target, plaza, período y franja" />
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

function DirectorySection({ eyebrow, title, description, items, countLabel }: { eyebrow: string; title: string; description: string; items: CatalogItem[]; countLabel: string }) {
  const [query, setQuery] = useState("");
  const matches = items.filter((item) => `${item.name} ${item.summary} ${item.coverage ?? ""}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
  return (
    <section className="rounded-panel border border-border bg-white p-6 shadow-panel sm:p-8">
      <SectionHeading eyebrow={eyebrow} title={title} description={description} count={countLabel} />
      <label className="mt-5 block text-sm font-black">Buscar en el catálogo<input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 font-normal outline-none focus:border-signal" /></label>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {matches.map((item) => (
          <article key={item.slug} className="rounded-card border border-border bg-fog p-5">
            <div className="flex items-start justify-between gap-3"><ProviderMark item={item} size="large" /><Status status={item.status} /></div>
            <h3 className="mt-4 text-xl font-black">{item.name}</h3>
            <p className="mt-1 text-xs font-black uppercase tracking-wide text-signal-dark">{item.statusNote}</p>
            <p className="mt-3 text-sm text-muted">{item.summary}</p>
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted">{item.detail}</p>
            {item.coverage && <p className="mt-3 text-xs"><strong>Cobertura:</strong> {item.coverage}</p>}
            {item.incorporated && <ListBlock title="Incorporado" items={item.incorporated} />}
            {item.pending && <ListBlock title="Antes de ordenar" items={item.pending} />}
            {item.count != null && <span className="mt-4 inline-flex rounded-full bg-signal/10 px-3 py-1 text-xs font-black text-signal-dark">{item.count} registros incorporados</span>}
          </article>
        ))}
      </div>
      <CatalogConditions />
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
