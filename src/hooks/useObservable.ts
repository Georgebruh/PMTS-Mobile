import { useEffect, useState } from 'react';

import type { Subscribable } from '../wo/types';

/**
 * Subscribe to a WatermelonDB observable (query.observe / observeCount /
 * relation.observe) for the lifetime of `deps`. Returns undefined until the
 * first emission and resets to undefined whenever deps change, so a stale
 * value never renders under a new scope (user switch, Act-as-L1 flip, day
 * rollover).
 */
export function useObservable<T>(
  create: () => Subscribable<T>,
  deps: readonly unknown[],
): T | undefined {
  // Boxed so T itself may include undefined without ambiguity.
  const [box, setBox] = useState<{ value: T } | undefined>(undefined);

  useEffect(() => {
    setBox(undefined);
    const subscription = create().subscribe({
      next: (value) => setBox({ value }),
      error: (err) => console.warn('[useObservable] stream error:', err),
    });
    return () => subscription.unsubscribe();
    // `create` is intentionally not a dep — callers pass inline closures; the
    // deps array is the subscription's identity.
  }, deps);

  return box?.value;
}
