"use client";
import { useEffect, useId, useState } from "react";
import type { BroadcastBrief, BroadcastCatalog } from "@/lib/broadcast-catalog";
import { CART_LIMITS, changeCatalogQuantity, type CatalogPick, type CatalogProduct } from "@/lib/catalog-shopping";
import { diyTvProductPrice } from "@/lib/diy-tv-pricing";
import { TelevisionProgramBrowser } from "./TelevisionDirectory";
import styles from "./TelevisionDirectory.module.css";

export type TvPick = { sourceId?: string; context?: string; id: string; channel: string; title: string; schedule: string; market: string; unitPrice: number | null; quantity: number };
const legacyKey = (pick: TvPick) => `tv:${pick.sourceId}:${pick.id}`;

export function DiyTelevision({ catalog, products, brief, picks, onChange, legacy, onLegacyChange }: {
  catalog: BroadcastCatalog; products: CatalogProduct[]; brief: BroadcastBrief;
  picks: CatalogPick[]; onChange: (picks: CatalogPick[]) => void;
  legacy: TvPick[]; onLegacyChange: (picks: TvPick[]) => void;
}) {
  const [error, setError] = useState("");
  const quantities = new Map(picks.map(pick => [pick.productKey, pick.quantity]));
  for (const pick of legacy) quantities.set(legacyKey(pick), (quantities.get(legacyKey(pick)) ?? 0) + pick.quantity);
  const unavailable = legacy.filter(pick => !products.some(product => product.key === legacyKey(pick)));
  function setQuantity(key: string, next: number) {
    if (!Number.isInteger(next) || next < 0 || next > CART_LIMITS.quantity) return;
    try {
      const current = picks.find(pick => pick.productKey === key)?.quantity ?? 0;
      const updated = changeCatalogQuantity(picks, key, next - current);
      onChange(updated);
      // Editing an older plan moves only this chosen programme into the same
      // canonical catalogue selection, without counting its old row twice.
      onLegacyChange(legacy.filter(pick => legacyKey(pick) !== key));
      setError("");
    } catch { setError(`Puedes incluir hasta ${CART_LIMITS.lines} productos distintos.`); }
  }
  return <>
    {error && <p role="alert" className={styles.empty}>{error}</p>}
    <TelevisionProgramBrowser catalog={catalog} products={products} day={brief.startDate} selectedKeys={[...quantities].filter(([,quantity]) => quantity > 0).map(([key]) => key)}
      renderAction={product => diyTvProductPrice(product, brief) ? <ProgrammeQuantity name={product.name} quantity={quantities.get(product.key) ?? 0} onChange={next => setQuantity(product.key, next)}/> : <p className={styles.unavailable}>{!brief.startDate || !brief.endDate ? "Completa las fechas del brief para seleccionar este programa." : "Selecciona fechas y cobertura compatibles con este programa."}</p>}/>
    {!!unavailable.length && <div className={styles.empty}><p>Programas de tu selección anterior</p><ul>{unavailable.map(pick => <li key={legacyKey(pick)} className="mt-3 flex flex-wrap items-center justify-between gap-3"><span>{pick.channel} · {pick.title}</span><button type="button" className="btn btn-secondary" onClick={() => onLegacyChange(legacy.filter(item => item !== pick))}>Retirar</button></li>)}</ul></div>}
  </>;
}
function ProgrammeQuantity({ name, quantity, onChange }: { name: string; quantity: number; onChange: (value: number) => void }) {
  const inputId = useId();
  const [value, setValue] = useState(String(quantity));
  useEffect(() => setValue(String(quantity)), [quantity]);
  function commit() {
    const next = Number(value);
    if (value.trim() && Number.isInteger(next) && next >= 0 && next <= CART_LIMITS.quantity) onChange(next);
    else setValue(String(quantity));
  }
  return <div className={styles.quantity} role="group" aria-label={`Selección de ${name}`}>
    <label htmlFor={inputId}>Cuñas en tu plan</label>
    <button type="button" disabled={!quantity} aria-label={`Quitar una cuña de ${name}`} onClick={() => onChange(Math.max(0, quantity - 1))}>−</button>
    <input id={inputId} type="number" min={0} max={CART_LIMITS.quantity} step={1} value={value} aria-label={`Cantidad de cuñas de ${name}`} onChange={event => setValue(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }}/>
    <button type="button" disabled={quantity >= CART_LIMITS.quantity} aria-label={`Agregar una cuña de ${name}`} onClick={() => onChange(quantity + 1)}>{quantity ? "+" : "Agregar"}</button>
    {!!quantity && <span role="status">{quantity} {quantity === 1 ? "cuña seleccionada" : "cuñas seleccionadas"}</span>}
  </div>;
}
