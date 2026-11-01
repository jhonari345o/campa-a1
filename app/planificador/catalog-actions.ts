"use server";
import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { getMyCompanies } from "@/lib/company";
import { canWorkspaceRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalCatalogOrder, catalogQuoteSignature, normalizeCatalogPicks, type CatalogCart, type CatalogProduct } from "@/lib/catalog-shopping";
import { readCatalogCart, readShoppingProducts } from "@/lib/catalog-shopping-server";
import { validDate } from "@/lib/broadcast-catalog";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export async function loadCatalogSelection() { return readCatalogCart(); }
export async function saveCatalogSelection(items: unknown, expectedVersion: number): Promise<{ ok: true; cart: CatalogCart } | { ok: false; error: string; cart?: CatalogCart }> {
  try {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new Error("INVALID_CART");
    const clean = normalizeCatalogPicks(items), db = await createClient();
    const { data, error } = await db.rpc("save_catalog_cart", { p_expected_version: expectedVersion, p_items: clean });
    if (error || !data) return { ok: false, error: "No se pudo guardar el carrito. Tu selección sigue aquí; vuelve a intentar." };
    const cart = { version: Number(data.version), items: normalizeCatalogPicks(data.items), expiresAt: data.expiresAt };
    return data.ok ? { ok: true, cart } : { ok: false, cart, error: data.code === "expired" ? "El carrito venció tras dos horas sin cambios. Recupera la selección actual para continuar." : "El carrito cambió en otra pestaña. Recupera la versión guardada antes de continuar." };
  } catch { return { ok: false, error: "Revisa los productos y las cantidades del carrito." }; }
}
export type CatalogRequestResult = { ok: true; id: string; cart: CatalogCart } | { ok: false; error: string; products?: CatalogProduct[]; refreshCart?: boolean };
export async function submitCatalogSelection(input: { requestId: string; version: number; quote: string; companyId: string | null; title: string; desiredStart: string; notes: string }): Promise<CatalogRequestResult> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, error: "Inicia sesión para enviar la solicitud." };
  if (!input || !uuid.test(input.requestId) || !Number.isSafeInteger(input.version) || input.version < 0 || typeof input.quote !== "string" || input.quote.length > 200_000 || typeof input.title !== "string" || !input.title.trim() || input.title.length > 120 || typeof input.notes !== "string" || input.notes.length > 2000 || typeof input.desiredStart !== "string" || (input.desiredStart && !validDate(input.desiredStart)) || (input.companyId != null && !uuid.test(input.companyId))) return { ok: false, error: "Revisa los datos de la solicitud." };
  const companies = await getMyCompanies(profile.id);
  if (!profile.is_platform_admin && !companies.some(c => c.id === input.companyId && c.status === "activa" && canWorkspaceRole(c, "campaign:create"))) return { ok: false, error: "Tu rol no permite solicitar productos en este espacio." };
  // Idempotent retries remain valid after the cart has been cleared by a successful request.
  const db = await createClient();
  const { data: previous } = await db.from("catalog_orders").select("id").eq("owner_id", profile.id).eq("request_id", input.requestId).maybeSingle();
  if (previous) return { ok: true, id: previous.id, cart: await readCatalogCart() };
  try {
    const cart = await readCatalogCart();
    if (cart.error || cart.version !== input.version) return { ok: false, refreshCart: true, error: "El carrito cambió. Recupera la selección actual antes de enviarla." };
    const products = await readShoppingProducts(cart.items);
    if (catalogQuoteSignature(cart.items, products) !== input.quote) return { ok: false, products, error: "El catálogo cambió. Revisa los productos y precios actualizados antes de volver a enviar." };
    const order = canonicalCatalogOrder(cart.items, products);
    const { data, error } = await createAdminClient().rpc("submit_catalog_request", {
      p_actor: profile.id, p_company: input.companyId, p_expected_version: cart.version,
      p_request_id: input.requestId, p_title: input.title.trim(), p_desired_start: input.desiredStart || null,
      p_notes: input.notes.trim(), p_items: order.items,
    });
    if (error || !data?.id) return { ok: false, refreshCart: /CART_CHANGED/.test(error?.message ?? ""), error: /QUOTE_CHANGED/.test(error?.message ?? "") ? "Una tarifa cambió durante la revisión. Actualiza el catálogo y vuelve a revisar." : "No se pudo registrar la solicitud. El carrito conserva tu selección." };
    revalidatePath("/campanas");
    return { ok: true, id: String(data.id), cart: await readCatalogCart() };
  } catch { return { ok: false, error: "No se pudo validar el catálogo. Vuelve a intentar en unos momentos." }; }
}
