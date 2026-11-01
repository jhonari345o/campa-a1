import "server-only";
import { catalogAccess } from "./catalog-access-server";
import { parseOohAsset, type OohCatalog } from "@/lib/ooh-catalog";

export async function getOohCatalog(): Promise<OohCatalog> {
  try {
    const { db, isAdmin } = await catalogAccess();
    const assets: OohCatalog["assets"] = [];
    for (let from = 0; ; from += 500) {
      const { data, error } = await db.from("ooh_catalog_assets").select("id,provider_slug,provinces,details,photo_path").eq("active", true).order("id").range(from, from + 499);
      if (error) throw error;
      for (const row of data ?? []) { const asset = parseOohAsset(row); if (asset) assets.push(isAdmin ? asset : {...asset, reference:"", taxLabel:"", rates:asset.rates.map(r=>({...r,amount:null}))}); }
      if (!data || data.length < 500) break;
    }
    return { assets };
  } catch { return { assets: [], error: "No pudimos cargar las fichas de vía pública. Vuelve a intentar en unos momentos." }; }
}
