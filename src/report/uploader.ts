// Feature I — moving queued files to Drive.
//
// Runs after each successful sync round. It does not decide anything: which
// row is next, what a failure means, and what the URL columns become are all
// settled by the pure modules (uploads.ts, urls.ts), which the harness has
// already exhausted. This file is the I/O around those decisions.
//
// The one rule worth stating out loud: a retryable failure ABORTS THE WHOLE
// FLUSH rather than moving to the next file. If the radio is gone it is gone
// for every file, and grinding through the queue would burn all five attempts
// on every row in a single offline moment — turning a temporary tunnel into a
// queue full of permanently failed uploads that need manual retries.

import { File } from 'expo-file-system';

import { API_URL } from '../config';
import { database } from '../database/database';
import { SyncError } from '../database/syncEngine';
import type { UploadRecord } from './types';
import { deriveUrls } from './urls';
import { nextUploadPatch, pickNextUpload, type UploadOutcome } from './uploads';

/** Gateway error codes that retrying cannot fix (see gateway/Upload.js). */
const PERMANENT_ERRORS = ['bad_request', 'too_large', 'unsupported_type'];

let inFlight: Promise<number> | null = null;

async function allUploads(): Promise<any[]> {
  return database.get('pending_uploads').query().fetch();
}

/**
 * POSTs one file. The upload row's id IS the upload_id, which is what makes
 * the endpoint idempotent: a retry after a dropped response finds the file
 * already in Drive and returns its URL instead of creating a duplicate.
 */
async function postFile(row: UploadRecord, token: string): Promise<UploadOutcome> {
  let base64: string;
  try {
    const file = new File(row.localUri);
    if (!file.exists) return { kind: 'permanent', error: 'The file is no longer on this device.' };
    base64 = await file.base64();
  } catch (e) {
    // Unreadable is permanent: the bytes are not coming back on a later try.
    return { kind: 'permanent', error: 'The file could not be read.' };
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}?path=upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token,
        report_id: row.reportId,
        upload_id: row.id,
        kind: row.kind,
        mime: row.mime,
        data_b64: base64,
      }),
    });
  } catch {
    return { kind: 'retryable', error: 'No connection.' };
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    return { kind: 'retryable', error: `Unexpected response (HTTP ${res.status}).` };
  }

  if (data?.ok === true && typeof data.url === 'string') {
    return { kind: 'success', url: data.url };
  }

  // An expired token is nobody's file problem — surface it so the sync manager
  // can sign out, rather than counting it against this row's attempts.
  if (data?.error === 'invalid_token' || data?.error === 'inactive') {
    throw new SyncError('invalid_token', data?.message ?? data?.error);
  }

  if (PERMANENT_ERRORS.includes(data?.error)) {
    return { kind: 'permanent', error: data?.message ?? data?.error };
  }
  return { kind: 'retryable', error: data?.message ?? data?.error ?? 'Upload failed.' };
}

/** Applies the patch and recomputes the parent report's URL columns. */
async function applyOutcome(rowId: string, outcome: UploadOutcome): Promise<void> {
  await database.write(async () => {
    const rows = await database.get('pending_uploads').query().fetch();
    const row = rows.find((r: any) => r.id === rowId) as any;
    if (!row) return; // removed while in flight — nothing to record

    const patch = nextUploadPatch(row as UploadRecord, outcome);
    await row.update((u: any) => {
      u.state = patch.state;
      u.remoteUrl = patch.remoteUrl;
      u.attempts = patch.attempts;
      u.lastError = patch.lastError;
    });

    if (outcome.kind !== 'success') return;

    // Recompute from the whole queue rather than appending — deriveUrls is the
    // only writer of these columns, and a full recomputation cannot double-list
    // a photo whose retry turned out to have already succeeded.
    const reportId = row.reportId as string;
    const siblings = rows.filter((r: any) => r.reportId === reportId) as unknown as UploadRecord[];
    const fresh = siblings.map((r) =>
      r.id === rowId ? { ...r, state: patch.state, remoteUrl: patch.remoteUrl } : r,
    );
    const derived = deriveUrls(fresh);

    const reports = await database
      .get('maintenance_reports')
      .query()
      .fetch();
    const report = reports.find((r: any) => r.id === reportId) as any;
    if (!report) return;

    await report.update((r: any) => {
      r.photoUrls = derived.photoUrls === '' ? null : derived.photoUrls;
      r.signatureUrl = derived.signatureUrl;
    });
  });
}

/**
 * Sends every queued file it can, newest failures last. Returns how many
 * reached Drive.
 *
 * Single-flight: a second call while one is running joins the first rather
 * than racing it onto the same rows.
 */
export function flushUploads(getToken: () => string | null): Promise<number> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const token = getToken();
      if (!token) return 0;
      if (!API_URL) return 0;

      let uploaded = 0;
      // Bounded by the queue: every pass either uploads a row or removes it
      // from contention (permanent failure), and a retryable failure returns.
      for (;;) {
        const rows = (await allUploads()) as unknown as UploadRecord[];
        const next = pickNextUpload(rows);
        if (next === null) return uploaded;

        const outcome = await postFile(next, token);
        await applyOutcome(next.id, outcome);

        if (outcome.kind === 'success') {
          uploaded += 1;
          continue;
        }
        if (outcome.kind === 'permanent') continue; // that row is out; try others
        return uploaded; // retryable: the network is down for everything
      }
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Files whose row is gone are deleted off disk by the caller; this is the
 *  best-effort helper both the screen and the discard path use. */
export async function deleteLocalFiles(uris: readonly string[]): Promise<void> {
  for (const uri of uris) {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch (e) {
      // A file we cannot delete is a few KB of clutter, never a reason to fail
      // the user's action.
      console.warn('could not delete local file:', uri, e);
    }
  }
}
