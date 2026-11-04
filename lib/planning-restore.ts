import type { PlanBrief, PlanResult } from "../app/planificador/actions";
import type { SavedMediaPlan } from "./media-workspace";
import type { MediaPlan, PlanRow } from "./planner";
import type { StrategyReport } from "./media-strategy";
import { restoreResearch } from "./infomedia";
import { normalizeCoverageBrief } from "./geographic-coverage";
import { buildPlanAnalysis } from "./plan-analysis";

type JsonObject = Record<string, unknown>;
type Check = (value: unknown) => boolean;
const object = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const string: Check = value => typeof value === "string" && value.length <= 50_000;
const number: Check = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
const boolean: Check = value => typeof value === "boolean";
const nullable = (check: Check): Check => value => value === null || check(value);
const optional = (check: Check): Check => value => value === undefined || check(value);
const list = (check: Check, limit = 1_000): Check => value => Array.isArray(value) && value.length <= limit && value.every(check);
const shape = (fields: Record<string, Check>): Check => value => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(fields).every(([key, check]) => check((value as JsonObject)[key]));
};
const oneOf = (...values: unknown[]): Check => value => values.includes(value);
const strings = list(string);
const medium = oneOf("television", "radio", "ooh", "press", "digital", "influencers");
const fraction: Check = value => number(value) && Number(value) <= 1;
const candidate = shape({
  id: string, medium, provider: string, product: string, market: string, target: string,
  period: string, sourceIds: strings, sourceUse: oneOf("comparable", "context", "unavailable"),
  unit: string, unitPriceUsd: nullable(number), referencePriceUsd: nullable(number), minimumUnits: number,
  minimumSpendUsd: nullable(number), note: string,
  metrics: list(shape({ label: string, value: number, unit: string, sourceId: string })),
  catalogKey: optional(string), stationId: optional(string), physicalAssetId: optional(string),
  planningTerritory: optional(string), cohort: optional(string), planningDaypart: optional(oneOf("A", "AA", "AAA", "Late")),
  marketKeys: optional(strings), stationCoverage: optional(strings), coverageKeys: optional(strings),
  planningMinimumUnits: optional(number), maximumUnits: optional(number), planningMaximumUnits: optional(number),
  planningWeight: optional(number), planningMaximumSpendUsd: optional(number),
  geo: optional(shape({ latitude: value => typeof value === "number" && Math.abs(value) <= 90, longitude: value => typeof value === "number" && Math.abs(value) <= 180 })),
  oohPhoto: optional(shape({ assetId: string, kind: oneOf("asset", "format") })),
  digitalProduction: optional(shape({ id: string, rights: strings })),
});
const quantities = { amountUsd: nullable(number), units: nullable(number), referenceSpendUsd: nullable(number), remainderUsd: nullable(number) };
const allocation = shape({
  medium, pct: fraction, ...quantities, rationale: string, sourceIds: strings,
  readiness: oneOf("reference", "needs_quote", "platform_budget"), candidate: nullable(candidate),
  executions: optional(list(shape({ candidate, ...quantities }), 50)),
});
const reportShape = shape({
  version: string, generatedAt: string, fingerprint: string, model: nullable(string),
  aiState: oneOf("validated", "cached", "not_configured", "quota", "unavailable", "rejected"),
  customized: optional(boolean), aiRetryable: optional(boolean), summary: string, allocations: list(allocation, 6),
  sources: list(shape({ id: string, kind: oneOf("competition", "consumption", "rating", "ranking", "tariff", "inventory"), label: string, period: string, market: string, target: string, use: oneOf("comparable", "context", "unavailable"), note: string })),
  competition: list(shape({ brand: string, estimatedInvestment: number, soi: number, declared: boolean })),
  gaps: strings, questions: strings,
  audienceReferences: list(shape({ sourceId: string, medium, provider: string, product: string, rating: nullable(number), reachPct: optional(number), audience: optional(number), rank: optional(number) })),
  channelShares: optional(list(shape({ provider: string, sharePct: number, period: string, market: string, target: string }))),
  candidateCount: number, budgetUsd: nullable(number), reserveUsd: nullable(number),
  alternatives: list(shape({ id: string, label: string, allocations: list(shape({ medium, pct: fraction, amountUsd: nullable(number) }), 6) }), 20),
  evaluation: shape({ budgetConserved: boolean, permittedMediaOnly: boolean, measuredReachAvailable: oneOf(false), comparableConsumption: boolean }),
});

const briefTextKeys = [
  "brand", "keyword", "objective", "priority", "audienceType", "audience", "ageRange", "sex", "socioeconomic",
  "startDate", "endDate", "businessDescription", "businessModel", "conversionModel", "commercialGoalType",
  "commercialGoalAmount", "commercialGoalUnit", "averageTicket", "grossMargin", "operationalCapacity", "commercialKpi",
  "valueProposition", "competitors", "restrictions", "learnings", "digitalObjective", "conversionEvent", "digitalDestination",
  "trackingStatus", "adAccountsStatus", "firstPartyData", "qualifiedLead", "attributionModel", "consentStatus", "managementNeed",
  "wowIdea", "wowBudget", "wowMunicipality", "wowExactLocation", "wowFormat", "wowSurface", "wowOwnership", "wowMeasurements",
] as const;
const text = (value: unknown) => typeof value === "string" ? value.slice(0, 50_000) : "";
const arrayText = (value: unknown) => (Array.isArray(value) ? value : typeof value === "string" && value ? [value] : []).filter((v): v is string => typeof v === "string").slice(0, 100);
const enabled = (value: unknown) => value === true || value === "true" || value === "on";
const amount = (value: unknown) => value !== "" && value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;

/** Normalize both generated briefs and the older native FormData draft shape. */
export function restorePlanBrief(value: unknown): PlanBrief {
  const row = object(value);
  const fields = Object.fromEntries(briefTextKeys.map(key => [key, text(row[key])])) as Pick<PlanBrief, typeof briefTextKeys[number]>;
  const names = arrayText(row.productName);
  const products = Array.isArray(row.products) ? row.products : names.map((name, index) => ({
    name, price: arrayText(row.productPrice)[index], margin: arrayText(row.productMargin)[index],
    capacity: arrayText(row.productCapacity)[index], season: arrayText(row.productSeason)[index], notes: arrayText(row.productNotes)[index],
  }));
  return {
    ...fields, ...normalizeCoverageBrief(row),
    clientId: typeof row.clientId === "string" ? row.clientId : null, clientName: text(row.clientName),
    categoryId: text(row.categoryId), referenceYear: amount(row.referenceYear) ?? 0,
    budgetUsd: amount(row.budgetUsd ?? row.budget), selectedMedia: arrayText(row.selectedMedia).filter(medium),
    digitalPlatforms: arrayText(row.digitalPlatforms), measurementStack: arrayText(row.measurementStack),
    productMatrixApplies: enabled(row.productMatrixApplies), wowEnabled: enabled(row.wowEnabled),
    products: products.slice(0, 100).map(value => {
      const product = object(value);
      return { name: text(product.name), price: text(product.price), margin: text(product.margin), capacity: text(product.capacity), season: text(product.season), notes: text(product.notes) };
    }),
  };
}

const planRow = shape({ label: string, pct: fraction, amount: nullable(number), rationale: optional(string) });

/** Display saved evidence; never issue a fresh signed draft or trust it as a purchase authorization. */
export function restoreSavedPlanningResult(saved?: SavedMediaPlan | null): Extract<PlanResult, { ok: true }> | null {
  if (!saved || saved.mode !== "guiado" || !["propuesta", "analisis", "personaliza", "aprobado"].includes(saved.stage)) return null;
  try {
    const proposal = object(saved.proposal), analysis = object(saved.analysis);
    const strategyValue = proposal.strategy ?? analysis.strategy;
    if (!reportShape(strategyValue)) return null;
    const strategy = strategyValue as StrategyReport;
    if (!strategy.allocations.length || new Set(strategy.allocations.map(row => row.medium)).size !== strategy.allocations.length) return null;
    if (!list(planRow, 50)(proposal.plan) || !(proposal.plan as unknown[]).length) return null;
    const research = restoreResearch(analysis.research);
    if (!research) return null;
    const brief = restorePlanBrief(saved.brief);
    if (strategy.allocations.some(row => !brief.selectedMedia.includes(row.medium))) return null;
    const plan: MediaPlan = {
      strategy, plan: proposal.plan as PlanRow[],
      benchmark: list(planRow, 50)(proposal.benchmark ?? analysis.benchmark) ? (proposal.benchmark ?? analysis.benchmark) as PlanRow[] : [],
      matched: amount(proposal.matched) ?? 0, totalRef: amount(proposal.totalRef) ?? 0,
      basis: oneOf("giro", "sector", "mercado", "infomedia")(proposal.basis ?? analysis.basis) ? (proposal.basis ?? analysis.basis) as MediaPlan["basis"] : "infomedia",
      profileLabel: text(proposal.profileLabel ?? analysis.profileLabel),
      referencePeriod: text(proposal.referencePeriod ?? analysis.periodLabel),
      strategySummary: text(proposal.strategySummary ?? analysis.strategySummary) || strategy.summary,
    };
    // The interactive strategy is authoritative for this view. Legacy creative/execution
    // payloads are not replayed; approval rebuilds them and prices on the server.
    return { ok: true, plan, brief, research, analysis: buildPlanAnalysis(brief, plan),
      keyword: brief.keyword, objective: brief.objective, audience: brief.audience,
      campaigns: [], detail: { engine: "datos", aiNarrative: null, liveSources: [], channelPlans: [], checks: [] } };
  } catch { return null; }
}

/** Editing a completed proposal starts a brief copy; its saved evidence remains intact. */
export function shouldCopySavedBrief(current: { status?: unknown; proposal?: unknown; analysis?: unknown }) {
  return current.status !== "borrador" || Object.keys(object(current.proposal)).length > 0 || Object.keys(object(current.analysis)).length > 0;
}
