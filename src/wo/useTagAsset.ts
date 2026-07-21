import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useAreaLock } from '../asset/hooks';
import type { AssetRecord } from '../asset/types';
import { useRole, useSession } from '../auth/session';
import { tagAssetForRepair, newWorkOrderId } from './mutations';
import type { Tagger } from './tag';

/**
 * Feature J's tag action, shared by both entry points — the FAB's picker and
 * the Asset Detail button.
 *
 * It lives in a hook rather than in either screen because "tag this asset" has
 * to mean exactly the same thing from both, down to the wording of the confirm.
 * Two screens each assembling their own viewer, lock, confirm and error
 * handling is how the two paths drift apart.
 *
 * Three things it owns:
 *
 *   1. The minted work-order id, kept per asset in a ref. A second tap reuses
 *      the same id, so the mutation re-finds the row the first tap created and
 *      returns success instead of a duplicate complaint. Idempotency by
 *      construction rather than by carefully not tapping twice.
 *   2. Single-flight, set synchronously before the first await — `busy` state
 *      alone re-renders too late to stop a fast double tap.
 *   3. The confirm. Tagging creates a real work order in someone else's queue,
 *      so it is never a bare one-tap action.
 */
export function useTagAsset() {
  const role = useRole();
  const userId = useSession((s) => s.user?.id ?? '');
  const fullName = useSession((s) => s.user?.full_name ?? '');
  const lock = useAreaLock();

  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // assetId -> the work order id minted for it. Survives re-renders, so a
  // retry after a failure reuses the id rather than risking a second row.
  const mintedIds = useRef<Map<string, string>>(new Map());

  const tag = useCallback(
    async (asset: AssetRecord): Promise<boolean> => {
      if (inFlight.current) return false;
      if (role === null) return false;

      const confirmed = await confirmTag(asset.equipmentName || 'this asset');
      if (!confirmed) return false;

      // Re-checked after the await: the confirm dialog is a window in which a
      // second tap could have started its own run.
      if (inFlight.current) return false;
      inFlight.current = true;
      setBusy(true);

      try {
        let woId = mintedIds.current.get(asset.id);
        if (woId === undefined) {
          woId = newWorkOrderId();
          mintedIds.current.set(asset.id, woId);
        }

        const viewer: Tagger = { role, userId, fullName };
        const result = await tagAssetForRepair(asset.id, woId, viewer, lock);

        if (!result.ok) {
          // The minted id is deliberately KEPT on failure: if the write partly
          // happened, or the user retries, the same id must be reused.
          Alert.alert('Could not tag asset', result.error);
          return false;
        }

        Alert.alert(
          'Tagged for repair',
          result.created
            ? 'An unassigned repair work order has been created. It reaches the asset manager on the next sync.'
            : 'This asset is already tagged — the repair work order was created.',
        );
        return true;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [role, userId, fullName, lock],
  );

  return { tag, busy };
}

/** Alert.alert as a promise. Android's hardware back dismisses the dialog
 *  without invoking either button, so onDismiss resolves false too. */
function confirmTag(assetName: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    Alert.alert(
      'Tag for repair?',
      `This creates an unassigned repair work order for ${assetName}.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => settle(false) },
        { text: 'Tag for repair', onPress: () => settle(true) },
      ],
      { cancelable: true, onDismiss: () => settle(false) },
    );
  });
}
