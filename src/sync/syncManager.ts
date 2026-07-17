import * as Network from 'expo-network';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { getSessionToken, useSession } from '../auth/session';
import { database } from '../database/database';
import { pendingChanges, sync, SyncError } from '../database/syncEngine';

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error';

type SyncStatus = {
  phase: SyncPhase;
  /** Local writes still waiting to be pushed (drives the header indicator). */
  pending: boolean;
  lastSyncedAt: number | null;
  errorMessage: string | null;
};

export const useSyncStatus = create<SyncStatus>()(() => ({
  phase: 'idle',
  pending: false,
  lastSyncedAt: null,
  errorMessage: null,
}));

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const WRITE_DEBOUNCE_MS = 2500;
const RETRY_BASE_MS = 5 * 1000;
const RETRY_MAX_MS = 5 * 60 * 1000;
const FLUSH_TIMEOUT_MS = 15 * 1000;

let currentRun: Promise<void> | null = null;
let queued = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelayMs = RETRY_BASE_MS;

function clearRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleRetry(): void {
  clearRetry();
  retryTimer = setTimeout(() => {
    retryTimer = null;
    requestSync('retry');
  }, retryDelayMs);
  retryDelayMs = Math.min(retryDelayMs * 2, RETRY_MAX_MS);
}

/**
 * The only sync entry point — every trigger funnels here. Single-flight: a
 * call during a running sync queues exactly one follow-up round (and returns
 * the in-flight promise), so writes made mid-sync are picked up without two
 * synchronize() calls ever running in parallel.
 */
export function requestSync(reason: string = 'manual'): Promise<void> {
  if (useSession.getState().status !== 'signedIn') return Promise.resolve();
  if (__DEV__) console.log('[sync] trigger:', reason);
  if (currentRun) {
    queued = true;
    return currentRun;
  }
  clearRetry();
  currentRun = (async () => {
    try {
      do {
        queued = false;
        await runOnce();
      } while (queued && useSession.getState().status === 'signedIn');
    } finally {
      currentRun = null;
    }
  })();
  return currentRun;
}

async function runOnce(): Promise<void> {
  const net = await Network.getNetworkStateAsync().catch(() => null);
  if (net?.isConnected === false) {
    useSyncStatus.setState({
      phase: 'offline',
      pending: await pendingChanges().catch(() => false),
    });
    return;
  }

  useSyncStatus.setState({ phase: 'syncing', errorMessage: null });
  try {
    await sync(getSessionToken);
    retryDelayMs = RETRY_BASE_MS;
    useSyncStatus.setState({
      phase: 'idle',
      pending: await pendingChanges().catch(() => false),
      lastSyncedAt: Date.now(),
      errorMessage: null,
    });
  } catch (e) {
    const pending = await pendingChanges().catch(() => false);
    if (e instanceof SyncError && e.code === 'invalid_token') {
      // Expired/revoked token or deactivated account. Local writes stay
      // queued in the DB; they flush after the owner logs back in.
      useSyncStatus.setState({ phase: 'idle', pending });
      queued = false;
      await useSession
        .getState()
        .signOut('Your session expired. Connect to the internet and log in again.');
      return;
    }
    if (e instanceof SyncError && e.code === 'offline') {
      // Airplane mode reports isConnected true on some devices — the fetch
      // failure is the ground truth. The reconnect listener usually beats
      // this backoff timer.
      useSyncStatus.setState({ phase: 'offline', pending });
      scheduleRetry();
      return;
    }
    console.warn('sync failed:', e);
    useSyncStatus.setState({
      phase: 'error',
      pending,
      errorMessage: e instanceof Error ? e.message : String(e),
    });
    scheduleRetry();
  }
}

/**
 * Logout path (frozen Feature C decision): best-effort final push while the
 * token still exists, so a later different-user login's DB wipe cannot eat
 * this user's unpushed work. Offline or failing? Sign out anyway — same-user
 * re-login keeps the local DB, so queued writes survive for their owner.
 */
export async function flushAndSignOut(): Promise<void> {
  try {
    if (await pendingChanges()) {
      await Promise.race([
        requestSync('logout flush'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('flush timed out')), FLUSH_TIMEOUT_MS),
        ),
      ]);
    }
  } catch (e) {
    console.warn('final flush before sign-out failed:', e);
  }
  await useSession.getState().signOut();
}

/**
 * Mount once at the app root. While signed in, wires every sync trigger from
 * the frozen Feature C list: app open / sign-in, foreground, local write
 * batches (debounced), a safety interval, and reconnect.
 */
export function useSyncLifecycle(): void {
  const signedIn = useSession((s) => s.status === 'signedIn');

  useEffect(() => {
    if (!signedIn) {
      clearRetry();
      return;
    }

    requestSync('sign-in / app open');

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestSync('foreground');
    });

    let wasConnected: boolean | null = null;
    const netSub = Network.addNetworkStateListener((state) => {
      const connected = state.isConnected === true;
      if (connected && wasConnected === false) requestSync('reconnect');
      if (!connected) {
        pendingChanges()
          .catch(() => false)
          .then((pending) => useSyncStatus.setState({ phase: 'offline', pending }));
      }
      wasConnected = connected;
    });

    const interval = setInterval(() => requestSync('interval'), SYNC_INTERVAL_MS);

    // "After each local write batch": every DB change lands here — including
    // ones a sync pull just applied — so the pendingChanges guard filters out
    // everything that is not an actual unpushed local write.
    let writeDebounce: ReturnType<typeof setTimeout> | null = null;
    const tables = Object.keys(database.schema.tables);
    const dbSub = database.withChangesForTables(tables as never[]).subscribe({
      next: () => {
        if (writeDebounce) clearTimeout(writeDebounce);
        writeDebounce = setTimeout(async () => {
          writeDebounce = null;
          const pending = await pendingChanges().catch(() => false);
          useSyncStatus.setState({ pending });
          if (pending) requestSync('local write');
        }, WRITE_DEBOUNCE_MS);
      },
    });

    return () => {
      appStateSub.remove();
      netSub.remove();
      clearInterval(interval);
      if (writeDebounce) clearTimeout(writeDebounce);
      dbSub.unsubscribe();
      clearRetry();
    };
  }, [signedIn]);
}
