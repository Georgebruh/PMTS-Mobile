// Feature M — the wire vocabulary shared by the gateway (which mints a
// notification) and the app (which receives, routes, and lists it). Import-pure
// on purpose (no react-native, no navigation, no database), exactly like
// src/wo/actions.ts: the dev harness compiles this under plain Node.
//
// The gateway sends one Expo push per recipient with `data` shaped as NotifData
// below; the app reads it back off `response.notification.request.content.data`.

/** The three server events that produce a push (frozen for Feature M). */
export type NotifKind = 'wo_assigned' | 'report_pending' | 'wo_unassigned';

export const NOTIF_KINDS: readonly NotifKind[] = [
  'wo_assigned',
  'report_pending',
  'wo_unassigned',
];

/**
 * The `data` payload carried inside every push. `uid` is the id of the user
 * this copy was minted for — the gateway fans an event out to each recipient
 * and stamps that recipient's id here, so a tap can be refused when a DIFFERENT
 * account is signed in on the phone (the shared-device guard).
 *
 * Exactly one of `woId` / `reportId` is present, per `kind`:
 *   wo_assigned    → woId       (the assignee's work order)
 *   wo_unassigned  → woId       (the new unassigned work order)
 *   report_pending → reportId   (the report to review)
 */
export type NotifData = {
  kind: NotifKind;
  uid: string;
  woId?: string;
  reportId?: string;
};

/**
 * A serializable navigation instruction — the pure router's output, kept as
 * data (not a navigate() call) so it is trivially testable and the routing hook
 * owns the one place that touches the navigation ref.
 *
 * Each shape maps 1:1 onto a nested navigate into a tab's stack:
 *   navigate('Tabs', { screen: tab, params: { screen, params } })
 *
 * The screen/param names are the real ones from navigation/types.ts, so a
 * rename there breaks this at compile time rather than at a finger tap.
 */
export type NavTarget =
  | { tab: 'HomeTab'; screen: 'WorkOrderDetail'; params: { woId: string } }
  | { tab: 'StaffTab'; screen: 'ApprovalDetail'; params: { reportId: string } }
  | { tab: 'StaffTab'; screen: 'AssignWorkOrder'; params: { woId: string } };

/**
 * The live session snapshot the router guards against. `uid`/`role` are null
 * while signed out. `role` is the EFFECTIVE role (an L2 acting as L1 is a 1
 * here) — it decides whether a Staff-bound tap even has a tab to land on.
 */
export type RouteSession = {
  uid: string | null;
  role: 1 | 2 | null;
};
