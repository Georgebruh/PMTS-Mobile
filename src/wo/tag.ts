// Feature J — Tag Asset for Repair.
//
// Import-pure like ./actions.ts and ../asset/lock.ts (no database, no
// react-native, no navigation): the Node harness compiles this module standalone
// and exhausts every rule below before a device ever runs it.
//
// This is the first feature that ORIGINATES a record the backend has never
// seen. Features H and I write into a conversation the sheet already started —
// a work order the server created, a report attached to it. Here the app makes
// the row up, from a button that floats over every tab with no asset context of
// its own. Two failure modes follow from that, and both are answered here
// rather than at the call site:
//
//   1. An out-of-scope asset reaching the row. The FAB carries no lock, so
//      tagGate() re-applies the EFFECTIVE role's area/location lock and the
//      mutation re-runs it inside the write transaction.
//   2. A duplicate work order. Nothing upstream dedupes an app-originated row,
//      so findOpenRepair() is a hard block (decision locked in J planning) —
//      and, because a work order id is minted before the write, a double tap
//      re-finds its OWN row and reports success instead of a false duplicate.

import { WO_STATUS, WO_TYPE, type WoStatus } from './status';

/**
 * GAP #11, FROZEN HERE: the only `asset_history.event_type` value this app is
 * ever allowed to write.
 *
 * `asset_history` is append-only and written by BOTH the server and the app, so
 * the plan deferred "freeze which event types the app may write" to Feature J.
 * This is that freeze. EVENT_LABELS (src/asset/queries.ts) lists eleven values
 * because it has to RENDER whatever the server authored; this constant governs
 * what the app may AUTHOR, and it is exactly one value.
 *
 * `TEST_SYNC` is deliberately not here — it is written only by __DEV__ probes,
 * which are required to delete their rows before reconnecting.
 */
export const EVENT_TAGGED_FOR_REPAIR = 'TAGGED_FOR_REPAIR';

/** Every event type the app may author. Adding to this list is a plan-level
 *  decision, not a code change — the harness asserts the mutation cannot write
 *  an event type outside it. */
export const APP_EVENT_TYPES: readonly string[] = [EVENT_TAGGED_FOR_REPAIR];

/** A work order still in play, for the purposes of "is this asset already
 *  tagged". COMPLETED onward is paperwork — the fault itself has been dealt
 *  with, so a NEW fault on the same asset must be taggable. Mirrors the
 *  reasoning behind OVERDUE_STATUSES in ./status.ts. */
export const OPEN_REPAIR_STATUSES: readonly WoStatus[] = [
  WO_STATUS.UNASSIGNED,
  WO_STATUS.ASSIGNED,
  WO_STATUS.IN_PROGRESS,
];

/** The minimum an asset must expose to be tagged. Structural, so both the rich
 *  AssetRecord (src/asset/types) and a plain fixture row satisfy it. */
export type TaggableAsset = {
  id: string;
  tier: number;
  site: string;
  location: string;
  active: boolean;
};

/** Who is tagging — role is the EFFECTIVE role (an L2 acting as L1 is a 1). */
export type Tagger = {
  role: 1 | 2;
  userId: string;
  /** Rendered verbatim in the history timeline's meta line, so this is the
   *  display name, not the id. See actorFor() below. */
  fullName: string;
};

/** The lock shape from src/asset/lock.ts, re-declared structurally so this
 *  module keeps zero imports outside ./status. */
export type TagLock = {
  areas: string[];
  locations: string[];
};

export type TagGateResult = {
  canTag: boolean;
  /** Why not, in the user's words. Null when canTag is true. */
  blockedReason: string | null;
};

const allowed: TagGateResult = { canTag: true, blockedReason: null };
const blocked = (blockedReason: string): TagGateResult => ({ canTag: false, blockedReason });

/**
 * May this viewer tag this asset?
 *
 * BOTH roles may tag (frozen in Feature D's planning: the L1 FAB's single
 * action and the L2 speed-dial both carry it), so unlike woActions() there is
 * no role-level refusal here — the axis that matters is the LOCK.
 *
 * The lock check is not redundant with Feature C's server scoping, for exactly
 * the reason src/asset/lock.ts documents: when an L2 acts as L1 the local
 * mirror still holds the L2's whole area, which is broader than an L1 may see.
 * The picker already filters by the same lock, so reaching this refusal means
 * either a stale route param or a role flipped mid-flow — both real.
 */
export function tagGate(
  asset: TaggableAsset | null | undefined,
  viewer: Tagger,
  lock: TagLock,
): TagGateResult {
  if (!asset) return blocked('This asset is no longer available.');
  if (!viewer.userId) return blocked('You must be signed in to tag an asset.');
  if (!asset.active) return blocked('This asset is inactive and cannot be tagged for repair.');

  // Same rule as matchesLockJs, restated rather than imported so this module
  // stays dependency-free. The harness checks the two against each other over
  // a shared fixture, so they cannot drift apart silently.
  if (lock.areas.length > 0 && !lock.areas.includes(asset.site)) {
    return blocked('This asset is outside your assigned area.');
  }
  if (viewer.role === 1 && lock.locations.length > 0 && !lock.locations.includes(asset.location)) {
    return blocked('This asset is outside your assigned locations.');
  }

  return allowed;
}

/** A work order as the duplicate check needs to see it. */
export type OpenRepairCandidate = {
  id: string;
  woType: string;
  status: string;
};

/**
 * The existing open REPAIR work order on this asset, or null.
 *
 * Callers pass the work orders ALREADY scoped to one asset — keeping the asset
 * filter in the query (where it is indexed) rather than here means this stays a
 * pure predicate the harness can drive with a handful of rows.
 *
 * Only REPAIR counts: a PMS or CAPEX work order on the same asset says nothing
 * about whether the fault someone just noticed has been reported.
 */
export function findOpenRepair(
  candidates: readonly OpenRepairCandidate[],
): OpenRepairCandidate | null {
  for (const wo of candidates) {
    if (wo.woType !== WO_TYPE.REPAIR) continue;
    if (!(OPEN_REPAIR_STATUSES as readonly string[]).includes(wo.status)) continue;
    return wo;
  }
  return null;
}

/**
 * The columns of the work_orders row a tag creates.
 *
 * Every non-optional column in the gateway's TABLE_SPECS.work_orders is set
 * here, and the harness asserts that field-by-field against that spec: a column
 * omitted here reaches the sheet blank, which is the kind of failure nobody
 * notices until an L2 opens the spreadsheet.
 *
 * Deliberately absent:
 *   assigned_to / assigned_by / assigned_at  — L2 owns assignment (Feature L).
 *   due_date                                 — L2 owns scheduling (locked in J
 *                                              planning). Verified safe against
 *                                              Feature E: a null due_date keeps
 *                                              the row out of Today and Overdue
 *                                              but still inside Unassigned,
 *                                              which is this feature's done-when.
 *   started_at / ended_at                    — Feature H stamps those.
 *   source_report_id                         — only a server-spawned rework
 *                                              carries one (gap #12).
 */
export type NewWoFields = {
  woCode: string;
  assetId: string;
  tier: number;
  woType: string;
  status: string;
  createdBy: string;
  site: string;
  location: string;
};

export function buildWoFields(asset: TaggableAsset, viewer: Tagger): NewWoFields {
  return {
    // Display codes are server-owned, written empty — the same convention as
    // report_code (Feature I) and crew_code (Feature H). The gateway mints one
    // on the first push (Feature N's assignDisplayCodes_), so it fills in on sync.
    woCode: '',
    assetId: asset.id,
    // Denormalized from the asset so the app-wide tier-first sort and the
    // gateway's area/location pull scope both work on the work order alone.
    tier: asset.tier,
    woType: WO_TYPE.REPAIR,
    status: WO_STATUS.UNASSIGNED,
    createdBy: viewer.userId,
    site: asset.site,
    location: asset.location,
  };
}

/** The columns of the asset_history row a tag creates. */
export type NewHistoryFields = {
  historyCode: string;
  assetId: string;
  eventType: string;
  workOrderId: string;
  statusColor: string | null;
  actor: string;
  notes: string | null;
  eventAt: number;
};

/**
 * `actor` carries the DISPLAY NAME, not the user id.
 *
 * This looks like it contradicts gap #9 (work_order_crew.added_by holds the
 * WatermelonDB user id), but it is the same reasoning reaching the opposite
 * answer. `added_by` is declared an FK in schema.js and is never rendered;
 * `actor` is declared as a plain optional string, is not an FK to anything, and
 * HistoryTimeline prints it verbatim into the timeline's meta line. Writing an
 * id there would put a raw UUID on the user's screen.
 */
export function actorFor(viewer: Tagger): string {
  return viewer.fullName.trim() || viewer.userId;
}

export function buildHistoryFields(
  asset: TaggableAsset,
  viewer: Tagger,
  workOrderId: string,
  now: number,
): NewHistoryFields {
  return {
    historyCode: '', // server-owned, like every other display code
    assetId: asset.id,
    eventType: EVENT_TAGGED_FOR_REPAIR, // the gap-#11 freeze, in its only use
    workOrderId,
    // No severity picker in v1 (locked in J planning): the app cannot change
    // asset status anyway — `assets` is push:false and the server owns
    // current_status_color — so a colour written here would be an unread signal.
    statusColor: null,
    actor: actorFor(viewer),
    // No reason field (locked in J planning). The tag records THAT the asset
    // needs repair; the diagnosis belongs in the maintenance report.
    notes: null,
    eventAt: now,
  };
}
