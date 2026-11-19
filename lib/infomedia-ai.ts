import { lookupKey, type CategoryResearch } from "@/lib/infomedia";

export type ResearchAdvice = { emphasis: string; questions: string[] };
/** Deliberately excludes brand names, client budgets, audiences and private commercial brief. */
export function researchAiEvidence(research: CategoryResearch, objective: string) {
  const period = research.periods.find((item) => item.year === research.referenceYear) ?? research.periods[0];
  return {
    category: research.category.label, objective: objective.slice(0, 80),
    period: period.periodLabel, target: period.sourceTarget,
    media: period.mediaMix.map((item) => ({ name: item.media, share: item.share })),
    limits: "Inversión observada estimada. No es ejecución del cliente ni alcance. No inferir afinidad a otro target.",
  };
}
export function parseResearchAdvice(value: string): ResearchAdvice | null {
  try {
    const parsed = JSON.parse(value.replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
    if (typeof parsed.emphasis !== "string" || !Array.isArray(parsed.questions) || parsed.questions.length > 3) return null;
    const parts = [parsed.emphasis, ...parsed.questions];
    if (parts.some((part) => typeof part !== "string" || part.length > 900 || /[0-9%$<>]|https?:|www\./i.test(part))) return null;
    if (lookupKey(parts.join(" ")).includes("GARANTIZ")) return null;
    return { emphasis: parsed.emphasis, questions: parsed.questions };
  } catch { return null; }
}
