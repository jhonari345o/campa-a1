"use client";

import {workspacePreviewHref} from "@/lib/workspace-preview";
import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  CATALOG_SECTIONS,
  DIGITAL_PLATFORMS,
  INFLUENCER_IMAGE_SLUGS,
  type CatalogItem,
  type CatalogSection,
  type DigitalPlatform,
  type InfluencerProfile,
} from "@/lib/media-catalog";
import type { CatalogHealth } from "@/lib/media-workspace";

import { TelevisionDirectoryPanel } from "./TelevisionDirectory";
import type { BroadcastCatalog } from "@/lib/broadcast-catalog";
import type { OohCatalog } from "@/lib/ooh-catalog";
import { OohCatalogPanel } from "./OohCatalog";
import { RadioDirectoryPanel } from "./RadioDirectory";
import { PressDirectoryPanel } from "./PressDirectory";
import type { PressCatalog } from "@/lib/press-catalog";
import type { RadioDirectoryCatalog } from "@/lib/radio-directory";
import { CatalogAccountRateCard, CatalogDigitalBudget, CatalogProfileProducts, CatalogShoppingLayout, CatalogShoppingProvider, type ShoppingCompany } from "./CatalogShopping";
import type { CatalogCart, CatalogProduct } from "@/lib/catalog-shopping";
import { accountRadioGroups } from "@/lib/account-radio-tariffs";
import type { OohPurchaseReference } from "@/lib/catalog-shopping-server";

export function MediaCatalog({
  broadcast,
  section,
  influencers,
  ooh,
  radioDirectory,
  press,
  shoppingProducts,
  shoppingCart,
  shoppingCompanies,
  canRequest,
  canPlan,
  isAdmin,
  purchaseReferences,previewCompanyId,previewClientId,
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
  canPlan: boolean;
  isAdmin: boolean;
  purchaseReferences: OohPurchaseReference[];previewCompanyId?:string;previewClientId?:string;
}) {
  return (
    <CatalogShoppingProvider products={shoppingProducts} cart={shoppingCart} companies={shoppingCompanies} canRequest={canRequest} isAdmin={isAdmin}><div className="media-portal-shell">
      <header className="media-portal-header">
        <div className="media-portal-header-copy">
          <p>Medios</p>
          <h1>{canRequest ? "Elige medios, arma tu compra." : "Explora tu catálogo de medios"}</h1>
          <p className="media-portal-header-description">
              {canRequest ? "Combina cuñas, espacios y formatos de distintos medios en una sola solicitud." : "Consulta formatos, coberturas y tarifas de tu espacio."}
          </p>
        </div>
        {canPlan && <Link href="/planificador?view=planner" className="media-portal-plan-button">Armar plan de medios <span>→</span></Link>}
      </header>


      <nav className="media-portal-tabs" aria-label="Tipos de medios" role="tablist">
        {CATALOG_SECTIONS.map((item) => (
          <Link
            key={item.id}
            href={previewCompanyId?workspacePreviewHref(previewCompanyId,`/planificador?view=media&section=${item.id}`,previewClientId):`/planificador?view=media&section=${item.id}`}
            aria-current={section === item.id ? "page" : undefined}
            role="tab"
            aria-selected={section === item.id}
            className={`media-portal-tab ${section === item.id ? "is-active" : ""}`}
          >
            <strong>{item.label}</strong><span>{item.description}</span>
          </Link>
        ))}
      </nav>

      {section !== "tv" && <WorkspaceRateCards products={shoppingProducts} section={section}/>}
      <CatalogShoppingLayout active={canRequest || isAdmin}><div className="media-portal-panel" role="tabpanel">
        {section === "digital" && <DigitalSection />}
        {section === "influencers" && <InfluencerSection profiles={influencers} />}
        {section === "radio" && <RadioDirectoryPanel directory={radioDirectory} broadcast={broadcast} />}
        {section === "tv" && <TelevisionDirectoryPanel catalog={broadcast} products={shoppingProducts}/>}
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
      <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))" }}>
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
          Elige tu objetivo
        </span>
      </div>
      <h3 className="mt-4 text-xl font-black tracking-tight">{item.name}</h3>
      <p className="mt-2 text-sm text-muted">{item.summary}</p>
      <p className="mt-4 border-t border-border pt-4 text-sm text-muted">{item.formats}</p>
      <p className="mt-4 rounded-xl bg-fog p-3 text-xs text-muted">
        <strong className="text-forest">Medición:</strong> {item.measurement}
      </p>
      <CatalogDigitalBudget slug={item.slug}/>
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
          <h3 className="mt-1 text-lg font-black leading-tight [overflow-wrap:break-word]">{profile.name}</h3>
          {profile.profileUrl && profile.handle ? (
            <a href={profile.profileUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all text-xs font-bold text-[#9bd6fa] hover:underline">
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
        <strong className="text-sm">Elige tus productos</strong>
        <CatalogProfileProducts profileId={profile.id} />
      </div>
    </article>
  );
}


function SectionHeading({ eyebrow, title, description, count }: { eyebrow: string; title: string; description: string; count: string }) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-signal-dark">{eyebrow}</p><h2 className="mt-1 text-2xl font-black tracking-tight">{title}</h2><p className="mt-1 max-w-3xl text-sm text-muted">{description}</p></div><span className="rounded-xl bg-forest px-4 py-2 text-sm font-black text-white">{count}</span></div>;
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

function WorkspaceRateCards({products,section}:{products:CatalogProduct[];section:CatalogSection}){
 const [query,setQuery]=useState(""),[limit,setLimit]=useState(6),[formatGroup,setFormatGroup]=useState("all");
 const medium=section==="influencers"?"influencer":section,rows=products.filter(p=>p.source.workspaceProductId&&p.kind===medium);
 const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const filtered=rows.filter(p=>(formatGroup==="all"||p.formatGroup===formatGroup)&&normalize(`${p.provider} ${p.name} ${p.format} ${p.location}`).includes(normalize(query)));
 const groups=section==="radio"?accountRadioGroups(filtered):filtered.map(p=>[p]);
 if(!rows.length)return null;
 return <section className="mt-6 rounded-panel border border-border bg-white p-6 sm:p-8" aria-label="Condiciones comerciales de tu cuenta">
  <p className="text-xs font-black uppercase tracking-widest text-signal-dark">Catálogo de tu espacio</p>
  <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><h2 className="text-2xl font-black">Tarifas de tu cuenta</h2><span className="text-sm text-muted">{groups.length} {section==="radio"?(groups.length===1?"emisora":"emisoras"):(groups.length===1?"formato":"formatos")}</span></div>
  <label className="mt-5 block text-sm font-bold">Buscar medio, formato o plaza<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setLimit(6)}} className="mt-2 w-full rounded-xl border border-border bg-fog p-3 font-normal" placeholder="Ej. Guayaquil, cuña, media página"/></label>
  {section==="ooh"&&<div className="mt-4 flex flex-wrap gap-2">{[["all","Todos los formatos"],["totem_special","Tótems especiales"],["totem_standard","Tótems normales / LED"]].map(([value,label])=><button key={value} aria-pressed={formatGroup===value} onClick={()=>{setFormatGroup(value);setLimit(6)}} className={`rounded-xl border border-border px-4 py-2 text-sm font-bold ${formatGroup===value?"bg-forest text-white":"bg-white text-forest"}`}>{label}</button>)}</div>}
  <div className="mt-5 grid gap-4 lg:grid-cols-3">{groups.slice(0,limit).map(group=><CatalogAccountRateCard key={group[0].key} products={group}/>)}</div>
  {!groups.length&&<p className="mt-6 text-sm text-muted">No hay formatos para esta búsqueda.</p>}
  {groups.length>limit&&<button className="btn btn-secondary mt-5" onClick={()=>setLimit(n=>n+6)}>Ver más tarifas →</button>}
 </section>;
}
