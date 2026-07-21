import { Q } from '@nozbe/watermelondb';

import type { AssetHistoryRecord, AssetRecord, PmsScheduleRecord } from './types';

// The L2 filter set (mockup's sliders button) plus the shared search box.
// Plain serializable object — it lives in screen state, not a nav param.
export type AssetFilter = {
  /** assets.asset_type, exact match. */
  type?: string;
  /** assets.current_status_color (green/orange/red/black), exact match. */
  status?: string;
  /** assets.location, exact match. */
  location?: string;
  /** free text over name / code / location (the mockup's placeholder). */
  search?: string;
};

/** Mockup pagination: fixed page size, "Page N of M". */
export const ASSETS_PER_PAGE = 10;

/**
 * Q-clauses for the exact-match filters. `search` is deliberately NOT here —
 * it is case-insensitive across several columns, which SQL LIKE handles badly;
 * matchesSearchJs applies it to the observed rows instead (the locked set is
 * at most a few hundred rows, so this is cheap and works offline).
 */
export function assetFilterClauses(filter: AssetFilter): Q.Clause[] {
  const clauses: Q.Clause[] = [];
  if (filter.type) clauses.push(Q.where('asset_type', filter.type));
  if (filter.status) clauses.push(Q.where('current_status_color', filter.status));
  if (filter.location) clauses.push(Q.where('location', filter.location));
  return clauses;
}

/** Only live assets are listed; a deactivated row leaves the list on sync. */
export function activeAssetClause(): Q.Clause {
  return Q.where('active', true);
}

/** The mockup's "Search name, code, or location", case-insensitive. */
export function matchesSearchJs(
  asset: Pick<AssetRecord, 'equipmentName' | 'assetCode' | 'code' | 'location'>,
  search: string | undefined,
): boolean {
  const q = (search ?? '').trim().toLowerCase();
  if (q.length === 0) return true;
  return [asset.equipmentName, asset.assetCode, asset.code, asset.location].some((field) =>
    (field ?? '').toLowerCase().includes(q),
  );
}

/** Independent plain-JS recount of the whole filter (search included). */
export function matchesAssetFilterJs(asset: AssetRecord, filter: AssetFilter): boolean {
  if (filter.type && asset.assetType !== filter.type) return false;
  if (filter.status && asset.currentStatusColor !== filter.status) return false;
  if (filter.location && asset.location !== filter.location) return false;
  if (!matchesSearchJs(asset, filter.search)) return false;
  return true;
}

/**
 * The frozen asset order: tier 1 → 2 → 3 (the app-wide tier-first rule), then
 * equipment name, then asset code as a stable tie-break. Sorted in JS so the
 * rule lives in one place and the harness can exercise it directly.
 */
export function assetCompare(a: AssetRecord, b: AssetRecord): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  const byName = (a.equipmentName ?? '').localeCompare(b.equipmentName ?? '');
  if (byName !== 0) return byName;
  return (a.assetCode ?? '').localeCompare(b.assetCode ?? '');
}

/** Asset History timeline order: newest event first, undated rows last. */
export function historyCompare(a: AssetHistoryRecord, b: AssetHistoryRecord): number {
  const at = a.eventAt ? a.eventAt.getTime() : 0;
  const bt = b.eventAt ? b.eventAt.getTime() : 0;
  if (at !== bt) return bt - at;
  return (b.historyCode ?? '').localeCompare(a.historyCode ?? '');
}

/** Distinct, sorted values of one column across the locked set — feeds the
 *  L2 filter modal's option lists so it only ever offers reachable values. */
export function distinctValues(
  assets: AssetRecord[],
  pick: (asset: AssetRecord) => string,
): string[] {
  const seen = new Set<string>();
  for (const asset of assets) {
    const value = (pick(asset) ?? '').trim();
    if (value.length > 0) seen.add(value);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export type ScheduleSummary = {
  /** soonest due row at or after `now` — the mockup's "Next Inspection". */
  next: PmsScheduleRecord | null;
  /** latest due row before `now` — the mockup's "Last Inspection". */
  last: PmsScheduleRecord | null;
  /** frequency_type of the most relevant row (next, else last). */
  frequency: string | null;
};

/** Splits an asset's PMS rows into the Schedule card's next/last/frequency. */
export function scheduleSummary(
  rows: PmsScheduleRecord[],
  now: number,
): ScheduleSummary {
  const dated = rows
    .filter((r): r is PmsScheduleRecord & { dueDate: Date } => r.dueDate !== null)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  let next: PmsScheduleRecord | null = null;
  let last: PmsScheduleRecord | null = null;
  for (const row of dated) {
    if (row.dueDate!.getTime() >= now) {
      if (next === null) next = row;
    } else {
      // Ascending order, so the final past row seen is the latest one.
      last = row;
    }
  }

  const source = next ?? last ?? null;
  return { next, last, frequency: source ? source.frequencyType : null };
}

/** Human labels for the asset_history.event_type values the app renders. */
export const EVENT_LABELS: Record<string, string> = {
  CREATED: 'Asset created',
  STATUS_CHANGE: 'Status changed',
  TAGGED_FOR_REPAIR: 'Tagged for repair',
  WO_CREATED: 'Work order created',
  WO_ASSIGNED: 'Work order assigned',
  WO_STARTED: 'Work started',
  WO_COMPLETED: 'Work completed',
  REPORT_SUBMITTED: 'Report submitted',
  REPORT_APPROVED: 'Report approved',
  REPORT_REJECTED: 'Report rejected',
  WO_CLOSED: 'Work order closed',
};

/** Sheet-authored rows can carry any event_type — show it rather than blank. */
export function eventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType ?? 'Event';
}
