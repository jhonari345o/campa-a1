"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  CATALOG_SECTIONS,
  DIGITAL_PLATFORMS,
  INFLUENCER_IMAGE_SLUGS,
  STATUS_LABELS,
  type CatalogItem,
  type CatalogSection,
  type CatalogStatus,
  type DigitalPlatform,
  type InfluencerProfile,
} from "@/lib/media-catalog";
import type { CatalogHealth } from "@/lib/media-workspace";

import { BroadcastCatalogPanel } from "./BroadcastCatalog";
import type { BroadcastCatalog } from "@/lib/broadcast-catalog";
import type { OohCatalog } from "@/lib/ooh-catalog";
import { OohCatalogPanel } from "./OohCatalog";
import { RadioDirectoryPanel } from "./RadioDirectory";
import { PressDirectoryPanel } from "./PressDirectory";
import type { PressCatalog } from "@/lib/press-catalog";
import type { RadioDirectoryCatalog } from "@/lib/radio-directory";
import { CatalogProfileProducts, CatalogShoppingLayout, CatalogShoppingProvider, type ShoppingCompany } from "./CatalogShopping";
import type { CatalogCart, CatalogProduct } from "@/lib/catalog-shopping";
import type { OohPurchaseReference } from "@/lib/catalog-shopping-server";

export function MediaCatalog({
  broadcast,
  section,
  influencers,
  health,
  ooh,
  radioDirectory,
  press,
  shoppingProducts,
  shoppingCart,
  shoppingCompanies,
  canRequest,
  isAdmin,
  purchaseReferences,
}: {
  broadcast: BroadcastCatalog;
  section: CatalogSection;
  influencers: InfluencerProfile[];
  health: CatalogHealth | null;
  ooh: OohCatalog;
  radioDirectory: RadioDirectoryCatalog;
  press: PressCatalog;
  shoppingProducts: CatalogProduct[];
  shoppingCart: CatalogCart;
  shoppingCompanies: ShoppingCompany[];
  canRequest: boolean;
  isAdmin: boolean;
  purchaseReferences: OohPurchaseReference[];
}) {
  return (
    <CatalogShoppingProvider products={shoppingProducts} cart={shoppingCart} companies={shoppingCompanies} canRequest={canRequest} isAdmin={isAdmin}><div className="media-portal-shell">
      <header className="media-portal-header">
        <div className="media-portal-header-copy">
          <p>Medios</p>
          <h1>{section === "influencers" || section === "ooh" ? "Elige medios, arma tu compra." : "Directorio para construir tu plan"}</h1>
          <p className="media-portal-header-description">
              {section === "influencers" || section === "ooh" ? "Explora el catálogo, agrega productos y cantidades a tu carrito y prepara una solicitud independiente." : "Explora canales, emisoras, proveedores, cabeceras, plataformas y creadores antes de armar una recomendación multimedios."}
          </p>
          <div className="media-portal-header-legend" aria-label="Estados de la información del catálogo">
            <Status status="cotizable" />
            <Status status="validacion" />
            <Status status="directorio" />
          </div>
        </div>
        <Link href="/planificador?view=planner" className="media-portal-plan-button">Armar plan de medios <span>→</span></Link>
      </header>

      {health && section !== "tv" && section !== "radio" && section !== "ooh" && section !== "press" && (
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

      <CatalogShoppingLayout active={section === "influencers" || section === "ooh"}><div className="media-portal-panel" role="tabpanel">
        {section === "digital" && <DigitalSection />}
        {section === "influencers" && <InfluencerSection profiles={influencers} />}
        {section === "radio" && <RadioDirectoryPanel directory={radioDirectory} broadcast={broadcast} />}
        {section === "tv" && <BroadcastCatalogPanel kind="tv" catalog={broadcast} />}
        {section === "ooh" && (
          <OohCatalogPanel catalog={ooh} purchaseReferences={purchaseReferences} />
        )}
        {section === "press" && (
          <PressDirectoryPanel catalog={press} />
        )}
      </div></CatalogShoppingLayout>
    </div></CatalogShoppingProvider>
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
        description="Elige reels, stories y otros entregables. Pulsa cada producto para agregarlo y ajusta su cantidad."
        count={`${profiles.length} perfiles`}
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
        <EmptyData message="No hay perfiles disponibles en este momento. Vuelve a intentar más tarde." />
      ) : (
        <>
          <div className="mt-6 grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,290px),1fr))" }}>
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
          <strong className="text-sm">Elige tus productos</strong>
          <span className="rounded-full bg-[#c8ffc5] px-2 py-1 text-[9px] font-black uppercase text-forest">Agregar al carrito</span>
        </div>
        <CatalogProfileProducts profileId={profile.id} />
      </div>
      <p className="mt-4 text-[10px] text-white/55">Vigencia, disponibilidad y derecho de pauta por reconfirmar.</p>
    </article>
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

function EmptyData({ message }: { message: string }) { return <p className="mt-6 rounded-card border border-dashed border-border bg-fog p-6 text-center text-sm text-muted">{message}</p>; }
function ProviderMark({ item, size }: { item: CatalogItem; size: "small" | "large" }) {
  const box = size === "small" ? "size-12" : "h-16 w-24";
  const background = item.slug === "duoprint" ? "bg-forest" : "bg-white";
  return <div className={`relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-border font-black text-forest ${background} ${box}`}>
    {item.imagePath ? <Image src={item.imagePath} alt={`Logo de ${item.name}`} fill sizes={size === "small" ? "48px" : "96px"} className="object-contain p-2" /> : initials(item.name)}
  </div>;
}
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

function compact(value: number | null) { return value == null ? "Por confirmar" : new Intl.NumberFormat("es-EC", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function percent(value: number | null) { return value == null ? "Por confirmar" : `${new Intl.NumberFormat("es-EC", { maximumFractionDigits: 2 }).format(value)}%`; }
