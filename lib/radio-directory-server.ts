import "server-only";
import { createClient } from "@/lib/supabase/server";
import { projectRadioDirectory, type RadioDirectoryCatalog } from "@/lib/radio-directory";

export async function getRadioDirectory(): Promise<RadioDirectoryCatalog> {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) throw new Error("AUTH_REQUIRED");
    const rows: unknown[] = [];
    for (let offset = 0; offset < 10_000; offset += 500) {
      const { data, error } = await db.from("radio_directory_entries")
        .select("id,name,region_keys,city,dial,genres,description,logo_path,reviewed_at")
        .eq("active", true).order("id").range(offset, offset + 499);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 500) return { stations: projectRadioDirectory(rows) };
    }
    throw new Error("DIRECTORY_LIMIT");
  } catch {
    return { stations: [], error: "No pudimos cargar el directorio de emisoras. Vuelve a intentarlo." };
  }
}
