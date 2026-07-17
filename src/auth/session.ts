import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { loginRequest, type SessionUser } from './api';
import { upsertLocalUser } from './localUser';

const SESSION_KEY = 'pmts.session';

type PersistedSession = {
  token: string;
  user: SessionUser;
  actAsL1: boolean;
};

type SessionState = {
  /** 'restoring' until restore() settles — the root screen holds the splash. */
  status: 'restoring' | 'signedOut' | 'signedIn';
  token: string | null;
  user: SessionUser | null;
  /** L2→L1 downgrade toggle. Only meaningful while user.role_level === 2. */
  actAsL1: boolean;
  /** Why the user was signed out (e.g. token expiry) — login screen shows it. */
  notice: string | null;
  restore: () => Promise<void>;
  signIn: (email: string, pin: string) => Promise<void>;
  signOut: (notice?: string) => Promise<void>;
  setActAsL1: (on: boolean) => Promise<void>;
  clearNotice: () => void;
};

async function persistSession(session: PersistedSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'restoring',
  token: null,
  user: null,
  actAsL1: false,
  notice: null,

  // Session restore is fully offline — only the first-ever login needs the
  // network (accepted behaviour: users has no credential column locally).
  // An expired token still restores; it only matters once sync (C) calls out.
  restore: async () => {
    try {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      if (!raw) {
        set({ status: 'signedOut' });
        return;
      }
      const saved = JSON.parse(raw) as PersistedSession;
      if (!saved?.token || !saved?.user?.id) throw new Error('malformed saved session');
      await upsertLocalUser(saved.user).catch((e) =>
        console.warn('user mirror upsert failed during restore:', e),
      );
      set({
        status: 'signedIn',
        token: saved.token,
        user: saved.user,
        actAsL1: !!saved.actAsL1 && saved.user.role_level === 2,
      });
    } catch (e) {
      console.warn('session restore failed:', e);
      await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
      set({ status: 'signedOut', token: null, user: null, actAsL1: false });
    }
  },

  // Throws LoginError — the login screen catches and renders it.
  signIn: async (email, pin) => {
    const { token, user } = await loginRequest(email, pin);
    await upsertLocalUser(user).catch((e) => console.warn('user mirror upsert failed:', e));
    await persistSession({ token, user, actAsL1: false });
    set({ status: 'signedIn', token, user, actAsL1: false, notice: null });
  },

  // Prefer flushAndSignOut (syncManager) from UI — it pushes queued writes
  // first. Direct signOut is for forced paths like token expiry.
  signOut: async (notice) => {
    await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
    // The local DB stays — same-user re-login keeps offline work; a
    // different user logging in wipes it (see signIn).
    set({
      status: 'signedOut',
      token: null,
      user: null,
      actAsL1: false,
      notice: notice ?? null,
    });
  },

  clearNotice: () => set({ notice: null }),

  setActAsL1: async (on) => {
    const { token, user } = get();
    if (!token || !user || user.role_level !== 2) return;
    set({ actAsL1: on });
    await persistSession({ token, user, actAsL1: on }).catch((e) =>
      console.warn('failed to persist role toggle:', e),
    );
  },
}));

export type EffectiveRole = 1 | 2;

/**
 * The effective role every later feature branches on (frozen rule:
 * L1 is always L1; L2 may act as L1 via the toggle). Null while signed out.
 */
export function useRole(): EffectiveRole | null {
  return useSession((s) =>
    s.user ? (s.user.role_level === 2 && s.actAsL1 ? 1 : s.user.role_level) : null,
  );
}

/** Non-hook token accessor — Feature C passes this to sync(getToken). */
export function getSessionToken(): string | null {
  return useSession.getState().token;
}
