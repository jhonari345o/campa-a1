import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { projectResearch, type InfomediaCategory, type CategoryResearch } from "@/lib/infomedia";

import { projectTgi, type TgiTarget } from "@/lib/tgi";

export type CategoryCatalog = { categories: InfomediaCategory[]; error?: string };
export async function getInfomediaCatalog(): Promise<CategoryCatalog> {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { categories: [], error: "Inicia sesión para consultar las categorías." };
  const { data: allowed, error: permissionError } = await db.rpc("can_access_infomedia");
  if (permissionError) return { categories: [], error: "El catálogo de Infomedia aún no está habilitado." };
  if (!allowed) return { categories: [], error: "Solicita al administrador acceso a la investigación de Infomedia." };
  const { data, error } = await db.from("infomedia_categories").select("id, label, periods").eq("active", true).order("label").limit(1000);
  if (error || !data?.length) return { categories: [], error: "El catálogo de Infomedia está pendiente de carga." };
  return { categories: data as InfomediaCategory[] };
}
export async function getCategoryResearch(categoryId: string, focusBrand = "", target?: TgiTarget): Promise<CategoryResearch> {
  if (!/^im_[a-f0-9]{24}$/.test(categoryId)) throw new Error("CATEGORY_REQUIRED");
  const catalog = await getInfomediaCatalog();
  const category = catalog.categories.find((item) => item.id === categoryId);
  if (!category) throw new Error("CATEGORY_UNAVAILABLE");
  // Entitlement was checked with the user's session; raw licensed tables remain inaccessible over REST.
  const db = createAdminClient();
  const { data, error } = await db.from("infomedia_research").select("payload, data_through").eq("category_id", categoryId).single();
  if (error || !data) throw new Error("RESEARCH_UNAVAILABLE");
  const research = projectResearch(category, data.payload, data.data_through, focusBrand.slice(0, 160));
  if (!research.periods.length) throw new Error("RESEARCH_UNAVAILABLE");
  if (target) {
    const { data: study } = await db.from("tgi_research").select("payload").eq("id", "ecuador-2025-r1").eq("active", true).maybeSingle();
    if (study) research.tgi = projectTgi(study.payload, target);
  }
  return research;
}
