import type { MediaGroup } from "@/lib/media-groups";

export type PlanningGoal = "balanced" | "reach" | "frequency" | "conversion" | "local";

export type PlanningScenario = {
  id: "recommended" | "efficiency" | "presence";
  label: string;
  description: string;
  confidence: "alta" | "media" | "requiere datos";
  allocations: Array<{ kind: MediaGroup; pct: number; amountUsd: number }>;
  validations: string[];
};

type ScenarioInput = {
  budgetUsd: number;
  selectedMedia: MediaGroup[];
  objective?: string;
  priority?: string;
  audienceType?: string;
  geographyCount?: number;
  digitalReady?: boolean;
};

const BASE: Record<MediaGroup, number> = {
  television: 1,
  radio: 0.9,
  ooh: 1,
  press: 0.55,
  digital: 1.25,
  influencers: 0.85,
};

const LABELS: Record<MediaGroup, string> = {
  television: "Televisión",
  radio: "Radio",
  ooh: "Vía pública",
  press: "Prensa",
  digital: "Digital",
  influencers: "Influenciadores",
};

export function buildPlanningScenarios(input: ScenarioInput): PlanningScenario[] {
  const selected = [...new Set(input.selectedMedia)].filter((item): item is MediaGroup => item in BASE);
  if (!Number.isFinite(input.budgetUsd) || input.budgetUsd <= 0 || selected.length === 0) return [];

  const objective = normalize(`${input.objective ?? ""} ${input.priority ?? ""}`);
  const audience = normalize(input.audienceType ?? "");
  const modifiers = Object.fromEntries(selected.map((kind) => [kind, objectiveWeight(kind, objective, audience)])) as Partial<Record<MediaGroup, number>>;
  const recommended = normalizeWeights(selected, (kind) => BASE[kind] * (modifiers[kind] ?? 1));
  const efficiency = normalizeWeights(selected, (kind) => {
    const measurable = kind === "digital" ? 1.65 : kind === "radio" || kind === "influencers" ? 1.1 : kind === "press" ? 0.65 : 0.82;
    return BASE[kind] * measurable * (modifiers[kind] ?? 1);
  });
  const presence = normalizeWeights(selected, (kind) => {
    const territorial = kind === "ooh" ? 1.7 : kind === "radio" ? 1.4 : kind === "television" ? 1.25 : kind === "digital" ? 0.95 : 0.8;
    const multiGeo = (input.geographyCount ?? 1) > 1 && (kind === "ooh" || kind === "radio") ? 1.2 : 1;
    return BASE[kind] * territorial * multiGeo * (modifiers[kind] ?? 1);
  });

  const readiness = input.digitalReady === false && selected.includes("digital") ? "requiere datos" : selected.length <= 3 ? "alta" : "media";
  const validations = validationList(selected, Boolean(input.digitalReady));
  return [
    scenario("recommended", "Recomendado por Mavi", "Equilibra el objetivo, la audiencia y el rol válido de cada medio.", recommended, input.budgetUsd, readiness, validations),
    scenario("efficiency", "Eficiencia y aprendizaje", "Concentra más inversión en ejecuciones medibles y deja espacio para aprender antes de escalar.", efficiency, input.budgetUsd, readiness, validations),
    scenario("presence", "Presencia territorial", "Refuerza cobertura local, frecuencia contextual y visibilidad física en las plazas elegidas.", presence, input.budgetUsd, readiness, validations),
  ];
}

export function planningGoal(objective?: string, priority?: string): PlanningGoal {
  const value = normalize(`${objective ?? ""} ${priority ?? ""}`);
  if (/venta|lead|conversion|mensaje|trafico|descarga/.test(value)) return "conversion";
  if (/frecuencia|recordacion/.test(value)) return "frequency";
  if (/local|territor|visita/.test(value)) return "local";
  if (/alcance|reconocimiento|cobertura/.test(value)) return "reach";
  return "balanced";
}

function objectiveWeight(kind: MediaGroup, objective: string, audience: string) {
  const goal = planningGoal(objective, objective);
  const weights: Record<PlanningGoal, Record<MediaGroup, number>> = {
    balanced: { television: 1, radio: 1, ooh: 1, press: 1, digital: 1, influencers: 1 },
    reach: { television: 1.35, radio: 1.12, ooh: 1.25, press: 0.8, digital: 1.08, influencers: 1 },
    frequency: { television: 0.95, radio: 1.4, ooh: 1.2, press: 0.75, digital: 1.2, influencers: 0.9 },
    conversion: { television: 0.72, radio: 0.85, ooh: 0.82, press: 0.62, digital: 1.6, influencers: 1.15 },
    local: { television: 0.7, radio: 1.35, ooh: 1.55, press: 0.75, digital: 1.18, influencers: 1.05 },
  };
  const b2b = /b2b|empresa|profesional/.test(audience);
  if (b2b && kind === "press") return weights[goal][kind] * 1.25;
  if (b2b && kind === "influencers") return weights[goal][kind] * 0.8;
  return weights[goal][kind];
}

function normalizeWeights(groups: MediaGroup[], weight: (kind: MediaGroup) => number) {
  const raw = groups.map((kind) => ({ kind, value: Math.max(0.01, weight(kind)) }));
  const total = raw.reduce((sum, item) => sum + item.value, 0);
  const basisPoints = raw.map((item) => ({ kind: item.kind, bp: Math.floor(item.value / total * 10_000) }));
  let remainder = 10_000 - basisPoints.reduce((sum, item) => sum + item.bp, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % basisPoints.length) {
    basisPoints[index].bp += 1;
    remainder -= 1;
  }
  return basisPoints.map((item) => ({ kind: item.kind, pct: item.bp / 10_000 }));
}

function scenario(
  id: PlanningScenario["id"],
  label: string,
  description: string,
  weights: Array<{ kind: MediaGroup; pct: number }>,
  budgetUsd: number,
  confidence: PlanningScenario["confidence"],
  validations: string[],
): PlanningScenario {
  const cents = Math.round(budgetUsd * 100);
  let assigned = 0;
  const allocations = weights.map((item, index) => {
    const amountCents = index === weights.length - 1 ? cents - assigned : Math.round(cents * item.pct);
    assigned += amountCents;
    return { kind: item.kind, pct: item.pct, amountUsd: amountCents / 100 };
  });
  return { id, label, description, confidence, allocations, validations };
}

function validationList(selected: MediaGroup[], digitalReady: boolean) {
  const list: string[] = [];
  if (selected.includes("television")) list.push("Programas, ratings compatibles, vigencia y cupos de TV.");
  if (selected.includes("radio")) list.push("Tarifas, franjas, cume y duplicación de radio.");
  if (selected.includes("ooh")) list.push("Disponibilidad, permisos, producción y flujo de cada soporte.");
  if (selected.includes("press")) list.push("Edición, circulación/lectura, cierre y tarifa vigente.");
  if (selected.includes("influencers")) list.push("Disponibilidad, derechos, territorio, entregables y vigencia.");
  if (selected.includes("digital") && !digitalReady) list.push("Destino, tracking, consentimiento y acceso a cuentas antes del forecast.");
  return list;
}

export function mediaGroupLabel(kind: MediaGroup) {
  return LABELS[kind];
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
