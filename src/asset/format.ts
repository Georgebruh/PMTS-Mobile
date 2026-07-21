// Date formatting for the asset screens. Written by hand rather than via Intl:
// Hermes ships a trimmed ICU and the rest of the app has never depended on
// Intl, so a plain lookup keeps output identical across devices.

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "July 12, 2025" — the mockup's info-row date format. Null → em dash. */
export function formatDate(value: Date | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const d = typeof value === 'number' ? new Date(value) : value;
  const ms = d.getTime();
  if (Number.isNaN(ms)) return '—';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Day-relative label against a local-day window: "Today", "Yesterday",
 * "Tomorrow", else null (the caller falls back to formatDate). Used for the
 * Schedule card's urgent "Today" treatment and the history timeline.
 */
export function relativeDay(
  value: Date | number | null | undefined,
  todayStart: number,
): string | null {
  if (value === null || value === undefined) return null;
  const d = typeof value === 'number' ? new Date(value) : value;
  const ms = d.getTime();
  if (Number.isNaN(ms)) return null;
  const DAY = 24 * 60 * 60 * 1000;
  if (ms >= todayStart && ms < todayStart + DAY) return 'Today';
  if (ms >= todayStart - DAY && ms < todayStart) return 'Yesterday';
  if (ms >= todayStart + DAY && ms < todayStart + 2 * DAY) return 'Tomorrow';
  return null;
}
