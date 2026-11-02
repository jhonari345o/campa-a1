import { DIGITAL_PLATFORMS } from "./media-catalog";
import type { CatalogProduct } from "./catalog-shopping";

export const DIGITAL_GOALS = [
  { id: "impressions", label: "Impresiones" }, { id: "views", label: "Visualizaciones" },
  { id: "reach", label: "Alcance" }, { id: "clicks", label: "Clics y visitas" },
  { id: "forms", label: "Formularios" }, { id: "whatsapp", label: "Mensajes de WhatsApp" },
  { id: "sales", label: "Ventas y conversiones" },
] as const;
export type DigitalGoal = typeof DIGITAL_GOALS[number]["id"];
const platformGoals: Record<string, readonly DigitalGoal[]> = {
  "google-ads": ["impressions", "views", "reach", "clicks", "forms", "sales"],
  "meta-ads": ["impressions", "views", "reach", "clicks", "forms", "whatsapp", "sales"],
  "linkedin-ads": ["impressions", "views", "reach", "clicks", "forms", "sales"],
  "tiktok-ads": ["impressions", "views", "reach", "clicks", "forms", "sales"],
  "spotify-ads": ["impressions", "views", "reach", "clicks"],
  "pinterest-ads": ["impressions", "views", "reach", "clicks", "sales"],
  "programmatic-dsp": ["impressions", "views", "reach", "clicks", "sales"],
};
export function digitalGoalsForPlatform(slug: string) { return DIGITAL_GOALS.filter(goal => platformGoals[slug]?.includes(goal.id)); }

/** A self-selected campaign budget is one product, never millions of fictitious USD units. */
export function digitalBudgetProduct(key: string): CatalogProduct | null {
  const match = /^digital:([a-z-]+):budget:([a-z]+):([1-9]\d{0,9})$/.exec(key);
  if (!match) return null;
  const [, slug, goalId, rawCents] = match, cents = Number(rawCents);
  const platform = DIGITAL_PLATFORMS.find(platform => platform.slug === slug);
  const goal = digitalGoalsForPlatform(slug).find(goal => goal.id === goalId);
  if (!platform || !goal || cents > 1_000_000_000) return null;
  return { key, kind: "digital", provider: platform.name, name: `Campaña · ${goal.label}`, format: goal.label,
    unit: "presupuesto de campaña", priceCents: cents, taxIncluded: null, location: "Según configuración de campaña",
    reference: "Presupuesto solicitado", image: platform.imagePath ?? null,
    conditions: "", source: { platformSlug: slug, digitalGoal: goal.id } };
}
export function digitalBudgetKey(slug: string, goal: string, cents: number) {
  if (!Number.isSafeInteger(cents)) throw new Error("INVALID_DIGITAL_BUDGET");
  const key = `digital:${slug}:budget:${goal}:${cents}`;
  if (!digitalBudgetProduct(key)) throw new Error("INVALID_DIGITAL_BUDGET");
  return key;
}
