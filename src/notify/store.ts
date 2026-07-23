// Feature M — the in-app bell's state. Fed by the notification listeners
// (routing.ts) and read by the header dot + the NotificationsSheet (Phase 5).
// In-memory for the session by design (the "minimal fallback" decision): a
// process restart starts the list empty, which is acceptable for a surface
// whose job is only to catch what the OS banner might have missed.

import { create } from 'zustand';

import type { NotifData, NotifKind } from './types';

export type NotifItem = {
  /** The OS notification identifier — the dedup key across received + tapped. */
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  data: NotifData;
  receivedAt: number;
  read: boolean;
};

type NotifStoreState = {
  items: NotifItem[];
  add: (item: NotifItem) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
};

// Caps memory; the bell is a recent-activity list, not an archive.
const MAX_ITEMS = 50;

export const useNotifStore = create<NotifStoreState>((set) => ({
  items: [],
  add: (item) =>
    set((s) => {
      if (s.items.some((i) => i.id === item.id)) return s; // same OS id → ignore
      return { items: [item, ...s.items].slice(0, MAX_ITEMS) };
    }),
  markRead: (id) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, read: true } : i)) })),
  markAllRead: () => set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) })),
  clear: () => set({ items: [] }),
}));

/** Unread tally for the header dot. Stable selector for zustand. */
export function selectUnreadCount(s: NotifStoreState): number {
  return s.items.reduce((n, i) => (i.read ? n : n + 1), 0);
}

/**
 * Compact relative timestamp for the sheet's rows ("just now" → "3d ago").
 * Coarse on purpose: the list holds at most a session's worth of items, so
 * minute-level resolution is plenty. A future receivedAt (clock skew) reads as
 * "just now" rather than something negative.
 */
export function formatTimeAgo(receivedAt: number, now: number): string {
  const mins = Math.floor((now - receivedAt) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
