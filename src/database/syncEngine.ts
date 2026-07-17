import { hasUnsyncedChanges, synchronize } from '@nozbe/watermelondb/sync';

import { API_URL } from '../config';
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

/**
 * POST ${API_URL}/sync/pull | /sync/push. The token rides in the body — Apps
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

  let res: Response;
  try {
    res = await fetch(`${API_URL}/${path}`, {
      method: 'POST',
      // text/plain keeps web builds preflight-free (Apps Script can't answer
      // OPTIONS); the gateway parses e.postData.contents as JSON regardless.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token, ...payload }),
    });
  } catch {
    throw new SyncError('offline');
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new SyncError('server_error', `unexpected response (HTTP ${res.status})`);
  }

  if (!data || data.ok !== true) {
    // 'inactive' means the account was deactivated after login — for the app
    // that is the same outcome as an expired token: force a fresh login.
    const code: SyncErrorCode =
      data?.error === 'invalid_token' || data?.error === 'inactive'
        ? 'invalid_token'
        : 'server_error';
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
      await callGateway('sync/push', token, { last_pulled_at: lastPulledAt, changes });
    },

    sendCreatedAsUpdated: true, // simpler server: created rows are upserts too
  });
}

/** True while any local write is still waiting to be pushed. */
export function pendingChanges(): Promise<boolean> {
  return hasUnsyncedChanges({ database });
}
