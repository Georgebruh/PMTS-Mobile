import { useRef } from 'react';

type Identifiable = { id: string; updatedAt?: Date | null };

/**
 * Feature N — collapses WatermelonDB's fresh-array-per-emission into a stable
 * reference.
 *
 * `query.observe()` emits a brand-new array on every relevant change — and on
 * some that are irrelevant to a given screen — so a hook that returns that
 * array directly hands a new reference downstream each time, re-rendering the
 * whole list even when its content is byte-for-byte identical. This keeps the
 * previous reference whenever the content fingerprint is unchanged, so a
 * spurious emission costs nothing past this point.
 *
 * The fingerprint is each row's id and `updated_at`. WatermelonDB bumps
 * `updated_at` on every local write, and the gateway stamps it on every synced
 * change, so the fingerprint moves whenever any visible field could have — which
 * is why it beats `_raw._changed` (empty on synced-in rows, so it would miss a
 * pulled update).
 *
 * `undefined` (still loading) is passed straight through, and the stored
 * reference is dropped, so a re-subscribe after a scope change can never hand
 * back a stale array.
 */
export function useStableList<T extends Identifiable>(next: T[] | undefined): T[] | undefined {
  const prev = useRef<{ value: T[]; key: string } | undefined>(undefined);

  if (next === undefined) {
    prev.current = undefined;
    return undefined;
  }

  const key = fingerprint(next);
  if (prev.current !== undefined && prev.current.key === key) return prev.current.value;
  prev.current = { value: next, key };
  return next;
}

function fingerprint(rows: readonly Identifiable[]): string {
  let out = String(rows.length);
  for (const r of rows) {
    out += '|' + r.id + ':' + (r.updatedAt ? r.updatedAt.getTime() : 0);
  }
  return out;
}
