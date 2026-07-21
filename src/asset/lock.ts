import { Q } from '@nozbe/watermelondb';

// The client-side area/location lock. This is NOT redundant with Feature C's
// server scoping: when an L2 acts as L1 (the downgrade toggle), the local
// mirror still holds the L2's WHOLE area (area-locked, not location-locked) —
// broader than an L1 may see. So the Asset List/Detail re-apply the L1 lock in
// the client, keyed off the EFFECTIVE role, never trusting the mirror alone.

/** Effective role the lock is applied for. Declared locally so src/asset stays
 *  free of app-layer imports and the Node verification harness can compile it. */
export type LockRole = 1 | 2;

export type AreaLock = {
  /** parsed assigned_area — the sites this user may see. */
  areas: string[];
  /** parsed assigned_locations — L1's extra narrowing (empty = area-only). */
  locations: string[];
};

/** Split a ';'-delimited sheet cell ("MEZ2;CBU") into trimmed, non-empty parts. */
export function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function areaLockFor(user: {
  assigned_area: string;
  assigned_locations: string;
}): AreaLock {
  return {
    areas: parseList(user.assigned_area),
    locations: parseList(user.assigned_locations),
  };
}

/**
 * Q-clauses locking an assets query to what `role` may see:
 * - both roles: site ∈ areas (skipped only when areas is empty — a malformed
 *   user row; the server has already scoped the mirror, so this fails open
 *   rather than hiding everything).
 * - L1 only: location ∈ locations, skipped when the list is empty ⇒ area-only
 *   (the frozen rule). L2 is area-locked, never location-locked.
 */
export function assetLockClauses(role: LockRole, lock: AreaLock): Q.Clause[] {
  const clauses: Q.Clause[] = [];
  if (lock.areas.length > 0) {
    clauses.push(Q.where('site', Q.oneOf(lock.areas)));
  }
  if (role === 1 && lock.locations.length > 0) {
    clauses.push(Q.where('location', Q.oneOf(lock.locations)));
  }
  return clauses;
}

/** Independent plain-JS recount of the lock — the dev harness checks it against
 *  assetLockClauses over a full-table fetch, so a Q-clause bug can't hide. */
export function matchesLockJs(
  asset: { site: string; location: string },
  role: LockRole,
  lock: AreaLock,
): boolean {
  if (lock.areas.length > 0 && !lock.areas.includes(asset.site)) return false;
  if (role === 1 && lock.locations.length > 0 && !lock.locations.includes(asset.location)) {
    return false;
  }
  return true;
}
