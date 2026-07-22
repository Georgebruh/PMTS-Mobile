import { Q } from '@nozbe/watermelondb';

import type { DayBounds } from './dates';
import type { DateRange } from './ranges';
import {
  DONE_TODAY_STATUSES,
  L2_ASSIGNED_STATUSES,
  OVERDUE_STATUSES,
  WO_STATUS,
} from './status';
import type { ReportRecord, WoRecord } from './types';

// The filter a dashboard card hands to the Work Order List (Feature F). Plain
// serializable object — it travels as a navigation param.
export type WoListFilterKind =
  | 'today'
  | 'overdue'
  | 'open'
  | 'unassigned'
  | 'assigned'
  | 'completed'
  | 'pendingApproval'
  | 'myDrafts';

export type WoListFilter = {
  kind: WoListFilterKind;
  /** L1 scope: only WOs assigned to this user id. */
  assignedTo?: string;
  /** myDrafts only: drafts written by this reporter. */
  reporterId?: string;
};

// Shared by the dashboard card labels and the list screen title, so a card
// always lands on a screen named like the card that was tapped.
export const FILTER_TITLES: Record<WoListFilterKind, string> = {
  today: 'Due Today',
  overdue: 'Overdue',
  open: 'All Open',
  unassigned: 'Unassigned',
  assigned: 'Assigned',
  completed: 'Completed',
  pendingApproval: 'For Approval',
  myDrafts: 'Unfinished Reports',
};

// Q-clauses for a work_orders query implementing `filter`. A dashboard card's
// count and the list it opens read the SAME clauses, so they cannot drift.
export function woClauses(filter: WoListFilter, bounds: DayBounds): Q.Clause[] {
  const clauses: Q.Clause[] = [];
  if (filter.assignedTo !== undefined) {
    clauses.push(Q.where('assigned_to', filter.assignedTo));
  }
  switch (filter.kind) {
    case 'today':
      clauses.push(
        Q.where('due_date', Q.gte(bounds.start)),
        Q.where('due_date', Q.lt(bounds.end)),
        Q.where('status', Q.notEq(WO_STATUS.CLOSED)),
      );
      break;
    case 'overdue':
      // A NULL due_date never satisfies a SQL comparison anyway; the notEq
      // spells the intent out.
      clauses.push(
        Q.where('due_date', Q.notEq(null)),
        Q.where('due_date', Q.lt(bounds.start)),
        Q.where('status', Q.oneOf([...OVERDUE_STATUSES])),
      );
      break;
    case 'open':
      clauses.push(Q.where('status', Q.notEq(WO_STATUS.CLOSED)));
      break;
    case 'unassigned':
      clauses.push(Q.where('status', WO_STATUS.UNASSIGNED));
      break;
    case 'assigned':
      clauses.push(Q.where('status', Q.oneOf([...L2_ASSIGNED_STATUSES])));
      break;
    case 'completed':
      clauses.push(Q.where('status', WO_STATUS.COMPLETED));
      break;
    case 'pendingApproval':
      clauses.push(Q.where('status', WO_STATUS.PENDING_APPROVAL));
      break;
    case 'myDrafts':
      // WOs having a draft by me. NB: the dashboard card counts draft REPORTS
      // (draftReportClauses); this lists WOs WITH such drafts — the two differ
      // when one WO carries two drafts. Accepted.
      clauses.push(
        Q.on(
          'maintenance_reports',
          Q.and(
            Q.where('is_draft', true),
            Q.where('reporter_user_id', filter.reporterId ?? ''),
          ),
        ),
      );
      break;
  }
  return clauses;
}

/** The L1 "Unfinished Reports" count: my local drafts. */
export function draftReportClauses(reporterId: string): Q.Clause[] {
  return [Q.where('is_draft', true), Q.where('reporter_user_id', reporterId)];
}

// L1 progress bar: work done today ÷ everything due today. No status clause on
// the denominator — CLOSED counts on both sides (frozen decision).
export function progressClauses(
  me: string,
  bounds: DayBounds,
): { denom: Q.Clause[]; numer: Q.Clause[] } {
  const denom: Q.Clause[] = [
    Q.where('assigned_to', me),
    Q.where('due_date', Q.gte(bounds.start)),
    Q.where('due_date', Q.lt(bounds.end)),
  ];
  return {
    denom,
    numer: [...denom, Q.where('status', Q.oneOf([...DONE_TODAY_STATUSES]))],
  };
}

// Feature K — the L2 Calendar's rows: work orders whose due_date falls inside
// a calendar range [start, end). There is deliberately NO status clause: the
// calendar is a pure date-range view (all statuses, CLOSED included — decision
// locked with the user 2026-07-22), so the done-when's "exactly the WOs whose
// due_date falls in range" is literally these three clauses and nothing else.
//
// The plain-JS counterpart is matchesRangeJs in ./ranges — the dev probe
// recounts one against the other so a Q-clause bug cannot hide behind itself.
export function rangeClauses(range: DateRange): Q.Clause[] {
  return [
    // A NULL due_date never satisfies a SQL comparison anyway; the notEq spells
    // the intent out — an unscheduled work order is not on the calendar.
    Q.where('due_date', Q.notEq(null)),
    Q.where('due_date', Q.gte(range.start)),
    Q.where('due_date', Q.lt(range.end)),
  ];
}

// The frozen list-wide order (preview AND every Feature F filter): tier
// 1 → 2 → 3, then due date (nulls last), then code for a stable tie-break.
// Sorted in JS because SQLite ORDER BY puts NULLs first and the frozen rule
// wants them last.
export function woCompare(a: WoRecord, b: WoRecord): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  const aDue = a.dueDate ? a.dueDate.getTime() : Infinity;
  const bDue = b.dueDate ? b.dueDate.getTime() : Infinity;
  if (aDue !== bDue) return aDue - bDue;
  return a.woCode.localeCompare(b.woCode);
}

// Deliberately naive plain-JS re-implementation of every work-order filter.
// The dev harness recounts with this against a full-table fetch, so a bug in
// the Q-clauses above cannot hide behind itself.
export function matchesFilterJs(
  wo: WoRecord,
  filter: WoListFilter,
  bounds: DayBounds,
): boolean {
  if (filter.assignedTo !== undefined && wo.assignedTo !== filter.assignedTo) {
    return false;
  }
  const due = wo.dueDate ? wo.dueDate.getTime() : null;
  switch (filter.kind) {
    case 'today':
      return (
        due !== null &&
        due >= bounds.start &&
        due < bounds.end &&
        wo.status !== WO_STATUS.CLOSED
      );
    case 'overdue':
      return (
        due !== null &&
        due < bounds.start &&
        (OVERDUE_STATUSES as readonly string[]).includes(wo.status)
      );
    case 'open':
      return wo.status !== WO_STATUS.CLOSED;
    case 'unassigned':
      return wo.status === WO_STATUS.UNASSIGNED;
    case 'assigned':
      return (L2_ASSIGNED_STATUSES as readonly string[]).includes(wo.status);
    case 'completed':
      return wo.status === WO_STATUS.COMPLETED;
    case 'pendingApproval':
      return wo.status === WO_STATUS.PENDING_APPROVAL;
    case 'myDrafts':
      // Needs the reports table — the harness recounts drafts with
      // matchesDraftJs instead of through this matcher.
      return false;
  }
}

/** matchesFilterJs' counterpart for the draft-reports count. */
export function matchesDraftJs(report: ReportRecord, reporterId: string): boolean {
  return report.isDraft === true && report.reporterUserId === reporterId;
}
