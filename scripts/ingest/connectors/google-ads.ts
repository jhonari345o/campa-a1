/**
 * Conector Google Ads — Google Ads API (GAQL vía searchStream).
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/ingest/connectors/google-ads.ts <advertiser> <year> [month]
 *
 * Requiere en el entorno (Google Ads API — cuenta con acceso):
 *   GOOGLE_ADS_DEVELOPER_TOKEN
 *   GOOGLE_ADS_CUSTOMER_ID          (sin guiones)
 *   GOOGLE_ADS_LOGIN_CUSTOMER_ID    (MCC, opcional)
 *   GOOGLE_ADS_OAUTH_ACCESS_TOKEN   (token OAuth2 vigente con scope adwords)
 *
 * Nota sobre OAuth: el token de acceso caduca (~1h). En produccion se obtiene
 * con un refresh_token; aqui se espera un access_token ya vigente para
 * mantener el conector simple y auditable. Los datos entran como "pendiente".
 */
import { admin } from "../env";
import { upsertAdvertiser, upsertMetric, ensureSource } from "../upsert";

const API_VERSION = "v17";

function dateRange(year: number, month?: number) {
  if (month) {
    const end = new Date(year, month, 0).getDate();
    return {
      start: `${year}-${String(month).padStart(2, "0")}-01`,
      end: `${year}-${String(month).padStart(2, "0")}-${String(end).padStart(2, "0")}`,
    };
  }
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

type AdsMetrics = { impressions: number; clicks: number; costMicros: number; conversions: number };

export async function fetchGoogleAdsMetrics(year: number, month?: number): Promise<AdsMetrics | null> {
  const dev = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const customer = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const accessToken = process.env.GOOGLE_ADS_OAUTH_ACCESS_TOKEN;
  if (!dev || !customer || !accessToken) {
    throw new Error(
      "Configura GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CUSTOMER_ID y " +
        "GOOGLE_ADS_OAUTH_ACCESS_TOKEN en .env.local para usar este conector.",
    );
  }
  const { start, end } = dateRange(year, month);
  const query = `
    SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM customer
    WHERE segments.date BETWEEN '${start}' AND '${end}'`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": dev,
    "Content-Type": "application/json",
  };
  const login = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (login) headers["login-customer-id"] = login;

  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${customer}/googleAds:searchStream`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ query }) });
  if (!res.ok) throw new Error(`Google Ads API ${res.status}: ${await res.text()}`);

  const batches = (await res.json()) as {
    results?: { metrics?: Record<string, string | number> }[];
  }[];

  const acc: AdsMetrics = { impressions: 0, clicks: 0, costMicros: 0, conversions: 0 };
  for (const batch of batches) {
    for (const r of batch.results ?? []) {
      acc.impressions += Number(r.metrics?.impressions ?? 0);
      acc.clicks += Number(r.metrics?.clicks ?? 0);
      acc.costMicros += Number(r.metrics?.costMicros ?? r.metrics?.cost_micros ?? 0);
      acc.conversions += Number(r.metrics?.conversions ?? 0);
    }
  }
  return acc;
}

async function main() {
  const [advertiser, yearArg, monthArg] = process.argv.slice(2);
  if (!advertiser || !yearArg) {
    console.error("Uso: google-ads.ts <advertiser> <year> [month]");
    process.exit(1);
  }
  const year = Number(yearArg);
  const month = monthArg ? Number(monthArg) : undefined;

  const m = await fetchGoogleAdsMetrics(year, month);
  if (!m) {
    console.log("Sin datos para el periodo.");
    return;
  }

  const db = admin();
  const sourceId = await ensureSource(db, "Google Ads");
  const advertiserId = await upsertAdvertiser(db, { name: advertiser, source_id: sourceId });
  await upsertMetric(db, {
    advertiser_id: advertiserId,
    platform: "google_ads",
    period_year: year,
    period_month: month ?? null,
    impressions: m.impressions,
    clicks: m.clicks,
    spend_usd: m.costMicros / 1_000_000,
    conversions: Math.round(m.conversions),
    status: "pendiente",
    source_id: sourceId,
  });
  console.log(`✓ Google Ads: ${advertiser} ${year}${month ? "/" + month : ""} registrado (pendiente).`);
}

if (process.argv[1] && process.argv[1].endsWith("google-ads.ts")) {
  main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
