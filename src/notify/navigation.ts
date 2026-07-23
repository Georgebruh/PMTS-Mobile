// Feature M — turning the pure router's NavTarget into an actual navigation
// call on the root container, with one wrinkle a notification forces: the tap
// can arrive before the NavigationContainer is ready (cold start, or while the
// login screen is still up). So a target that can't be dispatched yet is parked
// and flushed from RootNavigator's onReady.

import { navigationRef } from '../navigation/navigationRef';
import type { NavTarget } from './types';

let pendingTarget: NavTarget | null = null;

/** Navigate now if the container is ready, else park it for flushPending(). */
export function navigateToTarget(target: NavTarget): void {
  if (navigationRef.isReady()) {
    dispatch(target);
  } else {
    pendingTarget = target; // last-one-wins; only the most recent tap matters
  }
}

/** Called from NavigationContainer.onReady — sends any parked target. */
export function flushPendingNavigation(): void {
  if (pendingTarget && navigationRef.isReady()) {
    const target = pendingTarget;
    pendingTarget = null;
    dispatch(target);
  }
}

// Each case narrows NavTarget to a single variant, so the tab/screen literals
// and the params shape line up with the typed nested navigate — no casts.
function dispatch(target: NavTarget): void {
  switch (target.screen) {
    case 'WorkOrderDetail':
      navigationRef.navigate('Tabs', {
        screen: 'HomeTab',
        params: { screen: 'WorkOrderDetail', params: target.params },
      });
      return;
    case 'ApprovalDetail':
      navigationRef.navigate('Tabs', {
        screen: 'StaffTab',
        params: { screen: 'ApprovalDetail', params: target.params },
      });
      return;
    case 'AssignWorkOrder':
      navigationRef.navigate('Tabs', {
        screen: 'StaffTab',
        params: { screen: 'AssignWorkOrder', params: target.params },
      });
      return;
  }
}
