import type { MediaGroup } from "./media-groups";

export type DeliveryContext = { startDate: string; endDate: string; geography: string; audience: string };
export type DeliveryItem = { id: string; quantity: number; amountCents: number };
export type DeliverySelection = { context: DeliveryContext; media: { medium: MediaGroup; items: DeliveryItem[] }[] };
/** Private, approved campaign forecasts. A rating or footfall count is not a reach input. */
export type DeliveryObservation = {
  medium: MediaGroup; selectionKey: string; universeId: string; universe: number;
  targetId: string; geographyId: string; periodId: string;
  reach1Pct: number; reach2Pct?: number; reach3Pct?: number;
  impressions?: number; views?: number; conversations?: number;
  evidenceId: string; approved: boolean;
};
export type DeliverySummary = {
  scopeLabel?: string;
  geographicComplements?: MediaGroup[];
  media: { medium: MediaGroup; reachPct: number; people: number }[];
  reach1Pct: number | null; reach2Pct: number | null; reach3Pct: number | null;
  people: number | null; frequency: number | null; grps: number | null;
  digital: { impressions: number | null; views: number | null; conversations: number | null } | null;
};
export type ReachCurve = { medium: MediaGroup; points: { grps: number; reachPct: number }[] };
/** Historical curve used as an explicit planning model; never a current measured result. */
export function reachAtGrps(curve: ReachCurve, grps: number): number | null {
  if (!count(grps) || !curve.points.length) return null;
  const points = [{ grps: 0, reachPct: 0 }, ...curve.points];
  for (let i = 1; i < points.length; i++) {
    if (!positive(points[i].grps) || !pct(points[i].reachPct) || points[i].grps <= points[i-1].grps || points[i].reachPct < points[i-1].reachPct || points[i].reachPct > points[i].grps + .01) return null;
  }
  const upper = points.findIndex(p => p.grps >= grps);
  if (upper === 0) return 0;
  if (upper < 0) return points.at(-1)!.reachPct;
  const a = points[upper - 1], b = points[upper];
  return a.reachPct + (b.reachPct - a.reachPct) * (grps - a.grps) / (b.grps - a.grps);
}
/** Fit positive-contact Poisson to the curve's 1+ and current GRPs, not to invented ratings.
 * This provides modeled 2+/3+; provenance retains that these are projections. */
export function projectContactThresholds(reach1Pct: number, grps: number) {
  if (!pct(reach1Pct) || !count(grps) || reach1Pct > grps + 1e-6 || (!reach1Pct && grps)) return null;
  if (!reach1Pct) return { reach2Pct: 0, reach3Pct: 0 };
  const mean = grps / reach1Pct;
  if (mean <= 1 + 1e-9) return { reach2Pct: 0, reach3Pct: 0 };
  let lo = 0, hi = mean;
  for (let i = 0; i < 80; i++) { const x = (lo + hi) / 2; if (x / -Math.expm1(-x) > mean) hi = x; else lo = x; }
  const lambda = (lo + hi) / 2;
  const p1 = lambda > 700 ? 0 : lambda / Math.expm1(lambda), p2 = p1 * lambda / 2;
  return { reach2Pct: reach1Pct * Math.max(0, 1 - p1), reach3Pct: reach1Pct * Math.max(0, 1 - p1 - p2) };
}
const MEDIA: MediaGroup[] = ["television", "radio", "ooh", "press", "digital", "influencers"];
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const positive = (n: unknown): n is number => finite(n) && n > 0;
const count = (n: unknown): n is number => finite(n) && n >= 0;
const pct = (n: unknown): n is number => count(n) && n <= 100;
const cleanText = (s: unknown, max: number): s is string => typeof s === "string" && s.length > 0 && s.length <= max;
const date = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;

/** Stable selection, including dates, target, market, money and quantity. No stale projections. */
export function normalizeDeliverySelection(input: DeliverySelection): DeliverySelection | null {
  if (!input || typeof input !== "object" || !input.context || !Array.isArray(input.media) || input.media.length > 6 || !input.media.length) return null;
  const c = input.context;
  if (!date(c.startDate) || !date(c.endDate) || c.endDate < c.startDate || !cleanText(c.geography, 3000) || !cleanText(c.audience, 2000)) return null;
  const media: DeliverySelection["media"] = [];
  for (const row of input.media) {
    if (!row || !MEDIA.includes(row.medium) || media.some(m => m.medium === row.medium) || !Array.isArray(row.items) || !row.items.length || row.items.length > 100) return null;
    const items: DeliveryItem[] = [];
    for (const item of row.items) {
      if (!item || !cleanText(item.id, 300) || !positive(item.quantity) || item.quantity > 10_000_000 || !Number.isSafeInteger(item.amountCents) || item.amountCents < 0 || item.amountCents > 1_000_000_000 || items.some(i => i.id === item.id)) return null;
      items.push({ id: item.id, quantity: item.quantity, amountCents: item.amountCents });
    }
    media.push({ medium: row.medium, items: items.sort((a, b) => a.id.localeCompare(b.id)) });
  }
  return { context: { startDate: c.startDate, endDate: c.endDate, geography: c.geography, audience: c.audience }, media: media.sort((a, b) => MEDIA.indexOf(a.medium) - MEDIA.indexOf(b.medium)) };
}
export function deliverySelectionKey(selection: DeliverySelection, medium: MediaGroup): string {
  const normalized = normalizeDeliverySelection(selection);
  return normalized ? JSON.stringify({ context: normalized.context, media: normalized.media.find(row => row.medium === medium) ?? null }) : "";
}
function validObservation(row: DeliveryObservation) {
  if (!row || !row.approved || !MEDIA.includes(row.medium) || !positive(row.universe) || !pct(row.reach1Pct) || ![row.universeId, row.targetId, row.geographyId, row.periodId, row.evidenceId].every(s => cleanText(s, 300))) return false;
  if (row.reach2Pct != null && (!pct(row.reach2Pct) || row.reach2Pct > row.reach1Pct)) return false;
  if (row.reach3Pct != null && (!pct(row.reach3Pct) || row.reach2Pct == null || row.reach3Pct > row.reach2Pct)) return false;
  if ([row.impressions, row.views, row.conversations].some(n => n != null && !count(n))) return false;
  if (row.impressions != null && row.impressions + 1e-6 < row.universe * (row.reach1Pct + (row.reach2Pct ?? 0) + (row.reach3Pct ?? 0)) / 100) return false;
  return true;
}
/** Sainsbury across media, never repeated insertions. Method and evidence stay server-side. */
export function combineMediaDelivery(selection: DeliverySelection, observations: DeliveryObservation[],options:{allowGeographicComplements?:boolean}={}): { summary: DeliverySummary; issues: string[] } {
  const normalized = normalizeDeliverySelection(selection), issues: string[] = [];
  const empty: DeliverySummary = { media: [], reach1Pct: null, reach2Pct: null, reach3Pct: null, people: null, frequency: null, grps: null, digital: null };
  if (!normalized) return { summary: empty, issues: ["INVALID_SELECTION"] };
  const matched: DeliveryObservation[] = [];
  for (const { medium } of normalized.media) {
    const rows = observations.filter(row => row.medium === medium && row.selectionKey === deliverySelectionKey(normalized, medium));
    if (rows.length !== 1 || !validObservation(rows[0])) { issues.push(`${medium}:${rows.length > 1 ? "CONFLICT" : "NO_APPROVED_FORECAST"}`); continue; }
    matched.push(rows[0]);
  }
  const summary: DeliverySummary = { ...empty, media: matched.map(row => ({ medium: row.medium, reachPct: row.reach1Pct, people: Math.round(row.universe * row.reach1Pct / 100) })) };
  const digital = matched.find(row => row.medium === "digital");
  if (digital) summary.digital = { impressions: digital.impressions ?? null, views: digital.views ?? null, conversations: digital.conversations ?? null };
  // Owner-approved planning convention: unmeasured OOH/press may add geographic
  // presence, but contribute no additional contacts to the numerical projection.
  const complements=normalized.media.filter(({medium})=>!matched.some(r=>r.medium===medium)&&options.allowGeographicComplements&&["ooh","press"].includes(medium)&&!observations.some(r=>r.medium===medium));
  if(complements.length)summary.geographicComplements=complements.map(r=>r.medium);
  if (!matched.length||matched.length+complements.length !== normalized.media.length) return { summary, issues };
  const first = matched[0];
  if (!matched.every(row => row.universe === first.universe && row.universeId === first.universeId && row.targetId === first.targetId && row.geographyId === first.geographyId && row.periodId === first.periodId)) return { summary, issues: [...issues, "INCOMPATIBLE_POPULATIONS"] };
  const p0 = matched.reduce((p, row) => p * (1 - row.reach1Pct / 100), 1);
  summary.reach1Pct = (1 - p0) * 100;
  const people = first.universe * (1 - p0);
  summary.people = Math.round(people);
  // Cumulative 2+/3+ require actual within-medium distributions. 1+ alone cannot provide them.
  if (matched.every(row => row.reach2Pct != null)) {
    let dist = [1, 0, 0];
    for (const row of matched) {
      const d = [1 - row.reach1Pct / 100, (row.reach1Pct - row.reach2Pct!) / 100, row.reach3Pct == null ? 0 : (row.reach2Pct! - row.reach3Pct) / 100];
      dist = [dist[0] * d[0], dist[1] * d[0] + dist[0] * d[1], dist[2] * d[0] + dist[1] * d[1] + dist[0] * d[2]];
    }
    summary.reach2Pct = Math.max(0, 1 - dist[0] - dist[1]) * 100;
    if (matched.every(row => row.reach3Pct != null)) summary.reach3Pct = Math.max(0, 1 - dist[0] - dist[1] - dist[2]) * 100;
  }
  if (matched.every(row => row.impressions != null)) {
    const gross = matched.reduce((n, row) => n + row.impressions!, 0);
    summary.frequency = people > 0 ? gross / people : null;
    summary.grps = gross / first.universe * 100;
  }
  return { summary, issues };
}
