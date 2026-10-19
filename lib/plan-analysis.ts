import type { MediaPlan } from "@/lib/planner";
import { mediaGroupForLabel } from "@/lib/media-groups";

export type AnalysisStatus = "listo" | "por_validar" | "requiere_preparacion";

export type AnalysisSignal = {
  kind: string;
  label: string;
  role: "principal" | "complementario" | "por_validar";
  share: number;
  amount: number | null;
  planningKpi: string;
  rationale: string;
  evidence: string;
  validation: string;
  status: AnalysisStatus;
};

export type PlanAnalysis = {
  category: string;
  profileLabel: string;
  periodLabel: string;
  targetLabel: string;
  coverageLabel: string;
  commercialReadiness: number;
  digitalReadiness: number | null;
  findings: Array<{ label: string; value: string; detail: string; status: AnalysisStatus }>;
  signals: AnalysisSignal[];
  guardrails: string[];
  wowCase: null | { idea: string; budget: string; status: string; missing: string[] };
};

export type PlanAnalysisInput = {
  keyword: string;
  objective: string;
  priority: string;
  audienceType: string;
  audience: string;
  ageRange: string;
  sex: string;
  socioeconomic: string;
  geography: string;
  budgetUsd: number | null;
  selectedMedia: string[];
  businessDescription: string;
  businessModel: string;
  conversionModel: string;
  commercialGoalAmount: string;
  averageTicket: string;
  grossMargin: string;
  operationalCapacity: string;
  commercialKpi: string;
  valueProposition: string;
  competitors: string;
  restrictions: string;
  learnings: string;
  products: Array<{ name: string; price: string; margin: string; capacity: string; season: string; notes: string }>;
  digitalObjective: string;
  conversionEvent: string;
  digitalPlatforms: string[];
  digitalDestination: string;
  trackingStatus: string;
  adAccountsStatus: string;
  measurementStack: string[];
  firstPartyData: string;
  qualifiedLead: string;
  attributionModel: string;
  consentStatus: string;
  managementNeed: string;
  wowEnabled: boolean;
  wowIdea: string;
  wowBudget: string;
  wowMunicipality: string;
  wowExactLocation: string;
  wowFormat: string;
  wowSurface: string;
  wowOwnership: string;
  wowMeasurements: string;
};

const MEDIA_LABELS: Record<string, string> = {
  television: "Televisión",
  radio: "Radio",
  press: "Prensa",
  digital: "Digital",
  ooh: "Vía pública",
  influencers: "Influenciadores",
};

const MEDIA_RULES: Record<string, { kpi: string; evidence: string; validation: string }> = {
  television: {
    kpi: "Alcance 1+ y frecuencia",
    evidence: "Catálogos y referencias 2026; los TRP se mantienen como presión secundaria.",
    validation: "Corrida de audiencia compatible con target, plaza y período.",
  },
  radio: {
    kpi: "Cobertura o cume y frecuencia",
    evidence: "Ranking y audiencia por emisora; las señales no se suman como personas únicas.",
    validation: "Cume y duplicación para las emisoras, target, plaza y período elegidos.",
  },
  press: {
    kpi: "Alcance o readership compatible",
    evidence: "Tarifarios y circulación declarada; circulación no equivale a alcance de campaña.",
    validation: "Fuente de readership, edición, plaza y período compatibles.",
  },
  digital: {
    kpi: "KPI específico del objetivo",
    evidence: "Forecast separado por plataforma, destino y evento de conversión.",
    validation: "Destino, tracking, cuentas y consentimiento listos antes de publicar el forecast.",
  },
  ooh: {
    kpi: "Cobertura territorial",
    evidence: "Inventario, corredor, formato y precio por activo; OTS no se convierte en Reach 1+.",
    validation: "Disponibilidad, ruta, permisos y factibilidad técnica del soporte.",
  },
  influencers: {
    kpi: "Entregables contratados y publicados",
    evidence: "Métricas declaradas por perfil y plataforma; seguidores y views no son Reach 1+.",
    validation: "Perfil, tarifa, derechos de uso, vigencia, disponibilidad y brand safety.",
  },
};

export function buildPlanAnalysis(input: PlanAnalysisInput, plan: MediaPlan): PlanAnalysis {
  const commercialFields = [
    input.businessDescription, input.businessModel, input.conversionModel, input.commercialGoalAmount,
    input.averageTicket, input.grossMargin, input.operationalCapacity, input.commercialKpi,
    input.valueProposition, input.competitors, input.restrictions, input.learnings,
  ];
  const commercialReadiness = completion(commercialFields);
  const includesDigital = input.selectedMedia.includes("digital");
  const digitalFields = [
    input.digitalObjective, input.conversionEvent, input.digitalDestination, input.trackingStatus,
    input.adAccountsStatus, input.firstPartyData, input.qualifiedLead, input.attributionModel,
    input.consentStatus, input.managementNeed, input.digitalPlatforms, input.measurementStack,
  ];
  const digitalReadiness = includesDigital ? completion(digitalFields) : null;
  const shares = new Map<string, { share: number; amount: number }>();
  for (const row of plan.plan) {
    const group = mediaGroupForLabel(row.label);
    if (!group) continue;
    const current = shares.get(group) ?? { share: 0, amount: 0 };
    current.share += row.pct;
    current.amount += row.amount ?? 0;
    shares.set(group, current);
  }
  const ranked = [...input.selectedMedia].sort((a, b) => (shares.get(b)?.share ?? 0) - (shares.get(a)?.share ?? 0));
  const signals = input.selectedMedia.map((kind): AnalysisSignal => {
    const metrics = shares.get(kind) ?? { share: 0, amount: 0 };
    const rule = MEDIA_RULES[kind] ?? MEDIA_RULES.ooh;
    const digitalReady = input.trackingStatus === "Implementado y validado"
      && input.adAccountsStatus === "Existen y tenemos acceso";
    const status: AnalysisStatus = kind === "digital"
      ? digitalReady ? "listo" : "requiere_preparacion"
      : "por_validar";
    const rank = ranked.indexOf(kind);
    return {
      kind,
      label: MEDIA_LABELS[kind] ?? kind,
      role: metrics.share <= 0 ? "por_validar" : rank === 0 ? "principal" : "complementario",
      share: metrics.share,
      amount: input.budgetUsd ? metrics.amount : null,
      planningKpi: kind === "digital" ? digitalKpi(input.objective, input.digitalObjective) : rule.kpi,
      rationale: plan.plan.find((row) => mediaGroupForLabel(row.label) === kind)?.rationale
        ?? "Se conserva para que el planner valide su función dentro del mix.",
      evidence: rule.evidence,
      validation: rule.validation,
      status,
    };
  });

  const findings: PlanAnalysis["findings"] = [
    {
      label: "Categoría y competencia",
      value: plan.profileLabel,
      detail: input.competitors
        ? `Se conciliará la presión observada con los competidores declarados: ${input.competitors}.`
        : "La categoría está identificada; falta declarar competidores para comparar presión relativa.",
      status: input.competitors ? "listo" : "por_validar",
    },
    {
      label: "Audiencia",
      value: `${input.sex} · ${input.ageRange}`,
      detail: input.audience
        ? `${input.audience}. La compatibilidad se valida por fuente y medio.`
        : "El corte demográfico queda registrado; intereses o cargos todavía están por definir.",
      status: input.audience ? "listo" : "por_validar",
    },
    {
      label: "Presupuesto",
      value: input.budgetUsd ? money(input.budgetUsd) : "Por definir",
      detail: input.budgetUsd
        ? "La mezcla aprovecha el presupuesto sin superarlo y no convierte inversión en una promesa de ventas."
        : "Se puede analizar el rol de medios, pero no construir una propuesta comprable sin inversión.",
      status: input.budgetUsd ? "listo" : "requiere_preparacion",
    },
    {
      label: "Preparación digital",
      value: digitalReadiness === null ? "No aplica" : `${digitalReadiness}% completa`,
      detail: digitalReadiness === null
        ? "Digital no forma parte del mix solicitado."
        : digitalReadiness >= 60
          ? "Existe información suficiente para preparar activación; todavía se valida antes de pautar."
          : "Destino, tracking, cuentas o definición de conversión deben completarse antes del forecast.",
      status: digitalReadiness === null || digitalReadiness >= 60 ? "listo" : "requiere_preparacion",
    },
  ];

  const wowMissing = input.wowEnabled
    ? [
        !input.wowIdea && "descripción de la idea",
        !input.wowMunicipality && "municipio",
        !input.wowExactLocation && "ubicación exacta",
        !input.wowFormat && "tipo de formato",
        !input.wowSurface && "superficie o soporte",
        !input.wowOwnership && "titularidad o autorización",
        !input.wowMeasurements && "medidas o factibilidad técnica",
      ].filter((item): item is string => Boolean(item))
    : [];

  return {
    category: input.keyword,
    profileLabel: plan.profileLabel,
    periodLabel: "Catálogo comercial 2026 + base interna disponible",
    targetLabel: `${input.audienceType} · ${input.ageRange} · ${input.sex} · ${input.socioeconomic}`,
    coverageLabel: input.geography || "Cobertura por definir",
    commercialReadiness,
    digitalReadiness,
    findings,
    signals,
    guardrails: [
      "Cada medio conserva su KPI válido; no se suman TRP, rankings, impresiones, circulación u OTS para inventar alcance único.",
      "Ticket, margen, capacidad y portafolio orientan la priorización, pero no constituyen una promesa de ROI.",
      "Tarifas, disponibilidad, derechos, permisos y fuentes de audiencia se reconfirman antes de emitir una orden.",
    ],
    wowCase: input.wowEnabled ? {
      idea: input.wowIdea || "Idea especial por completar",
      budget: input.wowBudget || "Presupuesto independiente por definir",
      status: wowMissing.length ? "Intake por completar" : "Listo para prefactibilidad",
      missing: wowMissing,
    } : null,
  };
}

function digitalKpi(objective: string, digitalObjective: string) {
  const value = `${digitalObjective} ${objective}`.toLocaleLowerCase("es");
  if (/venta|convers/.test(value)) return "Compras o valor de conversión";
  if (/lead/.test(value)) return "Leads calificados";
  if (/mensaje|whatsapp/.test(value)) return "Conversaciones útiles iniciadas";
  if (/tráfico|trafico|visita/.test(value)) return "Sesiones o visitas de calidad";
  if (/video|reprodu/.test(value)) return "Reproducciones y retención de video";
  return "Alcance digital y frecuencia";
}

function completion(values: Array<string | string[]>) {
  if (!values.length) return 0;
  const complete = values.filter((value) => Array.isArray(value) ? value.length > 0 : value.trim().length > 0).length;
  return Math.round(complete / values.length * 100);
}

function money(value: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
