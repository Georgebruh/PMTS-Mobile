import { FILTER_TITLES, type WoListFilter, type WoListFilterKind } from './queries';

// Mirrors auth/session's EffectiveRole. Declared locally so src/wo stays free
// of app-layer imports and the Node verification harness can compile it.
export type WoRole = 1 | 2;

export type WoChipSpec = {
  kind: WoListFilterKind;
  label: string;
  filter: WoListFilter;
};

// Chip order per effective role (locked 2026-07-19). L1 is the personal view:
// every chip is scoped to the signed-in user, exactly like the L1 dashboard
// cards. L2 chips are unscoped; Overdue is offered even though L2 has no
// Overdue card. Active-chip matching is by kind — scope is implied by role.
const L1_CHIP_KINDS: readonly WoListFilterKind[] = ['open', 'today', 'overdue', 'myDrafts'];
const L2_CHIP_KINDS: readonly WoListFilterKind[] = [
  'open',
  'today',
  'overdue',
  'unassigned',
  'assigned',
  'completed',
  'pendingApproval',
];

/**
 * The filter a chip applies — IDENTICAL to what the matching dashboard card
 * passes (DashboardL1/L2), so a chip and a card for the same kind always
 * produce the same rows and count.
 */
export function filterForChip(
  kind: WoListFilterKind,
  role: WoRole,
  userId: string,
): WoListFilter {
  if (role === 2) return { kind };
  return kind === 'myDrafts'
    ? { kind, reporterId: userId }
    : { kind, assignedTo: userId };
}

/** The ordered chip row for an effective role. */
export function chipsForRole(role: WoRole, userId: string): WoChipSpec[] {
  const kinds = role === 1 ? L1_CHIP_KINDS : L2_CHIP_KINDS;
  return kinds.map((kind) => ({
    kind,
    label: FILTER_TITLES[kind],
    filter: filterForChip(kind, role, userId),
  }));
}
