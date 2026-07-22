// Feature I — the ONLY writer of maintenance_reports.photo_urls and
// signature_url. Nothing else in the app may assign those columns.
//
// Why a whole module for two string columns: design gap #6 says local file
// URIs must never reach the sheet. "Be careful at each call site" is not a
// mechanism. One derivation function, fed only by upload rows that already
// carry a Drive URL, and a hard rejection of anything that still looks local,
// is a mechanism.
//
// Import-pure: no database, no react-native.

import type { UploadRecord } from './types';

/** The schema's join character for photo_urls (';'-joined Drive URLs). */
export const URL_SEPARATOR = ';';

export const UPLOAD_KIND = { PHOTO: 'photo', SIGNATURE: 'signature' } as const;
export type UploadKind = (typeof UPLOAD_KIND)[keyof typeof UPLOAD_KIND];

/**
 * Schemes that must never appear in a synced column. `file://` is the one the
 * picker hands us; `content://` is what an Android gallery intent can return;
 * a bare `/data/...` path is what a careless `.replace()` would leave behind.
 */
export function isRemoteUrl(value: string): boolean {
  const v = value.trim();
  if (v === '') return false;
  return /^https?:\/\//i.test(v);
}

export function splitUrls(joined: string | null | undefined): string[] {
  if (!joined) return [];
  return joined
    .split(URL_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function joinUrls(urls: readonly string[]): string {
  return urls.join(URL_SEPARATOR);
}

/** Photo uploads in display order: sort_order, then id for a stable tie-break
 *  between rows queued in the same millisecond. */
export function uploadCompare(a: UploadRecord, b: UploadRecord): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id.localeCompare(b.id);
}

export type DerivedUrls = {
  photoUrls: string;
  signatureUrl: string | null;
};

/**
 * Recomputes both URL columns from the report's upload queue. Called after
 * every successful upload, and it is a FULL recomputation rather than an
 * append: appending would double-write a URL on a retry that turned out to
 * have already succeeded, and the sheet would show the same photo twice.
 *
 * Only rows that are `uploaded` AND carry a genuinely remote URL contribute.
 * A row still pending contributes nothing — which is exactly why a report can
 * submit before its photos finish and have the URLs filled in later.
 *
 * The signature is single-valued; if several exist (a re-signed draft), the
 * last in upload order wins, matching what the user last drew.
 */
export function deriveUrls(uploads: readonly UploadRecord[]): DerivedUrls {
  const usable = uploads
    .filter((u) => u.state === 'uploaded')
    .filter((u) => typeof u.remoteUrl === 'string' && isRemoteUrl(u.remoteUrl))
    .slice()
    .sort(uploadCompare);

  const photos = usable
    .filter((u) => u.kind === UPLOAD_KIND.PHOTO)
    .map((u) => (u.remoteUrl as string).trim());

  const signatures = usable.filter((u) => u.kind === UPLOAD_KIND.SIGNATURE);
  const signature =
    signatures.length > 0 ? (signatures[signatures.length - 1].remoteUrl as string).trim() : null;

  return { photoUrls: joinUrls(photos), signatureUrl: signature };
}

/**
 * Last line of defence, asserted by the harness and cheap enough to call
 * before any write: true when a column value is safe to sync.
 */
export function isSafeToSync(columnValue: string | null): boolean {
  if (columnValue === null || columnValue === '') return true;
  return splitUrls(columnValue).every(isRemoteUrl);
}
