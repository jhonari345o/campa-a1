import { createClient } from "@/lib/supabase/server";

export const MEDIA_TYPE_LABELS: Record<string, string> = {
  tv_abierta: "TV abierta",
  tv_paga: "TV paga",
  radio: "Radio",
  prensa: "Prensa",
  revistas: "Revistas",
  via_publica: "Via publica",
  cine: "Cine",
  buscadores: "Buscadores",
  redes_sociales: "Redes sociales",
  video_streaming: "Video / streaming",
  sitios_apps: "Sitios y apps",
  influencers: "Influencers",
  email: "Email",
  retail_media: "Retail media",
  otros: "Otros",
};

export const MEDIA_TYPES = Object.keys(MEDIA_TYPE_LABELS);

export type Advertiser = {
  id: string;
  name: string;
  legal_id: string | null;
  sector: string | null;
  province: string | null;
  status: "verificado" | "pendiente";
};

export type MediaChannel = {
  id: string;
  name: string;
  media_type: string;
  owner: string | null;
};

export type Investment = {
  id: string;
  advertiser_id: string | null;
  media_type: string | null;
  period_year: number;
  period_month: number | null;
  amount_usd: number | null;
  status: "verificado" | "pendiente";
  advertisers?: { name: string } | null;
};

export type Metric = {
  id: string;
  advertiser_id: string | null;
  platform: string;
  period_year: number;
  period_month: number | null;
  impressions: number | null;
  clicks: number | null;
  spend_usd: number | null;
  status: "verificado" | "pendiente";
  advertisers?: { name: string } | null;
};

export type MarketOverview = {
  advertisers: number;
  channels: number;
  investments: number;
  metrics: number;
  investmentTotal: number;
  verifiedShare: number; // 0..1 de inversiones verificadas
};

/** Formatea montos en USD de forma compacta y legible. */
export function money(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function period(year: number, month: number | null): string {
  if (!month) return String(year);
  return `${String(month).padStart(2, "0")}/${year}`;
}

async function count(table: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

export async function getOverview(): Promise<MarketOverview> {
  const supabase = await createClient();
  const [advertisers, channels, investments, metrics] = await Promise.all([
    count("advertisers"),
    count("media_channels"),
    count("ad_investments"),
    count("digital_metrics"),
  ]);

  const { data: inv } = await supabase
    .from("ad_investments")
    .select("amount_usd, status")
    .limit(1000);

  const investmentTotal = (inv ?? []).reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
  const verified = (inv ?? []).filter((r) => r.status === "verificado").length;
  const verifiedShare = inv && inv.length ? verified / inv.length : 0;

  return { advertisers, channels, investments, metrics, investmentTotal, verifiedShare };
}

export async function getAdvertisers(limit = 50): Promise<Advertiser[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("advertisers")
    .select("id, name, legal_id, sector, province, status")
    .order("name")
    .limit(limit);
  return (data ?? []) as Advertiser[];
}

export async function getChannels(limit = 50): Promise<MediaChannel[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("media_channels")
    .select("id, name, media_type, owner")
    .order("name")
    .limit(limit);
  return (data ?? []) as MediaChannel[];
}

export async function getInvestments(limit = 30): Promise<Investment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ad_investments")
    .select("id, advertiser_id, media_type, period_year, period_month, amount_usd, status, advertisers(name)")
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as Investment[];
}

export async function getMetrics(limit = 30): Promise<Metric[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("digital_metrics")
    .select("id, advertiser_id, platform, period_year, period_month, impressions, clicks, spend_usd, status, advertisers(name)")
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as Metric[];
}
