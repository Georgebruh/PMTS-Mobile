import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useRole, useSession } from '../auth/session';
import type { Viewer } from '../wo/actions';
import { approvalOutcome, type ApprovalDecision } from './approval';
import { approveReport, assignWork } from './mutations';

// Feature L's two staff actions, each in a hook like Feature J's useTagAsset,
// and for the same reason: the action must mean exactly the same thing however
// it is triggered, down to the confirm wording, and a synchronous single-flight
// ref is the only thing that reliably stops a fast double tap (a `busy` state
// re-renders too late). Both mutations are idempotent regardless, so the ref is
// belt-and-braces, not the whole safety argument.

function useViewer(): Viewer {
  const role = useRole();
  const userId = useSession((s) => s.user?.id ?? '');
  // The Staff tab only mounts at effective L2, so role is 2 here; the mutations
  // re-check it anyway. Default to 2 so a momentary null during a role flip does
  // not silently downgrade the write into a guaranteed refusal.
  return { role: role === 1 ? 1 : 2, userId };
}

/** Assigns (or reassigns) a work order. Returns true on success so the screen
 *  can pop back to the queue. The staff picker IS the confirmation step, so
 *  there is no extra dialog. */
export function useAssign() {
  const viewer = useViewer();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const assign = useCallback(
    async (woId: string, staffId: string): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setBusy(true);
      try {
        const result = await assignWork(woId, staffId, viewer);
        if (!result.ok) {
          Alert.alert('Could not assign', result.error);
          return false;
        }
        return true;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [viewer.role, viewer.userId],
  );

  return { assign, busy };
}

/** Records an approve/reject decision, confirming first with copy that spells
 *  out what the server will then do (close / spawn rework / send back). */
export function useApprove() {
  const viewer = useViewer();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const review = useCallback(
    async (
      reportId: string,
      decision: ApprovalDecision,
      statusColor: string | null,
    ): Promise<boolean> => {
      if (inFlight.current) return false;

      const confirmed = await confirmReview(decision, statusColor);
      if (!confirmed) return false;

      // Re-checked after the await: the dialog is a window a second tap could
      // have used to start its own run.
      if (inFlight.current) return false;
      inFlight.current = true;
      setBusy(true);
      try {
        const result = await approveReport(reportId, viewer, decision);
        if (!result.ok) {
          Alert.alert('Could not record decision', result.error);
          return false;
        }
        return true;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [viewer.role, viewer.userId],
  );

  return { review, busy };
}

function confirmReview(
  decision: ApprovalDecision,
  statusColor: string | null,
): Promise<boolean> {
  const outcome = approvalOutcome(decision, statusColor);
  const [title, message, confirmLabel] =
    outcome === 'close'
      ? ['Approve report?', 'The equipment is healthy — this closes the work order.', 'Approve']
      : outcome === 'rework'
        ? [
            'Approve report?',
            'The equipment still needs work — approving creates a repair work order for it. This one closes.',
            'Approve',
          ]
        : [
            'Send back for revision?',
            'The maintenance staff will be asked to revise and resubmit this report.',
            'Send back',
          ];

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => settle(false) },
        {
          text: confirmLabel,
          style: outcome === 'sendBack' ? 'destructive' : 'default',
          onPress: () => settle(true),
        },
      ],
      { cancelable: true, onDismiss: () => settle(false) },
    );
  });
}
