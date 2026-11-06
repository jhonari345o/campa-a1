import { normalizeCatalogPicks, type CatalogCart, type CatalogPick } from "./catalog-shopping";

/** Canonical order is essential: digital budgets can be appended after radio/TV. */
export const cartFingerprint = (items: CatalogPick[]) => JSON.stringify(normalizeCatalogPicks(items));
const TWO_HOURS = 2 * 60 * 60 * 1000;
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function cartDraftKey(ownerId: string, clientId: string | null): string | null {
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  return uuid.test(ownerId) && (clientId === null || uuid.test(clientId)) ? `amo-cart-v1:${ownerId}:${clientId ?? "account"}` : null;
}
/** Session-only recovery, scoped to the authenticated owner and selected client.
 * Only product identifiers and quantities are stored; prices remain server-owned. */
export function saveCartDraft(storage: DraftStorage, key: string | null, baseVersion: number, baseFingerprint: string, items: CatalogPick[], now = Date.now()): boolean {
  if (!key) return false;
  try {
    const clean = normalizeCatalogPicks(items);
    storage.setItem(key, JSON.stringify({version:1,baseVersion,baseFingerprint,items:clean,expiresAt:now+TWO_HOURS}));
    return true;
  } catch { return false; }
}
export function recoverCartDraft(storage: DraftStorage, key: string | null, server: CatalogCart, now = Date.now()): CatalogPick[] | null {
  if (!key) return null;
  try {
    const raw=storage.getItem(key); if(!raw || raw.length>300000)return null;
    const draft=JSON.parse(raw);
    if(draft.version!==1||!Number.isFinite(draft.expiresAt)||draft.expiresAt<=now||draft.expiresAt>now+TWO_HOURS||!Number.isSafeInteger(draft.baseVersion)||draft.baseVersion<0)return null;
    const items=normalizeCatalogPicks(draft.items), current=cartFingerprint(server.items);
    if(current===cartFingerprint(items)){storage.removeItem(key);return null;}
    // Never overwrite another tab's new selection or resurrect a completed order.
    return server.version===draft.baseVersion&&current===draft.baseFingerprint?items:null;
  } catch { return null; }
}
export function clearCartDraft(storage: DraftStorage, key: string | null) {
  try { if(key)storage.removeItem(key); } catch { /* Storage can be unavailable. */ }
}
