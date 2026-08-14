/**
 * Conector Meta Ads (Facebook / Instagram) — Marketing API (Insights).
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/ingest/connectors/meta-ads.ts <advertiser> <year> [month]
 *
 * Requiere en el entorno:
 *   META_ADS_ACCESS_TOKEN   (token de acceso con permiso ads_read)
 *   META_ADS_ACCOUNT_ID     (id de la cuenta publicitaria, sin el prefijo act_)
 *
 * Los datos entran como "pendiente": son metricas propias de una cuenta y
 * deben verificarse antes de tratarlas como definitivas.
 */
import { admin } from "../env";
import { upsertAdvertiser, upsertMetric, ensureSource } from "../upsert";

const API_VERSION = "v21.0";

type MetaInsight = {
  impressions?: string;
  clicks?: string;
  spend?: string;
  actions?: { action_type: string; value: string }[];
};

function monthRange(year: number, month?: number) {
  if (month) {
    const since = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = new Date(year, month, 0).getDate();
    const until = `${year}-${String(month).padStart(2, "0")}-${String(end).padStart(2, "0")}`;
    return { since, until };
  }
  return { since: `${year}-01-01`, until: `${year}-12-31` };
}

export async function fetchMetaInsights(year: number, month?: number): Promise<MetaInsight | null> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const account = process.env.META_ADS_ACCOUNT_ID;
  if (!token || !account) {
    throw new Error(
      "Configura META_ADS_ACCESS_TOKEN y META_ADS_ACCOUNT_ID en .env.local para usar este conector.",
    );
  }
  const { since, until } = monthRange(year, month);
  const params = new URLSearchParams({
    fields: "impressions,clicks,spend,actions",
    time_range: JSON.stringify({ since, until }),
    access_token: token,
  });
  const url = `https://graph.facebook.com/${API_VERSION}/act_${account}/insights?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meta API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: MetaInsight[] };
  return json.data?.[0] ?? null;
}

async function main() {
  const [advertiser, yearArg, monthArg] = process.argv.slice(2);
  if (!advertiser || !yearArg) {
    console.error("Uso: meta-ads.ts <advertiser> <year> [month]");
    process.exit(1);
  }
  const year = Number(yearArg);
  const month = monthArg ? Number(monthArg) : undefined;

  const insight = await fetchMetaInsights(year, month);
  if (!insight) {
    console.log("Sin datos para el periodo.");
    return;
  }

  const db = admin();
  const sourceId = await ensureSource(db, "Meta Ads (Facebook / Instagram)");
  const advertiserId = await upsertAdvertiser(db, { name: advertiser, source_id: sourceId });
  const conversions = insight.actions?.find((a) =>
    ["purchase", "lead", "complete_registration"].includes(a.action_type),
  );

  await upsertMetric(db, {
    advertiser_id: advertiserId,
    platform: "meta_ads",
    period_year: year,
    period_month: month ?? null,
    impressions: insight.impressions ? Number(insight.impressions) : null,
    clicks: insight.clicks ? Number(insight.clicks) : null,
    spend_usd: insight.spend ? Number(insight.spend) : null,
    conversions: conversions ? Number(conversions.value) : null,
    status: "pendiente",
    source_id: sourceId,
  });
  console.log(`✓ Meta Ads: ${advertiser} ${year}${month ? "/" + month : ""} registrado (pendiente).`);
}

// Ejecutar solo si se invoca directamente.
if (process.argv[1] && process.argv[1].endsWith("meta-ads.ts")) {
  main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
