import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { documentPathAllowed } from "@/lib/campaign-library";
export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await getSessionProfile();
    if (!profile) return new Response(null, { status: 401, headers: HEADERS });
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404, headers: HEADERS });
    const db = await createClient();
    const { data: doc, error } = await db.from("workspace_documents")
      .select("id,company_id,campaign_id,storage_path,downloadable").eq("id", id).maybeSingle();
    if (error || !doc?.downloadable || !doc.storage_path ||
        !documentPathAllowed(doc.storage_path, doc.company_id, doc.campaign_id, doc.id)) {
      return new Response(null, { status: 404, headers: HEADERS });
    }
    const { data, error: storageError } = await db.storage.from("workspace-documents").download(doc.storage_path);
    if (storageError || !data) return new Response(null, { status: 404, headers: HEADERS });
    const filename = doc.storage_path.split("/").pop()!;
    return new Response(data, { headers: { ...HEADERS, "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch { return new Response(null, { status: 503, headers: HEADERS }); }
}

