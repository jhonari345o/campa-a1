import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSessionProfile } from "@/lib/auth";
import { servePrivateEvidence } from "@/lib/private-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ asset: string[] }> }) {
  const { asset } = await context.params;
  return servePrivateEvidence(asset, {
    getProfile: getSessionProfile,
    readAsset: (relativePath) => readFile(join(process.cwd(), "private/postbuy/warner/evidence", relativePath)),
  });
}
