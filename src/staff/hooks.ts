// Feature L — live views for the Staff tab.
//
// Same shape as src/wo/hooks.ts and src/report/hooks.ts: query().observe()
// everywhere so a row removed by a sync updates the screen without a refetch,
// and undefined until the first emission so nothing renders under a scope that
// has not loaded yet. Sorting and area-matching happen in JS off the shared
// import-pure predicates, so the harness exercises the exact logic the screen
// runs.

import { Q } from '@nozbe/watermelondb';
import { useMemo } from 'react';

import { database } from '../database/database';
import { useObservable } from '../hooks/useObservable';
import { APPROVAL_PENDING } from '../report/actions';
import type { ReportRecord } from '../report/types';
import { todayBounds } from '../wo/dates';
import { woClauses, woCompare } from '../wo/queries';
import { asSubscribable, type WoRecord } from '../wo/types';
import { isEligibleStaff } from './assign';
import { buildNameMap } from './naming';
import type { UserRecord } from './types';

/**
 * Live id → full-name map over every user in the local mirror (the server has
 * already scoped it to the caller's area). Feeds gap #8's name resolution —
 * assignee names on the assignment queue, reporter names on the approval queue.
 */
export function useUserNames(): Map<string, string> | undefined {
  const rows = useObservable(
    () => asSubscribable<UserRecord[]>(database.get('users').query().observe()),
    [],
  );
  return useMemo(() => (rows === undefined ? undefined : buildNameMap(rows)), [rows]);
}

/**
 * The assignment queue: every UNASSIGNED work order, in the frozen list order
 * (tier 1→2→3, due nulls-last, code). Reuses the exact clauses the dashboard's
 * Unassigned card and Feature F's chip use, so the three cannot drift.
 */
export function useUnassignedWos(): WoRecord[] | undefined {
  const rows = useObservable(
    () =>
      asSubscribable<WoRecord[]>(
        database
          .get('work_orders')
          // 'unassigned' carries no date clause; todayBounds() only satisfies
          // the shared builder's signature.
          .query(...woClauses({ kind: 'unassigned' }, todayBounds()))
          .observe(),
      ),
    [],
  );
  return useMemo(() => (rows === undefined ? undefined : [...rows].sort(woCompare)), [rows]);
}

/**
 * The approval queue: submitted reports still waiting, oldest-submitted first
 * (a review queue is FIFO — the report that has waited longest is reviewed
 * next). is_draft = false AND approval_status = PENDING is exactly what submit
 * leaves behind and what the server clears on review.
 */
export function usePendingApprovals(): ReportRecord[] | undefined {
  const rows = useObservable(
    () =>
      asSubscribable<ReportRecord[]>(
        database
          .get('maintenance_reports')
          .query(Q.where('is_draft', false), Q.where('approval_status', APPROVAL_PENDING))
          .observe(),
      ),
    [],
  );
  return useMemo(() => (rows === undefined ? undefined : [...rows].sort(approvalQueueCompare)), [rows]);
}

/**
 * The eligible-staff pool for one work order: active role-1 users whose area
 * covers its site, alphabetical by name. The SQL narrows to role-1 active users
 * (cheap, indexed-ish); the area match runs in JS via the shared isEligibleStaff
 * so it is the same predicate the mutation re-checks and the harness asserts.
 */
export function useEligibleStaff(wo: WoRecord | null | undefined): UserRecord[] | undefined {
  const rows = useObservable(
    () =>
      asSubscribable<UserRecord[]>(
        database
          .get('users')
          .query(Q.where('role_level', 1), Q.where('active', true))
          .observe(),
      ),
    [],
  );
  return useMemo(() => {
    if (rows === undefined || !wo) return undefined;
    return rows.filter((u) => isEligibleStaff(u, wo)).sort(staffCompare);
  }, [rows, wo?.site]);
}

/** Oldest submitted first; null submitted_at last; id as a stable tie-break. */
function approvalQueueCompare(a: ReportRecord, b: ReportRecord): number {
  const aAt = a.submittedAt ? a.submittedAt.getTime() : Number.POSITIVE_INFINITY;
  const bAt = b.submittedAt ? b.submittedAt.getTime() : Number.POSITIVE_INFINITY;
  if (aAt !== bAt) return aAt - bAt;
  return a.id.localeCompare(b.id);
}

/** Alphabetical by name, then id so two identically-named staff order stably. */
function staffCompare(a: UserRecord, b: UserRecord): number {
  const byName = (a.fullName ?? '').localeCompare(b.fullName ?? '');
  return byName !== 0 ? byName : a.id.localeCompare(b.id);
}
