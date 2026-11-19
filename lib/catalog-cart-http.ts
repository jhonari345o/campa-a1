import { normalizeCatalogPicks, type CatalogCart, type CatalogPick } from "./catalog-shopping";

export type CartSaveResult = { ok: true; cart: CatalogCart } | { ok: false; error: string; cart?: CatalogCart };
type CartStore = {
  authenticated: () => Promise<boolean>;
  load: () => Promise<CatalogCart>;
  save: (items: CatalogPick[], version: number, clientId: string | null) => Promise<CartSaveResult>;
};
const MAX_BODY_BYTES = 256 * 1024;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "private, no-store", "vary": "Cookie" } });

/** A stable URL lets an already-open catalogue save after a new deployment.
 * The authenticated store still enforces tenant scope and optimistic versions. */
export async function handleCatalogCart(request: Request, store: CartStore, siteUrl?: string): Promise<Response> {
  if (!["GET", "POST"].includes(request.method)) return json({ ok: false, error: "Método no permitido." }, 405);
  const origin = request.headers.get("origin");
  const allowed = new Set([new URL(request.url).origin]);
  try { if (siteUrl) allowed.add(new URL(siteUrl).origin); } catch { /* Ignore invalid optional configuration. */ }
  if (request.headers.get("sec-fetch-site") === "cross-site" || origin && !allowed.has(origin) || request.method === "POST" && !origin) {
    return json({ ok: false, error: "Origen no permitido." }, 403);
  }
  try {
    if (!await store.authenticated()) return json({ ok: false, error: "Inicia sesión para recuperar tu carrito." }, 401);
    if (request.method === "GET") {
      const cart = await store.load();
      return json(cart, cart.error ? 503 : 200);
    }
    if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
      return json({ ok: false, error: "Tipo de contenido no admitido." }, 415);
    }
    if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return json({ ok: false, error: "La selección es demasiado grande." }, 413);
    // Enforce the actual streamed size, including requests without Content-Length.
    const reader = request.body?.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return json({ ok: false, error: "La selección es demasiado grande." }, 413); }
      chunks.push(value);
    }
    let items: CatalogPick[], version: number, clientId: string | null;
    try {
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const input = JSON.parse(new TextDecoder().decode(bytes));
      if (!input || typeof input !== "object" || Array.isArray(input)
        || Object.keys(input).some(k => !["items", "expectedVersion", "expectedClientId"].includes(k))
        || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0
        || !(input.expectedClientId === null || typeof input.expectedClientId === "string" && uuid.test(input.expectedClientId))) throw new Error("INVALID_CART");
      items = normalizeCatalogPicks(input.items); version = input.expectedVersion; clientId = input.expectedClientId;
    } catch { return json({ ok: false, error: "Revisa los productos y las cantidades del carrito." }, 400); }
    const result = await store.save(items, version, clientId);
    return json(result, result.ok ? 200 : result.cart ? 409 : 400);
  } catch { return json({ ok: false, error: "No se pudo guardar el carrito. Tu selección sigue aquí; vuelve a intentar." }, 503); }
}
