import type { StatusVariant } from '../components/StatusTile';
import type { TagVariant } from '../theme';

// The frozen six-state work-order machine (implementation plan gap #7). These
// exact strings live in the sheet, the gateway, and every dashboard count —
// never re-spell them at a call site.
export const WO_STATUS = {
  UNASSIGNED: 'UNASSIGNED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  CLOSED: 'CLOSED',
} as const;

export type WoStatus = (typeof WO_STATUS)[keyof typeof WO_STATUS];

// "Overdue" means the work itself is not done — COMPLETED onward is paperwork
// (report/approval), not overdue field work.
export const OVERDUE_STATUSES: readonly WoStatus[] = [
  WO_STATUS.UNASSIGNED,
  WO_STATUS.ASSIGNED,
  WO_STATUS.IN_PROGRESS,
];

// The L1 progress bar's "done" side: work has physically ended today.
export const DONE_TODAY_STATUSES: readonly WoStatus[] = [
  WO_STATUS.COMPLETED,
  WO_STATUS.PENDING_APPROVAL,
  WO_STATUS.CLOSED,
];

// L2's "Assigned" card = handed to staff, work not finished, so no WO is
// invisible between the Unassigned and Completed cards. Drop IN_PROGRESS here
// if that decision ever changes — the card, its list filter, and the dev
// harness all follow this one constant.
export const L2_ASSIGNED_STATUSES: readonly WoStatus[] = [
  WO_STATUS.ASSIGNED,
  WO_STATUS.IN_PROGRESS,
];

export const WO_TYPE_LABELS: Record<string, string> = {
  PMS: 'PMS',
  REPAIR: 'Repair',
  REWORK: 'Rework',
};

type StatusMeta = {
  label: string;
  pill: TagVariant;
  tile: StatusVariant;
};

// Visual-only mapping of the six statuses onto the mockup's three tile/pill
// variants; editing this never changes a count.
export const STATUS_META: Record<WoStatus, StatusMeta> = {
  UNASSIGNED: { label: 'Unassigned', pill: 'repair', tile: 'pending' },
  ASSIGNED: { label: 'Assigned', pill: 'pending', tile: 'pending' },
  IN_PROGRESS: { label: 'In Progress', pill: 'pending', tile: 'repair' },
  COMPLETED: { label: 'Completed', pill: 'done', tile: 'done' },
  PENDING_APPROVAL: { label: 'For Approval', pill: 'pending', tile: 'done' },
  CLOSED: { label: 'Closed', pill: 'done', tile: 'done' },
};

// Rows synced from a hand-edited sheet can carry anything — render them
// legibly instead of crashing on an unknown key.
export function statusMeta(status: string): StatusMeta {
  return (
    STATUS_META[status as WoStatus] ?? {
      label: status || 'Unknown',
      pill: 'pending',
      tile: 'pending',
    }
  );
}
