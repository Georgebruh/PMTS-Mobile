// Feature I — every rule about what a maintenance report must contain before
// it may be submitted. Import-pure like src/wo/actions.ts: the Node harness
// compiles this standalone and exhausts it before a device ever runs it.
//
// The mutation layer re-runs these against the record it re-fetched INSIDE the
// write transaction. The screen's copy of the form can be a sync round out of
// date by the time a finger lands on Submit.

/** The four report outcomes. Green closes the loop; anything else makes the
 *  server spawn a rework work order — the app only reports, it never spawns. */
export const REPORT_STATUS_COLORS = ['green', 'orange', 'red', 'black'] as const;
export type ReportStatusColor = (typeof REPORT_STATUS_COLORS)[number];

/** Frozen during planning: photos are optional, and capped at three. Apps
 *  Script carries these as base64 in a request body — this is a real limit,
 *  not a style preference. */
export const MAX_PHOTOS = 3;

// Sheet cells have to stay readable by a human scrolling the backend.
export const MAX_ACTION_TAKEN = 2000;
export const MAX_PARAM_NAME = 60;
export const MAX_PARAM_UNIT = 20;
export const MAX_PARAM_VALUE = 40;

/** Trim and collapse inner whitespace runs, exactly like normalizeCrewName. */
export function normalizeText(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Action Taken keeps its newlines — it is a narrative field and a tech may
 * legitimately write steps on separate lines. Only the outer edges are trimmed
 * and runs of blank lines collapsed.
 */
export function normalizeActionTaken(raw: string): string {
  return raw.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
}

export function isReportStatusColor(value: unknown): value is ReportStatusColor {
  return (
    typeof value === 'string' &&
    (REPORT_STATUS_COLORS as readonly string[]).includes(value)
  );
}

// ---------- parameters ----------

/** One parameter row as the form holds it, before it becomes a DB record. */
export type ParamDraft = {
  /** Stable identity for React keys and for matching an existing row.
   *  Undefined `id` means "not yet in the database". */
  key: string;
  id?: string;
  name: string;
  unit: string;
  value: string;
};

export type ParamIssue = { index: number; message: string };

/**
 * A parameter row is either COMPLETE (name + value) or ENTIRELY BLANK. A blank
 * row is not an error — it is the empty row the form always keeps at the
 * bottom, and it is dropped on save. A half-filled row IS an error: it means
 * the user meant something and did not finish, and silently dropping it would
 * lose a measurement they believe they recorded.
 */
export function isBlankParam(row: ParamDraft): boolean {
  return (
    normalizeText(row.name) === '' &&
    normalizeText(row.unit) === '' &&
    normalizeText(row.value) === ''
  );
}

export function validateParams(rows: readonly ParamDraft[]): ParamIssue[] {
  const issues: ParamIssue[] = [];
  const seen = new Map<string, number>();

  rows.forEach((row, index) => {
    if (isBlankParam(row)) return;

    const name = normalizeText(row.name);
    const value = normalizeText(row.value);

    if (name === '') {
      issues.push({ index, message: 'Give this parameter a name, or clear the row.' });
    } else if (name.length > MAX_PARAM_NAME) {
      issues.push({ index, message: `Keep the name under ${MAX_PARAM_NAME} characters.` });
    } else {
      // Two rows named the same measurement make the report ambiguous to the
      // approver. Case-insensitive, same as crew names.
      const folded = name.toLowerCase();
      const first = seen.get(folded);
      if (first !== undefined) {
        issues.push({ index, message: `"${name}" is already listed on row ${first + 1}.` });
      } else {
        seen.set(folded, index);
      }
    }

    if (value === '') {
      issues.push({ index, message: 'Enter a measured value, or clear the row.' });
    } else if (value.length > MAX_PARAM_VALUE) {
      issues.push({ index, message: `Keep the value under ${MAX_PARAM_VALUE} characters.` });
    }

    if (normalizeText(row.unit).length > MAX_PARAM_UNIT) {
      issues.push({ index, message: `Keep the unit under ${MAX_PARAM_UNIT} characters.` });
    }
  });

  return issues;
}

// ---------- the whole report ----------

/** What Submit is judged against — the form's own state, not a DB row, so the
 *  screen can validate live while the user types. */
export type ReportDraftView = {
  actionTaken: string;
  statusColor: string | null;
  hasSignature: boolean;
  params: readonly ParamDraft[];
  photoCount: number;
};

export type ReportField = 'actionTaken' | 'statusColor' | 'signature' | 'params' | 'photos';
export type ReportIssue = { field: ReportField; message: string };

/**
 * Every reason this report cannot be submitted, not just the first — the
 * screen marks all offending fields at once rather than making the user
 * discover them one Submit at a time.
 *
 * Required (frozen in planning): Action Taken, status colour, signature.
 * Photos are optional; the cap is still enforced because a form bug must not
 * be able to queue a fourth upload.
 */
export function validateSubmit(view: ReportDraftView): ReportIssue[] {
  const issues: ReportIssue[] = [];

  const action = normalizeActionTaken(view.actionTaken);
  if (action === '') {
    issues.push({ field: 'actionTaken', message: 'Describe the action taken.' });
  } else if (action.length > MAX_ACTION_TAKEN) {
    issues.push({
      field: 'actionTaken',
      message: `Keep the action under ${MAX_ACTION_TAKEN} characters.`,
    });
  }

  if (!isReportStatusColor(view.statusColor)) {
    issues.push({ field: 'statusColor', message: 'Choose the equipment status.' });
  }

  if (!view.hasSignature) {
    issues.push({ field: 'signature', message: 'Add a signature.' });
  }

  if (view.photoCount > MAX_PHOTOS) {
    issues.push({ field: 'photos', message: `Attach at most ${MAX_PHOTOS} photos.` });
  }

  for (const issue of validateParams(view.params)) {
    issues.push({ field: 'params', message: `Row ${issue.index + 1}: ${issue.message}` });
  }

  return issues;
}

export function canSubmit(view: ReportDraftView): boolean {
  return validateSubmit(view).length === 0;
}

/**
 * True when the user has entered nothing worth keeping. Drives the Close path:
 * an untouched draft is destroyed rather than left behind inflating the
 * dashboard's Unfinished count with a report that says nothing.
 */
export function isUntouchedDraft(view: ReportDraftView): boolean {
  return (
    normalizeActionTaken(view.actionTaken) === '' &&
    view.statusColor === null &&
    !view.hasSignature &&
    view.photoCount === 0 &&
    view.params.every(isBlankParam)
  );
}
