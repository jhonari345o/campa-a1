import { priceCatalogProducts } from "./catalog-access-server";
import { getBroadcastCatalog } from "./broadcast-server";
import { getRadioDirectory } from "./radio-directory-server";
import { getPressCatalog } from "./press-server";
import "server-only";
import { createClient } from "./supabase/server";
import { getInfluencerCatalog } from "./media-workspace";
import { getOohCatalog } from "./ooh-server";
import { catalogProducts, normalizeCatalogPicks, type CatalogCart } from "./catalog-shopping";

export async function readCatalogCart(): Promise<CatalogCart> {
  const db = await createClient();
  const { data, error } = await db.rpc("load_catalog_cart");
  if (error) return { version: 0, items: [], error: "El carrito no está disponible en este momento." };
  try { return { version: Number(data?.version ?? 0), items: normalizeCatalogPicks(data?.items ?? []), expiresAt: data?.expiresAt,clientId:data?.clientId??null }; }
  catch { return { version: 0, items: [], error: "No se pudo recuperar la selección guardada." }; }
}
export async function readShoppingProducts(items: { productKey: string }[]) {
  const [profiles, ooh, broadcast, radio, press] = await Promise.all([
    items.some(i => i.productKey.startsWith("creator:")) ? getInfluencerCatalog() : Promise.resolve([]),
    items.some(i => i.productKey.startsWith("ooh:")) ? getOohCatalog() : Promise.resolve({ assets: [] }),
    items.some(i => i.productKey.startsWith("tv:")) ? getBroadcastCatalog() : Promise.resolve({ sources: [], tv: [], radio: [] }),
    items.some(i => i.productKey.startsWith("radio:")) ? getRadioDirectory() : Promise.resolve({ stations: [] }),
    items.some(i => i.productKey.startsWith("press:")) ? getPressCatalog() : Promise.resolve({ entries: [] }),
  ]);
  if ("error" in ooh && ooh.error) throw new Error("CATALOG_UNAVAILABLE");
  return priceCatalogProducts(catalogProducts(profiles, ooh, { broadcast, radio, press }));
}
export type OohPurchaseReference = {
  id: string; provider_slug: string; asset_id: string | null; location: string; format: string;
  period_start: string | null; period_end: string | null; invoice_number: string; invoice_date: string | null;
  paid_at: string | null; purchase_net_usd: number | null; paid_usd: number | null;
  unit_price_usd: number | null; unit: string | null; tax_label: string;
  payment_status: "verified" | "partial" | "invoiced"; scope_note: string;
};
export async function readOohPurchaseReferences(): Promise<OohPurchaseReference[]> {
  const db = await createClient();
  const { data, error } = await db.from("ooh_purchase_references").select("id,provider_slug,asset_id,location,format,period_start,period_end,invoice_number,invoice_date,paid_at,purchase_net_usd,paid_usd,unit_price_usd,unit,tax_label,payment_status,scope_note").order("paid_at", { ascending: false }).limit(500);
  return error ? [] : (data ?? []) as OohPurchaseReference[];
}
