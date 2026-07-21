// Feature I — live views of a report and its files.
//
// Same shape as src/wo/hooks.ts: query().observe() everywhere rather than
// findAndObserve(), so a row removed by a sync renders an empty state instead
// of throwing, and undefined until the first emission so nothing renders under
// a scope that has not loaded yet.

import { Q } from '@nozbe/watermelondb';
import { useMemo } from 'react';

import { database } from '../database/database';
import { useObservable } from '../hooks/useObservable';
import { asSubscribable } from '../wo/types';
import { paramCompare } from './params';
import type { ParamRecord, ReportRecord, UploadRecord } from './types';
import { uploadCompare, UPLOAD_KIND } from './urls';

/** One report. undefined until the first emission, null when it is gone. */
export function useReport(reportId: string): ReportRecord | null | undefined {
  const rows = useObservable(
    () =>
      asSubscribable<ReportRecord[]>(
        database.get('maintenance_reports').query(Q.where('id', reportId)).observe(),
      ),
    [reportId],
  );
  if (rows === undefined) return undefined;
  return rows.length > 0 ? rows[0] : null;
}

/** This report's parameters, in stored order. */
export function useReportParams(reportId: string): ParamRecord[] | undefined {
  const rows = useObservable(
    () =>
      asSubscribable<ParamRecord[]>(
        database.get('report_parameters').query(Q.where('report_id', reportId)).observe(),
      ),
    [reportId],
  );
  return useMemo(() => (rows === undefined ? undefined : [...rows].sort(paramCompare)), [rows]);
}

/** This report's queued files, photos before signature, in display order. */
export function useReportUploads(reportId: string): UploadRecord[] | undefined {
  const rows = useObservable(
    () =>
      asSubscribable<UploadRecord[]>(
        database.get('pending_uploads').query(Q.where('report_id', reportId)).observe(),
      ),
    [reportId],
  );
  return useMemo(() => (rows === undefined ? undefined : [...rows].sort(uploadCompare)), [rows]);
}

export function usePhotos(uploads: UploadRecord[] | undefined): UploadRecord[] | undefined {
  return useMemo(
    () => (uploads === undefined ? undefined : uploads.filter((u) => u.kind === UPLOAD_KIND.PHOTO)),
    [uploads],
  );
}

/** The current signature, or null. The last one wins, matching deriveUrls. */
export function useSignature(uploads: UploadRecord[] | undefined): UploadRecord | null | undefined {
  return useMemo(() => {
    if (uploads === undefined) return undefined;
    const signatures = uploads.filter((u) => u.kind === UPLOAD_KIND.SIGNATURE);
    return signatures.length > 0 ? signatures[signatures.length - 1] : null;
  }, [uploads]);
}

/**
 * The draft report for a work order, if one exists — this is what turns Work
 * Order Detail's button from "File report" into "Continue report", and it is
 * the re-entry path from the dashboard's Unfinished Reports card.
 */
export function useDraftForWo(woId: string): ReportRecord | null | undefined {
  const rows = useObservable(
    () =>
      asSubscribable<ReportRecord[]>(
        database
          .get('maintenance_reports')
          .query(Q.where('work_order_id', woId), Q.where('is_draft', true))
          .observe(),
      ),
    [woId],
  );
  if (rows === undefined) return undefined;
  return rows.length > 0 ? rows[0] : null;
}
