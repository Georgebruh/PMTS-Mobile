// Feature M — the app end of a notification: a tap becomes a deep link, a
// foreground arrival becomes a bell entry. All navigation decisions defer to the
// pure routeFromNotification (uid + effective-role guarded), so this file holds
// only the wiring: three OS listeners and the cold-start read.

import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { useSession } from '../auth/session';
import { requestSync } from '../sync/syncManager';
import { navigateToTarget } from './navigation';
import { parseNotifData, routeFromNotification } from './route';
import { useNotifStore } from './store';
import type { NotifData, RouteSession } from './types';

// A tap can be delivered via BOTH getLastNotificationResponseAsync (the launch
// tap on cold start) and the response listener. This dedupes them by OS id.
// Module-scoped so it survives across the hook's remounts within one runtime.
const handledResponseIds = new Set<string>();

/** The live session as the pure router needs it — read non-reactively at tap
 *  time. Also used by the NotificationsSheet, whose item taps face the same
 *  uid/role guard as a real OS tap. */
export function currentRouteSession(): RouteSession {
  const { user, actAsL1 } = useSession.getState();
  const role = user ? (user.role_level === 2 && actAsL1 ? 1 : user.role_level) : null;
  return { uid: user?.id ?? null, role };
}

function recordInBell(
  id: string,
  title: string | null | undefined,
  body: string | null | undefined,
  data: NotifData,
  read: boolean,
): void {
  const store = useNotifStore.getState();
  store.add({ id, kind: data.kind, title: title ?? '', body: body ?? '', data, receivedAt: Date.now(), read: false });
  if (read) store.markRead(id); // add() dedups by id, so mark after
}

function handleResponse(response: Notifications.NotificationResponse): void {
  const req = response.notification.request;
  if (handledResponseIds.has(req.identifier)) return;
  handledResponseIds.add(req.identifier);

  const data = parseNotifData(req.content.data);
  if (!data) return; // not one of ours / malformed → ignore

  recordInBell(req.identifier, req.content.title, req.content.body, data, true);
  const target = routeFromNotification(data, currentRouteSession());
  if (target) {
    navigateToTarget(target);
    // The push often beats this device's own sync — the target row may not be
    // mirrored yet. Kick a round so the observe-based detail screen fills in
    // instead of showing its empty state. (requestSync no-ops when signed out.)
    void requestSync('notification tap');
  }
}

/**
 * Mount once at the app root. Wires:
 *   - taps while running (foreground/background) + foreground arrivals → bell,
 *   - cold start: the tap that launched the app.
 */
export function useNotificationRouting(): void {
  // The launch tap is read only AFTER the session restores — otherwise the
  // router's uid/role guard runs against a still-null session and the deep link
  // is silently dropped. Taps on an already-running app never hit this.
  const signedIn = useSession((s) => s.status === 'signedIn');

  useEffect(() => {
    const responseSub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    const receivedSub = Notifications.addNotificationReceivedListener((n) => {
      const data = parseNotifData(n.request.content.data);
      if (data) recordInBell(n.request.identifier, n.request.content.title, n.request.content.body, data, false);
    });
    return () => {
      responseSub.remove();
      receivedSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (active && r) handleResponse(r); // handledResponseIds dedups a re-read
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [signedIn]);
}
