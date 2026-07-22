// Feature I — the report's writes.
//
// Same contract as src/wo/mutations.ts (Feature H), for the same reasons:
//
//   1. Every mutation re-fetches its rows and re-runs the phase-3 guards INSIDE
//      the write transaction. The form was rendered from props that a sync
//      round can invalidate before a finger lands on Submit.
//   2. Every mutation is idempotent. A double tap must be a no-op, never a
//      second report and never an error the user has to interpret.
//   3. Failures come back as values, not exceptions.
//
// What is new here, and what most of the care is spent on: submit has to leave
// the database in a state the PUSH can represent correctly, and drafts are
// deliberately never pushed. See touchParams() below — without it a submitted
// report reaches the sheet with no parameters at all.

import { Q } from '@nozbe/watermelondb';

import { database } from '../database/database';
import type { Viewer } from '../wo/actions';
import { nextStatusFor } from '../wo/actions';
import type { WoRecord } from '../wo/types';
import { APPROVAL_PENDING, APPROVAL_REJECTED, isReportEditable, reportGate } from './actions';
import { planParamWrites } from './params';
import type { ParamRecord, ReportRecord, UploadRecord } from './types';
import { UPLOAD_KIND } from './urls';
import { retryPatch, UPLOAD_STATE } from './uploads';
import {
  canSubmit,
  isUntouchedDraft,
  MAX_PHOTOS,
  normalizeActionTaken,
  validateSubmit,
  type ParamDraft,
} from './validation';

export type MutationResult = { ok: true } | { ok: false; error: string };
export type OpenResult = { ok: true; reportId: string } | { ok: false; error: string };

const OK: MutationResult = { ok: true };
const fail = (error: string): MutationResult => ({ ok: false, error });

/** What the form holds. Photos and the signature live in pending_uploads, not
 *  here — they are files, and files have their own lifecycle. */
export type ReportForm = {
  actionTaken: string;
  statusColor: string | null;
  params: readonly ParamDraft[];
};

// query().fetch() rather than find() — a row removed by a sync must come back
// as "gone", not as a thrown record-not-found.
async function fetchOne(table: string, id: string): Promise<any | null> {
  const rows = await database.get(table).query(Q.where('id', id)).fetch();
  return rows.length > 0 ? rows[0] : null;
}

function reportsOf(woId: string): Promise<any[]> {
  return database.get('maintenance_reports').query(Q.where('work_order_id', woId)).fetch();
}

function paramsOf(reportId: string): Promise<any[]> {
  return database.get('report_parameters').query(Q.where('report_id', reportId)).fetch();
}

function uploadsOf(reportId: string): Promise<any[]> {
  return database.get('pending_uploads').query(Q.where('report_id', reportId)).fetch();
}

/**
 * Opens the report for a work order, creating the draft if there is none.
 *
 * One active report per work order (frozen decision): an existing draft is
 * REOPENED rather than joined by a second one, which is also what makes the
 * Complete button idempotent — tapping it twice lands on the same report.
 */
export async function openOrCreateDraft(woId: string, viewer: Viewer): Promise<OpenResult> {
  try {
    return await database.write(async () => {
      const wo = await fetchOne('work_orders', woId);
      if (wo === null) return { ok: false as const, error: 'This work order is no longer available.' };

      const gate = reportGate(wo as WoRecord, viewer);
      if (!gate.canFile) {
        return { ok: false as const, error: gate.blockedReason ?? 'This report cannot be opened.' };
      }

      const existing = await reportsOf(woId);
      const draft = existing.find((r: any) => r.isDraft === true);
      if (draft) return { ok: true as const, reportId: draft.id };

      // A submitted report exists but the work order is still COMPLETED. That
      // is contradictory (submit moves it on), so refuse rather than open a
      // second report against the same job.
      if (existing.length > 0) {
        return {
          ok: false as const,
          error: 'A report has already been filed for this work order.',
        };
      }

      const created = await database.get('maintenance_reports').create((r: any) => {
        r.workOrder.id = woId;
        r.asset.id = wo.asset.id; // denormalized, exactly as the WO carries it
        r.reportCode = ''; // display codes are server-owned
        r.reporterUserId = viewer.userId;
        r.isDraft = true;
        r.approvalStatus = '';
        r.actionTaken = '';
        r.statusColor = null;
        r.photoUrls = null;
        r.signatureUrl = null;
      });
      return { ok: true as const, reportId: created.id };
    });
  } catch (e) {
    console.warn('openOrCreateDraft failed:', e);
    return { ok: false, error: 'Could not open the report. Please try again.' };
  }
}

/**
 * Persists the form without submitting — the Draft and Close exits.
 *
 * Deliberately does NOT validate: a draft is allowed to be incomplete, that is
 * the entire point of drafting. Only Submit judges.
 */
export async function saveDraft(
  reportId: string,
  viewer: Viewer,
  form: ReportForm,
): Promise<MutationResult> {
  try {
    return await database.write(async () => {
      const report = await fetchOne('maintenance_reports', reportId);
      if (report === null) return fail('This report is no longer available.');
      if (!isReportEditable(report as ReportRecord)) {
        return fail('This report has been submitted and can no longer be edited.');
      }

      const gate = reportGate((await fetchOne('work_orders', report.workOrder.id)) as WoRecord, viewer);
      if (!gate.canFile) return fail(gate.blockedReason ?? 'This report cannot be edited.');

      await applyForm(report, form);
      return OK;
    });
  } catch (e) {
    console.warn('saveDraft failed:', e);
    return fail('Could not save the report. Please try again.');
  }
}

/** Writes the scalar fields and reconciles the parameter rows. Must be called
 *  inside a write transaction. */
async function applyForm(report: any, form: ReportForm): Promise<void> {
  await report.update((r: any) => {
    r.actionTaken = normalizeActionTaken(form.actionTaken);
    r.statusColor = form.statusColor;
  });

  const existing = (await paramsOf(report.id)) as ParamRecord[];
  const plan = planParamWrites(form.params, existing);

  for (const write of plan.create) {
    await database.get('report_parameters').create((p: any) => {
      p.report.id = report.id;
      p.paramCode = ''; // server-owned
      p.paramName = write.name;
      p.unit = write.unit;
      p.measuredValue = write.value;
      p.sortOrder = write.sortOrder;
    });
  }

  for (const write of plan.update) {
    const row = existing.find((r) => r.id === write.id) as any;
    if (!row) continue;
    await row.update((p: any) => {
      p.paramName = write.name;
      p.unit = write.unit;
      p.measuredValue = write.value;
      p.sortOrder = write.sortOrder;
    });
  }

  for (const id of plan.destroy) {
    const row = existing.find((r) => r.id === id) as any;
    // destroyPermanently, not markAsDeleted: draft parameters have never been
    // pushed, so there is no sheet row for a pull to resurrect. This is the
    // freedom the drafts-never-sync decision bought — contrast Feature H's
    // crew rows, which can only be removed while unsynced.
    if (row) await row.destroyPermanently();
  }
}

/**
 * ⚠️ Load-bearing. Marks every parameter row dirty so the push includes it.
 *
 * WatermelonDB marks records synced once a push resolves — including the ones
 * syncEngine stripped from the payload, which never reached the sheet. So a
 * draft's parameters can sit marked 'synced' while the server has never seen
 * them. Submitting is the moment they become sendable, and touching them here
 * is what actually sends them. Delete this and submitted reports arrive in the
 * sheet with no parameters, silently.
 */
async function touchParams(reportId: string): Promise<void> {
  const rows = await paramsOf(reportId);
  for (const row of rows as any[]) {
    await row.update((p: any) => {
      p.sortOrder = p.sortOrder; // no semantic change; marks the row updated
    });
  }
}

/**
 * Submit — the report's one-way door. Validates, stamps, flips the work order
 * to PENDING_APPROVAL, and makes the whole tree pushable.
 *
 * Photos still uploading are fine: photo_urls fills in later, by the uploader,
 * on a subsequent push. Blocking submit on a Drive round-trip would mean a tech
 * in a basement cannot finish their job, which is precisely the situation this
 * app exists for.
 */
export async function submitReport(
  reportId: string,
  viewer: Viewer,
  form: ReportForm,
): Promise<MutationResult> {
  try {
    return await database.write(async () => {
      const report = await fetchOne('maintenance_reports', reportId);
      if (report === null) return fail('This report is no longer available.');

      // Idempotent: an already-submitted report is success, not a duplicate
      // stamp and not an error to interpret.
      if (report.isDraft === false) return OK;

      const wo = await fetchOne('work_orders', report.workOrder.id);
      if (wo === null) return fail('This work order is no longer available.');

      const gate = reportGate(wo as WoRecord, viewer);
      if (!gate.canFile) return fail(gate.blockedReason ?? 'This report cannot be submitted.');

      const uploads = (await uploadsOf(reportId)) as UploadRecord[];
      const view = {
        actionTaken: form.actionTaken,
        statusColor: form.statusColor,
        hasSignature: uploads.some((u) => u.kind === UPLOAD_KIND.SIGNATURE),
        params: form.params,
        photoCount: uploads.filter((u) => u.kind === UPLOAD_KIND.PHOTO).length,
      };
      if (!canSubmit(view)) {
        return fail(validateSubmit(view)[0]?.message ?? 'This report is not complete.');
      }

      await applyForm(report, form);
      await touchParams(reportId);

      await report.update((r: any) => {
        r.isDraft = false;
        r.submittedAt = new Date();
        r.approvalStatus = APPROVAL_PENDING;
      });

      await wo.update((w: any) => {
        w.status = nextStatusFor('submitReport');
      });

      return OK;
    });
  } catch (e) {
    console.warn('submitReport failed:', e);
    return fail('Could not submit the report. Please try again.');
  }
}

/**
 * Close with nothing entered: remove the draft rather than leave it inflating
 * the dashboard's Unfinished count with a report that says nothing.
 *
 * Returns the file URIs it orphaned so the caller can delete them — file I/O
 * has no business inside a database transaction.
 */
export async function discardDraftIfUntouched(
  reportId: string,
  form: ReportForm,
): Promise<{ discarded: boolean; orphanedUris: string[] }> {
  try {
    return await database.write(async () => {
      const report = await fetchOne('maintenance_reports', reportId);
      if (report === null || report.isDraft !== true) {
        return { discarded: false, orphanedUris: [] };
      }

      const uploads = (await uploadsOf(reportId)) as UploadRecord[];
      const view = {
        actionTaken: form.actionTaken,
        statusColor: form.statusColor,
        hasSignature: uploads.some((u) => u.kind === UPLOAD_KIND.SIGNATURE),
        params: form.params,
        photoCount: uploads.filter((u) => u.kind === UPLOAD_KIND.PHOTO).length,
      };
      if (!isUntouchedDraft(view)) return { discarded: false, orphanedUris: [] };

      const uris: string[] = [];
      for (const row of (await uploadsOf(reportId)) as any[]) {
        uris.push(row.localUri);
        await row.destroyPermanently();
      }
      for (const row of (await paramsOf(reportId)) as any[]) {
        await row.destroyPermanently();
      }
      await report.destroyPermanently();

      return { discarded: true, orphanedUris: uris };
    });
  } catch (e) {
    console.warn('discardDraftIfUntouched failed:', e);
    return { discarded: false, orphanedUris: [] };
  }
}

/**
 * Feature L — reopens a report an L2 REJECTED (sent back for revision).
 *
 * The reject loop is deliberately explicit rather than automatic: the gateway's
 * reconcileApprovals_ returns the work order to COMPLETED and leaves the report
 * submitted (is_draft = false, approval_status = REJECTED) — it does NOT
 * silently un-submit. This mutation is the L1's conscious "Revise report" tap,
 * which is the only thing that flips the report back to a draft.
 *
 * Guarded exactly like the report's other writes: it is still the assignee's
 * own COMPLETED work order (reportGate.canFile), and the report is genuinely a
 * rejected one. Idempotent — a report already back in draft is success.
 *
 * Known v1 edge (accepted, drafts-never-sync tradeoff): the report's parameters
 * already synced on the first submit, so REMOVING a param row during revision
 * would let the next full-snapshot pull resurrect it. Editing values and
 * resubmitting is clean; row removal is the rare exception.
 */
export async function reopenForRevision(reportId: string, viewer: Viewer): Promise<MutationResult> {
  try {
    return await database.write(async () => {
      const report = await fetchOne('maintenance_reports', reportId);
      if (report === null) return fail('This report is no longer available.');

      // Idempotent: already a draft (a second tap) is success.
      if (report.isDraft === true) return OK;
      if (report.approvalStatus !== APPROVAL_REJECTED) {
        return fail('This report was not sent back for revision.');
      }

      const wo = await fetchOne('work_orders', report.workOrder.id);
      if (wo === null) return fail('This work order is no longer available.');

      // reportGate.canFile is true exactly for the assignee's own COMPLETED work
      // order — which is where a rejected report's work order sits after the
      // server sends it back.
      const gate = reportGate(wo as WoRecord, viewer);
      if (!gate.canFile) return fail(gate.blockedReason ?? 'This report cannot be revised.');

      await report.update((r: any) => {
        r.isDraft = true;
        r.approvalStatus = ''; // a fresh draft again; submit re-stamps PENDING
      });
      return OK;
    });
  } catch (e) {
    console.warn('reopenForRevision failed:', e);
    return fail('Could not reopen the report. Please try again.');
  }
}

// ---------- files ----------

/**
 * Queues a photo. The caller has already copied the file somewhere durable —
 * the picker's cache directory can be reclaimed by Android before the upload
 * runs, and a queue entry pointing at a reclaimed file is a guaranteed failure.
 */
export async function addPhoto(
  reportId: string,
  localUri: string,
  mime: string,
): Promise<MutationResult> {
  try {
    return await database.write(async () => {
      const report = await fetchOne('maintenance_reports', reportId);
      if (report === null) return fail('This report is no longer available.');
      if (!isReportEditable(report as ReportRecord)) {
        return fail('This report has been submitted and can no longer be edited.');
      }

      // Re-counted inside the transaction so two quick taps cannot both pass
      // a check made against the same rendered count.
      const photos = ((await uploadsOf(reportId)) as UploadRecord[]).filter(
        (u) => u.kind === UPLOAD_KIND.PHOTO,
      );
      if (photos.length >= MAX_PHOTOS) {
        return fail(`You can attach at most ${MAX_PHOTOS} photos.`);
      }

      const nextOrder = photos.reduce((max, u) => Math.max(max, u.sortOrder + 1), 0);
      await createUpload(reportId, UPLOAD_KIND.PHOTO, localUri, mime, nextOrder);
      return OK;
    });
  } catch (e) {
    console.warn('addPhoto failed:', e);
    return fail('Could not attach that photo. Please try again.');
  }
}

/**
 * Replaces the signature. Any previous one is destroyed rather than kept:
 * re-signing means the earlier drawing was wrong, and leaving it queued would
 * upload a signature the user rejected.
 */
export async function setSignature(
  reportId: string,
  localUri: string,
  mime: string,
): Promise<{ ok: true; orphanedUris: string[] } | { ok: false; error: string }> {
  try {
    return await database.write(async () => {
      const report = await fetchOne('maintenance_reports', reportId);
      if (report === null) return { ok: false as const, error: 'This report is no longer available.' };
      if (!isReportEditable(report as ReportRecord)) {
        return {
          ok: false as const,
          error: 'This report has been submitted and can no longer be edited.',
        };
      }

      const orphanedUris: string[] = [];
      for (const row of (await uploadsOf(reportId)) as any[]) {
        if (row.kind !== UPLOAD_KIND.SIGNATURE) continue;
        orphanedUris.push(row.localUri);
        await row.destroyPermanently();
      }

      await createUpload(reportId, UPLOAD_KIND.SIGNATURE, localUri, mime, 0);
      return { ok: true as const, orphanedUris };
    });
  } catch (e) {
    console.warn('setSignature failed:', e);
    return { ok: false, error: 'Could not save the signature. Please try again.' };
  }
}

/** Removes a queued file. Always safe: pending_uploads is local-only, so there
 *  is no server copy for a pull to bring back. */
export async function removeUpload(
  uploadId: string,
): Promise<{ ok: true; orphanedUri: string | null } | { ok: false; error: string }> {
  try {
    return await database.write(async () => {
      const row = await fetchOne('pending_uploads', uploadId);
      if (row === null) return { ok: true as const, orphanedUri: null }; // already gone

      const report = await fetchOne('maintenance_reports', row.reportId);
      if (report !== null && !isReportEditable(report as ReportRecord)) {
        return {
          ok: false as const,
          error: 'This report has been submitted and can no longer be edited.',
        };
      }

      const uri = row.localUri as string;
      await row.destroyPermanently();
      return { ok: true as const, orphanedUri: uri };
    });
  } catch (e) {
    console.warn('removeUpload failed:', e);
    return { ok: false, error: 'Could not remove that file. Please try again.' };
  }
}

/**
 * Puts a failed file back in the queue.
 *
 * ⚠️ Deliberately NOT gated on isReportEditable, unlike every other mutation in
 * this file. Submit does not wait for Drive — that is a frozen decision, so a
 * tech in a basement can finish their job — which means the uploads most likely
 * to fail are precisely the ones still in flight when the report went
 * read-only. Gating retry on editability would strand photo_urls and
 * signature_url permanently empty in the sheet with no in-app remedy, and the
 * done-when asks for those URLs.
 *
 * Safe to allow after submit because pending_uploads is local-only queue state:
 * retrying changes nothing an approver can see except filling in a URL that was
 * always meant to be there. deriveUrls remains the only writer of the columns.
 *
 * Idempotent: a row that is already pending or already uploaded is a no-op.
 */
export async function retryUpload(uploadId: string): Promise<MutationResult> {
  try {
    return await database.write(async () => {
      const row = await fetchOne('pending_uploads', uploadId);
      if (row === null) return fail('That file is no longer queued.');
      if (row.state !== UPLOAD_STATE.FAILED) return OK;

      const patch = retryPatch(row as UploadRecord);
      await row.update((u: any) => {
        u.state = patch.state;
        u.remoteUrl = patch.remoteUrl;
        u.attempts = patch.attempts;
        u.lastError = patch.lastError;
      });
      return OK;
    });
  } catch (e) {
    console.warn('retryUpload failed:', e);
    return fail('Could not retry that upload. Please try again.');
  }
}

async function createUpload(
  reportId: string,
  kind: string,
  localUri: string,
  mime: string,
  sortOrder: number,
): Promise<void> {
  await database.get('pending_uploads').create((u: any) => {
    u.reportId = reportId;
    u.kind = kind;
    u.localUri = localUri;
    u.mime = mime;
    u.sortOrder = sortOrder;
    u.state = UPLOAD_STATE.PENDING;
    u.attempts = 0;
    u.remoteUrl = null;
    u.lastError = null;
  });
}
