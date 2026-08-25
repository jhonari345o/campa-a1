export type LiveTrendSource = {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
};

const LIVE_INTENT = /\b(tendenc|actual|hoy|ahora|momento|viral|noticia|temporada|coyuntura|reciente|esta semana|ultimo)\w*/i;
const STOPWORDS = new Set([
  "para", "como", "quiero", "puedo", "dime", "cuales", "sobre", "esto", "esta",
  "tendencias", "tendencia", "actual", "actuales", "momento", "ahora", "publicidad",
  "campana", "campanas", "ecuador", "necesito", "buscar", "internet",
]);

export function shouldUseLiveTrends(message: string): boolean {
  return LIVE_INTENT.test(message);
}

export async function buildLiveTrendContext(message: string): Promise<{
  context: string;
  sources: LiveTrendSource[];
}> {
  const query = searchTerms(message);
  const [trendSources, newsSources] = await Promise.all([
    readRss("https://trends.google.com/trending/rss?geo=EC", 6, true),
    readRss(
      `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} Ecuador`)}&hl=es-419&gl=EC&ceid=EC:es-419`,
      6,
      false,
    ),
  ]);
  const sources = dedupe([...newsSources, ...trendSources]).slice(0, 8);
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

function searchTerms(message: string): string {
  const clean = message
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[\w.+-]+@[\w.-]+/gi, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ");
  const words = clean.split(/\s+/).filter((word) => word.length > 2 && !STOPWORDS.has(word.toLowerCase()));
  return words.slice(0, 8).join(" ") || "marketing consumo";
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
