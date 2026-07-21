// Feature I — structural views of the untyped .js models, mirroring
// src/wo/types.ts. One cast at the query boundary, strict typing downstream.

/**
 * A maintenance_reports row.
 *
 * NB `workOrder` / `report` are declared as `{ id }` rather than a plain
 * `workOrderId` string because models.js exposes those FKs only through
 * @relation — there is no @text decorator for the raw column. This is the same
 * shape WoRecord uses for `asset`.
 */
export type ReportRecord = {
  id: string;
  reportCode: string;
  actionTaken: string | null;
  statusColor: string | null;
  photoUrls: string | null;
  signatureUrl: string | null;
  reporterUserId: string;
  isDraft: boolean;
  submittedAt: Date | null;
  approvalStatus: string;
  createdAt: Date | null;
  workOrder: { id: string };
  asset: { id: string };
};

/** A report_parameters row. */
export type ParamRecord = {
  id: string;
  paramCode: string;
  paramName: string;
  unit: string | null;
  measuredValue: string;
  sortOrder: number | null;
  report: { id: string };
};

/**
 * A pending_uploads row — one file still on its way to Drive.
 *
 * `state` is the upload truth. Do NOT read `_raw._status` on this table: it is
 * local-only, so WatermelonDB marks every row 'synced' after a push that never
 * carried it. (The opposite of Feature H's crew rows, where `_status` is
 * exactly the right signal — see canRemoveCrew.)
 */
export type UploadRecord = {
  id: string;
  reportId: string;
  kind: string;
  localUri: string;
  mime: string;
  sortOrder: number;
  state: string;
  remoteUrl: string | null;
  attempts: number;
  lastError: string | null;
};
