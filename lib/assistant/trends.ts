export type LiveTrendSource = {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
};

const LIVE_INTENT = /\b(tendenc|actual|hoy|ahora|momento|viral|noticia|temporada|coyuntura|reciente|esta semana|ultimo)\w*/i;
const STOPWORDS = new Set([
  "para", "como", "cómo", "quiero", "puedo", "dime", "cuales", "cuáles", "sobre", "esto", "esta",
  "tendencias", "tendencia", "actual", "actuales", "momento", "ahora", "publicidad",
  "campana", "campanas", "ecuador", "necesito", "buscar", "internet", "qué", "que",
  "hay", "hoy", "podria", "podría", "usar", "usarlas", "usarles", "una", "uno", "unos",
  "unas", "del", "las", "los", "con", "por", "desde", "marca", "negocio", "ayuda",
]);
const GEO_TERMS = new Set([
  "guayaquil", "quito", "cuenca", "loja", "manta", "portoviejo", "ambato", "riobamba",
  "machala", "daule", "samborondon", "milagro", "quevedo", "babahoyo", "esmeraldas",
  "ibarra", "latacunga", "tulcan", "guayas", "pichincha", "manabi", "azuay", "ecuador",
]);

export function shouldUseLiveTrends(message: string): boolean {
  return LIVE_INTENT.test(message);
}

export async function buildLiveTrendContext(message: string): Promise<{
  context: string;
  sources: LiveTrendSource[];
}> {
  const terms = searchTerms(message);
  const query = terms.join(" ");
  const [trendSources, newsSources] = await Promise.all([
    readRss("https://trends.google.com/trending/rss?geo=EC", 12, true),
    readRss(
      `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} Ecuador when:180d`)}&hl=es-419&gl=EC&ceid=EC:es-419`,
      10,
      false,
    ),
  ]);
  const relevantNews = newsSources.filter((item) => isRelevant(item.title, terms));
  const relevantTrends = trendSources.filter((item) => isRelevant(item.title, terms));
  const sources = dedupe([...relevantNews, ...relevantTrends])
    .filter((item) => !isLowSignalSource(item))
    .slice(0, 8);
  if (!sources.length) return { context: "No fue posible obtener fuentes actuales en esta consulta.", sources: [] };

  const checkedAt = new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Guayaquil",
  }).format(new Date());
  const lines = sources.map((item, index) =>
    `${index + 1}. ${item.title} — ${item.source}${item.publishedAt ? ` (${item.publishedAt})` : ""} — ${item.url}`,
  );
  return {
    context: [
      `FUENTES ACTUALES DE INTERNET consultadas el ${checkedAt}:`,
      ...lines,
      "Úsalas solo si son pertinentes. Son señales editoriales y de búsqueda, no evidencia de ventas ni garantía de desempeño.",
      "Distingue claramente hechos publicados, inferencias de marketing y recomendaciones.",
    ].join("\n"),
    sources,
  };
}

async function readRss(url: string, limit: number, googleTrends: boolean): Promise<LiveTrendSource[]> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "AdMavericksOne/1.0 (+https://one.ad-mavericks.com)" },
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return [];
    const xml = (await response.text()).slice(0, 500_000);
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
      .slice(0, limit)
      .map((match) => parseItem(match[1], googleTrends))
      .filter((item): item is LiveTrendSource => item !== null);
  } catch {
    return [];
  }
}

function parseItem(block: string, googleTrends: boolean): LiveTrendSource | null {
  const title = tag(block, googleTrends ? "ht:news_item_title" : "title") || tag(block, "title");
  const url = tag(block, googleTrends ? "ht:news_item_url" : "link") || tag(block, "link");
  const source = tag(block, googleTrends ? "ht:news_item_source" : "source") || (googleTrends ? "Google Trends Ecuador" : "Google News");
  const publishedAt = tag(block, "pubDate");
  if (!title || !safeHttpUrl(url)) return null;
  return {
    title: decodeXml(title).slice(0, 220),
    url,
    source: decodeXml(source).slice(0, 100),
    publishedAt: publishedAt ? displayDate(publishedAt) : null,
  };
}

function tag(block: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return match?.[1]?.replace(/^<!\[CDATA\[|\]\]>$/g, "").trim() ?? "";
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function displayDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "America/Guayaquil" }).format(date);
}

function safeHttpUrl(value: string): boolean {
  try {
    const url = new URL(decodeXml(value));
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

function searchTerms(message: string): string[] {
  const clean = message
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[\w.+-]+@[\w.-]+/gi, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ");
  const words = clean
    .split(/\s+/)
    .map((word) => word.toLocaleLowerCase("es"))
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
  return [...new Set(words)].slice(0, 6).length ? [...new Set(words)].slice(0, 6) : ["marketing", "consumo"];
}

function isRelevant(title: string, terms: string[]): boolean {
  const normalized = normalizeText(title);
  const subjectTerms = terms.filter((term) => !GEO_TERMS.has(normalizeText(term)));
  const candidates = subjectTerms.length ? subjectTerms : terms;
  return candidates.some((term) => term.length >= 4 && normalized.includes(normalizeText(term).slice(0, 6)));
}

function isLowSignalSource(item: LiveTrendSource): boolean {
  return /facebook|instagram|tiktok|youtube|x\.com/i.test(`${item.source} ${item.title}`);
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function dedupe(items: LiveTrendSource[]): LiveTrendSource[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.title.toLowerCase()}|${item.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
