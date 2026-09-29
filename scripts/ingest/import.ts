/**
 * Importador de datos de mercado desde CSV.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/ingest/import.ts advertisers  data/samples/advertisers.csv
 *   npx tsx --env-file=.env.local scripts/ingest/import.ts investments  data/samples/investments.csv
 *   npx tsx --env-file=.env.local scripts/ingest/import.ts metrics      data/samples/metrics.csv
 *
 * Todo entra como "pendiente" salvo que el CSV indique status=verificado.
 */
import { admin, logStep } from "./env";
import { readCsv, toNumber, toStatus } from "./csv";
import {
  ensureSource,
  upsertAdvertiser,
  upsertChannel,
  upsertInvestment,
  upsertMonthlyInvestment,
  upsertMetric,
} from "./upsert";

const pick = (row: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
    if (v != null && v !== "") return v;
  }
  return "";
};

async function importAdvertisers(file: string) {
  const db = admin();
  const rows = readCsv(file);
  logStep(`${rows.length} filas de anunciantes`);
  let n = 0;
  for (const row of rows) {
    const name = pick(row, "name", "nombre", "razon_social");
    if (!name) continue;
    const sourceName = pick(row, "source", "fuente");
    await upsertAdvertiser(db, {
      name,
      legal_id: pick(row, "legal_id", "ruc") || null,
      sector: pick(row, "sector") || null,
      province: pick(row, "province", "provincia") || null,
      status: toStatus(pick(row, "status", "estado")),
      source_id: sourceName ? await ensureSource(db, sourceName) : null,
    });
    n++;
  }
  logStep(`✓ ${n} anunciantes procesados`);
}

async function importChannels(file: string) {
  const db = admin();
  const rows = readCsv(file);
  logStep(`${rows.length} filas de medios/canales`);
  let n = 0;
  for (const row of rows) {
    const name = pick(row, "name", "nombre", "medio");
    const media_type = pick(row, "media_type", "tipo") || "otros";
    if (!name) continue;
    await upsertChannel(db, { name, media_type, owner: pick(row, "owner", "propietario", "grupo") || null });
    n++;
  }
  logStep(`✓ ${n} medios procesados`);
}

async function importInvestments(file: string) {
  const db = admin();
  const rows = readCsv(file);
  logStep(`${rows.length} filas de inversion`);
  let n = 0;
  for (const row of rows) {
    const advName = pick(row, "advertiser", "anunciante", "name", "nombre");
    const year = toNumber(pick(row, "year", "anio", "ano", "period_year"));
    if (!advName || !year) continue;

    const sourceName = pick(row, "source", "fuente");
    const sourceId = sourceName ? await ensureSource(db, sourceName) : null;
    const advertiserId = await upsertAdvertiser(db, {
      name: advName,
      legal_id: pick(row, "legal_id", "ruc") || null,
      source_id: sourceId,
    });

    await upsertInvestment(db, {
      advertiser_id: advertiserId,
      media_type: pick(row, "media_type", "medio") || null,
      period_year: year,
      period_month: toNumber(pick(row, "month", "mes", "period_month")),
      amount_usd: toNumber(pick(row, "amount_usd", "monto", "inversion")),
      status: toStatus(pick(row, "status", "estado")),
      source_id: sourceId,
      notes: pick(row, "notes", "notas") || null,
    });
    n++;
  }
  logStep(`✓ ${n} registros de inversion procesados`);
}

async function importMonthly(file: string) {
  const db = admin();
  const rows = readCsv(file);
  logStep(`${rows.length} filas de inversion mensual`);
  let n = 0;
  for (const row of rows) {
    const advName = pick(row, "advertiser", "anunciante", "name", "nombre");
    const year = toNumber(pick(row, "year", "anio", "ano", "period_year"));
    const month = toNumber(pick(row, "month", "mes", "period_month"));
    if (!advName || !year || !month) continue;

    const advertiserId = await upsertAdvertiser(db, { name: advName });
    await upsertMonthlyInvestment(db, {
      advertiser_id: advertiserId,
      period_year: year,
      period_month: month,
      amount_usd: toNumber(pick(row, "amount_usd", "monto", "inversion")),
      avisos: toNumber(pick(row, "avisos", "ads")),
      status: toStatus(pick(row, "status", "estado")),
    });
    n++;
  }
  logStep(`✓ ${n} registros de inversion mensual procesados`);
}

async function importMetrics(file: string) {
  const db = admin();
  const rows = readCsv(file);
  logStep(`${rows.length} filas de metricas`);
  let n = 0;
  for (const row of rows) {
    const advName = pick(row, "advertiser", "anunciante", "name", "nombre");
    const platform = pick(row, "platform", "plataforma");
    const year = toNumber(pick(row, "year", "anio", "ano", "period_year"));
    if (!advName || !platform || !year) continue;

    const sourceName = pick(row, "source", "fuente");
    const sourceId = sourceName ? await ensureSource(db, sourceName) : null;
    const advertiserId = await upsertAdvertiser(db, {
      name: advName,
      legal_id: pick(row, "legal_id", "ruc") || null,
      source_id: sourceId,
    });

    await upsertMetric(db, {
      advertiser_id: advertiserId,
      platform,
      period_year: year,
      period_month: toNumber(pick(row, "month", "mes", "period_month")),
      impressions: toNumber(pick(row, "impressions", "impresiones")),
      clicks: toNumber(pick(row, "clicks", "clics")),
      spend_usd: toNumber(pick(row, "spend_usd", "spend", "inversion")),
      conversions: toNumber(pick(row, "conversions", "conversiones")),
      ctr: toNumber(pick(row, "ctr")),
      cpc: toNumber(pick(row, "cpc")),
      cpm: toNumber(pick(row, "cpm")),
      cpa: toNumber(pick(row, "cpa")),
      status: toStatus(pick(row, "status", "estado")),
      source_id: sourceId,
    });
    n++;
  }
  logStep(`✓ ${n} metricas procesadas`);
}

async function main() {
  const [kind, file] = process.argv.slice(2);
  if (!kind || !file) {
    console.error("Uso: import.ts <advertisers|channels|investments|monthly|metrics> <archivo.csv>");
    process.exit(1);
  }
  console.log(`Ingesta: ${kind} <- ${file}`);
  if (kind === "advertisers") await importAdvertisers(file);
  else if (kind === "channels") await importChannels(file);
  else if (kind === "investments") await importInvestments(file);
  else if (kind === "monthly") await importMonthly(file);
  else if (kind === "metrics") await importMetrics(file);
  else {
    console.error(`Tipo desconocido: ${kind}`);
    process.exit(1);
  }
  console.log("Listo.");
}

main().catch((err) => {
  console.error("Error de ingesta:", err.message);
  process.exit(1);
});
