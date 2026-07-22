// Feature L — the L2 staff writes: assign a work order, and review a report.
//
// Same contract as src/wo/mutations.ts (Feature H) and src/report/mutations.ts
// (Feature I), for the same reasons:
//
//   1. Every mutation re-fetches its rows and re-runs the phase-1 guards INSIDE
//      the write transaction. The queue/detail was rendered from props a sync
//      round can invalidate before a finger lands.
//   2. Every mutation is idempotent. A double tap is a no-op, never a second
//      stamp and never an error the user has to interpret.
//   3. Failures come back as values, not exceptions.
//   4. No requestSync() — Feature C's debounced write-batch trigger carries the
//      offline write, which is exactly what the offline half of the done-when
//      tests.
//
// What is deliberately SMALL here: approveReport writes three columns and stops.
// Closing the work order, spawning the rework REPAIR order, and sending a
// rejected report back are the gateway's job (reconcileApprovals_) — the app
// only records the decision and mirrors the consequence on the next pull.

import { Q } from '@nozbe/watermelondb';

import { database } from '../database/database';
import type { ReportRecord } from '../report/types';
import type { Viewer } from '../wo/actions';
import { WO_STATUS } from '../wo/status';
import type { WoRecord } from '../wo/types';
import { approvalGate, approvalStatusFor, type ApprovalDecision } from './approval';
import { assignGate, buildAssignFields, isEligibleStaff } from './assign';
import type { UserRecord } from './types';

export type MutationResult = { ok: true } | { ok: false; error: string };

const OK: MutationResult = { ok: true };
const fail = (error: string): MutationResult => ({ ok: false, error });

// query().fetch() rather than find() — a row removed by a sync must come back
// as "gone", not as a thrown record-not-found.
async function fetchOne(table: string, id: string): Promise<any | null> {
  const rows = await database.get(table).query(Q.where('id', id)).fetch();
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Assigns (or re-assigns) a work order to a maintenance staff member.
 *
 * Re-verifies BOTH axes inside the transaction: assignGate on the re-fetched
 * work order, and isEligibleStaff on the re-fetched user — the picker's list
 * can be a sync round out of date, and an assignment to someone who has since
 * been deactivated or moved out of area must be refused, not written.
 */
export async function assignWork(
  woId: string,
  staffId: string,
  viewer: Viewer,
): Promise<MutationResult> {
  try {
    return await database.write(async () => {
      const wo = await fetchOne('work_orders', woId);
      if (wo === null) return fail('This work order is no longer available.');

      // Idempotent: already assigned to this same staff (a second tap, or the
      // row arriving from another device mid-session) is success.
      if (wo.status === WO_STATUS.ASSIGNED && wo.assignedTo === staffId) return OK;

      const guard = assignGate(wo as WoRecord, viewer);
      if (!guard.canAssign) {
        return fail(guard.blockedReason ?? 'This work order cannot be assigned right now.');
      }

      const staff = (await fetchOne('users', staffId)) as UserRecord | null;
      if (staff === null) return fail('That staff member is no longer available.');
      if (!isEligibleStaff(staff, wo as WoRecord)) {
        return fail('That staff member cannot be assigned to this work order.');
      }

      const fields = buildAssignFields(staffId, viewer, Date.now());
      await wo.update((w: any) => {
        w.assignedTo = fields.assignedTo;
        w.assignedBy = fields.assignedBy;
        w.assignedAt = new Date(fields.assignedAt);
        w.status = fields.status;
      });
      return OK;
    });
  } catch (e) {
    console.warn('assignWork failed:', e);
    return fail('Could not assign this work order. Please try again.');
  }
}

/**
 * Records an approval decision on a submitted report.
 *
 * The app's ENTIRE write is approval_status + the reviewer stamps. The server's
 * reconcileApprovals_ reads what lands and does everything else:
 *   approve + green     → close the work order
 *   approve + non-green → close it and spawn the REPAIR rework order
 *   reject              → send the work order back to COMPLETED for revision
 * plus the asset_history event for each. Keeping the app this thin is what lets
 * frozen gap #11 stand (the app never authors an approval/rework history event)
 * and what makes the whole feature work offline: the decision queues and syncs,
 * the consequences arrive on the next pull.
 */
export async function approveReport(
  reportId: string,
  viewer: Viewer,
  decision: ApprovalDecision,
): Promise<MutationResult> {
  try {
    return await database.write(async () => {
      const report = await fetchOne('maintenance_reports', reportId);
      if (report === null) return fail('This report is no longer available.');

      const target = approvalStatusFor(decision);
      // Idempotent: already recorded this decision (a second tap, or the row
      // syncing back) is success, not a re-stamp.
      if (report.isDraft === false && report.approvalStatus === target) return OK;

      const wo = await fetchOne('work_orders', report.workOrder.id);
      if (wo === null) return fail('This work order is no longer available.');

      const guard = approvalGate(report as ReportRecord, wo as WoRecord, viewer);
      if (!guard.canReview) {
        return fail(guard.blockedReason ?? 'This report cannot be reviewed right now.');
      }

      await report.update((r: any) => {
        r.approvalStatus = target;
        r.approvedBy = viewer.userId;
        r.approvedAt = new Date();
      });
      // No work_orders write and no requestSync() — see the module header.
      return OK;
    });
  } catch (e) {
    console.warn('approveReport failed:', e);
    return fail('Could not record that decision. Please try again.');
  }
}
