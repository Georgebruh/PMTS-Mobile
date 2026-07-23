// Feature M — turning an OS notification payload into a navigation target, and
// nothing else. Import-pure like types.ts: the harness exhausts every
// kind × role × uid-match combination under plain Node before a device runs it.
//
// Two responsibilities, kept apart on purpose:
//   parseNotifData        — the payload off the OS is `unknown`; validate it.
//   routeFromNotification — a VALID payload + the live session → where to go.
//
// What this module deliberately does NOT do: check that the target row still
// exists in the local mirror. That needs the database, which would break
// import-purity — so the routing hook does the "id no longer resolves → fall
// back to the tab root" step after this returns a target.

import { NOTIF_KINDS, type NavTarget, type NotifData, type NotifKind, type RouteSession } from './types';

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isKind(v: unknown): v is NotifKind {
  return typeof v === 'string' && (NOTIF_KINDS as readonly string[]).includes(v);
}

/**
 * Validates the untyped `data` bag from `content.data`. Returns a well-formed
 * NotifData or null — null means "not one of ours / malformed", and the caller
 * simply ignores it (a stray or future-version payload never crashes routing).
 *
 * The id required depends on kind: wo_assigned/wo_unassigned need `woId`,
 * report_pending needs `reportId`. `uid` is always required — a payload with no
 * target user can never pass the shared-device guard, so it is dead on arrival.
 */
export function parseNotifData(raw: unknown): NotifData | null {
  if (!raw || typeof raw !== 'object') return null;
  const bag = raw as Record<string, unknown>;

  const kind = bag.kind;
  if (!isKind(kind)) return null;

  const uid = asString(bag.uid);
  if (!uid) return null;

  if (kind === 'report_pending') {
    const reportId = asString(bag.reportId);
    if (!reportId) return null;
    return { kind, uid, reportId };
  }

  // wo_assigned | wo_unassigned
  const woId = asString(bag.woId);
  if (!woId) return null;
  return { kind, uid, woId };
}

/**
 * Where a tapped notification should land, or null. Null is a real answer, not
 * a failure: the routing hook responds by just bringing the app to the
 * foreground and leaving the item in the in-app bell. Null happens when —
 *
 *  - signed out (no session to navigate within), or
 *  - the payload was minted for a DIFFERENT user than the one now signed in
 *    (shared phone: user B must never be deep-linked into user A's work), or
 *  - the target lives in the Staff tab but the viewer's EFFECTIVE role is 1
 *    (an L2 acting as L1 has no Staff tab mounted to navigate into).
 */
export function routeFromNotification(
  data: NotifData,
  session: RouteSession,
): NavTarget | null {
  if (session.uid === null || session.role === null) return null;
  // The shared-device guard: this copy was addressed to a specific user id.
  if (data.uid !== session.uid) return null;

  switch (data.kind) {
    case 'wo_assigned':
      if (!data.woId) return null;
      // Home is mounted for both roles, so no role gate — the assignee may be
      // an L2 acting as L1 viewing their own assigned work.
      return { tab: 'HomeTab', screen: 'WorkOrderDetail', params: { woId: data.woId } };

    case 'report_pending':
      if (session.role !== 2) return null; // no Staff tab under effective L1
      if (!data.reportId) return null;
      return { tab: 'StaffTab', screen: 'ApprovalDetail', params: { reportId: data.reportId } };

    case 'wo_unassigned':
      if (session.role !== 2) return null;
      if (!data.woId) return null;
      return { tab: 'StaffTab', screen: 'AssignWorkOrder', params: { woId: data.woId } };

    default:
      return null;
  }
}
