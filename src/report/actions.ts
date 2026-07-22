// Feature I — who may file a maintenance report, and when.
//
// Same shape and the same reasoning as src/wo/actions.ts (Feature H): a pure
// guard the mutation layer re-runs INSIDE its write transaction against a
// freshly-fetched row. The screen's props can be a sync round out of date by
// the time a finger lands, and a report is not something to file twice.
//
// Import-pure: no database, no react-native, no navigation.

import { WO_STATUS } from '../wo/status';
import type { Viewer } from '../wo/actions';
import type { WoRecord } from '../wo/types';
import type { ReportRecord } from './types';
import { canSubmit, type ReportDraftView } from './validation';

export type ReportGate = {
  /** May this viewer open/continue the report form on this work order? */
  canFile: boolean;
  /** Why not, in the user's words. Null when canFile is true. */
  blockedReason: string | null;
};

/**
 * Reporting is gated on the same axis Feature H settled for Start/Complete:
 * EFFECTIVE role 1, and the work order is MINE. Not `users.is_lead` — a real
 * lead whose sheet row has the flag unset would otherwise be locked out of
 * their own job with no in-app remedy.
 *
 * The status gate is exactly COMPLETED. Earlier means the work has not ended
 * and there is nothing to report yet; later means a report has already been
 * submitted and the record is under review — reopening it would let the form
 * move underneath the approver.
 *
 * Visibility is a separate axis, handled by the screen's area/location lock.
 */
export function reportGate(wo: WoRecord, viewer: Viewer): ReportGate {
  const blocked = (blockedReason: string): ReportGate => ({ canFile: false, blockedReason });

  if (viewer.role !== 1) {
    return blocked('Maintenance reports are filed by the assigned maintenance staff.');
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

  switch (wo.status) {
    case WO_STATUS.COMPLETED:
      return { canFile: true, blockedReason: null };
    case WO_STATUS.UNASSIGNED:
    case WO_STATUS.ASSIGNED:
      return blocked('Start and complete the work before filing a report.');
    case WO_STATUS.IN_PROGRESS:
      return blocked('Complete the work before filing a report.');
    case WO_STATUS.PENDING_APPROVAL:
      return blocked('This report has been submitted and is waiting for approval.');
    case WO_STATUS.CLOSED:
      return blocked('This work order is closed.');
    default:
      // Reachable only through sheet drift. Refusing is correct — the app must
      // not paper over a contradictory row.
      return blocked('This work order is in an unexpected state and cannot be reported on here.');
  }
}

/**
 * A report is editable only while it is a draft. Submitting is one-way from
 * the app's side: the server owns everything that happens next (approval, and
 * the rework work order a non-green outcome spawns).
 */
export function isReportEditable(report: ReportRecord): boolean {
  return report.isDraft === true;
}

/**
 * The full Submit precondition: the work order still accepts a report, this
 * report is still a draft, and the form itself validates.
 *
 * Kept as one function so the button's enabled state and the mutation's guard
 * cannot drift apart — they call this, not their own combination of the three.
 */
export function canSubmitReport(
  wo: WoRecord,
  report: ReportRecord,
  viewer: Viewer,
  view: ReportDraftView,
): boolean {
  return reportGate(wo, viewer).canFile && isReportEditable(report) && canSubmit(view);
}

/**
 * The three approval states, centralized here alongside APPROVAL_PENDING so
 * Feature L's staff domain and this module cannot spell them differently.
 *
 * PENDING is stamped on submit (above). L2's review (Feature L) moves it to
 * APPROVED or REJECTED — the app only stamps the report; the gateway's
 * reconcileApprovals_ owns every consequence (close, rework spawn, send-back).
 */
export const APPROVAL_PENDING = 'PENDING';
export const APPROVAL_APPROVED = 'APPROVED';
export const APPROVAL_REJECTED = 'REJECTED';
