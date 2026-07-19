// Local-day boundary helpers. All DB timestamps are unix ms; the dashboard's
// "today" is the device's local day.

export type DayBounds = {
  /** First ms of the local day (inclusive). */
  start: number;
  /** First ms of the NEXT local day (exclusive) — the window is [start, end). */
  end: number;
};

export function todayBounds(now: Date = new Date()): DayBounds {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const start = d.getTime();
  // Next local midnight via the calendar, not start + 86_400_000.
  d.setDate(d.getDate() + 1);
  return { start, end: d.getTime() };
}
