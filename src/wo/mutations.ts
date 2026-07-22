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

import { database } from '../database/database';
import { canRemoveCrew, nextStatusFor, woActions, validateCrewName, type Viewer } from './actions';
import { WO_STATUS } from './status';
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
