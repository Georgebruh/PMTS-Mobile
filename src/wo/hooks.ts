import { Q } from '@nozbe/watermelondb';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { database } from '../database/database';
import { useObservable } from '../hooks/useObservable';
import { todayBounds, type DayBounds } from './dates';
import {
  draftReportClauses,
  progressClauses,
  woClauses,
  woCompare,
  type WoListFilter,
} from './queries';
import { asSubscribable, type CrewRecord, type WoRecord } from './types';

// Today's [start, end) window, recomputed whenever the app returns to the
// foreground so a day rollover re-baselines every dashboard query. Accepted
// limitation: an app kept foregrounded non-stop across midnight waits for its
// next background/foreground cycle.
export function useTodayBounds(): DayBounds {
  const [bounds, setBounds] = useState<DayBounds>(() => todayBounds());

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setBounds((prev) => {
        const next = todayBounds();
        // Change-gated: same day → same object → no re-render/re-subscribe.
        return next.start === prev.start ? prev : next;
      });
    });
    return () => sub.remove();
  }, []);

  return bounds;
}

/** Live count of work orders matching `filter`; undefined until first emission. */
export function useWoCount(filter: WoListFilter, bounds: DayBounds): number | undefined {
  return useObservable(
    () =>
      asSubscribable<number>(
        database
          .get('work_orders')
          .query(...woClauses(filter, bounds))
          .observeCount(),
      ),
    [filter.kind, filter.assignedTo, filter.reporterId, bounds.start],
  );
}

/** Live count of this user's local draft (unfinished) reports. */
export function useDraftReportCount(reporterId: string): number | undefined {
  return useObservable(
    () =>
      asSubscribable<number>(
        database
          .get('maintenance_reports')
          .query(...draftReportClauses(reporterId))
          .observeCount(),
      ),
    [reporterId],
  );
}

/** L1 progress: my due-today WOs whose work is done vs all my due-today WOs. */
export function useProgressToday(
  me: string,
  bounds: DayBounds,
): { done: number; total: number } | undefined {
  const done = useObservable(
    () =>
      asSubscribable<number>(
        database
          .get('work_orders')
          .query(...progressClauses(me, bounds).numer)
          .observeCount(),
      ),
    [me, bounds.start],
  );
  const total = useObservable(
    () =>
      asSubscribable<number>(
        database
          .get('work_orders')
          .query(...progressClauses(me, bounds).denom)
          .observeCount(),
      ),
    [me, bounds.start],
  );
  if (done === undefined || total === undefined) return undefined;
  return { done, total };
}

/** Top five open WOs, tier 1→2→3 then due date (nulls last). */
export function useWoPreview(assignedTo?: string): WoRecord[] | undefined {
  const rows = useObservable(
    () =>
      asSubscribable<WoRecord[]>(
        database
          .get('work_orders')
          // 'open' has no date clause; todayBounds() only satisfies the
          // shared builder signature.
          .query(...woClauses({ kind: 'open', assignedTo }, todayBounds()))
          .observe(),
      ),
    [assignedTo],
  );
  return useMemo(
    () => (rows === undefined ? undefined : [...rows].sort(woCompare).slice(0, 5)),
    [rows],
  );
}

/**
 * The Work Order List's rows: everything matching `filter`, in the frozen
 * order (tier 1→2→3, due date nulls-last, code). undefined until the first
 * emission — and again whenever the filter changes, so a stale list never
 * shows under a new title. The screen's count is rows.length: the list and
 * its header number read the same array and cannot disagree.
 */
export function useWoList(filter: WoListFilter, bounds: DayBounds): WoRecord[] | undefined {
  const rows = useObservable(
    () =>
      asSubscribable<WoRecord[]>(
        database
          .get('work_orders')
          .query(...woClauses(filter, bounds))
          .observe(),
      ),
    [filter.kind, filter.assignedTo, filter.reporterId, bounds.start],
  );
  return useMemo(() => (rows === undefined ? undefined : [...rows].sort(woCompare)), [rows]);
}

/**
 * One live work order for the detail screen (Feature H). undefined until the
 * first emission, null when the row is gone.
 *
 * query().observe() rather than findAndObserve() — a work order removed by a
 * sync while the detail is open must render the empty state, not throw. It
 * also keeps emitting after Start/Complete, so the buttons re-evaluate their
 * guards against the row the write just produced.
 */
export function useWo(woId: string): WoRecord | null | undefined {
  const rows = useObservable(
    () =>
      asSubscribable<WoRecord[]>(
        database.get('work_orders').query(Q.where('id', woId)).observe(),
      ),
    [woId],
  );
  if (rows === undefined) return undefined;
  return rows.length > 0 ? rows[0] : null;
}

/**
 * This work order's crew, oldest first — the order they were added is the
 * order they read best in. undefined until the first emission.
 */
export function useCrew(woId: string): CrewRecord[] | undefined {
  const rows = useObservable(
    () =>
      asSubscribable<CrewRecord[]>(
        database
          .get('work_order_crew')
          .query(Q.where('work_order_id', woId))
          .observe(),
      ),
    [woId],
  );
  return useMemo(() => (rows === undefined ? undefined : [...rows].sort(crewCompare)), [rows]);
}

/** Oldest first, id as a stable tie-break for rows created in the same ms. */
function crewCompare(a: CrewRecord, b: CrewRecord): number {
  const aAt = a.createdAt ? a.createdAt.getTime() : 0;
  const bAt = b.createdAt ? b.createdAt.getTime() : 0;
  if (aAt !== bAt) return aAt - bAt;
  return a.id.localeCompare(b.id);
}
