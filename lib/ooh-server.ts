import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseOohAsset, type OohCatalog } from "@/lib/ooh-catalog";

export async function getOohCatalog(): Promise<OohCatalog> {
  try {
    const db = await createClient();
    const assets: OohCatalog["assets"] = [];
    for (let from = 0; ; from += 500) {
      const { data, error } = await db.from("ooh_catalog_assets").select("id,provider_slug,provinces,details,photo_path").eq("active", true).order("id").range(from, from + 499);
      if (error) throw error;
      for (const row of data ?? []) { const asset = parseOohAsset(row); if (asset) assets.push(asset); }
      if (!data || data.length < 500) break;
    }
    return { assets };
  } catch { return { assets: [], error: "No pudimos cargar las fichas de vía pública. Vuelve a intentar en unos momentos." }; }
}
