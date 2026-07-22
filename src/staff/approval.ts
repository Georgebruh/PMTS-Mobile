// Feature L — who may review a submitted report, and what the app writes when
// they do. Import-pure like ./assign.
//
// The crucial scope fact: the app writes almost nothing. An approval is three
// columns on the report (approval_status + reviewer stamps) and a push. Closing
// the work order, spawning the rework REPAIR order, and sending a rejected
// report back all belong to the gateway's reconcileApprovals_ (decision locked
// in planning: the spec says the server owns the loop, and this keeps
// asset_history server-authored so frozen gap #11 stays intact). The functions
// below therefore split cleanly: approvalGate/approvalStatusFor drive the WRITE;
// approvalOutcome only DESCRIBES, for UI copy, what the server will then do.

import { APPROVAL_APPROVED, APPROVAL_PENDING, APPROVAL_REJECTED } from '../report/actions';
import type { ReportRecord } from '../report/types';
import type { Viewer } from '../wo/actions';
import { WO_STATUS } from '../wo/status';
import type { WoRecord } from '../wo/types';

export const APPROVAL_STATUS = {
  PENDING: APPROVAL_PENDING,
  APPROVED: APPROVAL_APPROVED,
  REJECTED: APPROVAL_REJECTED,
} as const;

export type ApprovalDecision = 'approve' | 'reject';

export type ApprovalGate = {
  canReview: boolean;
  /** Why not, in the user's words. Null when canReview is true. */
  blockedReason: string | null;
};

/**
 * Reviewing is an effective-L2 action on a report that has actually been
 * submitted and is still waiting: not a draft, approval_status PENDING, and the
 * work order sitting in PENDING_APPROVAL. The three checks are ordered so the
 * message names the real reason — a draft says "not submitted", an
 * already-reviewed report says "already reviewed", a contradictory work-order
 * status says "unexpected".
 */
export function approvalGate(report: ReportRecord, wo: WoRecord, viewer: Viewer): ApprovalGate {
  const blocked = (blockedReason: string): ApprovalGate => ({ canReview: false, blockedReason });

  if (viewer.role !== 2) {
    return blocked('Only the asset manager reviews reports.');
  }
  if (report.isDraft !== false) {
    return blocked('This report has not been submitted yet.');
  }
  if (report.approvalStatus !== APPROVAL_STATUS.PENDING) {
    return blocked('This report has already been reviewed.');
  }
  if (wo.status !== WO_STATUS.PENDING_APPROVAL) {
    return blocked('This work order is not waiting for approval.');
  }
  return { canReview: true, blockedReason: null };
}

/** Green closes the loop; any other colour means the equipment still needs
 *  work. Tolerant of case and stray whitespace from a hand-edited cell. */
export function isGreen(statusColor: string | null | undefined): boolean {
  return String(statusColor ?? '').trim().toLowerCase() === 'green';
}

/** What the SERVER will do once this decision syncs — used for the confirm copy
 *  so the reviewer knows the consequence before they tap, and asserted by the
 *  harness. The app itself performs none of these. */
export type ApprovalOutcome = 'close' | 'rework' | 'sendBack';

export function approvalOutcome(
  decision: ApprovalDecision,
  statusColor: string | null | undefined,
): ApprovalOutcome {
  if (decision === 'reject') return 'sendBack';
  return isGreen(statusColor) ? 'close' : 'rework';
}

/** The approval_status value stamped for a decision. */
export function approvalStatusFor(decision: ApprovalDecision): string {
  return decision === 'approve' ? APPROVAL_STATUS.APPROVED : APPROVAL_STATUS.REJECTED;
}
