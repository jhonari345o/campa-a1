import { createAdminClient } from "@/lib/supabase/admin";
import { MEDIA_TYPE_LABELS } from "@/lib/market";

export type PlanInput = {
  keyword: string;
  budgetUsd?: number | null;
  selectedMedia?: string[];
  objective?: string;
  priority?: string;
  audienceType?: string;
  geography?: string;
  businessModel?: string;
  conversionModel?: string;
  trackingStatus?: string;
};

export type PlanRow = {
  label: string;
  pct: number;
  amount: number | null;
  rationale?: string;
};

export type MediaPlan = {
  matched: number;
  totalRef: number;
  basis: "giro" | "sector" | "mercado";
  benchmark: PlanRow[];
  plan: PlanRow[];
  profileLabel: string;
  strategySummary: string;
};

type MediaGroup = "television" | "radio" | "ooh" | "press" | "digital" | "influencers";
type DigitalKey = "meta" | "google" | "whatsapp" | "tiktok" | "linkedin" | "spotify" | "programmatic" | "pinterest";

export type StrategicProfile = {
  id: string;
  label: string;
  keywords: string[];
  promise: string;
  proof: string;
  offer: string;
  channelBias: Record<MediaGroup, number>;
  digitalSplit: Partial<Record<DigitalKey, number>>;
};

const GROUP_LABELS: Record<Exclude<MediaGroup, "digital">, string> = {
  television: "Televisión",
  radio: "Radio",
  ooh: "Vía pública",
  press: "Prensa",
  influencers: "Influenciadores",
};

const DIGITAL_LABELS: Record<DigitalKey, string> = {
  meta: "Meta — Facebook e Instagram",
  google: "Google — Búsqueda y YouTube",
  whatsapp: "WhatsApp Business",
  tiktok: "TikTok",
  linkedin: "LinkedIn Ads",
  spotify: "Spotify Ads",
  programmatic: "Programmatic — Ad Mavericks DSP",
  pinterest: "Pinterest Ads",
};

const FALLBACK_SHARE: Record<MediaGroup, number> = {
  digital: 0.38,
  television: 0.2,
  radio: 0.13,
  ooh: 0.12,
  press: 0.07,
  influencers: 0.1,
};

const PROFILES: StrategicProfile[] = [
  {
    id: "gastronomia",
    label: "Gastronomía y consumo local",
    keywords: ["cafeteria", "cafe", "restaurante", "comida", "food", "bar", "panaderia", "heladeria", "delivery"],
    promise: "antojo, experiencia y conveniencia",
    proof: "producto real, reseñas y cercanía",
    offer: "una visita, reserva o pedido con incentivo medible",
    channelBias: { television: 0.7, radio: 1.15, ooh: 1.05, press: 0.45, digital: 1.35, influencers: 1.45 },
    digitalSplit: { meta: 0.34, google: 0.2, whatsapp: 0.16, tiktok: 0.2, spotify: 0.04, programmatic: 0.06 },
  },
  {
    id: "retail",
    label: "Retail y comercio",
    keywords: ["retail", "tienda", "almacen", "supermercado", "ropa", "moda", "ecommerce", "comercio", "producto"],
    promise: "variedad, precio y disponibilidad",
    proof: "catálogo, demostración y prueba social",
    offer: "una promoción con vigencia y llamado a compra",
    channelBias: { television: 1.0, radio: 0.9, ooh: 1.15, press: 0.65, digital: 1.25, influencers: 1.15 },
    digitalSplit: { meta: 0.31, google: 0.24, whatsapp: 0.12, tiktok: 0.15, programmatic: 0.1, pinterest: 0.08 },
  },
  {
    id: "salud",
    label: "Salud y bienestar",
    keywords: ["farmacia", "salud", "clinica", "medico", "dental", "odont", "laboratorio", "bienestar", "optica"],
    promise: "confianza, acceso y acompañamiento",
    proof: "credenciales, procesos claros y testimonios autorizados",
    offer: "una consulta, cotización o visita sin promesas clínicas",
    channelBias: { television: 0.95, radio: 1.2, ooh: 0.85, press: 0.8, digital: 1.15, influencers: 0.65 },
    digitalSplit: { meta: 0.27, google: 0.35, whatsapp: 0.16, tiktok: 0.06, programmatic: 0.1, linkedin: 0.06 },
  },
  {
    id: "finanzas",
    label: "Finanzas y servicios regulados",
    keywords: ["banco", "finanza", "credito", "seguro", "cooperativa", "inversion", "fintech", "pago"],
    promise: "claridad, seguridad y control",
    proof: "condiciones transparentes, respaldo y casos verificables",
    offer: "una simulación, solicitud o asesoría con términos visibles",
    channelBias: { television: 1.15, radio: 0.9, ooh: 1.0, press: 1.05, digital: 1.2, influencers: 0.55 },
    digitalSplit: { meta: 0.2, google: 0.3, linkedin: 0.18, programmatic: 0.2, whatsapp: 0.08, spotify: 0.04 },
  },
  {
    id: "automotriz",
    label: "Automotriz y movilidad",
    keywords: ["auto", "carro", "moto", "vehiculo", "automotriz", "concesionario", "repuesto", "movilidad"],
    promise: "desempeño, diseño y una decisión segura",
    proof: "demostración, ficha técnica y experiencia de uso",
    offer: "una prueba, cotización o visita al punto de venta",
    channelBias: { television: 1.1, radio: 0.9, ooh: 1.25, press: 0.65, digital: 1.2, influencers: 0.8 },
    digitalSplit: { meta: 0.27, google: 0.33, tiktok: 0.1, programmatic: 0.18, whatsapp: 0.07, spotify: 0.05 },
  },
  {
    id: "inmobiliario",
    label: "Inmobiliario y construcción",
    keywords: ["inmobili", "vivienda", "casa", "departamento", "construct", "proyecto", "terreno"],
    promise: "ubicación, patrimonio y calidad de vida",
    proof: "recorrido, planos, avances y condiciones verificables",
    offer: "una visita, llamada o precalificación",
    channelBias: { television: 0.85, radio: 0.7, ooh: 1.35, press: 0.8, digital: 1.3, influencers: 0.55 },
    digitalSplit: { meta: 0.3, google: 0.31, whatsapp: 0.14, linkedin: 0.08, programmatic: 0.12, pinterest: 0.05 },
  },
  {
    id: "educacion",
    label: "Educación y formación",
    keywords: ["colegio", "universidad", "educacion", "curso", "academia", "capacitacion", "maestria", "idioma"],
    promise: "progreso, empleabilidad y comunidad",
    proof: "programa, docentes, resultados y testimonios",
    offer: "información, inscripción o una sesión introductoria",
    channelBias: { television: 0.8, radio: 1.0, ooh: 0.9, press: 0.7, digital: 1.3, influencers: 0.8 },
    digitalSplit: { meta: 0.26, google: 0.3, tiktok: 0.12, whatsapp: 0.12, linkedin: 0.12, programmatic: 0.08 },
  },
  {
    id: "b2b",
    label: "Servicios B2B y profesionales",
    keywords: ["b2b", "empresa", "consultor", "software", "tecnologia", "logistica", "industrial", "corporativo", "profesional"],
    promise: "eficiencia, reducción de riesgo y retorno",
    proof: "casos, metodología y evidencia operativa",
    offer: "una demo, diagnóstico o reunión con un especialista",
    channelBias: { television: 0.45, radio: 0.55, ooh: 0.7, press: 0.85, digital: 1.55, influencers: 0.4 },
    digitalSplit: { google: 0.31, linkedin: 0.32, meta: 0.14, programmatic: 0.17, whatsapp: 0.06 },
  },
];

const DEFAULT_PROFILE: StrategicProfile = {
  id: "general",
  label: "Consumo y servicios",
  keywords: [],
  promise: "una propuesta relevante y fácil de entender",
  proof: "beneficios concretos, demostración y prueba social",
  offer: "una acción clara y medible",
  channelBias: { television: 1, radio: 1, ooh: 1, press: 0.8, digital: 1.2, influencers: 0.9 },
  digitalSplit: { meta: 0.29, google: 0.27, whatsapp: 0.11, tiktok: 0.11, linkedin: 0.06, spotify: 0.04, programmatic: 0.08, pinterest: 0.04 },
};

export function strategicProfileFor(keyword: string, audienceType = "", businessModel = ""): StrategicProfile {
  const haystack = comparable(`${keyword} ${audienceType} ${businessModel}`);
  if (comparable(audienceType).includes("b2b")) return PROFILES.find((profile) => profile.id === "b2b")!;
  return PROFILES.find((profile) => profile.keywords.some((term) => containsTerm(haystack, term))) ?? DEFAULT_PROFILE;
}

function comparable(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function containsTerm(haystack: string, term: string): boolean {
  const needle = comparable(term);
  if (needle.length > 3) return haystack.includes(needle);
  return haystack.split(/[^a-z0-9]+/).includes(needle);
}

export function mediaGroupForLabel(label: string): string | null {
  const value = comparable(label);
  if (["meta", "google", "whatsapp", "tiktok", "linkedin", "spotify", "pinterest", "programmatic", "buscador", "redes sociales", "streaming", "sitios y apps"].some((key) => value.includes(key))) return "digital";
  if (value.includes("tv") || value.includes("television")) return "television";
  if (value.includes("radio")) return "radio";
  if (value.includes("prensa") || value.includes("revista") || value.includes("periodico")) return "press";
  if (value.includes("via publica") || value.includes("exterior") || value.includes("ooh")) return "ooh";
  if (value.includes("influencer")) return "influencers";
  return null;
}

export function filterPlanByMedia(rows: PlanRow[], selectedMedia: string[] | undefined, budget: number | null): PlanRow[] {
  const selected = new Set(selectedMedia ?? []);
  if (!selected.size) return rows;
  const eligible = rows.filter((row) => {
    const group = mediaGroupForLabel(row.label);
    return group ? selected.has(group) : false;
  });
  if (!eligible.length) return rows;
  const total = eligible.reduce((sum, row) => sum + row.pct, 0) || 1;
  return eligible.map((row) => {
    const pct = row.pct / total;
    return { ...row, pct, amount: budget ? budget * pct : null };
  }).sort((a, b) => b.pct - a.pct);
}

export async function buildMediaPlan(input: PlanInput): Promise<MediaPlan> {
  const db = createAdminClient();
  const keyword = input.keyword.trim();
  const profile = strategicProfileFor(keyword, input.audienceType, input.businessModel);
  const { data: raw } = await db
    .from("ad_investments")
    .select("media_type, amount_usd, advertisers(name, sector)")
    .limit(4000);

  const allRows = raw ?? [];
  const needle = comparable(keyword).trim();
  const related = allRows.filter((row) => {
    const advertiser = row.advertisers as unknown as { name?: string; sector?: string } | null;
    const text = comparable(`${advertiser?.name ?? ""} ${advertiser?.sector ?? ""}`);
    return needle.length > 1 && text.includes(needle);
  });
  const sectorRows = allRows.filter((row) => {
    const advertiser = row.advertisers as unknown as { sector?: string } | null;
    const sector = comparable(advertiser?.sector ?? "");
    return Boolean(sector) && profile.keywords.some((term) => containsTerm(sector, term));
  });

  const selectedRows = related.length >= 3 ? related : sectorRows.length >= 3 ? sectorRows : allRows;
  const basis: MediaPlan["basis"] = related.length >= 3 ? "giro" : sectorRows.length >= 3 ? "sector" : "mercado";
  const byMedia = new Map<string, number>();
  const advertisers = new Set<string>();
  let total = 0;
  for (const row of selectedRows) {
    const amount = Number(row.amount_usd ?? 0);
    if (amount <= 0) continue;
    const key = String(row.media_type ?? "otros");
    byMedia.set(key, (byMedia.get(key) ?? 0) + amount);
    total += amount;
    const advertiser = row.advertisers as unknown as { name?: string } | null;
    if (advertiser?.name) advertisers.add(advertiser.name);
  }

  const budget = input.budgetUsd && input.budgetUsd > 0 ? input.budgetUsd : null;
  const benchmark: PlanRow[] = [...byMedia.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([mediaType, value]) => ({
      label: MEDIA_TYPE_LABELS[mediaType] ?? mediaType,
      pct: total > 0 ? value / total : 0,
      amount: budget && total > 0 ? budget * value / total : null,
    }));

  const marketGroups = aggregateMarketGroups(byMedia, total);
  const selectedGroups = new Set<MediaGroup>((input.selectedMedia?.length ? input.selectedMedia : Object.keys(FALLBACK_SHARE)) as MediaGroup[]);
  const weightedGroups = [...selectedGroups].map((group) => {
    const marketShare = marketGroups.get(group) ?? FALLBACK_SHARE[group];
    const weight = marketShare
      * profile.channelBias[group]
      * objectiveBias(group, input.objective ?? "")
      * priorityBias(group, input.priority ?? "");
    return { group, weight };
  });
  const groupTotal = weightedGroups.reduce((sum, item) => sum + item.weight, 0) || 1;
  const plan: PlanRow[] = [];

  for (const item of weightedGroups) {
    const groupPct = item.weight / groupTotal;
    if (item.group === "digital") {
      const split = normalizeDigitalSplit(profile.digitalSplit);
      for (const [key, share] of split) {
        const pct = groupPct * share;
        if (pct < 0.012) continue;
        plan.push({
          label: DIGITAL_LABELS[key],
          pct,
          amount: budget ? budget * pct : null,
          rationale: digitalRationale(key, profile, input),
        });
      }
      continue;
    }
    plan.push({
      label: GROUP_LABELS[item.group],
      pct: groupPct,
      amount: budget ? budget * groupPct : null,
      rationale: groupRationale(item.group, profile, input),
    });
  }

  plan.sort((a, b) => b.pct - a.pct);
  const top = plan.slice(0, 3).map((row) => row.label).join(", ");
  const location = input.geography?.trim() || "la cobertura seleccionada";
  const objective = input.objective?.trim() || "el objetivo comercial";
  const priority = input.priority?.trim() || "balance";

  return {
    matched: advertisers.size,
    totalRef: total,
    basis,
    benchmark,
    plan,
    profileLabel: profile.label,
    strategySummary: `Para ${profile.label.toLowerCase()}, con foco en ${objective.toLowerCase()} y prioridad ${priority.toLowerCase()}, la mezcla concentra el esfuerzo en ${top}. La ejecución se adapta a ${location}.`,
  };
}

function aggregateMarketGroups(byMedia: Map<string, number>, total: number): Map<MediaGroup, number> {
  const groups = new Map<MediaGroup, number>();
  if (total <= 0) return groups;
  for (const [mediaType, value] of byMedia) {
    const group = mediaGroupForLabel(MEDIA_TYPE_LABELS[mediaType] ?? mediaType) as MediaGroup | null;
    if (!group) continue;
    groups.set(group, (groups.get(group) ?? 0) + value / total);
  }
  return groups;
}

function normalizeDigitalSplit(split: StrategicProfile["digitalSplit"]): [DigitalKey, number][] {
  const entries = Object.entries(split).filter((entry): entry is [DigitalKey, number] => Number(entry[1]) > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  return entries.map(([key, value]) => [key, value / total]);
}

function objectiveBias(group: MediaGroup, objective: string): number {
  const value = comparable(objective);
  if (value.includes("reconocimiento") || value.includes("alcance")) return ({ television: 1.35, radio: 1.15, ooh: 1.25, press: 0.85, digital: 1.05, influencers: 1.1 })[group];
  if (["venta", "lead", "mensaje", "trafico", "descarga"].some((term) => value.includes(term))) return ({ television: 0.75, radio: 0.85, ooh: 0.8, press: 0.65, digital: 1.45, influencers: 1.05 })[group];
  if (value.includes("visita")) return ({ television: 0.75, radio: 1.15, ooh: 1.4, press: 0.65, digital: 1.2, influencers: 1.05 })[group];
  return 1;
}

function priorityBias(group: MediaGroup, priority: string): number {
  const value = comparable(priority);
  if (value.includes("frecuencia")) return ({ television: 0.9, radio: 1.3, ooh: 1.1, press: 0.8, digital: 1.15, influencers: 0.8 })[group];
  if (value.includes("cobertura")) return ({ television: 1.3, radio: 1.05, ooh: 1.15, press: 0.8, digital: 1.1, influencers: 0.9 })[group];
  if (value.includes("conversion") || value.includes("eficiencia")) return ({ television: 0.75, radio: 0.85, ooh: 0.75, press: 0.65, digital: 1.4, influencers: 1.0 })[group];
  if (value.includes("afinidad")) return group === "influencers" || group === "digital" ? 1.3 : 0.9;
  if (value.includes("local")) return group === "radio" || group === "ooh" || group === "digital" ? 1.25 : 0.8;
  return 1;
}

function groupRationale(group: Exclude<MediaGroup, "digital">, profile: StrategicProfile, input: PlanInput): string {
  const geography = input.geography?.trim() || "las plazas prioritarias";
  const reasons: Record<Exclude<MediaGroup, "digital">, string> = {
    television: `Aporta notoriedad audiovisual para comunicar ${profile.promise}; conviene concentrarla en contenidos afines, no repartirla por inercia.`,
    radio: `Construye frecuencia en ${geography} con mensajes cortos, horarios y emisoras alineadas al público del brief.`,
    ooh: `Da presencia física en ${geography}; la ubicación debe responder a movilidad, puntos de venta y momento de decisión.`,
    press: `Suma contexto y credibilidad para explicar ${profile.proof}, con cabeceras y formatos elegidos por afinidad.`,
    influencers: `Convierte ${profile.proof} en contenido demostrable; se seleccionan perfiles por territorio creativo y calidad de audiencia.`,
  };
  return reasons[group];
}

function digitalRationale(key: DigitalKey, profile: StrategicProfile, input: PlanInput): string {
  const objective = input.objective?.trim().toLowerCase() || "el objetivo";
  const geography = input.geography?.trim() || "la geografía definida";
  const reasons: Record<DigitalKey, string> = {
    meta: `Usa video, historias y mensajes para convertir ${profile.promise} en piezas segmentadas hacia ${objective}.`,
    google: `Captura intención activa y búsquedas relacionadas con ${input.keyword} en ${geography}; separar marca, categoría y competencia.`,
    whatsapp: `Reduce fricción hacia ${profile.offer}; necesita respuesta rápida, catálogo y medición de conversaciones útiles.`,
    tiktok: `Prueba demostraciones y códigos culturales nativos; el gancho debe mostrar ${profile.proof} en los primeros segundos.`,
    linkedin: `Prioriza cargos y empresas, con contenido de autoridad y una conversión consultiva hacia ${profile.offer}.`,
    spotify: `Añade frecuencia en momentos de escucha con audio contextual y una idea simple, reconocible y local.`,
    programmatic: `Amplía cobertura con control de inventario, formatos y brand safety; medir viewability y frecuencia antes de escalar.`,
    pinterest: `Trabaja descubrimiento visual y consideración con colecciones, inspiración y destino de producto medible.`,
  };
  return reasons[key];
}
