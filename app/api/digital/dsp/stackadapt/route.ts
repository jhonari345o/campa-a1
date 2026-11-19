import "server-only";
import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { stackAdaptConfig } from "@/lib/ads/stackadapt";
import { handleStackAdaptRequest } from "@/lib/ads/stackadapt-request";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const profile = await getSessionProfile();
  const result = await handleStackAdaptRequest(profile, new URL(request.url).searchParams, () => stackAdaptConfig(process.env));
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}
