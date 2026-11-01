"use client";
import Image from "next/image";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CART_LIMITS, catalogCartSummary, catalogQuoteSignature, changeCatalogQuantity, type CatalogCart, type CatalogPick, type CatalogProduct } from "@/lib/catalog-shopping";
import { loadCatalogSelection, saveCatalogSelection, submitCatalogSelection } from "./catalog-actions";
import styles from "./CatalogShopping.module.css";

export type ShoppingCompany = { id: string; name: string };
type ShoppingState = {
  products: CatalogProduct[]; items: CatalogPick[]; saving: boolean; busy: boolean; error: string;
  canRequest: boolean; companies: ShoppingCompany[]; isAdmin: boolean;
  change: (key: string, delta: number) => void; remove: (key: string) => void;
  open: (review?: boolean) => void; restore: () => void; retry: () => void;
};
const Shopping = createContext<ShoppingState | null>(null);
export const catalogMoney = (cents: number | null) => cents == null ? "Por cotizar" : new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(cents / 100);
export const catalogTax = (value: boolean | null) => value === true ? "IVA incluido" : value === false ? "Sin IVA" : "Base fiscal no indicada";
function useShopping() { const value = useContext(Shopping); if (!value) throw new Error("Shopping provider required"); return value; }

export function CatalogShoppingProvider({ products: initialProducts, cart, companies, canRequest, isAdmin, children }: {
  products: CatalogProduct[]; cart: CatalogCart; companies: ShoppingCompany[]; canRequest: boolean; isAdmin: boolean; children: ReactNode;
}) {
  const [products, setProducts] = useState(initialProducts), [items, setItems] = useState(cart.items);
  const [saving, setSaving] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(cart.error ?? "");
  const [mode, setMode] = useState<"cart" | "review" | null>(null), [orderId, setOrderId] = useState("");
  const [notice, setNotice] = useState("");
  const desired = useRef(cart.items), persisted = useRef(JSON.stringify(cart.items)), version = useRef(cart.version);
  const running = useRef(false), mounted = useRef(true), submission = useRef<string | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setProducts(initialProducts); }, [initialProducts]);
  async function drain() {
    if (running.current) return;
    running.current = true; setSaving(true); setError("");
    try {
      while (JSON.stringify(desired.current) !== persisted.current) {
        const snapshot = desired.current;
        const result = await saveCatalogSelection(snapshot, version.current);
        if (!result.ok) { if (mounted.current) setError(result.error); return; }
        version.current = result.cart.version;
        persisted.current = JSON.stringify(result.cart.items);
      }
    } catch { if (mounted.current) setError("No se pudo guardar. Tu selección sigue aquí; vuelve a intentar."); }
    finally { running.current = false; if (mounted.current) setSaving(false); }
  }
  function replace(next: CatalogPick[]) {
    if (busy) return;
    try { catalogCartSummary(next, products); } catch { setError("La selección supera el límite permitido. Reduce los productos o cantidades."); return; }
    desired.current = next; setItems(next); setOrderId(""); submission.current = null; void drain();
  }
  function change(key: string, delta: number) {
    if (!products.some(p => p.key === key)) return;
    try {
      const next = changeCatalogQuantity(desired.current, key, delta);
      const product = products.find(p => p.key === key)!;
      replace(next); setNotice(`${next.find(p => p.productKey === key)?.quantity ?? 0} · ${product.name} · ${product.provider}`);
    } catch { setError(`Puedes seleccionar hasta ${CART_LIMITS.lines} productos distintos.`); }
  }
  async function restore() {
    if (busy || running.current) return;
    setSaving(true);
    try {
      const result = await loadCatalogSelection();
      if (result.error) { setError(result.error); return; }
      version.current = result.version; desired.current = result.items;
      persisted.current = JSON.stringify(result.items); setItems(result.items); setError(""); submission.current = null;
    } catch { setError("No se pudo recuperar el carrito. Tu selección sigue aquí."); }
    finally { setSaving(false); }
  }
  async function send(form: HTMLFormElement) {
    if (busy || saving || error || !canRequest) return;
    const data = new FormData(form);
    setBusy(true); setError("");
    submission.current ??= crypto.randomUUID();
    try {
      const result = await submitCatalogSelection({
        requestId: submission.current, version: version.current, quote: catalogQuoteSignature(items, products),
        companyId: String(data.get("companyId") ?? "") || null, title: String(data.get("title") ?? ""),
        desiredStart: String(data.get("desiredStart") ?? ""), notes: String(data.get("notes") ?? ""),
      });
      if (!result.ok) { if (result.products) setProducts(result.products); setError(result.error); return; }
      version.current = result.cart.version; desired.current = result.cart.items;
      persisted.current = JSON.stringify(result.cart.items); setItems(result.cart.items); setOrderId(result.id);
    } catch { setError("La conexión se interrumpió. Vuelve a enviar para recuperar la misma solicitud."); }
    finally { setBusy(false); }
  }
  const value: ShoppingState = { products, items, saving, busy, error, companies, canRequest, isAdmin, change, remove: key => replace(desired.current.filter(p => p.productKey !== key)), open: review => { setOrderId(""); setMode(review ? "review" : "cart"); }, restore, retry: () => void drain() };
  return <Shopping.Provider value={value}>{children}<span className="sr-only" role="status">{notice}</span>
    <ShoppingDialog mode={mode} orderId={orderId} onClose={() => { if (!busy) setMode(null); }} onReview={() => setMode("review")} onSend={send} />
  </Shopping.Provider>;
}
export function CatalogShoppingLayout({ active, children }: { active: boolean; children: ReactNode }) {
  return <div className={active ? styles.layout : ""}><div className={styles.content}>{children}</div>{active && <><aside className={styles.aside}><CartContents /></aside><MobileCartBar /></>}</div>;
}
export function CatalogProductPicker({ product }: { product: CatalogProduct }) {
  const cart = useShopping(), quantity = cart.items.find(p => p.productKey === product.key)?.quantity ?? 0;
  if (!cart.canRequest && !cart.isAdmin) return <div className={styles.product}><div className={styles.add}><span className={styles.productTitle}>{product.format}<small>{product.unit}</small></span><strong>{catalogMoney(product.priceCents)}</strong><small>{catalogTax(product.taxIncluded)}</small></div></div>;
  return <div className={`${styles.product} ${quantity ? styles.selected : ""}`}>
    <button type="button" className={styles.add} disabled={cart.busy || quantity >= CART_LIMITS.quantity} aria-label={`Agregar ${product.name} · ${product.format} · ${product.provider} · ${product.unit}`} onClick={() => cart.change(product.key, 1)}>
      <span className={styles.productTitle}>{product.format}{product.kind === "ooh" && <small>{product.unit}</small>}</span>
      <strong>{catalogMoney(product.priceCents)}</strong>
      <span className={styles.addMark} aria-hidden="true">{quantity ? quantity : "+"}</span>
      <small>{catalogTax(product.taxIncluded)}</small>
    </button>
    {!!quantity && <div className={styles.selectedRow}><span>En tu carrito</span><Quantity product={product} quantity={quantity} /></div>}
  </div>;
}
export function CatalogProfileProducts({ profileId }: { profileId: string }) {
  const { products } = useShopping(), rows = products.filter(p => p.source.profileId === profileId);
  return rows.length ? <div className={styles.profileProducts}>{rows.map(p => <CatalogProductPicker product={p} key={p.key} />)}</div> : <p className="mt-3 text-xs text-white/70">Sin formatos publicados.</p>;
}
export function CatalogOohProducts({ assetId }: { assetId: string }) {
  const { products } = useShopping();
  return <div className={styles.oohProducts}>{products.filter(p => p.source.assetId === assetId).map(p => <CatalogProductPicker product={p} key={p.key} />)}</div>;
}
export function CatalogPrice({ productKey }: { productKey: string }) {
  const { products } = useShopping(), product = products.find(p => p.key === productKey);
  return <><strong>{catalogMoney(product?.priceCents ?? null)}</strong><small className="block text-xs text-muted">{product ? catalogTax(product.taxIncluded) : ""}</small></>;
}
export function CatalogInlineProduct({ productKey, label = "Cantidad" }: { productKey: string; label?: string }) {
  const cart = useShopping(), product = cart.products.find(p => p.key === productKey);
  const [amount, setAmount] = useState("1");
  if (!product || (!cart.canRequest && !cart.isAdmin)) return null;
  const quantity = Number(amount), selected = cart.items.find(p => p.productKey === productKey)?.quantity ?? 0;
  return <div className={styles.inlineProduct}><label>{label}<input type="number" min={1} max={CART_LIMITS.quantity} step={1} value={amount} onChange={e => setAmount(e.target.value)} aria-label={`${label} de ${product.provider} · ${product.name} · ${product.unit}`} /></label><button type="button" disabled={cart.busy || !Number.isInteger(quantity) || quantity < 1 || quantity > CART_LIMITS.quantity} onClick={() => cart.change(productKey, quantity)}>Agregar +</button>{selected > 0 && <span role="status">{selected} en el carrito</span>}</div>;
}
export function CatalogRadioProducts({ stationId, tariffId, rateIndex }: { stationId: string; tariffId?: string; rateIndex?: number }) {
  const { products } = useShopping();
  const rows = products.filter(p => p.kind === "radio" && p.source.stationId === stationId && p.source.tariffId === tariffId && (rateIndex == null || p.source.rateIndex === rateIndex));
  const [seconds, setSeconds] = useState(30);
  const product = rows.find(p => p.source.seconds === seconds) ?? rows[0];
  return product ? <div className={styles.radioProduct}>{rows.length > 1 && <label>Duración de la cuña<select value={product.source.seconds} onChange={e => setSeconds(Number(e.target.value))}>{rows.map(p => <option key={p.key} value={p.source.seconds}>{p.source.seconds} segundos</option>)}</select></label>}<p>{product.unit}</p><CatalogPrice productKey={product.key}/><CatalogInlineProduct productKey={product.key} label="Cuñas"/></div> : null;
}
export function CatalogPressQuote({ id }: { id: string }) { return <CatalogInlineProduct productKey={`press:${id}:quote`} label="Inserciones"/>; }
export function CatalogDigitalBudget({ slug }: { slug: string }) { return <div className={styles.radioProduct}><p className="text-sm font-bold">Presupuesto para tu campaña</p><CatalogInlineProduct productKey={`digital:${slug}`} label="Inversión USD"/></div>; }
function Quantity({ product, quantity }: { product: CatalogProduct; quantity: number }) {
  const { change, busy } = useShopping(), name = `${product.name} · ${product.format} · ${product.provider}`;
  const [input, setInput] = useState(String(quantity));
  useEffect(() => setInput(String(quantity)), [quantity]);
  function commit() { const next = Number(input); if (input && Number.isInteger(next) && next >= 0 && next <= CART_LIMITS.quantity) change(product.key, next - quantity); else setInput(String(quantity)); }
  return <div className={styles.quantity} role="group" aria-label={`Cantidad de ${name}`}>
    <button type="button" aria-label={`Reducir ${name}`} disabled={busy} onClick={() => change(product.key, -1)}>−</button>
    <input type="number" min={0} max={CART_LIMITS.quantity} step={1} value={input} aria-label={`Cantidad seleccionada de ${name}`} disabled={busy} onChange={e => setInput(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }} />
    <button type="button" aria-label={`Aumentar ${name}`} disabled={busy || quantity >= CART_LIMITS.quantity} onClick={() => change(product.key, 1)}>+</button>
  </div>;
}
function CartContents({ compact = false }: { compact?: boolean }) {
  const cart = useShopping(), summary = useMemo(() => catalogCartSummary(cart.items, cart.products), [cart.items, cart.products]);
  return <section className={styles.cart} aria-label="Carrito del catálogo">
    <header className={styles.cartHeader}><CartIcon /><div><h3>Tu carrito</h3><p>Se guarda por dos horas sin cambios</p></div><span>{summary.quantity}</span></header>
    {!summary.lines.length ? <div className={styles.empty}><CartIcon /><h4>Elige tus medios</h4><p>Agrega cuñas, espacios y formatos de todo el catálogo.</p></div> : <div className={styles.cartLines}>{summary.lines.map(line => <article key={line.pick.productKey} className={styles.cartLine}>
      <div className={styles.lineHeading}>{line.product?.image && <Image src={line.product.image} alt="" width={48} height={48} unoptimized className={styles.thumbnail} />}<div><strong>{line.product?.provider ?? "Producto no disponible"}</strong><p>{line.product?.name}</p><small>{line.product?.format}{line.product?.kind === "ooh" ? ` · ${line.product.unit}` : ""}</small></div><button type="button" disabled={cart.busy} onClick={() => cart.remove(line.pick.productKey)} aria-label={`Quitar ${line.product?.name ?? "producto"} de ${line.product?.provider ?? "catálogo"}`}>×</button></div>
      {line.product && <><div className={styles.linePrice}><span>{catalogMoney(line.product.priceCents)} × {line.pick.quantity}</span><strong>{catalogMoney(line.subtotalCents)}</strong></div><div className={styles.lineControls}><small>{catalogTax(line.product.taxIncluded)}</small><Quantity product={line.product} quantity={line.pick.quantity} /></div></>}
    </article>)}</div>}
    {summary.lines.length > 0 && <div className={styles.total}><span>{summary.totalLabel}</span><strong>{catalogMoney(summary.knownSubtotalCents)}</strong>{summary.pendingPrice > 0 && <small>{summary.pendingPrice} {summary.pendingPrice === 1 ? "producto requiere" : "productos requieren"} cotización</small>}</div>}
    <div className={styles.cartFooter}><span className={styles.saveState} role="status">{cart.saving ? "Guardando selección…" : cart.error ? "Revisa el guardado de tu selección" : summary.lines.length ? "Selección guardada en tu cuenta" : "Selección privada"}</span>
      {cart.error && <div className={styles.error} role="alert"><p>{cart.error}</p><button type="button" onClick={cart.retry} disabled={cart.busy || cart.saving}>Reintentar</button><button type="button" onClick={cart.restore} disabled={cart.busy || cart.saving}>Recuperar carrito guardado</button></div>}
      {!compact && <button type="button" className={styles.primary} onClick={() => cart.open(true)} disabled={!summary.lines.length || !!summary.unavailable || cart.saving || cart.busy || !!cart.error || !cart.canRequest}>Revisar selección <span aria-hidden="true">→</span></button>}
      {!cart.canRequest && <p className={styles.note}>Tu rol permite seleccionar productos; el envío requiere un usuario autorizado.</p>}
      <p className={styles.note}>Las cantidades respetan la unidad de cada producto. La solicitud pasa a revisión comercial.</p>
    </div>
  </section>;
}
function MobileCartBar() {
  const cart = useShopping(), summary = catalogCartSummary(cart.items, cart.products);
  if (!summary.lines.length) return null;
  return <button type="button" className={styles.mobileBar} onClick={() => cart.open()} aria-label={`Ver carrito: ${summary.quantity} unidades`}><span className={styles.mobileCount}>{summary.quantity}</span><strong>Ver carrito</strong><span>{catalogMoney(summary.knownSubtotalCents)}{summary.pendingPrice > 0 ? " + cotizaciones" : ""}</span></button>;
}
function ShoppingDialog({ mode, orderId, onClose, onReview, onSend }: { mode: "cart" | "review" | null; orderId: string; onClose: () => void; onReview: () => void; onSend: (form: HTMLFormElement) => Promise<void> }) {
  const ref = useRef<HTMLDialogElement>(null), cart = useShopping(), summary = catalogCartSummary(cart.items, cart.products);
  useEffect(() => { if (mode && !ref.current?.open) ref.current?.showModal(); if (!mode && ref.current?.open) ref.current.close(); }, [mode]);
  return <dialog ref={ref} className={styles.dialog} onClose={onClose} onCancel={event => { if (cart.busy) event.preventDefault(); }}>
    <header className={styles.dialogHeader}><div><p>Catálogo de medios</p><h2>{orderId ? "Solicitud registrada" : mode === "review" ? "Revisa tu selección" : "Tu carrito"}</h2></div><button type="button" aria-label="Cerrar carrito" onClick={onClose} disabled={cart.busy}>×</button></header>
    {orderId ? <div className={styles.success}><span aria-hidden="true">✓</span><h3>Tu solicitud está en revisión</h3><p>Consulta sus productos y estado en Órdenes.</p><a className={styles.primary} href={`/campanas?catalog=${encodeURIComponent(orderId)}`}>Ver solicitud →</a><button type="button" className={styles.secondary} onClick={onClose}>Seguir explorando</button></div> : <><CartContents compact />
      {mode === "cart" ? <button type="button" className={styles.primary} onClick={onReview} disabled={!summary.lines.length || !!summary.unavailable || cart.saving || !!cart.error || !cart.canRequest}>Revisar selección →</button> : <form className={styles.requestForm} onSubmit={event => { event.preventDefault(); void onSend(event.currentTarget); }}>
        <label>Nombre de la solicitud<input name="title" required maxLength={120} defaultValue="Selección del catálogo" placeholder="Marca o referencia de la compra" /></label>
        {cart.companies.length > 1 || cart.isAdmin ? <label>Espacio de la solicitud<select name="companyId" defaultValue={cart.companies.length === 1 ? cart.companies[0].id : ""}>{cart.isAdmin && <option value="">Ad Mavericks · cuenta propia</option>}{!cart.isAdmin && <option value="" disabled>Selecciona un espacio</option>}{cart.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label> : <input type="hidden" name="companyId" value={cart.companies[0]?.id ?? ""} />}
        <label>Fecha de inicio deseada <small>Opcional</small><input name="desiredStart" type="date" /></label>
        <label>Indicaciones <small>Opcional</small><textarea name="notes" rows={3} maxLength={2000} placeholder="Fechas, ciudad, marca o detalles de los entregables" /></label>
        <button className={styles.primary} type="submit" disabled={cart.busy || cart.saving || !!cart.error || !!summary.unavailable || !summary.lines.length || !cart.canRequest}>{cart.busy ? "Registrando solicitud…" : "Enviar solicitud →"}</button>
      </form>}</>}
  </dialog>;
}
function CartIcon() { return <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4h2l2.2 11h11.6l2-8H6M8 19h.01M18 19h.01" /><circle cx="8" cy="19" r="1" /><circle cx="18" cy="19" r="1" /></svg>; }
