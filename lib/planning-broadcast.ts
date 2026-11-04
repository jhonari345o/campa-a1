import { briefMarketKeys, normalized, validDate } from "./broadcast-catalog";
import { televisionProviderKey } from "./television-directory";
import { nationalTerritoryOrder, territoriesOverlap, territoryKey } from "./planning-market";
import type { StrategyBrief, StrategyCandidate, StrategyEvidenceBundle } from "./media-strategy-evidence";

export type PlanningDaypart = "A" | "AA" | "AAA" | "Late";
/** These are planning time bands, not a reclassification of the supplier's tariff. */
export function planningDaypart(schedule: string): PlanningDaypart | undefined {
  const explicit = schedule.match(/(?:^|[\s·,;(])(?:[Ff]ranja\s*)?(AAA|AA|A|Late|LATE|late)(?=$|[\s·,;)])/)?.[1];
  if (explicit) return explicit.toLowerCase() === "late" ? "Late" : explicit.toUpperCase() as PlanningDaypart;
  const hour = schedule.match(/(?:^|\s|·)([01]?\d|2[0-3])[:h]([0-5]\d)/)?.[1];
  if (hour == null) return undefined;
  const h = Number(hour);
  return h >= 23 || h < 6 ? "Late" : h >= 18 ? "AAA" : h >= 12 ? "AA" : "A";
}
export function broadcastPlanningMonths(brief: StrategyBrief) {
  const days = validDate(brief.startDate) && validDate(brief.endDate) && brief.endDate >= brief.startDate
    ? (Date.parse(brief.endDate) - Date.parse(brief.startDate)) / 86400000 + 1 : 30;
  return { days, months: days / 30 };
}
export type RadioFlightBrief = Pick<StrategyBrief,"startDate"|"endDate"|"geography"|"coverage">;
export type RadioFlight = { month: string; startDate: string; endDate: string; activeDays: number };
/** Up to twenty working days per calendar month. A short campaign cannot buy
 * a full month's frequency, and adding months does not add unique listeners. */
export function radioFlightMonths(brief: RadioFlightBrief): RadioFlight[] {
  if(!validDate(brief.startDate)||!validDate(brief.endDate)||brief.endDate<brief.startDate)return [];
  const first=new Date(`${brief.startDate}T00:00:00Z`), last=Date.parse(brief.endDate);
  const flights:RadioFlight[]=[];
  for(let month=Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),1);month<=last;){
    if(flights.length>=120)return [];
    const date=new Date(month), next=Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1);
    const start=Math.max(month,first.getTime()),end=Math.min(next-86400000,last);
    let weekdays=0;
    for(let d=start;d<=end;d+=86400000){const day=new Date(d).getUTCDay();if(day!==0&&day!==6)weekdays++;}
    // Weekend-only briefs still support a small, explicitly dated flight.
    const activeDays=Math.min(20,weekdays||Math.floor((end-start)/86400000)+1);
    flights.push({month:new Date(month).toISOString().slice(0,7),startDate:new Date(start).toISOString().slice(0,10),endDate:new Date(end).toISOString().slice(0,10),activeDays});
    month=next;
  }
  return flights;
}
export const radioCandidateIdentity = (c: StrategyCandidate) => c.stationId ?? JSON.stringify([normalized(c.provider),(c.stationCoverage??c.coverageKeys??c.marketKeys??[c.market]).map(normalized).sort()]);
const identity = radioCandidateIdentity;
const price = (c: StrategyCandidate) => c.unitPriceUsd != null && Number.isFinite(c.unitPriceUsd) && c.unitPriceUsd > 0;
const minimum = (c: StrategyCandidate) => Math.max(c.minimumSpendUsd ?? 0, (c.unitPriceUsd ?? 0) * (c.planningMinimumUnits ?? c.minimumUnits));

/** Preserve territorial seeds, then widen the station mix before adding frequency.
 * Budgets are monthly planning limits, not commercial supplier minimums. */
export function diversifyRadio(pool: StrategyCandidate[], seeds: StrategyCandidate[], brief: StrategyBrief, amount: number | null, limit: number) {
  if (amount == null || amount <= 0) return seeds;
  const days=radioFlightMonths(brief).reduce((sum,f)=>sum+f.activeDays,0)||20;
  const months=days/20, ceiling = 2000 * months, target = 1500 * months;
  const candidates = [...new Map([...seeds, ...pool].filter(price).map(c => [identity(c), c])).values()];
  // Map construction must not replace the geographically chosen signal with a
  // later study/format for the same station.
  const ordered = candidates.map(c => seeds.find(s => identity(s) === identity(c)) ?? [...pool].find(s => identity(s) === identity(c)) ?? c);
  const desired = Math.min(limit, Math.max(6,seeds.length, Math.ceil(amount / target)));
  const chosen: StrategyCandidate[] = [];
  let remaining = amount;
  for (const c of ordered) {
    if (chosen.length >= desired) break;
    const maxUnits = Math.min(c.maximumUnits ?? Infinity, Math.floor(days * 6), Math.floor(ceiling / c.unitPriceUsd!));
    const cost = minimum(c);
    if (maxUnits < (c.planningMinimumUnits ?? c.minimumUnits) || cost > remaining) continue;
    chosen.push({ ...c, planningMaximumUnits: maxUnits, planningMaximumSpendUsd: ceiling });
    remaining -= cost;
  }
  // Where the practical insertion cap is below the monthly envelope, add more
  // stations instead of parking the remainder on an already saturated signal.
  let capacity = chosen.reduce((n, c) => n + Math.min(c.planningMaximumSpendUsd!, c.unitPriceUsd! * c.planningMaximumUnits!), 0);
  for (const c of ordered) {
    if (capacity >= amount || chosen.length >= limit) break;
    if (chosen.some(s => identity(s) === identity(c))) continue;
    const maxUnits = Math.min(c.maximumUnits ?? Infinity, Math.floor(days * 6), Math.floor(ceiling / c.unitPriceUsd!));
    if (maxUnits < (c.planningMinimumUnits ?? c.minimumUnits) || minimum(c) > remaining) continue;
    chosen.push({ ...c, planningMaximumUnits: maxUnits, planningMaximumSpendUsd: ceiling });
    remaining -= minimum(c); capacity += Math.min(ceiling, c.unitPriceUsd! * maxUnits);
  }
  return chosen.map(c => {
    // Compare relative relevance only within a shared study, never raw ratings
    // between different provinces or audiences.
    const peers = chosen.filter(p => p.cohort && p.cohort === c.cohort);
    const rating = c.metrics.find(m => m.label === "Rating")?.value;
    const top = Math.max(0, ...peers.map(p => p.metrics.find(m => m.label === "Rating")?.value ?? 0));
    const weight = top > 0 && rating != null ? 1 + Math.max(0, rating) / top * .5 : 1;
    return { ...c, planningWeight: weight };
  });
}

/** Channel shares determine channel envelopes; programme variety is selected
 * before distributing money. No historical tariff or rating is manufactured. */
export function diversifyTelevision(pool: StrategyCandidate[], preferred: StrategyCandidate[], brief: StrategyBrief, amount: number | null, shares: StrategyEvidenceBundle["channelShares"], limit: number) {
  const age = Number((brief.ageRange ?? "").match(/\d+/)?.[0] ?? 0);
  const late = age >= 18 && /adult|nocturn|late|madur/.test(normalized(`${brief.audience} ${brief.keyword} ${brief.restrictions}`));
  const candidates = [...preferred, ...pool.filter(c => !preferred.some(p => p.id === c.id))]
    .filter(c => price(c) && (c.planningDaypart !== "Late" || late));
  const groups = new Map<string, {key:string;markets:string[];rows:StrategyCandidate[]}>();
  for (const c of candidates) {
    const key = televisionProviderKey(c.provider);
    const markets = [...new Set((c.coverageKeys?.length ? c.coverageKeys : c.marketKeys?.length ? c.marketKeys : [c.market]).map(territoryKey))].sort();
    const id = JSON.stringify([key, markets]), group = groups.get(id) ?? {key,markets,rows:[]}, rows=group.rows;
    if (!rows.some(r => r.catalogKey && r.catalogKey === c.catalogKey || r.id === c.id)) rows.push(c);
    groups.set(id, group);
  }
  const channelShare = (key: string) => shares?.find(s => televisionProviderKey(s.provider) === key)?.sharePct;
  const channels = [...groups].map(([id, {key,markets,rows}]) => {
    const choices: StrategyCandidate[] = [];
    const add = (c?: StrategyCandidate) => { if (c && !choices.some(r => normalized(r.product) === normalized(c.product))) choices.push(c); };
    for (const band of ["A", "AA", "AAA", ...(late ? ["Late"] : [])]) add(rows.find(c => c.planningDaypart === band));
    for (const c of rows) { if (choices.length >= 3) break; add(c); }
    return { id, key, markets, choices, share: channelShare(key) };
  }).filter(c => c.choices.length >= 2).sort((a,b) => (b.share ?? 0) - (a.share ?? 0) || a.key.localeCompare(b.key));
  if (!channels.length) return [];
  const selected: typeof channels = []; let remaining = amount;
  const requested=briefMarketKeys(brief).map(territoryKey);
  const territories=requested.includes("nacional")?nationalTerritoryOrder():requested;
  const ordered:typeof channels=[];
  // Regional editions of the same programme are separate purchases. Establish
  // a pair in each requested market before adding more channels in one city.
  for(const territory of territories){
    if(ordered.some(g=>g.markets.some(m=>territoriesOverlap(m,territory))))continue;
    const group=channels.find(g=>g.markets.some(m=>territoriesOverlap(m,territory)));
    if(group)ordered.push(group);
  }
  ordered.push(...channels.filter(g=>!ordered.includes(g)));
  for (const channel of ordered) {
    const pair = channel.choices.slice(0,2), cost = pair.reduce((n,c) => n + minimum(c), 0);
    if (selected.length * 2 + 2 > limit || remaining != null && cost > remaining) continue;
    selected.push({ ...channel, choices: pair }); if (remaining != null) remaining -= cost;
  }
  let count = selected.length * 2;
  for (const channel of selected) for (const c of channels.find(g => g.id === channel.id)!.choices.slice(2)) {
    if (count >= limit || remaining != null && minimum(c) > remaining) continue;
    channel.choices.push(c); count++; if (remaining != null) remaining -= minimum(c);
  }
  const known = selected.filter(c => c.share != null && c.share > 0), fallback = known.length ? known.reduce((n,c) => n + c.share!, 0) / known.length : 1;
  return selected.flatMap(channel => channel.choices.map(c => ({ ...c, planningWeight: (channel.share ?? fallback) / selected.filter(g=>g.key===channel.key).length / channel.choices.length })));
}
