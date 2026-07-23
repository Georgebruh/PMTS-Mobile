// Feature M — registering THIS device's Expo push token against the signed-in
// user, and unregistering it on logout. The gateway endpoints (?path=registerPush
// / unregisterPush) arrive in Phase 4; until then these POSTs simply get a
// not_found and fail soft — registration is best-effort and never blocks the UI.

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useSession } from '../auth/session';
import { API_URL } from '../config';
import { useNotifStore } from './store';

/** From `eas init` (written into app.json extra.eas.projectId), or null.
 *  Exported for the DevProbes registration dump. */
export function getProjectId(): string | null {
  const fromExpo = Constants.expoConfig?.extra?.eas?.projectId;
  const fromEas = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig
    ?.projectId;
  const id = fromExpo ?? fromEas;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

async function ensurePermission(): Promise<boolean> {
  // Record the outcome in the store so the bell can indicate when OS banners
  // will not arrive. In-app notifications work regardless of this.
  const setPermission = useNotifStore.getState().setPermission;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    setPermission('granted');
    return true;
  }
  if (!current.canAskAgain) {
    setPermission('denied'); // user permanently denied — respect it
    return false;
  }
  const requested = await Notifications.requestPermissionsAsync();
  setPermission(requested.granted ? 'granted' : 'denied');
  return requested.granted;
}

/**
 * The device's Expo push token, or null when it can't be obtained — no
 * projectId yet, permission denied, or running on an emulator (the native call
 * throws there). Every null path is logged and non-fatal.
 */
export async function fetchExpoPushToken(): Promise<string | null> {
  const projectId = getProjectId();
  if (!projectId) {
    console.warn('[notify] no EAS projectId (run `eas init`) — skipping push registration');
    return null;
  }
  if (!(await ensurePermission())) {
    console.warn('[notify] notification permission not granted — skipping push registration');
    return null;
  }
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (e) {
    console.warn('[notify] getExpoPushTokenAsync failed (emulator / missing FCM creds?):', e);
    return null;
  }
}

async function postOk(path: string, body: unknown): Promise<boolean> {
  if (!API_URL) return false;
  try {
    // Same text/plain, ?path= convention as auth/api.ts (keeps web preflight-free
    // and rides Apps Script's query-param router).
    const res = await fetch(`${API_URL}?path=${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return data?.ok === true;
  } catch (e) {
    console.warn(`[notify] POST ${path} failed:`, e);
    return false;
  }
}

export function registerPushToken(sessionToken: string, expoPushToken: string): Promise<boolean> {
  return postOk('registerPush', {
    token: sessionToken,
    expo_push_token: expoPushToken,
    platform: Platform.OS,
  });
}

export function unregisterPushToken(sessionToken: string, expoPushToken: string): Promise<boolean> {
  return postOk('unregisterPush', { token: sessionToken, expo_push_token: expoPushToken });
}

/**
 * Mount once at the app root. Registers this device's token whenever a session
 * is active, and unregisters it on the way out — using the token captured at
 * register time, because the session token is already cleared by the time the
 * cleanup runs, and a logged-out shared phone must stop ringing for the previous
 * user.
 */
export function usePushRegistration(): void {
  const status = useSession((s) => s.status);

  useEffect(() => {
    if (status !== 'signedIn') return;

    let cancelled = false;
    let registered: { sessionToken: string; expoToken: string } | null = null;

    (async () => {
      const sessionToken = useSession.getState().token;
      if (!sessionToken) return;
      const expoToken = await fetchExpoPushToken();
      if (cancelled || !expoToken) return;
      const ok = await registerPushToken(sessionToken, expoToken);
      if (!cancelled && ok) registered = { sessionToken, expoToken };
    })();

    return () => {
      cancelled = true;
      if (registered) {
        // Fire-and-forget: the captured token is still valid for ~30 days, so a
        // normal logout deactivates this device server-side. A forced sign-out
        // on token expiry will simply fail this call, which is fine.
        void unregisterPushToken(registered.sessionToken, registered.expoToken);
      }
    };
  }, [status]);
}
