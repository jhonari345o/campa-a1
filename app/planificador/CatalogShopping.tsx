"use client";
import { DEFAULT_AUDIENCE } from "@/lib/audience-target";
import { PlanDeliveryPreview } from "@/components/PlanDeliveryPreview";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CART_LIMITS, catalogCartSummary, catalogQuoteSignature, changeCatalogQuantity, normalizeCatalogPicks, type CatalogCart, type CatalogPick, type CatalogProduct } from "@/lib/catalog-shopping";
import { catalogReferenceDisclosure } from "@/lib/catalog-rate-display";
import { catalogReplacementOptions, replaceCatalogProduct } from "@/lib/catalog-cart-replacements";
import { radioProductMatchesStation } from "@/lib/account-radio-tariffs";
import { digitalBudgetKey, digitalBudgetProduct, digitalGoalsForPlatform } from "@/lib/digital-budget";
import { formatBudgetInput, parseBudgetInput } from "@/lib/brief-inputs";
import { CalendarDateField } from "@/components/PlanScheduleFields";
import { checkoutCatalog } from "@/lib/catalog-checkout-client";
import { persistCatalogCart, recoverCatalogCart } from "@/lib/catalog-cart-client";
import { cartDraftKey, cartFingerprint, saveCartDraft, recoverCartDraft, clearCartDraft } from "@/lib/catalog-cart-draft";
import styles from "./CatalogShopping.module.css";

export type ShoppingCompany = { id: string; name: string };
type ShoppingState = {
  products: CatalogProduct[]; items: CatalogPick[]; saving: boolean; busy: boolean; error: string;
  clientId:string|null; canRequest: boolean; companies: ShoppingCompany[]; isAdmin: boolean;
  change: (key: string, delta: number) => void; remove: (key: string) => void;
  open: (review?: boolean) => void; restore: () => void; retry: () => void;
  setBudget: (slug: string, goal: string, cents: number) => void;
  replaceProduct: (oldKey: string, newKey: string) => void;
};
const Shopping = createContext<ShoppingState | null>(null);
export const catalogMoney = (cents: number | null) => cents == null ? "Por cotizar" : `$ ${formatBudgetInput(cents / 100)}`;
export const catalogTax = (value: boolean | null) => value === true ? "IVA incluido" : value === false ? "Sin IVA" : "Base fiscal no indicada";
function useShopping() { const value = useContext(Shopping); if (!value) throw new Error("Shopping provider required"); return value; }
const budgetProducts = (picks: CatalogPick[]) => picks.flatMap(pick => { const product = digitalBudgetProduct(pick.productKey); return product ? [product] : []; });

export function CatalogShoppingProvider({ products: initialProducts, cart, companies, canRequest, isAdmin, ownerId = "", children }: {
  products: CatalogProduct[]; cart: CatalogCart; companies: ShoppingCompany[]; canRequest: boolean; isAdmin: boolean; ownerId?:string; children: ReactNode;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(() => [...initialProducts, ...budgetProducts(cart.items)]), [items, setItems] = useState(cart.items);
  const [saving, setSaving] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(cart.error ?? "");
  const [mode, setMode] = useState<"cart" | "review" | null>(null), [orderId, setOrderId] = useState("");
  const [purchaseError,setPurchaseError] = useState("");
  const checkoutInFlight = useRef(false);
  const [notice, setNotice] = useState("");
  const desired = useRef(normalizeCatalogPicks(cart.items)), persisted = useRef(cartFingerprint(cart.items)), version = useRef(cart.version);
  const running = useRef(false), mounted = useRef(true), submission = useRef<string | null>(null);
  const flight = useRef<Promise<boolean> | null>(null), pendingNavigation = useRef("");
  const flush = useRef<() => Promise<boolean>>(async () => true);
  const draftKey = cartDraftKey(ownerId, cart.clientId ?? null);
  function backupSelection() {
    try { return saveCartDraft(sessionStorage,draftKey,version.current,persisted.current,desired.current); } catch { return false; }
  }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setProducts([...initialProducts, ...budgetProducts(desired.current)]); }, [initialProducts]);
  useEffect(() => {
    try {
      const recovered=recoverCartDraft(sessionStorage,draftKey,cart);
      if(recovered){desired.current=recovered;setItems(recovered);setProducts([...initialProducts,...budgetProducts(recovered)]);setNotice("Recuperamos tu selección para que continúes.");void flush.current();}
    } catch { /* The server cart remains authoritative if session storage is unavailable. */ }
    // A client change remounts this provider. Never replay a draft after a live save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  useEffect(() => {
    function beforeNavigation(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.download || link.target && link.target !== "_self") return;
      const destination = new URL(link.href, location.href);
      if (destination.origin !== location.origin || destination.pathname === location.pathname && destination.search === location.search) return;
      if (!running.current && cartFingerprint(desired.current) === persisted.current) return;
      event.preventDefault();
      const href = destination.pathname + destination.search + destination.hash;
      if(backupSelection()) { void flush.current(); router.push(href); return; }
      pendingNavigation.current = href;
      setNotice("Guardando tu selección antes de continuar…");
      void flush.current().then(saved => {
        if (saved && mounted.current && pendingNavigation.current === href) {
          pendingNavigation.current = "";
          router.push(href);
        }
      });
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      if ((running.current || cartFingerprint(desired.current) !== persisted.current) && !backupSelection()) { event.preventDefault(); event.returnValue = ""; }
    }
    document.addEventListener("click", beforeNavigation, true);
    window.addEventListener("beforeunload", beforeUnload);
    return () => { document.removeEventListener("click", beforeNavigation, true); window.removeEventListener("beforeunload", beforeUnload); };
    // Values are read from refs so navigation does not subscribe to every cart edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router,draftKey]);
  function drain(): Promise<boolean> {
    if (flight.current) return flight.current;
    if (cartFingerprint(desired.current) === persisted.current) return Promise.resolve(true);
    running.current = true; setSaving(true); setError("");
    const task = (async () => {
    try {
      while (cartFingerprint(desired.current) !== persisted.current) {
        const snapshot = normalizeCatalogPicks(desired.current);
        const result = await persistCatalogCart(snapshot, version.current,cart.clientId??null);
        if (!result.ok) { if (mounted.current) setError(result.error); return false; }
        if(cartFingerprint(result.cart.items)!==cartFingerprint(snapshot)){if(mounted.current)setError("No pudimos verificar el guardado. Conservamos tu selección para volver a intentar.");return false;}
        version.current = result.cart.version;
        persisted.current = cartFingerprint(result.cart.items);
        if(mounted.current){try{if(cartFingerprint(desired.current)===persisted.current)clearCartDraft(sessionStorage,draftKey);else backupSelection();}catch{/* Keep the server result. */}}
      }
      return true;
    } catch { if (mounted.current) setError("No se pudo guardar. Tu selección sigue aquí; vuelve a intentar."); return false; }
    finally { running.current = false; flight.current = null; if (mounted.current) setSaving(false); }
    })();
    flight.current = task;
    return task;
  }
  flush.current = drain;
  function replace(next: CatalogPick[], nextProducts = products) {
    if (checkoutInFlight.current) return;
    try { next=normalizeCatalogPicks(next);catalogCartSummary(next, nextProducts); } catch { setError("La selección supera el límite permitido. Reduce los productos o cantidades."); return; }
    desired.current = next; setItems(next); setOrderId(""); setPurchaseError(""); submission.current = null; backupSelection();void drain();
  }
  function setBudget(slug: string, goal: string, cents: number) {
    if ((!canRequest && !isAdmin) || busy) return;
    try {
      const key = digitalBudgetKey(slug, goal, cents), product = digitalBudgetProduct(key)!;
      const nextProducts = [...products.filter(row => row.key !== key), product];
      const next = [...desired.current.filter(pick => {
        const existing = digitalBudgetProduct(pick.productKey);
        return !existing || existing.source.platformSlug !== slug || existing.source.digitalGoal !== goal;
      }), { productKey: key, quantity: 1 }];
      catalogCartSummary(next, nextProducts);
      setProducts(nextProducts); replace(next, nextProducts); setNotice(`Presupuesto ${catalogMoney(cents)} · ${product.provider} · ${product.format}`);
    } catch { setError("Revisa el objetivo y el presupuesto de la campaña."); }
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
      const result = await recoverCatalogCart();
      if (result.error) { setError(result.error); return; }
      if((result.clientId??null)!==(cart.clientId??null)){setError("El cliente cambió. Recarga la página para usar su catálogo.");return;}
      version.current = result.version; desired.current = result.items;
      persisted.current = cartFingerprint(result.items); setItems(result.items); setProducts([...initialProducts, ...budgetProducts(result.items)]); setError(""); submission.current = null;clearCartDraft(sessionStorage,draftKey);
    } catch { setError("No se pudo recuperar el carrito. Tu selección sigue aquí."); }
    finally { setSaving(false); }
  }
  async function send(form: HTMLFormElement) {
    if (checkoutInFlight.current || running.current || saving || error || !canRequest) return;
    checkoutInFlight.current = true;
    const data = new FormData(form);
    setBusy(true); setPurchaseError("");
    submission.current ??= crypto.randomUUID();
    try {
      const result = await checkoutCatalog({
        clientId:cart.clientId??null,requestId: submission.current, version: version.current, quote: catalogQuoteSignature(items, products),
        companyId: String(data.get("companyId") ?? "") || null, title: String(data.get("title") ?? ""),
        desiredStart: String(data.get("desiredStart") ?? ""), notes: [String(data.get("notes") ?? ""), data.get("desiredEnd") ? `Fin de campaña: ${String(data.get("desiredEnd"))}` : ""].filter(Boolean).join("\n").slice(0,2000),
      });
      if (!result.ok) {
        if (result.products) setProducts(old => { const updated = new Map(old.map(p => [p.key,p])); for (const item of items) updated.delete(item.productKey); for (const p of result.products!) updated.set(p.key,p); return [...updated.values()]; });
        if (result.refreshCart) setError(result.error); else setPurchaseError(result.error);
        return;
      }
      version.current = result.cart.version; desired.current = result.cart.items;
      persisted.current = cartFingerprint(result.cart.items); setItems(result.cart.items); setOrderId(result.id);setNotice("Compra recibida. Puedes consultarla en Órdenes.");try { clearCartDraft(sessionStorage,draftKey); } catch { /* The order is already registered. */ }
    } catch { setPurchaseError("No recibimos la respuesta. Vuelve a pulsar Comprar Medios: tu compra no se duplicará."); }
    finally { checkoutInFlight.current = false; setBusy(false); }
  }
  function replaceProduct(oldKey: string, newKey: string) {
    if (busy || (!canRequest && !isAdmin)) return;
    try { replace(replaceCatalogProduct(desired.current, oldKey, newKey, products)); setNotice("Formato actualizado. Conservamos tu cantidad de cuñas."); }
    catch { setError("No se pudo actualizar el formato. Revisa la cantidad y vuelve a elegir."); }
  }
  const value: ShoppingState = { clientId:cart.clientId??null,products, items, saving, busy, error, companies, canRequest, isAdmin, change, setBudget, replaceProduct, remove: key => replace(desired.current.filter(p => p.productKey !== key)), open: review => { setOrderId(""); setMode(review ? "review" : "cart"); }, restore, retry: () => void drain() };
  return <Shopping.Provider value={value}>{children}<span className="sr-only" role="status">{notice}</span>
    <ShoppingDialog mode={mode} orderId={orderId} purchaseError={purchaseError} onClose={() => setMode(null)} onReview={() => setMode("review")} onSend={send} />
  </Shopping.Provider>;
}
export function CatalogShoppingLayout({ active, children }: { active: boolean; children: ReactNode }) {
  return <div className={active ? styles.layout : ""}><div className={styles.content}>{children}</div>{active && <><aside className={styles.aside}><CartContents /></aside><MobileCartBar /></>}</div>;
}
export function CatalogProductPicker({ product, emptyPriceLabel = "Por cotizar" }: { product: CatalogProduct; emptyPriceLabel?: string }) {
  const cart = useShopping(), quantity = cart.items.find(p => p.productKey === product.key)?.quantity ?? 0;
  const amount = product.priceCents ?? product.referencePriceCents ?? null;
  const priceLabel = amount == null ? emptyPriceLabel : catalogMoney(amount);
  if (!cart.canRequest && !cart.isAdmin) return <div className={styles.product}><div className={styles.add}><span className={styles.productTitle}>{product.format}<small>{product.unit}</small></span><strong>{priceLabel}</strong><small>{catalogTax(product.taxIncluded)}</small></div><CatalogRateReference product={product}/></div>;
  return <div className={`${styles.product} ${quantity ? styles.selected : ""}`}>
    <button type="button" className={styles.add} disabled={cart.busy || quantity >= CART_LIMITS.quantity} aria-label={`Agregar ${product.name} · ${product.format} · ${product.provider} · ${product.unit}`} onClick={() => cart.change(product.key, 1)}>
      <span className={styles.productTitle}>{product.format}{product.kind === "ooh" && <small>{product.unit}</small>}</span>
      <strong>{priceLabel}</strong>
      <span className={styles.addMark} aria-hidden="true">{quantity ? quantity : "+"}</span>
      <small>{catalogTax(product.taxIncluded)}</small>
    </button>
    <CatalogRateReference product={product}/>
    {!!quantity && <div className={styles.selectedRow}><span>En tu carrito</span><Quantity product={product} quantity={quantity} /></div>}
  </div>;
}
export function CatalogProfileProducts({ profileId }: { profileId: string }) {
  const { products } = useShopping(), rows = products.filter(p => p.source.profileId === profileId);
  return rows.length ? <>
    <div className={styles.profileProducts}>{rows.slice(0, 4).map(p => <CatalogProductPicker product={p} key={p.key} />)}</div>
    {rows.length > 4 && <details className={styles.moreProducts}>
      <summary>Ver {rows.length - 4} formatos más</summary>
      <div className={styles.profileProducts}>{rows.slice(4).map(p => <CatalogProductPicker product={p} key={p.key} />)}</div>
    </details>}
  </> : <p className="mt-3 text-xs text-white/70">Sin formatos publicados.</p>;
}
export function CatalogOohProducts({ assetId, quotationOnly = false }: { assetId: string; quotationOnly?: boolean }) {
  const { products } = useShopping();
  return <div className={styles.oohProducts}>{quotationOnly && <p className="text-sm font-bold leading-relaxed text-forest">Revisar disponibilidad, solo bajo cotización previa.</p>}{products.filter(p => p.source.assetId === assetId).map(p => <CatalogProductPicker product={p} key={p.key} emptyPriceLabel={quotationOnly ? "Solicitar cotización" : undefined} />)}</div>;
}
export function CatalogPrice({ productKey, showReference = true }: { productKey: string; showReference?: boolean }) {
  const { products } = useShopping(), product = products.find(p => p.key === productKey);
  return <><strong>{catalogMoney(product?.priceCents ?? product?.referencePriceCents ?? null)}</strong><small className="block text-xs text-muted">{product ? catalogTax(product.taxIncluded) : ""}</small>{product && showReference && <CatalogRateReference product={product}/>}</>;
}
export function CatalogRateReference({ product, showAmount = false }: { product: CatalogProduct; showAmount?: boolean }) {
  const reference = catalogReferenceDisclosure(product);
  if (!reference) return null;
  return <div className="mt-3 text-xs leading-relaxed"><span className="inline-block rounded-xl border border-border bg-white px-3 py-1 font-bold text-forest">{reference.label}{showAmount ? ` · ${catalogMoney(reference.priceCents)}` : ""}</span><p className="mt-2 text-muted">{reference.confirmation}</p></div>;
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
  const rows = products.filter(p => p.kind === "radio" && !p.source.workspaceProductId && p.source.stationId === stationId && p.source.tariffId === tariffId && (rateIndex == null || p.source.rateIndex === rateIndex));
  const [seconds, setSeconds] = useState(30);
  const product = rows.find(p => p.source.seconds === seconds) ?? rows[0];
  return product ? <div className={styles.radioProduct}>{rows.length > 1 && <label>Duración de la cuña<select value={product.source.seconds} onChange={e => setSeconds(Number(e.target.value))}>{rows.map(p => <option key={p.key} value={p.source.seconds}>{p.source.seconds} segundos</option>)}</select></label>}<p>{product.unit}</p><CatalogPrice productKey={product.key}/><CatalogInlineProduct productKey={product.key} label="Cuñas"/></div> : null;
}
export function CatalogRadioTariffs({ stationId, stationName, regionKeys, children }: { stationId: string; stationName: string; regionKeys: string[]; children: ReactNode }) {
  const cart = useShopping();
  const products = cart.products.filter(p => radioProductMatchesStation(p, {id:stationId,name:stationName,regionKeys}));
  // Approved catalog defaults replace legacy tariff IDs in the admin detail too.
  if (cart.isAdmin && !products.some(p => p.source.defaultPrice && p.source.standingPrice)) return children;
  if (!products.length) return <p className="text-sm text-muted">Solicita la tarifa de esta emisora para tu cuenta.</p>;
  return <div className="my-5"><h5 className="mb-3 text-lg font-black">{cart.isAdmin ? "Tarifas de la emisora" : "Tarifa de tu cuenta"}</h5><CatalogAccountRateCard products={products}/></div>;
}
export function CatalogAccountRateCard({ products }: { products: CatalogProduct[] }) {
  const [selected, setSelected] = useState(products[0].key);
  const p = products.find(p => p.key === selected) ?? products[0];
  return <article className="rounded-2xl border border-border bg-fog p-5"><p className="text-xs font-bold text-muted">{p.provider}</p><h3 className="mt-2 text-lg font-black">{p.name}</h3>{products.length > 1 && <label className="mt-4 block text-sm font-bold">Programa o formato<select className="mt-2 w-full rounded-xl border border-border bg-white p-3 font-normal" value={p.key} onChange={e => setSelected(e.target.value)} aria-label={`Programa o formato de ${p.provider}`}>{products.map(option => <option key={option.key} value={option.key}>{option.name} · {option.unit}{option.location ? ` · ${option.location}` : ""}</option>)}</select></label>}<p className="mt-2 text-sm">{p.format}</p><strong className="mt-5 block text-2xl">{p.priceCents != null || p.referencePriceCents != null ? catalogMoney(p.priceCents ?? p.referencePriceCents ?? null) : "Consultar"}</strong><p className="mt-1 text-sm text-muted">{p.unit}</p><CatalogRateReference product={p}/><p className="mt-4 text-xs text-muted">{p.referenceLabel || (p.validFrom && p.validTo ? `${p.validFrom} – ${p.validTo}` : p.reference)}</p>{p.location && <p className="mt-2 text-sm">{p.location}</p>}{p.conditions && <p className="mt-3 text-xs leading-relaxed text-muted">{p.conditions}</p>}<div className="mt-4"><CatalogInlineProduct productKey={p.key}/></div></article>;
}
export function CatalogWorkspaceFormats({stationId,publicationId}:{stationId?:string;publicationId?:string}){
 const {products}=useShopping(),rows=products.filter(p=>p.source.workspaceProductId&&((stationId&&p.source.stationId===stationId)||(publicationId&&p.source.publicationId===publicationId)));
 if(!rows.length)return null;
 return <section className="my-5 grid gap-4"><h5 className="text-lg font-black">Formatos de tu cuenta</h5>{rows.map(p=><article key={p.key} className="rounded-xl border border-border bg-fog p-4"><h6 className="font-black">{p.name}</h6><p className="mt-2 text-sm">{p.format} · {p.location}</p><p className="mt-3 text-xl font-black">{catalogMoney(p.priceCents??p.referencePriceCents??null)}</p><p className="text-sm text-muted">{p.unit}</p><CatalogRateReference product={p}/><p className="mt-2 text-xs text-muted">{p.referenceLabel||(p.validFrom&&p.validTo?`${p.validFrom} – ${p.validTo}`:p.reference)}</p>{p.conditions&&<p className="mt-2 text-sm">{p.conditions}</p>}<CatalogInlineProduct productKey={p.key}/></article>)}</section>;
}
export function CatalogPressQuote({ id }: { id: string }) { return <CatalogInlineProduct productKey={`press:${id}:quote`} label="Inserciones"/>; }
export function CatalogDigitalBudget({ slug }: { slug: string }) {
  const cart = useShopping(), goals = digitalGoalsForPlatform(slug);
  const [goal, setGoal] = useState(""), [display, setDisplay] = useState("");
  const amount = parseBudgetInput(display), invalid = !!display.trim() && amount == null;
  const selected = cart.items.map(pick => ({ pick, product: cart.products.find(row => row.key === pick.productKey) })).filter(row => row.product?.source.platformSlug === slug);
  if (!cart.canRequest && !cart.isAdmin) return null;
  return <div className={styles.digitalBudget}>
    <label>Objetivo de la pauta<select value={goal} onChange={event => setGoal(event.target.value)}><option value="" disabled>Selecciona un objetivo</option>{goals.map(goal => <option key={goal.id} value={goal.id}>{goal.label}</option>)}</select></label>
    <label>Presupuesto (USD)<span className={styles.moneyInput}><span aria-hidden="true">$</span><input type="text" inputMode="decimal" maxLength={22} value={display} placeholder="0,00" aria-label={`Presupuesto de ${slug}`} aria-invalid={invalid ? true : undefined} onChange={event => setDisplay(event.target.value)} onBlur={() => { if (amount != null) setDisplay(formatBudgetInput(amount)); }}/></span></label>
    {invalid && <p role="alert">Usa punto para miles y coma para centavos.</p>}
    <button type="button" disabled={cart.busy || !goal || amount == null} onClick={() => { if (amount != null) cart.setBudget(slug, goal, Math.round(amount * 100)); }}>Agregar presupuesto <span aria-hidden="true">+</span></button>
    {!!selected.length && <ul aria-label={`Presupuestos seleccionados de ${slug}`}>{selected.map(({ pick, product }) => <li key={pick.productKey}>{product!.format} <strong>{catalogMoney((product!.priceCents ?? 0) * pick.quantity)}</strong></li>)}</ul>}
  </div>;
}
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
      <div className={styles.lineHeading}>{line.product?.image && <Image src={line.product.image} alt="" width={48} height={48} unoptimized className={styles.thumbnail} />}<div><strong>{line.product?.provider ?? catalogReplacementOptions(line.pick.productKey, cart.products)[0]?.provider ?? "Producto no disponible"}</strong><p>{line.product?.name}</p><small>{line.product?.format}{line.product?.kind === "ooh" ? ` · ${line.product.unit}` : ""}</small></div><button type="button" disabled={cart.busy} onClick={() => cart.remove(line.pick.productKey)} aria-label={`Quitar ${line.product?.name ?? "producto"} de ${line.product?.provider ?? "catálogo"}`}>×</button></div>
      {!line.product && <CartFormatReplacement pick={line.pick}/>}
      {line.product && <><div className={styles.linePrice}><span>{digitalBudgetProduct(line.product.key) ? "Presupuesto de campaña" : `${catalogMoney(line.product.priceCents ?? line.product.referencePriceCents ?? null)} × ${line.pick.quantity}`}</span><strong>{catalogMoney(line.subtotalCents ?? (line.product.referencePriceCents == null ? null : line.product.referencePriceCents * line.pick.quantity))}</strong></div><div className={styles.lineControls}><small>{catalogTax(line.product.taxIncluded)}</small>{!digitalBudgetProduct(line.product.key) && <Quantity product={line.product} quantity={line.pick.quantity} />}</div></>}
      {line.product && <CatalogRateReference product={line.product} showAmount/>}
    </article>)}</div>}
    {summary.lines.length > 0 && <div className={styles.total}><span>{summary.pendingPrice && summary.estimatedSubtotalCents != null ? "Total estimado" : summary.totalLabel}</span><strong>{catalogMoney(summary.estimatedSubtotalCents ?? summary.knownSubtotalCents)}</strong>{summary.pendingPrice > 0 && summary.estimatedSubtotalCents == null && <small>{summary.pendingPrice} {summary.pendingPrice === 1 ? "producto requiere" : "productos requieren"} cotización</small>}</div>}
    <div className={styles.cartFooter}><span className={styles.saveState} role="status">{cart.saving ? "Guardando selección…" : cart.error ? "Revisa el guardado de tu selección" : summary.lines.length ? "Selección guardada en tu cuenta" : "Selección privada"}</span>
      {cart.error && <div className={styles.error} role="alert"><p>{cart.error}</p><button type="button" onClick={cart.retry} disabled={cart.busy || cart.saving}>Reintentar</button><button type="button" onClick={cart.restore} disabled={cart.busy || cart.saving}>Recuperar carrito guardado</button></div>}
      {!compact && <button type="button" className={styles.primary} onClick={() => cart.open(true)} disabled={!summary.lines.length || cart.busy || !cart.canRequest}>Revisar selección <span aria-hidden="true">→</span></button>}
      {!cart.canRequest && <p className={styles.note}>Tu rol permite seleccionar productos; el envío requiere un usuario autorizado.</p>}
      <p className={styles.note}>Las cantidades respetan la unidad de cada producto. </p>
    </div>
  </section>;
}
function CartFormatReplacement({ pick }: { pick: CatalogPick }) {
  const cart = useShopping(), options = catalogReplacementOptions(pick.productKey, cart.products);
  if (!options.length) return null;
  return <label className={styles.replacement}>Elige el formato de tus {pick.quantity} cuñas
    <select value="" disabled={cart.busy || (!cart.canRequest && !cart.isAdmin)} onChange={event => cart.replaceProduct(pick.productKey, event.target.value)}>
      <option value="" disabled>Seleccionar duración y horario</option>
      {options.map(product => <option key={product.key} value={product.key}>{product.name} · {product.source.seconds} s · {catalogMoney(product.priceCents)}</option>)}
    </select>
  </label>;
}
function MobileCartBar() {
  const cart = useShopping(), summary = catalogCartSummary(cart.items, cart.products);
  if (!summary.lines.length) return null;
  return <button type="button" className={styles.mobileBar} onClick={() => cart.open()} aria-label={`Ver carrito: ${summary.quantity} unidades`}><span className={styles.mobileCount}>{summary.quantity}</span><strong>Ver carrito</strong><span>{catalogMoney(summary.estimatedSubtotalCents ?? summary.knownSubtotalCents)}{summary.pendingPrice > 0 ? summary.estimatedSubtotalCents == null ? " + cotizaciones" : " est." : ""}</span></button>;
}
function ShoppingDialog({ mode, orderId, purchaseError, onClose, onReview, onSend }: { purchaseError:string; mode: "cart" | "review" | null; orderId: string; onClose: () => void; onReview: () => void; onSend: (form: HTMLFormElement) => Promise<void> }) {
  const ref = useRef<HTMLDialogElement>(null), cart = useShopping();
  const summary = useMemo(() => mode ? catalogCartSummary(cart.items, cart.products) : null, [mode, cart.items, cart.products]);
  const [startDate,setStartDate]=useState(""), [endDate,setEndDate]=useState("");
  useEffect(() => { if (mode && !ref.current?.open) ref.current?.showModal(); if (!mode && ref.current?.open) ref.current.close(); }, [mode]);
  return <dialog ref={ref} aria-labelledby="catalog-cart-title" className={styles.dialog} onClose={onClose}>
    {mode && summary && <><header className={styles.dialogHeader}><div><p>Catálogo de medios</p><h2 id="catalog-cart-title">{orderId ? "Compra recibida" : mode === "review" ? "Revisa tu selección" : "Tu carrito"}</h2></div><button type="button" aria-label="Cerrar carrito" onClick={onClose}>×</button></header>
    {orderId ? <div className={styles.success}><span aria-hidden="true">✓</span><div role="status"><h3>Tu compra está siendo procesada</h3><p>Nuestro equipo coordinará la pauta con los medios y en breve te enviará un correo de confirmación.</p></div><a className={styles.primary} href={`/campanas?catalog=${encodeURIComponent(orderId)}`}>Ver mi compra →</a><button type="button" className={styles.secondary} onClick={onClose}>Seguir explorando</button></div> : <><CartContents compact />{mode && <CartDeliveryProjection startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate}/>}
      {mode === "cart" ? <button type="button" className={styles.primary} onClick={onReview} disabled={!summary.lines.length || cart.busy || !cart.canRequest}>Revisar selección →</button> : <form className={styles.requestForm} onSubmit={event => { event.preventDefault(); void onSend(event.currentTarget); }}>
        <label>Nombre de la compra<input name="title" required maxLength={120} defaultValue="Selección del catálogo" placeholder="Marca o referencia de la compra" /></label>
        {cart.companies.length > 1 || cart.isAdmin ? <label>Espacio de la compra<select name="companyId" defaultValue={cart.companies.length === 1 ? cart.companies[0].id : ""}>{cart.isAdmin && <option value="">Ad Mavericks · cuenta propia</option>}{!cart.isAdmin && <option value="" disabled>Selecciona un espacio</option>}{cart.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label> : <input type="hidden" name="companyId" value={cart.companies[0]?.id ?? ""} />}
        <input type="hidden" name="desiredStart" value={startDate}/>
        <input type="hidden" name="desiredEnd" value={endDate}/>
        <label>Indicaciones <small>Opcional</small><textarea name="notes" rows={3} maxLength={2000} placeholder="Fechas, ciudad, marca o detalles de los entregables" /></label>
        {purchaseError && <p className={styles.error} role="alert">{purchaseError}</p>}
        <button className={styles.primary} type="submit" disabled={cart.busy || cart.saving || !!cart.error || !!summary.unavailable || !summary.lines.length || !cart.canRequest}>{cart.busy ? "Registrando compra…" : "Comprar Medios →"}</button>
      </form>}</>}</>}
  </dialog>;
}
function CartDeliveryProjection({startDate,endDate,setStartDate,setEndDate}:{startDate:string;endDate:string;setStartDate:(v:string)=>void;setEndDate:(v:string)=>void}) {
  const cart=useShopping();
  const [geography,setGeography]=useState("Guayaquil, Quito");
  if(!cart.items.length)return null;
  return <section className={styles.delivery} aria-label="Fechas y alcance de la compra"><h3>Fechas y alcance</h3><div className={styles.deliveryFields}>
    <CalendarDateField name="reachStart" label="Inicio de campaña" value={startDate} onChange={setStartDate} max={endDate||undefined} required={false}/>
    <CalendarDateField name="reachEnd" label="Fin de campaña" value={endDate} onChange={setEndDate} min={startDate||undefined} required={false}/>
    <label>Cobertura<select value={geography} onChange={e=>setGeography(e.target.value)}>{["Guayaquil, Quito","Guayaquil","Quito"].map(city=><option key={city}>{city}</option>)}</select></label>
    <p>Público: personas de 18 años o más.</p>
  </div>{startDate&&endDate&&<PlanDeliveryPreview request={{brief:{startDate,endDate,geography,...DEFAULT_AUDIENCE,audienceType:"B2C"},picks:cart.items,clientId:cart.clientId}}/>}</section>;
}
function CartIcon() { return <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4h2l2.2 11h11.6l2-8H6M8 19h.01M18 19h.01" /><circle cx="8" cy="19" r="1" /><circle cx="18" cy="19" r="1" /></svg>; }
