// Feature I — the upload queue's state machine, as a pure reducer.
//
// This is the part of the feature that talks to the least reliable thing in
// the system: a phone radio in a basement, in front of an Apps Script endpoint
// that can take seconds to answer. Every interesting failure is a partial one —
// the file reached Drive but the response did not come back, the app was killed
// between the POST and the write. So the transitions live here, in a function
// with no I/O, and the uploader is left with nothing to decide.
//
// Import-pure: no database, no react-native, no fetch.

import type { UploadRecord } from './types';

export const UPLOAD_STATE = {
  PENDING: 'pending',
  UPLOADED: 'uploaded',
  FAILED: 'failed',
} as const;
export type UploadState = (typeof UPLOAD_STATE)[keyof typeof UPLOAD_STATE];

/**
 * After this many consecutive retryable failures a row stops trying by itself
 * and waits for the user. Five covers a tunnel, a lift, and a lunch break;
 * beyond that the problem is not transient and silently retrying forever just
 * burns battery and hides a real fault.
 */
export const MAX_UPLOAD_ATTEMPTS = 5;

export type UploadOutcome =
  /** Drive has the file and gave us its URL. */
  | { kind: 'success'; url: string }
  /** Offline, timeout, 5xx, Apps Script hiccup — worth trying again. */
  | { kind: 'retryable'; error: string }
  /** The file is gone, unreadable, or rejected. Retrying cannot help. */
  | { kind: 'permanent'; error: string };

/** The columns an outcome changes. Returned as data so the mutation layer
 *  applies it and the harness asserts it, without either duplicating rules. */
export type UploadPatch = {
  state: UploadState;
  remoteUrl: string | null;
  attempts: number;
  lastError: string | null;
};

/**
 * Note `attempts` counts FAILURES, not tries: a success leaves it untouched so
 * the number in a diagnostic dump reads as "how much trouble did this file
 * give us", and a row that succeeded on its fourth go does not look like it is
 * one failure away from the cap.
 */
export function nextUploadPatch(row: UploadRecord, outcome: UploadOutcome): UploadPatch {
  if (outcome.kind === 'success') {
    return {
      state: UPLOAD_STATE.UPLOADED,
      remoteUrl: outcome.url,
      attempts: row.attempts,
      lastError: null,
    };
  }

  const attempts = row.attempts + 1;

  if (outcome.kind === 'permanent') {
    return {
      state: UPLOAD_STATE.FAILED,
      remoteUrl: row.remoteUrl,
      attempts,
      lastError: outcome.error,
    };
  }

  return {
    // Stays claimable until the cap, then parks as failed for the user to
    // retry by hand.
    state: attempts >= MAX_UPLOAD_ATTEMPTS ? UPLOAD_STATE.FAILED : UPLOAD_STATE.PENDING,
    remoteUrl: row.remoteUrl,
    attempts,
    lastError: outcome.error,
  };
}

/** A row the uploader may pick up on this pass. */
export function isUploadable(row: UploadRecord): boolean {
  return (
    row.state === UPLOAD_STATE.PENDING &&
    row.attempts < MAX_UPLOAD_ATTEMPTS &&
    row.localUri.trim() !== ''
  );
}

/**
 * The next file to send: fewest failures first, so one poisonous row cannot
 * starve the rest of the queue behind it, then oldest-first within that.
 */
export function pickNextUpload(rows: readonly UploadRecord[]): UploadRecord | null {
  const ready = rows.filter(isUploadable);
  if (ready.length === 0) return null;
  return ready.slice().sort((a, b) => {
    if (a.attempts !== b.attempts) return a.attempts - b.attempts;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id.localeCompare(b.id);
  })[0];
}

/** Failed rows can be put back in the queue by the user. Attempts reset —
 *  the user retrying is new information (they moved, or reconnected). */
export function retryPatch(row: UploadRecord): UploadPatch {
  return {
    state: UPLOAD_STATE.PENDING,
    remoteUrl: row.remoteUrl,
    attempts: 0,
    lastError: row.lastError,
  };
}

/** True once every file for a report has reached Drive — the report's URL
 *  columns are final and nothing further will change them. */
export function isQueueSettled(rows: readonly UploadRecord[]): boolean {
  return rows.every((row) => row.state === UPLOAD_STATE.UPLOADED);
}

export function countByState(rows: readonly UploadRecord[]): Record<UploadState, number> {
  const counts: Record<UploadState, number> = { pending: 0, uploaded: 0, failed: 0 };
  for (const row of rows) {
    if (row.state === UPLOAD_STATE.PENDING) counts.pending += 1;
    else if (row.state === UPLOAD_STATE.UPLOADED) counts.uploaded += 1;
    else if (row.state === UPLOAD_STATE.FAILED) counts.failed += 1;
  }
  return counts;
}
