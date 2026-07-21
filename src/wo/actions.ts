// Feature H — every rule governing who may act on a work order, and what a
// Start/Complete actually writes. Import-pure on purpose (no database, no
// react-native, no navigation) exactly like chips.ts: the dev harness compiles
// this module under plain Node and exhausts the state matrix before a device
// ever runs it.
//
// The mutation layer re-runs woActions() INSIDE its write transaction against
// a freshly-fetched row — the rendered props it was called with may be a
// sync round out of date by the time a finger lands.

import { WO_STATUS, type WoStatus } from './status';
import type { CrewRecord, WoRecord } from './types';

/** Who is looking — the EFFECTIVE role (an L2 acting as L1 is a 1 here). */
export type Viewer = {
  role: 1 | 2;
  userId: string;
};

export type WoActionState = {
  canStart: boolean;
  canComplete: boolean;
  canEditCrew: boolean;
  /**
   * Why no action is offered, in the user's words. Null when at least one of
   * the flags above is true — the buttons speak for themselves then.
   */
  blockedReason: string | null;
};

/**
 * Crew stays editable while the work is live and through COMPLETED, because a
 * lead who ends work and only then remembers a helper must still be able to
 * record them. It freezes at PENDING_APPROVAL: once the report is submitted
 * the record is under review and must stop moving underneath the approver.
 */
const CREW_EDITABLE_STATUSES: readonly WoStatus[] = [
  WO_STATUS.ASSIGNED,
  WO_STATUS.IN_PROGRESS,
  WO_STATUS.COMPLETED,
];

/**
 * Actionability is ASSIGNMENT, not the users.is_lead flag (decision locked in
 * H planning): "the lead's own active work order" reduces to assigned_to === me
 * in practice, and gating on is_lead would strand a real lead whose sheet row
 * has the flag unset, with no in-app remedy.
 *
 * Visibility is a separate axis handled by the screen's area/location lock —
 * an L1 may VIEW an in-scope work order assigned to someone else (the server
 * already mirrors it) but can never act on it.
 */
export function woActions(wo: WoRecord, viewer: Viewer): WoActionState {
  const blocked = (blockedReason: string): WoActionState => ({
    canStart: false,
    canComplete: false,
    canEditCrew: false,
    blockedReason,
  });

  if (viewer.role !== 1) {
    return blocked('Work orders are started and completed by the assigned maintenance staff.');
  }

  // An empty assigned_to must never match an empty viewer id.
  const mine = !!wo.assignedTo && !!viewer.userId && wo.assignedTo === viewer.userId;
  if (!mine) {
    return blocked(
      wo.status === WO_STATUS.UNASSIGNED
        ? 'This work order has not been assigned yet.'
        : 'This work order is assigned to someone else.',
    );
  }

  const canEditCrew = (CREW_EDITABLE_STATUSES as readonly string[]).includes(wo.status);
  const canStart = wo.status === WO_STATUS.ASSIGNED && wo.startedAt === null;
  const canComplete =
    wo.status === WO_STATUS.IN_PROGRESS && wo.startedAt !== null && wo.endedAt === null;

  if (canStart || canComplete || canEditCrew) {
    return { canStart, canComplete, canEditCrew, blockedReason: null };
  }

  // No action and no crew editing left — say which of the terminal states we
  // are in rather than showing an inert screen.
  switch (wo.status) {
    case WO_STATUS.PENDING_APPROVAL:
      return blocked('This work order is submitted and waiting for approval.');
    case WO_STATUS.CLOSED:
      return blocked('This work order is closed.');
    default:
      // Reachable only through sheet drift, e.g. status ASSIGNED with
      // started_at already stamped, or IN_PROGRESS with ended_at set. Refusing
      // is correct: the app must not paper over a contradictory row.
      return blocked('This work order is in an unexpected state and cannot be actioned here.');
  }
}

export type WoAction = 'start' | 'complete' | 'submitReport';

/**
 * The single home of every work-order transition the app performs. Each action
 * writes exactly one status (and, for start/complete, one timestamp); nothing
 * else in the app may spell these strings out.
 *
 * START:         ASSIGNED    → IN_PROGRESS      (+ started_at)
 * COMPLETE:      IN_PROGRESS → COMPLETED        (+ ended_at)
 * SUBMITREPORT:  COMPLETED   → PENDING_APPROVAL (Feature I)
 *
 * COMPLETED means "work ended, report not yet submitted" — submitting the
 * maintenance report is what carries a work order on to PENDING_APPROVAL, and
 * L2's approval (Feature L) is what closes it.
 */
export function nextStatusFor(action: WoAction): WoStatus {
  switch (action) {
    case 'start':
      return WO_STATUS.IN_PROGRESS;
    case 'complete':
      return WO_STATUS.COMPLETED;
    case 'submitReport':
      return WO_STATUS.PENDING_APPROVAL;
  }
}

// ---------- crew names ----------

/** Longest worker name accepted. Free text, but a sheet cell has to stay readable. */
export const MAX_CREW_NAME = 60;

/** Trim and collapse inner whitespace runs — "  Juan   Dela  Cruz " → "Juan Dela Cruz". */
export function normalizeCrewName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export type CrewNameResult = { ok: true; name: string } | { ok: false; error: string };

/**
 * Validates a typed crew name against the names already on this work order.
 * Dedupe is case-insensitive: "juan dela cruz" and "Juan Dela Cruz" are the
 * same worker, and two rows for one person would double-count the crew.
 */
export function validateCrewName(raw: string, existing: readonly string[]): CrewNameResult {
  const name = normalizeCrewName(raw);
  if (name.length === 0) return { ok: false, error: 'Enter a name.' };
  if (name.length > MAX_CREW_NAME) {
    return { ok: false, error: `Keep the name under ${MAX_CREW_NAME} characters.` };
  }
  const folded = name.toLowerCase();
  if (existing.some((e) => normalizeCrewName(e).toLowerCase() === folded)) {
    return { ok: false, error: 'That name is already on the crew.' };
  }
  return { ok: true, name };
}

/**
 * A crew row may be removed ONLY while it has never been pushed.
 *
 * This is not fussiness. The gateway ignores `deleted` arrays by design (no
 * hard deletes in that backend) and every pull is a FULL SNAPSHOT — so a crew
 * row that has already synced, deleted locally, would be silently resurrected
 * by the very next pull. Offering a delete button that a background sync
 * quietly undoes is worse than not offering one, so the UI hides removal the
 * moment WatermelonDB marks the row anything other than 'created'.
 */
export function canRemoveCrew(crew: CrewRecord): boolean {
  return crew._raw._status === 'created';
}
