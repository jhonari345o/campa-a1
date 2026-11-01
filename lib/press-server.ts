import "server-only";
import { createClient } from "@/lib/supabase/server";
import { projectPressCatalog, type PressCatalog } from "./press-catalog";
export async function getPressCatalog(): Promise<PressCatalog> {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) throw new Error("AUTH_REQUIRED");
    const rows: unknown[] = [];
    for (let offset = 0; offset < 10_000; offset += 250) {
      const { data, error } = await db.from("press_directory_entries").select("id,name,region_keys,city,description,logo_path,website,coverage,editions").eq("active", true).order("id").range(offset, offset + 249);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 250) return { entries: projectPressCatalog(rows), asOfDate: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) };
    }
    throw new Error("CATALOG_LIMIT");
  } catch { return { entries: [], error: "No pudimos cargar el catálogo de prensa. Vuelve a intentarlo." }; }
}
