import { createAdminClient } from "@/lib/supabase/admin";
import { MEDIA_TYPE_LABELS } from "@/lib/market";
import { DIGITAL_PLATFORMS, OOH_PROVIDERS, PRESS_OUTLETS } from "@/lib/media-catalog";
import { getBroadcastCatalog } from "@/lib/broadcast-server";
import { sourceDescription, emptyBroadcastCatalog } from "@/lib/broadcast-catalog";

/**
 * Arma el contexto de Mavi. Corre del lado del servidor con la clave de
 * servicio (los clientes no ven la data cruda; solo la respuesta de Mavi).
 * Combina: (1) resumen agregado de inversion del periodo interno mas reciente
 * y (2) la base de conocimiento de giros, canales y plantillas de campana.
 * El contexto declara siempre la antiguedad y el estado de esos datos.
 */
export async function buildMarketContext(question = ""): Promise<string> {
  let db;
  try {
    db = createAdminClient();
  } catch {
    return "La base de conocimiento aun no esta disponible.";
  }

  const [
    { data: investments },
    { data: giros },
    { data: canales },
    { data: campanas },
    broadcast,
    { data: catalogItems },
  ] =
    await Promise.all([
      db
        .from("ad_investments")
        .select("media_type, amount_usd, period_year, period_month, status")
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false, nullsFirst: true })
        .limit(4000),
      db.from("kb_giros").select("giro, publico, canales, tono, ideas"),
      db.from("kb_canales").select("canal, para_que, como_invertir, formato, tip"),
      db.from("kb_campanas").select("tipo, titulo, estructura"),
      process.env.AI_PROVIDER === "bedrock" && process.env.INFOMEDIA_AWS_AI_ENABLED === "true" ? getBroadcastCatalog() : Promise.resolve(emptyBroadcastCatalog),
      db.from("media_catalog_items").select("name, kind, coverage, status, status_note, metadata").eq("active", true),
    ]);

  const periods = (investments ?? [])
    .map((row) => ({ year: Number(row.period_year), month: row.period_month == null ? null : Number(row.period_month) }))
    .filter((period) => Number.isInteger(period.year));
  const latestYear = periods.reduce((max, period) => Math.max(max, period.year), 0);
  const monthsInLatestYear = periods
    .filter((period) => period.year === latestYear && period.month !== null)
    .map((period) => period.month as number);
  const latestMonth = monthsInLatestYear.length ? Math.max(...monthsInLatestYear) : null;
  const referenceRows = (investments ?? []).filter((row) => {
    if (Number(row.period_year) !== latestYear) return false;
    return latestMonth === null ? row.period_month == null : Number(row.period_month) === latestMonth;
  });

  // Resumen del periodo interno mas reciente. No se mezcla con anos anteriores.
  const byMedia = new Map<string, number>();
  let total = 0;
  let verified = 0;
  let pending = 0;
  for (const r of referenceRows) {
    const amt = Number(r.amount_usd ?? 0);
    if (amt <= 0) continue;
    const k = r.media_type ?? "otros";
    byMedia.set(k, (byMedia.get(k) ?? 0) + amt);
    total += amt;
    if (r.status === "verificado") verified += 1;
    else pending += 1;
  }
  const mediaLines =
    [...byMedia.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([mt, v]) => `- ${MEDIA_TYPE_LABELS[mt] ?? mt}: ${total ? Math.round((v / total) * 100) : 0}%`)
      .join("\n") || "- (sin datos)";

  const giroLines =
    (giros ?? [])
      .map((g) => `- ${g.giro}: publico ${g.publico}; canales ${g.canales}; tono ${g.tono}; ideas: ${g.ideas}`)
      .join("\n") || "- (sin datos)";

  const canalLines =
    (canales ?? [])
      .map((c) => `- ${c.canal}: ${c.para_que}. Como invertir: ${c.como_invertir}. Formato: ${c.formato}. Tip: ${c.tip}`)
      .join("\n") || "- (sin datos)";

  const campanaLines =
    (campanas ?? [])
      .map((c) => `- [${c.tipo}] ${c.titulo}: ${c.estructura}`)
      .join("\n") || "- (sin datos)";
  const questionTerms = normalize(question).split(/[^a-z0-9]+/).filter(term => term.length >= 4);
  // Preserve complete study boundaries. Do not pool ranks or infer missing markets.
  const relevant = broadcast.sources.filter(source => questionTerms.some(term => normalize(`${source.label} ${source.market} ${source.target}`).includes(term)));
  const sources = relevant.length ? relevant : broadcast.sources;
  const tvLines = sources.filter(source => source.kind === "tv").map(source =>
    `- ${source.label}: ${sourceDescription(source)}. ${source.conditions}. Base ${source.spotSeconds ?? "no indicada"} s; mínimo ${source.minimumSeconds ?? "no indicado"} s. ${source.annualContract ? "Requiere contrato anual." : ""} Consulte el catálogo privado para cotizar únicamente dentro de la vigencia y plaza documentadas.`
  ).join("\n");
  const radioLines = sources.filter(source => source.kind === "radio").map(source => {
    const rows = broadcast.radio.filter(row => row.sourceId === source.id).sort((a,b) => (b.rating ?? -1) - (a.rating ?? -1)).slice(0,5);
    return `- ESTUDIO: ${source.label}. ${sourceDescription(source)}. ${source.conditions}\n` + rows.map(row => `  ${row.name}: rating ${row.rating ?? "no informado"}; share ${row.share ?? "no informado"}%; audiencia ${row.audience ?? "no informada"}.`).join("\n");
  }).join("\n") || "- Ranking no disponible en esta consulta.";
  const loadedOoh = ((catalogItems ?? []) as Array<Record<string, unknown>>)
    .filter((item) => item.kind === "ooh")
    .map((item) => `- ${item.name}: cobertura ${item.coverage || "por confirmar"}; estado ${item.status}; ${item.status_note || "inventario por validar"}`);
  const oohLines = (loadedOoh.length ? loadedOoh : OOH_PROVIDERS.map((item) => `- ${item.name}: ${item.coverage || item.detail}; ${item.statusNote}`)).join("\n");
  const digitalLines = DIGITAL_PLATFORMS.map((item) => `- ${item.name}: ${item.objective}; formatos ${item.formats}; medición ${item.measurement}`).join("\n");
  const pressLines = PRESS_OUTLETS.map((item) => `- ${item.name}: ${item.detail}; ${item.statusNote}`).join("\n");

  const currentYear = Number(new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: "America/Guayaquil",
  }).format(new Date()));
  const periodLabel = latestYear
    ? `${latestMonth ? `${String(latestMonth).padStart(2, "0")}/` : ""}${latestYear}${latestMonth === null ? " (periodo anual o acumulado; corte mensual no informado)" : ""}`
    : "sin periodo disponible";
  const vintageWarning = latestYear && latestYear < currentYear
    ? `ADVERTENCIA: la base interna termina en ${periodLabel}; es historica y NO representa el mercado actual de ${currentYear}.`
    : `La etiqueta mas reciente de la base es ${periodLabel}; no implica datos en tiempo real ni reemplaza fuentes actuales.`;

  return [
    "BASE INTERNA DE REFERENCIA (separada de Internet):",
    `Periodo usado: ${periodLabel}. Registros: ${referenceRows.length}; verificados: ${verified}; pendientes: ${pending}.`,
    vintageWarning,
    "No presentes esta base como noticia, tendencia actual ni medicion en tiempo real. No mezcles anos para calcular participaciones.",
    "PARTICIPACION AGREGADA DEL PERIODO INTERNO POR MEDIO (sin montos ni anunciantes):",
    mediaLines,
    "",
    "GIROS DE NEGOCIO (publico, canales, tono, ideas):",
    giroLines,
    "",
    "CANALES DE PUBLICIDAD (para que sirve, como invertir, formato, tip):",
    canalLines,
    "",
    "PLANTILLAS DE CAMPANA Y GUIONES:",
    campanaLines,
    "",
    "CATALOGO ESPECIFICO DE TELEVISION (tarifas referenciales; no son reserva):",
    tvLines || "- (sin registros con tarifa)",
    "",
    "EMISORAS DE RADIO: cada bloque es un estudio separado. No comparar ni sumar plazas, sexos, bandas o franjas distintas. Audiencia no es alcance de campaña. No aplicar un corte a un público distinto:",
    radioLines,
    "",
    "VIA PUBLICA (solo usa una dirección o coordenada si aparece explícitamente):",
    oohLines,
    "",
    "PLATAFORMAS DIGITALES:",
    digitalLines,
    "",
    "PRENSA:",
    pressLines,
  ].join("\n");
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
