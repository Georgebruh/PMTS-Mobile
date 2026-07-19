import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { database } from '../database/database';
import { useObservable } from '../hooks/useObservable';
import { todayBounds, type DayBounds } from './dates';
import {
  draftReportClauses,
  previewCompare,
  progressClauses,
  woClauses,
  type WoListFilter,
} from './queries';
import { asSubscribable, type WoRecord } from './types';

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
    () => (rows === undefined ? undefined : [...rows].sort(previewCompare).slice(0, 5)),
    [rows],
  );
}
