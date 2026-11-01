"use client";
import Image from "next/image";
import { useState } from "react";
import { OOH_PROVIDERS } from "@/lib/media-catalog";
import { oohKey, oohMatches, oohProvinceGroups, oohRateUnit, type OohAsset, type OohCatalog } from "@/lib/ooh-catalog";
import { CatalogOohProducts } from "./CatalogShopping";
import type { OohPurchaseReference } from "@/lib/catalog-shopping-server";

const money = (value: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal-dark";

export function OohCatalogPanel({ catalog, purchaseReferences = [] }: { catalog: OohCatalog; purchaseReferences?: OohPurchaseReference[] }) {
  const [providerSlug, setProviderSlug] = useState<string | null>(null);
  const [provinceKey, setProvinceKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const provider = OOH_PROVIDERS.find(item => item.slug === providerSlug);
  const providerAssets = catalog.assets.filter(item => item.providerSlug === providerSlug);
  const groups = oohProvinceGroups(providerAssets);
  const province = groups.find(group => group.key === provinceKey);
  const shown = (province?.assets ?? []).filter(item => oohMatches(item, query));
  function selectProvider(slug: string | null) { setProviderSlug(slug); setProvinceKey(null); setQuery(""); }
  function selectProvince(key: string | null) { setProvinceKey(key); setQuery(""); }

  return <section className="media-portal-section">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-signal-dark">Vía pública</p><h2 className="mt-1 text-2xl font-black tracking-tight">{province ? `${provider?.name} · ${province.name}` : provider ? `Explora ${provider.name}` : "Encuentra el espacio para tu marca"}</h2><p className="mt-2 max-w-3xl text-sm text-muted">{province ? "Fotografías, ubicaciones, formatos y valores de referencia." : provider ? "Selecciona una provincia para ver sus espacios." : "Elige un proveedor, explora sus provincias y compara los espacios disponibles en el catálogo."}</p></div>
      <span className="rounded-xl bg-forest px-4 py-2 text-sm font-black text-white">{province ? `${province.assets.length} fichas` : provider ? `${groups.length} coberturas · ${providerAssets.length} fichas` : `${OOH_PROVIDERS.length} proveedores · ${catalog.assets.length} fichas`}</span>
    </header>

    {provider && <nav aria-label="Ubicación en el catálogo de vía pública" className="mt-6 flex flex-wrap items-center gap-2 border-b border-border pb-4 text-sm">
      <button type="button" onClick={() => selectProvider(null)} className={`rounded-lg px-2 py-1 font-bold text-signal-dark hover:bg-fog ${focus}`}>← Proveedores</button><span aria-hidden="true" className="text-muted">/</span>
      {province ? <button type="button" onClick={() => selectProvince(null)} className={`rounded-lg px-2 py-1 font-bold text-signal-dark hover:bg-fog ${focus}`}>{provider.name}</button> : <span aria-current="page" className="font-black">{provider.name}</span>}
      {province && <><span aria-hidden="true" className="text-muted">/</span><span aria-current="page" className="font-black">{province.name}</span></>}
    </nav>}
    {provider && <PurchaseHistory rows={purchaseReferences.filter(r => r.provider_slug === providerSlug)} />}
    {catalog.error ? <p role="alert" className="mt-6 rounded-xl border border-border bg-fog p-5 text-sm">{catalog.error}</p> : !provider ? <>
      <label className="media-catalog-search">Buscar proveedor<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre del proveedor" /></label>
      <div className="media-directory-grid">
        {OOH_PROVIDERS.filter(item => oohKey(item.name).includes(oohKey(query))).map(item => {
          const rows = catalog.assets.filter(asset => asset.providerSlug === item.slug), provinces = oohProvinceGroups(rows);
          return <button key={item.slug} type="button" onClick={() => selectProvider(item.slug)} className={`media-directory-card w-full text-left transition hover:border-signal ${focus}`} aria-label={`Ver provincias de ${item.name}`}>
            <div className="flex items-start justify-between gap-3"><div className={`relative h-16 w-24 overflow-hidden rounded-2xl border border-border ${item.slug === "duoprint" ? "bg-forest" : "bg-white"}`}>{item.imagePath ? <Image src={item.imagePath} alt={item.name} fill sizes="96px" className="object-contain p-2" /> : <span className="grid h-full place-items-center text-xl font-black">{item.name.slice(0, 1)}</span>}</div><span className="rounded-full bg-signal/10 px-3 py-1 text-xs font-black text-signal-dark">{rows.length} fichas</span></div>
            <h3>{item.name}</h3><p>{item.summary}</p><p className="media-directory-detail">{provinces.length ? provinces.map(group => group.name).join(" · ") : "Fichas de ubicaciones aún no incorporadas."}</p>
            <span className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm font-black text-signal-dark">Ver provincias <span aria-hidden="true">→</span></span>
          </button>;
        })}
      </div>
    </> : !province ? <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map(group => <button key={group.key} type="button" onClick={() => selectProvince(group.key)} className={`flex items-center gap-4 rounded-2xl border border-border bg-white p-5 text-left transition hover:border-signal hover:bg-fog ${focus}`}>
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-signal/10 text-signal-dark"><LocationIcon /></span><span className="min-w-0 flex-1"><strong className="block text-lg font-black">{group.name}</strong><span className="mt-1 block text-xs text-muted">{group.assets.length} fichas · {new Set(group.assets.map(asset => asset.city).filter(Boolean)).size} localidades</span></span><span aria-hidden="true" className="text-xl text-signal-dark">→</span>
        </button>)}
      </div>
      {!groups.length && <p className="mt-6 rounded-2xl border border-dashed border-border bg-fog p-6 text-sm text-muted">Este proveedor todavía no tiene fichas de ubicaciones incorporadas al catálogo.</p>}
    </> : <>
      <div className="mt-6 flex flex-wrap items-end gap-4"><label className="min-w-0 flex-1 text-sm font-black">Buscar en {province.name}<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Ciudad, dirección, código o formato" className="mt-2 w-full rounded-xl border border-border bg-fog px-4 py-3 font-normal outline-none focus:border-signal focus:ring-2 focus:ring-signal/20" /></label><p role="status" className="pb-3 text-sm text-muted">{shown.length} de {province.assets.length} fichas</p></div>
      <div className="mt-6 grid items-start gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))" }}>{shown.map(asset => <OohAssetCard key={asset.id} asset={asset} references={purchaseReferences.filter(r => r.asset_id === asset.id)} />)}</div>
      {!shown.length && <p className="py-10 text-center text-sm text-muted">No hay fichas que coincidan con esa búsqueda.</p>}
    </>}
  </section>;
}

function OohAssetCard({ asset, references }: { asset: OohAsset; references: OohPurchaseReference[] }) {
  const [imageFailed, setImageFailed] = useState(false);
  const photoUrl = `/api/ooh/images/${encodeURIComponent(asset.id)}`;
  const hasMap = asset.latitude != null && asset.longitude != null;
  return <article className="overflow-hidden rounded-card border border-border bg-white shadow-panel">
    <div className="relative aspect-[4/3] bg-fog">
      {asset.photo && !imageFailed ? <a href={photoUrl} target="_blank" rel="noopener noreferrer" className={`block h-full ${focus}`} aria-label={`Ampliar fotografía de ${asset.name}`}>
        <Image src={photoUrl} alt={`${asset.name}${asset.city ? ` en ${asset.city}` : ""}${asset.photoKind === "format" ? " · imagen de referencia del formato" : ""}`} fill unoptimized sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" className="object-contain" onError={() => setImageFailed(true)} />
        <span className="absolute bottom-3 right-3 rounded-lg bg-forest/90 px-3 py-1.5 text-[10px] font-black text-white">Ampliar ↗</span>
      </a> : <div className="grid h-full place-content-center gap-2 text-center text-muted"><span className="mx-auto"><LocationIcon /></span><span className="text-xs">{imageFailed ? "Fotografía no disponible en este momento" : "Sin fotografía incorporada"}</span></div>}
      {asset.photoKind === "format" && asset.photo && <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-3 py-1.5 text-[10px] font-bold text-forest">Imagen de referencia del formato</span>}
    </div>
    <div className="p-5"><p className="text-[10px] font-black uppercase tracking-wide text-signal-dark">{[asset.city, asset.brand].filter(Boolean).join(" · ") || asset.provinces.join(" · ")}</p><h3 className="mt-1 text-lg font-black leading-tight">{asset.name}</h3>{asset.code && <p className="mt-1 text-xs text-muted">Código {asset.code}</p>}
      <p className="mt-3 text-sm text-muted">{asset.address || "Ubicación exacta no informada"}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-border py-3 text-xs"><div><dt className="text-muted">Formato</dt><dd className="mt-1 font-bold">{asset.format || "No informado"}</dd></div><div><dt className="text-muted">Medidas</dt><dd className="mt-1 font-bold">{asset.dimensions || "No informadas"}</dd></div>{asset.dailySpots != null && <div><dt className="text-muted">Spots por día</dt><dd className="mt-1 font-bold">{asset.dailySpots}</dd></div>}{asset.spotSeconds != null && <div><dt className="text-muted">Duración del spot</dt><dd className="mt-1 font-bold">{asset.spotSeconds} segundos</dd></div>}</dl>
      <div className="mt-4 rounded-xl bg-fog p-4"><p className="text-[10px] font-black uppercase tracking-wide text-muted">Valores de referencia</p>
        {asset.rates.length ? <ul className="mt-2 space-y-3">{asset.rates.map((rate, index) => <li key={index}><strong className="block text-xl font-black text-forest">{money(rate.amount)}</strong><span className="block text-xs text-muted">{oohRateUnit(rate)}{rate.component ? ` · ${rate.component}` : ""}</span></li>)}</ul> : <p className="mt-2 text-sm font-black">{asset.rateLabel.startsWith("$") ? asset.rateLabel : "Sin tarifa publicada"}</p>}
        {(asset.reference || asset.taxLabel) && <p className="mt-3 text-[10px] text-muted">{[asset.reference, asset.taxLabel].filter(Boolean).join(" · ")}</p>}
      </div>
      <CatalogOohProducts assetId={asset.id} />
      <PurchaseHistory rows={references} />
      {hasMap && <a href={`https://www.google.com/maps/search/?api=1&query=${asset.latitude},${asset.longitude}`} target="_blank" rel="noopener noreferrer" className={`mt-4 flex items-center gap-2 rounded-lg py-1 text-sm font-black text-signal-dark ${focus}`}><LocationIcon /> Ver ubicación en el mapa ↗</a>}
    </div>
  </article>;
}
function PurchaseHistory({ rows }: { rows: OohPurchaseReference[] }) {
  if (!rows.length) return null;
  return <details className="my-5 rounded-xl border border-amber/40 bg-amber/10 p-4 text-forest"><summary className="cursor-pointer text-sm font-black">Referencias internas de compra · {rows.length}</summary><p className="mt-3 text-xs text-muted">Costos históricos de Ad Mavericks · administración</p><div className="mt-3 max-h-[420px] overflow-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead><tr><th className="p-2">Factura y ubicación</th><th className="p-2">Período</th><th className="p-2">Base de compra</th><th className="p-2">Pago registrado</th><th className="p-2">Costo por unidad</th></tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-t border-amber/20"><th scope="row" className="p-2"><strong>{r.invoice_number}</strong><span className="mt-1 block font-normal">{r.location}</span><span className="mt-1 block font-normal text-muted">{r.scope_note}</span></th><td className="p-2">{[r.period_start, r.period_end].filter(Boolean).join(" – ") || "Período no detallado"}</td><td className="p-2">{r.purchase_net_usd == null ? "Sin desglose" : money(Number(r.purchase_net_usd))}<small className="mt-1 block">{r.tax_label}</small></td><td className="p-2">{r.paid_usd == null ? "No verificado" : money(Number(r.paid_usd))}<small className="mt-1 block">{r.paid_at} · {r.payment_status === "verified" ? "Verificado" : r.payment_status === "partial" ? "Abono" : "Facturado"}</small></td><td className="p-2">{r.unit_price_usd == null ? "Sin asignación unitaria" : money(Number(r.unit_price_usd))}<small className="mt-1 block">{r.unit}</small></td></tr>)}</tbody></table></div></details>;
}
function LocationIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>; }
