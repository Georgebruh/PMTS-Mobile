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
  restore: () => Promise<void>;
  signIn: (email: string, pin: string) => Promise<void>;
  signOut: () => Promise<void>;
  setActAsL1: (on: boolean) => Promise<void>;
};

async function persistSession(session: PersistedSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'restoring',
  token: null,
  user: null,
  actAsL1: false,

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
    set({ status: 'signedIn', token, user, actAsL1: false });
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
    // The local DB stays — wipe-on-user-switch is decided in Feature C.
    set({ status: 'signedOut', token: null, user: null, actAsL1: false });
  },

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
