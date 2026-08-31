import type { MediaGroup } from "@/lib/media-groups";

export type CpmHypothesis = { low: number; high: number };
export type TwinAllocation = { kind: MediaGroup; pct: number; amountUsd: number };
export type CampaignTwin = {
  confidence: number;
  confidenceLabel: "alta" | "media" | "baja";
  modeledImpressions: { low: number; high: number };
  media: Array<TwinAllocation & { capPct: number; saturation: number; risk: "estable" | "vigilar" | "saturado"; impressions: { low: number; high: number }; cpm: CpmHypothesis }>;
  optimization: { from: MediaGroup; to: MediaGroup; shiftPct: number; shiftUsd: number; reason: string } | null;
  geographies: Array<{ label: string; planningShare: number; amountUsd: number }>;
  timeline: Array<{ phase: string; period: string; action: string }>;
};

export const DEFAULT_CPM_HYPOTHESES: Record<MediaGroup, CpmHypothesis> = {
  television: { low: 14, high: 38 },
  radio: { low: 5, high: 18 },
  ooh: { low: 8, high: 28 },
  press: { low: 18, high: 45 },
  digital: { low: 3.5, high: 12 },
  influencers: { low: 9, high: 32 },
};

const CAPS: Record<MediaGroup, number> = {
  television: 0.5,
  radio: 0.35,
  ooh: 0.35,
  press: 0.25,
  digital: 0.6,
  influencers: 0.3,
};

export function buildCampaignTwin(input: {
  budgetUsd: number;
  allocations: TwinAllocation[];
  geographies: string[];
  digitalReady: boolean;
  cpm?: Partial<Record<MediaGroup, CpmHypothesis>>;
}): CampaignTwin {
  const budgetUsd = positive(input.budgetUsd);
  const media = input.allocations.map((allocation) => {
    const capPct = CAPS[allocation.kind];
    const saturation = Math.round(allocation.pct / capPct * 100);
    const cpm = validCpm(input.cpm?.[allocation.kind]) ?? DEFAULT_CPM_HYPOTHESES[allocation.kind];
    const impressions = impressionRange(allocation.amountUsd, cpm);
    return {
      ...allocation,
      capPct,
      saturation,
      risk: saturation > 115 ? "saturado" as const : saturation > 90 ? "vigilar" as const : "estable" as const,
      impressions,
      cpm,
    };
  });
  const modeledImpressions = media.reduce((total, item) => ({ low: total.low + item.impressions.low, high: total.high + item.impressions.high }), { low: 0, high: 0 });
  const over = [...media].filter((item) => item.pct > item.capPct).sort((a, b) => b.saturation - a.saturation)[0];
  const under = [...media].filter((item) => item.kind !== over?.kind && item.pct < item.capPct * 0.75).sort((a, b) => a.saturation - b.saturation)[0];
  const shiftPct = over && under ? Math.min(over.pct - over.capPct, under.capPct * 0.75 - under.pct, 0.12) : 0;
  const optimization = over && under && shiftPct >= 0.01 ? {
    from: over.kind,
    to: under.kind,
    shiftPct,
    shiftUsd: Math.round(budgetUsd * shiftPct * 100) / 100,
    reason: `La concentración de ${over.kind} supera el umbral de diversificación del simulador; ${under.kind} conserva capacidad de prueba.`,
  } : null;
  const geographies = [...new Set(input.geographies.filter(Boolean))];
  const geoCount = Math.max(1, geographies.length);
  const planningShare = 1 / geoCount;
  const confidence = clamp(42 + (input.digitalReady ? 18 : 0) + (media.length <= 4 ? 12 : 5) + (geoCount <= 3 ? 10 : 2) + (optimization ? 0 : 8), 0, 92);
  return {
    confidence,
    confidenceLabel: confidence >= 78 ? "alta" : confidence >= 58 ? "media" : "baja",
    modeledImpressions,
    media,
    optimization,
    geographies: geographies.map((label, index) => ({
      label,
      planningShare,
      amountUsd: index === geographies.length - 1 ? Math.round((budgetUsd - Math.round(budgetUsd * planningShare * 100) / 100 * index) * 100) / 100 : Math.round(budgetUsd * planningShare * 100) / 100,
    })),
    timeline: [
      { phase: "Preparación", period: "Días -7 a 0", action: "Confirmar inventario, creatividades, tracking, derechos y responsables." },
      { phase: "Lanzamiento", period: "Semana 1", action: "Activar por etapas y comprobar entrega, enlaces y eventos sin ampliar gasto." },
      { phase: "Aprendizaje", period: "Semanas 2–3", action: "Comparar señales homogéneas y redistribuir sólo con evidencia suficiente." },
      { phase: "Decisión", period: "Semana 4", action: "Escalar, mantener o detener; documentar aprendizajes para la siguiente versión." },
    ],
  };
}

function impressionRange(amountUsd: number, cpm: CpmHypothesis) {
  const amount = positive(amountUsd);
  return { low: Math.round(amount * 1000 / cpm.high), high: Math.round(amount * 1000 / cpm.low) };
}
function validCpm(value?: CpmHypothesis) { return value && positive(value.low) && positive(value.high) && value.high >= value.low ? value : null; }
function positive(value: number) { return Number.isFinite(value) && value > 0 ? value : 0; }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, Math.round(value))); }
