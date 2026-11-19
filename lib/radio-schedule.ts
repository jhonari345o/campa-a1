import { validDate } from "./broadcast-catalog";
import type { RadioFlight } from "./planning-broadcast";
import type { StrategyAllocation } from "./media-strategy";

export type RadioDailySpots = { date: string; units: number };
const DAY = 86400000;
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);

export function radioMonthDates(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month) || !validDate(`${month}-01`)) return [];
  const first = new Date(`${month}-01T00:00:00Z`);
  const end = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1);
  const dates: { date: string; day: number; weekend: boolean }[] = [];
  for (let time = first.getTime(); time < end; time += DAY) {
    const date = new Date(time);
    dates.push({ date: iso(time), day: date.getUTCDate(), weekend: [0, 6].includes(date.getUTCDay()) });
  }
  return dates;
}

/** Explicit proposed insertions, never a confirmation of broadcasts. Spread the
 * flight's existing quantity across its active working days, including both
 * ends of the flight. The monthly budget and station rotation do not change. */
export function makeRadioDailySpots(flight: RadioFlight, units: number): RadioDailySpots[] {
  if (!Number.isSafeInteger(units) || units <= 0 || !Number.isSafeInteger(flight.activeDays) || flight.activeDays <= 0 ||
    !validDate(flight.startDate) || !validDate(flight.endDate) || flight.endDate < flight.startDate ||
    flight.startDate.slice(0, 7) !== flight.month || flight.endDate.slice(0, 7) !== flight.month) return [];
  const calendar = radioMonthDates(flight.month).filter(d => d.date >= flight.startDate && d.date <= flight.endDate);
  const weekdays = calendar.filter(d => !d.weekend);
  // Preserve the allocator's explicitly supported weekend-only short briefs.
  const eligible = weekdays.length ? weekdays : calendar;
  const count = Math.min(flight.activeDays, eligible.length, units);
  if (!count) return [];
  const base = Math.floor(units / count), extra = units % count;
  return Array.from({ length: count }, (_, index) => ({
    date: eligible[count === 1 ? 0 : Math.round(index * (eligible.length - 1) / (count - 1))].date,
    // Evenly distribute remainder spots too, rather than loading the first week.
    units: base + Math.floor((index + 1) * extra / count) - Math.floor(index * extra / count),
  }));
}

function validStoredSchedule(days: RadioDailySpots[] | undefined, flight: RadioFlight & { units: number }) {
  return days?.length && new Set(days.map(d => d.date)).size === days.length && days.every(d =>
    validDate(d.date) && d.date >= flight.startDate && d.date <= flight.endDate && d.date.startsWith(`${flight.month}-`) && Number.isSafeInteger(d.units) && d.units > 0
  ) && days.reduce((n, d) => n + d.units, 0) === flight.units;
}

/** Older saved recommendations already have dated monthly flights. Reconstruct
 * their daily view deterministically without changing prices or quantities. */
export function radioMonthSchedule(allocation: StrategyAllocation, month: string) {
  const dates = radioMonthDates(month);
  const rows = allocation.medium === "radio" ? (allocation.executions ?? []).flatMap(row =>
    (row.radioFlights ?? []).filter(f => f.month === month).map((flight, index) => {
      const daily = validStoredSchedule(flight.dailySpots, flight) ? flight.dailySpots! : makeRadioDailySpots(flight, flight.units);
      const counts = new Map(daily.map(d => [d.date, d.units]));
      return {
        key: `${row.candidate.id}:${index}`, stationId: row.candidate.stationId ?? row.candidate.provider,
        station: row.candidate.provider, market: row.candidate.market, format: row.candidate.unit,
        program: row.candidate.product, priceUsd: row.candidate.unitPriceUsd,
        units: flight.units, totalUsd: flight.spendUsd, daily: dates.map(d => counts.get(d.date) ?? 0),
      };
    })
  ) : [];
  return {
    month, dates, rows, stations: new Set(rows.map(r => r.stationId)).size,
    units: rows.reduce((n, r) => n + r.units, 0),
    spendUsd: rows.reduce((n, r) => n + Math.round(r.totalUsd * 100), 0) / 100,
    dailyTotals: dates.map((_, i) => rows.reduce((n, r) => n + r.daily[i], 0)),
  };
}
