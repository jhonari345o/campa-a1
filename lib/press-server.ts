import "server-only";
import { catalogAccess } from "./catalog-access-server";
import { projectPressCatalog, type PressCatalog } from "./press-catalog";
export async function getPressCatalog(): Promise<PressCatalog> {
  try {
    const { db, isAdmin } = await catalogAccess();
    const rows: unknown[] = [];
    for (let offset = 0; offset < 10_000; offset += 250) {
      const { data, error } = await db.from("press_directory_entries").select("id,name,region_keys,city,description,logo_path,website,coverage,editions").eq("active", true).order("id").range(offset, offset + 249);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 250) return { entries: projectPressCatalog(rows).map(p=>isAdmin?p:({...p,editions:p.editions.map(e=>({...e,conditions:[],offers:e.offers.map(o=>({...o,priceUsd:null,notes:""}))}))})), asOfDate: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) };
    }
    throw new Error("CATALOG_LIMIT");
  } catch { return { entries: [], error: "No pudimos cargar el catálogo de prensa. Vuelve a intentarlo." }; }
}
