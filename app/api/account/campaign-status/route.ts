import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ hasCampaigns: false }, { status: 401 });
  const db = await createClient();
  const [{ count, error }, { count: orderCount, error: orderError }] = await Promise.all([
    db.from("campaign_jobs").select("id", { count: "exact", head: true }),
    db.from("media_orders").select("id", { count: "exact", head: true }),
  ]);
  return NextResponse.json(
    { hasCampaigns: (!error && (count ?? 0) > 0) || (!orderError && (orderCount ?? 0) > 0) },
    { headers: { "cache-control": "private, no-store" } },
  );
}
