// Feature H — the first writes in this app that are MEANT to survive.
//
// Everything through Feature G is read-only; the dev probes' local rows are
// deliberately destroyed before reconnecting. So this module is where
// WatermelonDB's _status queue, the gateway's upsert-by-id, and the
// full-snapshot pull first meet for real. Two habits follow from that:
//
//   1. Every mutation re-fetches its row and re-runs the phase-1 guard INSIDE
//      the write transaction. The props the button was rendered from can be a
//      sync round out of date by the time a finger lands.
//   2. Every mutation is idempotent. A double tap, or a retry after the screen
//      re-rendered, must be a no-op — never a second timestamp and never an
//      error the user has to interpret.
//
// Failures come back as values, not exceptions: the screen shows result.error
// verbatim and there is no path where a write half-succeeds silently.

import { Q } from '@nozbe/watermelondb';
import { randomId } from '@nozbe/watermelondb/utils/common';

import { database } from '../database/database';
import { canRemoveCrew, nextStatusFor, woActions, validateCrewName, type Viewer } from './actions';
import { WO_STATUS } from './status';
import {
  buildHistoryFields,
  buildWoFields,
  findOpenRepair,
  tagGate,
  type OpenRepairCandidate,
  type TagLock,
  type Tagger,
  type TaggableAsset,
} from './tag';
import type { CrewRecord, WoRecord } from './types';

export type MutationResult = { ok: true } | { ok: false; error: string };

const OK: MutationResult = { ok: true };

function fail(error: string): MutationResult {
  return { ok: false, error };
}

/** query().fetch() rather than find() — a work order deleted by a sync must
 *  come back as "gone", not as a thrown record-not-found. */
async function fetchWo(woId: string): Promise<any | null> {
  const rows = await database.get('work_orders').query(Q.where('id', woId)).fetch();
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Start Work — ASSIGNED → IN_PROGRESS, stamping started_at from the device
 * clock. Offline by construction; clock skew between devices is accepted
 * (the sheet records what the phone that did the work believed the time was).
 */
export async function startWork(woId: string, viewer: Viewer): Promise<MutationResult> {
  try {
    return await database.write(async () => {
      const wo = await fetchWo(woId);
      if (wo === null) return fail('This work order is no longer available.');

      // Idempotent: already running (a second tap, or another device's row
      // arriving mid-session) is success, not a duplicate stamp. Anything else
      // falls through to the guard, which explains itself properly.
      if (wo.status === WO_STATUS.IN_PROGRESS && wo.startedAt !== null) return OK;

      const guard = woActions(wo as WoRecord, viewer);
      if (!guard.canStart) {
        return fail(guard.blockedReason ?? 'This work order cannot be started right now.');
      }

      await wo.update((w: any) => {
        w.status = nextStatusFor('start');
        w.startedAt = new Date();
      });
      return OK;
    });
  } catch (e) {
    console.warn('startWork failed:', e);
    return fail('Could not start this work order. Please try again.');
  }
}

/**
 * Complete Work — IN_PROGRESS → COMPLETED, stamping ended_at. COMPLETED means
 * "work ended, report not yet submitted"; Feature I's report is what moves it
 * on to PENDING_APPROVAL. Deliberately does NOT touch started_at.
 */
export async function completeWork(woId: string, viewer: Viewer): Promise<MutationResult> {
  try {
    return await database.write(async () => {
      const wo = await fetchWo(woId);
      if (wo === null) return fail('This work order is no longer available.');

      // Idempotent, same reasoning as startWork: already completed is success.
      if (wo.status === WO_STATUS.COMPLETED && wo.endedAt !== null) return OK;

      const guard = woActions(wo as WoRecord, viewer);
      if (!guard.canComplete) {
        return fail(guard.blockedReason ?? 'This work order cannot be completed right now.');
      }

      await wo.update((w: any) => {
        w.status = nextStatusFor('complete');
        w.endedAt = new Date();
      });
      return OK;
    });
  } catch (e) {
    console.warn('completeWork failed:', e);
    return fail('Could not complete this work order. Please try again.');
  }
}

/**
 * Adds a free-typed worker to the crew — the phone-less-worker case this
 * feature exists for. added_by holds the WatermelonDB user id (gap #9,
 * resolved in H planning: every other FK in the schema is a raw row id).
 * crew_code is written empty and treated as server-owned, matching the
 * report_code convention.
 *
 * Re-reads the existing names inside the transaction so two quick taps cannot
 * race past the duplicate check.
 */
export async function addCrew(
  woId: string,
  rawName: string,
  viewer: Viewer,
): Promise<MutationResult> {
  try {
    return await database.write(async () => {
      const wo = await fetchWo(woId);
      if (wo === null) return fail('This work order is no longer available.');

      const guard = woActions(wo as WoRecord, viewer);
      if (!guard.canEditCrew) {
        return fail(guard.blockedReason ?? 'Crew cannot be changed on this work order.');
      }

      const existing = await database
        .get('work_order_crew')
        .query(Q.where('work_order_id', woId))
        .fetch();
      const check = validateCrewName(
        rawName,
        existing.map((c: any) => c.workerName as string),
      );
      if (!check.ok) return fail(check.error);

      await database.get('work_order_crew').create((c: any) => {
        c.workOrder.set(wo);
        c.crewCode = ''; // display codes are server-owned
        c.workerName = check.name;
        c.addedBy = viewer.userId;
      });
      return OK;
    });
  } catch (e) {
    console.warn('addCrew failed:', e);
    return fail('Could not add that crew member. Please try again.');
  }
}

/**
 * Removes a crew row that has never been pushed — destroyPermanently, so
 * nothing is queued for the server and nothing can come back.
 *
 * A row that HAS synced is refused. The gateway ignores `deleted` arrays and
 * every pull is a full snapshot, so deleting a synced row locally would let
 * the next pull resurrect it; the UI hides removal for those rows and this
 * guard is the backstop if it ever slips.
 */
export async function removeCrew(crewId: string): Promise<MutationResult> {
  try {
    return await database.write(async () => {
      const rows = await database.get('work_order_crew').query(Q.where('id', crewId)).fetch();
      if (rows.length === 0) return OK; // already gone — nothing to undo

      const crew = rows[0] as any;
      if (!canRemoveCrew(crew as CrewRecord)) {
        return fail('This crew member has already synced and can no longer be removed here.');
      }

      await crew.destroyPermanently();
      return OK;
    });
  } catch (e) {
    console.warn('removeCrew failed:', e);
    return fail('Could not remove that crew member. Please try again.');
  }
}

// ---------- Feature J: Tag Asset for Repair ----------

export type TagResult =
  | { ok: true; woId: string; /** false when a re-submit re-found its own row */ created: boolean }
  | { ok: false; error: string };

/**
 * Mints the id of the work order a tag is ABOUT to create, before the write.
 *
 * This is what makes tagAssetForRepair idempotent, and it matters more here
 * than anywhere else in the app. Every other mutation acts on a row the sheet
 * already gave us, so a double tap has something to be idempotent AGAINST; a
 * tag invents its row, so without a stable id the second tap simply makes a
 * second work order. With one, the second tap re-finds the first tap's row and
 * reports success.
 *
 * Uses WatermelonDB's own generator rather than a hand-rolled one: ids are
 * restricted to [a-zA-Z0-9._] by the library (anything else breaks its SQL
 * escaping), and this is the exact function sanitizedRaw would have called.
 */
export function newWorkOrderId(): string {
  return randomId();
}

/**
 * Creates the REPAIR work order for a tagged asset, plus its asset_history
 * event, in ONE batch.
 *
 * The two rows are batched rather than created in sequence because a work order
 * with no history event — or worse, a history event pointing at a work order
 * that never landed — is a silent integrity failure that no screen would show.
 * database.batch() is a single adapter call, so both rows commit or neither do.
 *
 * Refuses when the asset already carries an open REPAIR work order (decision
 * locked in J planning: one open repair per asset). The one exception is a row
 * this very call is retrying — see newWorkOrderId above.
 */
export async function tagAssetForRepair(
  assetId: string,
  woId: string,
  viewer: Tagger,
  lock: TagLock,
): Promise<TagResult> {
  try {
    return await database.write(async () => {
      const assets = await database.get('assets').query(Q.where('id', assetId)).fetch();
      const asset = (assets.length > 0 ? assets[0] : null) as TaggableAsset | null;

      // Re-run the gate INSIDE the transaction against the re-fetched row, not
      // the props the button was rendered from: the picker's list, the route
      // param and the effective role can all be a sync round — or a role flip —
      // out of date by the time a finger lands.
      const gate = tagGate(asset, viewer, lock);
      if (!gate.canTag || asset === null) {
        return { ok: false as const, error: gate.blockedReason ?? 'This asset cannot be tagged.' };
      }

      // Fetched by asset only; findOpenRepair applies the type/status rule in
      // plain JS so the predicate the harness exercises is the one that runs.
      const onAsset = (await database
        .get('work_orders')
        .query(Q.where('asset_id', assetId))
        .fetch()) as unknown as OpenRepairCandidate[];

      const existing = findOpenRepair(onAsset);
      if (existing !== null) {
        // Our own row from a double tap (or a retry after the screen re-rendered):
        // success, not a duplicate complaint about work we just did.
        if (existing.id === woId) return { ok: true as const, woId, created: false };
        return {
          ok: false as const,
          error: 'This asset already has an open repair work order.',
        };
      }

      const woFields = buildWoFields(asset, viewer);
      const historyFields = buildHistoryFields(asset, viewer, woId, Date.now());

      const woRecord = database.get('work_orders').prepareCreate((w: any) => {
        // Set before anything else: `id` has no setter, and the whole
        // idempotency argument rests on this row carrying the minted id.
        w._raw.id = woId;
        w.asset.id = woFields.assetId;
        w.woCode = woFields.woCode;
        w.tier = woFields.tier;
        w.woType = woFields.woType;
        w.status = woFields.status;
        w.createdBy = woFields.createdBy;
        w.site = woFields.site;
        w.location = woFields.location;
      });

      const historyRecord = database.get('asset_history').prepareCreate((h: any) => {
        h.asset.id = historyFields.assetId;
        h.historyCode = historyFields.historyCode;
        h.eventType = historyFields.eventType;
        h.workOrderId = historyFields.workOrderId;
        h.statusColor = historyFields.statusColor;
        h.actor = historyFields.actor;
        h.notes = historyFields.notes;
        h.eventAt = new Date(historyFields.eventAt);
      });

      await database.batch(woRecord, historyRecord);

      // No requestSync() here on purpose. Feature C's debounced write-batch
      // trigger has to pick this up by itself — that is precisely what the
      // offline half of this feature's done-when tests.
      return { ok: true as const, woId, created: true };
    });
  } catch (e) {
    console.warn('tagAssetForRepair failed:', e);
    return { ok: false, error: 'Could not tag this asset. Please try again.' };
  }
}
