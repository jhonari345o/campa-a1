/** Clock time, independent of the programme title or alphabetical order. */
export function televisionStartMinute(schedule: string): number {
  const match = schedule.match(/\b([01]?\d|2[0-3])[:hH]([0-5]\d)\b/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Infinity;
}
