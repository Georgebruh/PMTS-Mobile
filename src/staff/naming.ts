// Feature L — id → display-name resolution.
//
// Gap #8, live at last: work_orders.assigned_to and
// maintenance_reports.reporter_user_id carry a user id with no @relation to
// users (models.js, by design). Every prior screen only ever needed the
// signed-in user's own name; the Staff tab is the first to render OTHER
// people's — the assignee on a work order, the reporter on a report, the staff
// in the picker. Rather than add relations (a schema concern) it resolves names
// from the local users mirror, which the server already scopes to the caller's
// area(s).
//
// Import-pure like src/wo/actions.ts: no database, no react-native. The hook
// that feeds it the rows lives in ./hooks; the map it builds is exercised by
// the Node harness directly.

/** Just enough of a user to name them. */
export type NamedUser = { id: string; fullName: string };

/**
 * Builds an id → full-name lookup. A blank name maps to '' (not dropped) so a
 * present-but-unnamed account is distinguishable from an absent one; nameFor
 * turns both into a legible fallback.
 */
export function buildNameMap(users: readonly NamedUser[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const u of users) {
    if (u.id) map.set(u.id, (u.fullName ?? '').trim());
  }
  return map;
}

/**
 * The name for a user id, or a fallback. An id that resolves to a present-but-
 * empty name, and an id absent from the map (not in the caller's area, or a
 * hand-edited cell), both read as the fallback rather than as a raw UUID on the
 * user's screen.
 */
export function nameFor(
  map: Map<string, string> | undefined,
  id: string | null | undefined,
  fallback = 'Unknown',
): string {
  if (!id) return fallback;
  const name = map?.get(id);
  return name && name.length > 0 ? name : fallback;
}
