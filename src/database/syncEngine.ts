import { Q } from '@nozbe/watermelondb';
import { hasUnsyncedChanges, synchronize } from '@nozbe/watermelondb/sync';

import { API_URL } from '../config';
import { stripLocalOnlyChanges, type ChangeSet } from '../report/push';
import { isSafeToSync } from '../report/urls';
import { database } from './database';

export type SyncErrorCode = 'unconfigured' | 'offline' | 'invalid_token' | 'server_error';

export class SyncError extends Error {
  readonly code: SyncErrorCode;

  constructor(code: SyncErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'SyncError';
    this.code = code;
  }
}

// Caps a single gateway round. An Apps Script cold start can legitimately take
// 15–30s, so the ceiling is generous — its job is only to stop an indefinite
// hang on a request that will never answer, so the sync manager's backoff can
// take over. Classified as 'offline' (retryable), same as a dropped connection.
const SYNC_TIMEOUT_MS = 45_000;

/**
 * POST ${API_URL}?path=sync/pull | sync/push. The route is a query param —
 * Apps Script pathInfo bounces anonymous callers to a Google sign-in page
 * (see auth/api.ts). The token rides in the body — Apps
 * Script web apps cannot read HTTP request headers. The gateway always
 * answers HTTP 200 (ContentService cannot set status codes); success/failure
 * is carried in the JSON `ok`/`error` body, same contract as /login.
 */
async function callGateway(
  path: 'sync/pull' | 'sync/push',
  token: string,
  payload: Record<string, unknown>,
): Promise<any> {
  if (!API_URL) throw new SyncError('unconfigured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}?path=${path}`, {
      method: 'POST',
      // text/plain keeps web builds preflight-free (Apps Script can't answer
      // OPTIONS); the gateway parses e.postData.contents as JSON regardless.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token, ...payload }),
      signal: controller.signal,
    });
  } catch {
    // A dropped connection OR our own timeout abort — both retryable. Mapping
    // the abort to 'offline' hands it to the sync manager's backoff instead of
    // surfacing an error on a gateway that simply never answered.
    throw new SyncError('offline');
  } finally {
    clearTimeout(timeout);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new SyncError('server_error', `unexpected response (HTTP ${res.status})`);
  }

  if (!data || data.ok !== true) {
    let code: SyncErrorCode;
    if (data?.error === 'invalid_token' || data?.error === 'inactive') {
      // 'inactive' means the account was deactivated after login — for the app
      // that is the same outcome as an expired token: force a fresh login.
      code = 'invalid_token';
    } else if (data?.error === 'lock_timeout') {
      // The gateway could not acquire its writer lock in time — transient
      // contention with another push, safe to retry. Treated as 'offline' so
      // the sync manager backs off rather than reporting a hard error.
      code = 'offline';
    } else {
      code = 'server_error';
    }
    throw new SyncError(code, data?.message ?? data?.error);
  }
  return data;
}

/**
 * One full WatermelonDB sync round (pull then push if needed). Throws
 * SyncError; a failed push never loses local writes — WatermelonDB keeps
 * unsynced rows queued via their _status column.
 */
export async function sync(getToken: () => string | null): Promise<void> {
  const token = getToken();
  if (!token) throw new SyncError('invalid_token', 'no session token');

  await synchronize({
    database,

    pullChanges: async ({ lastPulledAt, schemaVersion }) => {
      const data = await callGateway('sync/pull', token, {
        last_pulled_at: lastPulledAt ?? 0,
        schema_version: schemaVersion,
      });
      return { changes: data.changes, timestamp: data.timestamp };
    },

    pushChanges: async ({ changes, lastPulledAt }) => {
      // Feature I: drafts and the upload queue never leave the device. Read the
      // draft ids from the database rather than from `changes` — a parameter
      // can belong to a draft whose own row is unchanged, and so absent here.
      const drafts = await database
        .get('maintenance_reports')
        .query(Q.where('is_draft', true))
        .fetch();
      const draftIds = new Set(drafts.map((r) => r.id));

      const outgoing = stripLocalOnlyChanges(changes as unknown as ChangeSet, draftIds);

      // Everything in this batch was local-only: there is nothing to say, and
      // an empty round-trip to Apps Script is pure latency. Returning early is
      // safe — WatermelonDB's post-push bookkeeping does not depend on the
      // request having happened.
      if (Object.keys(outgoing).length === 0) return;

      warnOnLocalUris(outgoing);

      await callGateway('sync/push', token, {
        last_pulled_at: lastPulledAt,
        changes: outgoing,
      });
    },

    sendCreatedAsUpdated: true, // simpler server: created rows are upserts too
  });
}

/** True while any local write is still waiting to be pushed. */
export function pendingChanges(): Promise<boolean> {
  return hasUnsyncedChanges({ database });
}

/**
 * Feature N — a canary, not a gate. deriveUrls is the sole writer of
 * photo_urls / signature_url and only ever writes remote Drive URLs, so a local
 * file:// (or content://) URI in an outgoing report should be impossible. The
 * check is free, so assert it: if it ever fires, design gap #6 has regressed and
 * a local path is one push away from the sheet.
 */
function warnOnLocalUris(changes: ChangeSet): void {
  const reports = changes.maintenance_reports;
  if (!reports) return;
  for (const row of [...reports.created, ...reports.updated]) {
    const photo = typeof row.photo_urls === 'string' ? row.photo_urls : null;
    const signature = typeof row.signature_url === 'string' ? row.signature_url : null;
    if (!isSafeToSync(photo) || !isSafeToSync(signature)) {
      console.warn(
        `[sync] report ${row.id}: a non-remote URL is about to be pushed ` +
          '(photo_urls/signature_url) — deriveUrls should have prevented this',
      );
    }
  }
}
