// Feature L — who may assign a work order, to whom, and what an assignment
// writes. Import-pure like src/wo/actions.ts and src/wo/tag.ts: the Node
// harness compiles it standalone and exhausts the state matrix before a device
// runs it. The mutation layer re-runs assignGate INSIDE its write transaction
// against a freshly-fetched row — the queue the button was rendered from can be
// a sync round out of date by the time a finger lands.

import type { Viewer } from '../wo/actions';
import { WO_STATUS, type WoStatus } from '../wo/status';
import type { WoRecord } from '../wo/types';
import type { UserRecord } from './types';

export type AssignGate = {
  canAssign: boolean;
  /** Why not, in the user's words. Null when canAssign is true. */
  blockedReason: string | null;
};

/**
 * Assignment is an L2 action, and it is allowed while the work has not yet
 * started:
 *   UNASSIGNED → ASSIGNED   (the initial hand-off)
 *   ASSIGNED   → ASSIGNED   (re-assignment to a different staff member —
 *                            decision locked in planning — but only while
 *                            started_at is null; a job someone has already
 *                            begun must not be yanked out from under them)
 *
 * Anything IN_PROGRESS or later is refused: the work is under way or done, and
 * assignment is no longer the operation that applies.
 *
 * Effective role is the axis that gates this — the Staff tab only mounts for an
 * effective L2, and an L2 acting as L1 is a 1 here and correctly refused.
 */
export function assignGate(wo: WoRecord, viewer: Viewer): AssignGate {
  const blocked = (blockedReason: string): AssignGate => ({ canAssign: false, blockedReason });

  if (viewer.role !== 2) {
    return blocked('Only the asset manager can assign work orders.');
  }

  switch (wo.status) {
    case WO_STATUS.UNASSIGNED:
      return { canAssign: true, blockedReason: null };
    case WO_STATUS.ASSIGNED:
      // started_at set on an ASSIGNED row is sheet drift (Start moves it to
      // IN_PROGRESS); refusing is correct — reassigning a started job is the
      // exact thing this guard exists to prevent.
      return wo.startedAt === null
        ? { canAssign: true, blockedReason: null }
        : blocked('Work has already started on this order and it cannot be reassigned.');
    case WO_STATUS.IN_PROGRESS:
      return blocked('This work order is already being worked on.');
    case WO_STATUS.COMPLETED:
      return blocked('The work is finished — this order no longer needs assigning.');
    case WO_STATUS.PENDING_APPROVAL:
      return blocked('This work order is submitted and waiting for approval.');
    case WO_STATUS.CLOSED:
      return blocked('This work order is closed.');
    default:
      return blocked('This work order is in an unexpected state and cannot be assigned here.');
  }
}

/**
 * Case-insensitive area membership over a ';'-delimited assigned_area cell,
 * matching the gateway's pull scoping (Sync.js splitList_/norm_) so the staff
 * the picker offers are exactly the staff the server would let see the work
 * order. "MEZ2; CBU" contains site "cbu".
 */
export function areaMatches(assignedArea: string | null | undefined, site: string): boolean {
  const target = String(site ?? '').trim().toLowerCase();
  if (target === '') return false;
  return String(assignedArea ?? '')
    .split(';')
    .map((s) => s.trim().toLowerCase())
    .some((a) => a.length > 0 && a === target);
}

/**
 * A user may take a work order when they are active maintenance staff
 * (role_level 1) whose area covers the work order's site. Location is NOT
 * narrowed here: the work order carries one site, and staff area is site-level;
 * the server's L1 pull will apply the finer location lock on the staff's own
 * device.
 */
export function isEligibleStaff(user: UserRecord, wo: { site: string }): boolean {
  return user.active === true && user.roleLevel === 1 && areaMatches(user.assignedArea, wo.site);
}

/** The eligible-staff pool for a work order, unsorted (the hook sorts by name). */
export function eligibleStaff(
  users: readonly UserRecord[],
  wo: { site: string },
): UserRecord[] {
  return users.filter((u) => isEligibleStaff(u, wo));
}

export type AssignFields = {
  assignedTo: string;
  assignedBy: string;
  /** unix ms — the mutation wraps it in a Date for the @date column. */
  assignedAt: number;
  status: WoStatus;
};

/**
 * The columns an assignment writes. The `→ ASSIGNED` transition lives here,
 * co-located with its guard, exactly as tag.ts owns its own `→ UNASSIGNED`
 * transition — nothing else in the app spells this one.
 */
export function buildAssignFields(staffId: string, viewer: Viewer, nowMs: number): AssignFields {
  return {
    assignedTo: staffId,
    assignedBy: viewer.userId,
    assignedAt: nowMs,
    status: WO_STATUS.ASSIGNED,
  };
}
