import { Q } from '@nozbe/watermelondb';
import { useMemo } from 'react';

import { useSession } from '../auth/session';
import { database } from '../database/database';
import { useObservable } from '../hooks/useObservable';
import { woCompare } from '../wo/queries';
import { WO_STATUS } from '../wo/status';
import { asSubscribable, type WoRecord } from '../wo/types';
import { areaLockFor, assetLockClauses, type AreaLock, type LockRole } from './lock';
import {
  activeAssetClause,
  assetCompare,
  assetFilterClauses,
  historyCompare,
  matchesSearchJs,
  type AssetFilter,
} from './queries';
import type { AssetHistoryRecord, AssetRecord, PmsScheduleRecord } from './types';

/** The signed-in user's parsed area/location lock. */
export function useAreaLock(): AreaLock {
  const area = useSession((s) => s.user?.assigned_area ?? '');
  const locations = useSession((s) => s.user?.assigned_locations ?? '');
  return useMemo(
    () => areaLockFor({ assigned_area: area, assigned_locations: locations }),
    [area, locations],
  );
}

/**
 * Every active asset the effective role may see — the lock applied, no filters.
 * Feeds the L2 filter modal's option lists, so it can only ever offer values
 * that are actually reachable. Mounted by the L2 list only.
 */
export function useLockedAssets(role: LockRole, lock: AreaLock): AssetRecord[] | undefined {
  return useObservable(
    () =>
      asSubscribable<AssetRecord[]>(
        database
          .get('assets')
          .query(activeAssetClause(), ...assetLockClauses(role, lock))
          .observe(),
      ),
    [role, lock.areas.join('|'), lock.locations.join('|')],
  );
}

/**
 * The Asset List's rows: locked, filtered, and in the frozen order (tier
 * 1→2→3, then name, then code). Lock and the exact-match filters run in SQL;
 * search and the sort run in JS. undefined until the first emission and again
 * whenever the scope changes, so a stale list never shows under a new lock.
 * The screen's count is rows.length — list and number cannot disagree.
 */
export function useAssetList(
  role: LockRole,
  lock: AreaLock,
  filter: AssetFilter,
): AssetRecord[] | undefined {
  const rows = useObservable(
    () =>
      asSubscribable<AssetRecord[]>(
        database
          .get('assets')
          .query(
            activeAssetClause(),
            ...assetLockClauses(role, lock),
            ...assetFilterClauses(filter),
          )
          .observe(),
      ),
    [
      role,
      lock.areas.join('|'),
      lock.locations.join('|'),
      filter.type,
      filter.status,
      filter.location,
    ],
  );

  return useMemo(() => {
    if (rows === undefined) return undefined;
    // filter() already copies, so sorting in place never touches the observed array.
    return rows.filter((asset) => matchesSearchJs(asset, filter.search)).sort(assetCompare);
  }, [rows, filter.search]);
}

/**
 * One asset by id. query().observe() rather than findAndObserve — an asset
 * removed by a sync while the detail is open must render the empty state, not
 * throw. undefined = still loading, null = gone.
 */
export function useAsset(assetId: string): AssetRecord | null | undefined {
  const rows = useObservable(
    () =>
      asSubscribable<AssetRecord[]>(
        database.get('assets').query(Q.where('id', assetId)).observe(),
      ),
    [assetId],
  );
  return rows === undefined ? undefined : (rows[0] ?? null);
}

/** The asset's history timeline, newest event first. */
export function useAssetHistory(assetId: string): AssetHistoryRecord[] | undefined {
  const rows = useObservable(
    () =>
      asSubscribable<AssetHistoryRecord[]>(
        database.get('asset_history').query(Q.where('asset_id', assetId)).observe(),
      ),
    [assetId],
  );
  return useMemo(
    () => (rows === undefined ? undefined : [...rows].sort(historyCompare)),
    [rows],
  );
}

/** The asset's PMS rows — scheduleSummary() turns these into next/last/frequency. */
export function useAssetSchedule(assetId: string): PmsScheduleRecord[] | undefined {
  return useObservable(
    () =>
      asSubscribable<PmsScheduleRecord[]>(
        database.get('pms_schedule').query(Q.where('asset_id', assetId)).observe(),
      ),
    [assetId],
  );
}

/**
 * Open work orders on this asset that the VIEWER owns — L1 sees only its own
 * assignments, L2 sees every open WO in its (already area-scoped) mirror.
 * Sorted by the frozen WO order; the detail screen jumps to the first.
 */
export function useAssetWorkOrders(
  assetId: string,
  role: LockRole,
  userId: string,
): WoRecord[] | undefined {
  const rows = useObservable(() => {
    const clauses: Q.Clause[] = [
      Q.where('asset_id', assetId),
      Q.where('status', Q.notEq(WO_STATUS.CLOSED)),
    ];
    if (role === 1) clauses.push(Q.where('assigned_to', userId));
    return asSubscribable<WoRecord[]>(
      database
        .get('work_orders')
        .query(...clauses)
        .observe(),
    );
  }, [assetId, role, userId]);

  return useMemo(() => (rows === undefined ? undefined : [...rows].sort(woCompare)), [rows]);
}
