import { catalogAccess } from "@/lib/catalog-access-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[a-z0-9-]{1,100}$/.test(id)) return new Response(null, { status: 404, headers });
    const { db } = await catalogAccess();
    const { data: products, error } = await db.from("catalog_digital_productions").select("product_key")
      .eq("active", true).eq("product->digitalProduction->>id", id).limit(1);
    if (error || !products?.length) return new Response(null, { status: 404, headers });
    const { data, error: downloadError } = await db.storage.from("digital-catalog").download(`${id}.webp`);
    if (downloadError || !data) return new Response(null, { status: 404, headers });
    return new Response(data, { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch { return new Response(null, { status: 403, headers }); }
}
