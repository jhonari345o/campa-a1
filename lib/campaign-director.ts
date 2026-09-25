import type { CreativePreflight } from "@/lib/creative-preflight";

export type DirectorFinding = { severity: "blocker" | "warning" | "ready"; label: string; detail: string };

export function directCampaign(input: {
  platform: string;
  budgetUsd: number;
  targetScope: "radius" | "country" | null;
  radiusKm: number | null;
  objective?: string;
  trackingReady: boolean;
  creative: CreativePreflight | null;
}) {
  const findings: DirectorFinding[] = [];
  if (!input.creative || input.creative.status === "blocked") findings.push({ severity: "blocker", label: "Creatividad", detail: "El enlace debe pasar el preflight antes de preparar el checkout." });
  else findings.push({ severity: input.creative.status === "ready" ? "ready" : "warning", label: "Creatividad", detail: `${input.creative.score}/100 en la revisión preliminar.` });
  if (input.budgetUsd < 100) findings.push({ severity: "warning", label: "Aprendizaje", detail: "Con menos de $100 el volumen puede ser insuficiente para comparar segmentos; úsalo como prueba técnica." });
  else findings.push({ severity: "ready", label: "Presupuesto", detail: "Permite una prueba controlada; la suficiencia final depende de la subasta real." });
  if (input.targetScope === "country" && input.budgetUsd < 500) findings.push({ severity: "warning", label: "Cobertura", detail: "Todo Ecuador con este presupuesto puede dispersar la entrega. Considera priorizar ciudades." });
  else if (input.targetScope === "radius" && Number(input.radiusKm) > 80 && input.budgetUsd < 400) findings.push({ severity: "warning", label: "Radio", detail: "El radio es amplio frente al presupuesto; revisa si la demanda realmente está distribuida." });
  else if (input.targetScope) findings.push({ severity: "ready", label: "Geografía", detail: "La cobertura está delimitada y se conservará en la orden." });
  if (/venta|conversion|lead/i.test(input.objective ?? "") && !input.trackingReady) findings.push({ severity: "warning", label: "Medición", detail: "Una campaña de conversión necesita Pixel/CAPI o un evento equivalente validado." });
  else findings.push({ severity: input.trackingReady ? "ready" : "warning", label: "Medición", detail: input.trackingReady ? "Tracking declarado listo; se validará de nuevo en la cuenta." : "Falta declarar el estado de tracking." });
  const blockers = findings.filter((item) => item.severity === "blocker").length;
  const warnings = findings.filter((item) => item.severity === "warning").length;
  return { status: blockers ? "blocked" as const : warnings ? "warning" as const : "ready" as const, score: Math.max(0, 100 - blockers * 45 - warnings * 12), findings };
}
