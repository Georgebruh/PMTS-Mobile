// Feature K — the L2 Calendar's date-range math, and nothing else.
//
// Import-pure (no database, no react-native, no navigation) exactly like
// chips.ts / actions.ts / tag.ts, so the Node harness compiles it standalone
// and can exhaust the boundary cases — month ends, leap Februaries, the year
// rollover, the Monday-week wrap — before a device ever runs one.
//
// Every window is computed by LOCAL-CALENDAR MUTATION (setHours/setDate/
// setMonth on a Date), never by millisecond arithmetic. That is what makes
// "+1 month" land on the first of the *next* month regardless of how many days
// this month has, and what keeps a device in a DST timezone on the correct
// local midnight — the Date object does the wall-clock normalization. It is the
// same technique todayBounds() in ./dates.ts already uses; this module is its
// generalization from a single day to weeks, months and arbitrary spans.

import type { WoRecord } from './types';

export type CalendarPreset =
  | 'day'
  | 'thisWeek'
  | 'nextWeek'
  | 'thisMonth'
  | 'nextMonth'
  | 'custom';

/** The ordered preset row the calendar offers, left to right. */
export const CALENDAR_PRESETS: readonly CalendarPreset[] = [
  'day',
  'thisWeek',
  'nextWeek',
  'thisMonth',
  'nextMonth',
  'custom',
];

/** Chip labels for the preset row. */
export const PRESET_LABELS: Record<CalendarPreset, string> = {
  day: '1 Day',
  thisWeek: 'This Week',
  nextWeek: 'Next Week',
  thisMonth: 'This Month',
  nextMonth: 'Next Month',
  custom: 'Custom',
};

/** A half-open local window [start, end) in unix ms — the DayBounds convention. */
export type DateRange = {
  start: number;
  end: number;
};

/** A user-picked custom span; both endpoints are inclusive day anchors. */
export type CustomSpan = {
  start: Date;
  end: Date;
};

// Monday-based weeks (decision locked with the user, 2026-07-22): "This Week"
// is the Mon–Sun block containing the anchor, "Next Week" the one after. Change
// this single constant to move the week start; startOfWeek() is its only reader.
export const WEEK_START_DOW = 1; // 0 = Sunday … 1 = Monday … 6 = Saturday

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ---------- window builders ----------

/** Local midnight of the day containing `at`. */
function startOfDay(at: Date): Date {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Local midnight of the week start (Monday) on or before `at`. */
function startOfWeek(at: Date): Date {
  const d = startOfDay(at);
  // getDay(): 0=Sun..6=Sat. Distance back to WEEK_START_DOW, always in [0,6].
  const back = (d.getDay() - WEEK_START_DOW + 7) % 7;
  d.setDate(d.getDate() - back);
  return d;
}

/** Local midnight of the first of the month containing `at`. */
function startOfMonth(at: Date): Date {
  const d = startOfDay(at);
  d.setDate(1);
  return d;
}

/** [midnight(anchor), next midnight) — the 1-day view. */
export function dayRange(anchor: Date): DateRange {
  const start = startOfDay(anchor);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

/** [startOfWeek(anchor), +7 days) — the Mon–Sun week containing the anchor. */
export function weekRange(anchor: Date): DateRange {
  const start = startOfWeek(anchor);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start: start.getTime(), end: end.getTime() };
}

/**
 * [first-of-month(anchor), first-of-next-month) — the whole calendar month.
 *
 * Safe against the classic "Jan 31 + 1 month = Mar 3" overflow: the day is
 * pinned to 1 (which exists in every month) BEFORE setMonth advances it, so
 * the result is always the first of the following month.
 */
export function monthRange(anchor: Date): DateRange {
  const start = startOfMonth(anchor);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

/**
 * A custom span from two picked days, INCLUSIVE of both. Order is normalized so
 * start ≤ end, and the window runs to the midnight AFTER the later day so that
 * whole day is included — the same half-open [start, end) shape as every other
 * range, so downstream code never special-cases custom.
 */
export function customRange(a: Date, b: Date): DateRange {
  const d1 = startOfDay(a).getTime();
  const d2 = startOfDay(b).getTime();
  const lo = Math.min(d1, d2);
  const hi = new Date(Math.max(d1, d2));
  hi.setDate(hi.getDate() + 1);
  return { start: lo, end: hi.getTime() };
}

/** Shift a day anchor by whole days — the ◀ ▶ 1-day navigator. */
export function shiftDay(anchor: Date, deltaDays: number): Date {
  const d = startOfDay(anchor);
  d.setDate(d.getDate() + deltaDays);
  return d;
}

/**
 * The window a preset resolves to. The 1-day preset reads `anchor` (which ◀ ▶
 * moves); the period presets are relative to `now` and ignore the anchor;
 * custom uses the picked span, falling back to today's single day until a span
 * is chosen so the resolved range is never undefined.
 *
 * "Next Week"/"Next Month" are expressed as the week/month starting at the END
 * of this week/month — the half-open end IS the next period's first instant, so
 * there is exactly one place the +1 step lives.
 */
export function rangeForPreset(
  preset: CalendarPreset,
  anchor: Date,
  now: Date = new Date(),
  custom?: CustomSpan,
): DateRange {
  switch (preset) {
    case 'day':
      return dayRange(anchor);
    case 'thisWeek':
      return weekRange(now);
    case 'nextWeek':
      return weekRange(new Date(weekRange(now).end));
    case 'thisMonth':
      return monthRange(now);
    case 'nextMonth':
      return monthRange(new Date(monthRange(now).end));
    case 'custom':
      return custom ? customRange(custom.start, custom.end) : dayRange(now);
  }
}

/** Whether the preset's window moves with the ◀ ▶ navigator (1-day only). */
export function isNavigable(preset: CalendarPreset): boolean {
  return preset === 'day';
}

// ---------- labels ----------

/** "Jul 13 – 19" · "Jun 30 – Jul 6" · "Dec 30, 2025 – Jan 5, 2026". */
function formatSpan(a: Date, b: Date): string {
  const sameYear = a.getFullYear() === b.getFullYear();
  if (sameYear && a.getMonth() === b.getMonth()) {
    return `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} – ${b.getDate()}`;
  }
  if (sameYear) {
    return `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} – ${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}`;
  }
  return (
    `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()}, ${a.getFullYear()} – ` +
    `${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`
  );
}

/**
 * The pill's label for a resolved range: the mockup's "July 15" for a day,
 * "July 2026" for a month, and a compact span for a week or custom range.
 * Reads `range.end - 1` for the last INCLUDED day, since end is exclusive.
 */
export function formatRangeLabel(preset: CalendarPreset, range: DateRange): string {
  const start = new Date(range.start);
  switch (preset) {
    case 'day':
      return `${MONTHS[start.getMonth()]} ${start.getDate()}`;
    case 'thisMonth':
    case 'nextMonth':
      return `${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
    default:
      return formatSpan(start, new Date(range.end - 1));
  }
}

// ---------- verification counterpart ----------

/**
 * Independent plain-JS predicate: is this work order's due date inside the
 * window? Deliberately a naive re-implementation of rangeClauses() (in
 * ./queries) so the dev harness can recount against a full-table fetch and a
 * bug in the Q-clauses cannot hide behind itself — the src/wo matchesFilterJs
 * pattern, applied to the calendar.
 *
 * A null due date is never in any range: an unscheduled work order is not on
 * the calendar, which also matches the SQL — a comparison against NULL is never
 * satisfied.
 */
export function matchesRangeJs(wo: Pick<WoRecord, 'dueDate'>, range: DateRange): boolean {
  if (wo.dueDate === null) return false;
  const due = wo.dueDate.getTime();
  return due >= range.start && due < range.end;
}
