// Feature I — turning the form's parameter rows into database writes.
//
// The form holds ParamDraft[] in React state; the database holds ParamRecord
// rows. Reconciling the two is the kind of code that grows quiet bugs (a row
// updated instead of created, a sort_order left with a hole after a delete), so
// it lives here as ONE pure function the harness can exhaust with permutations.
//
// Import-pure: no database, no react-native.

import { isBlankParam, normalizeText, type ParamDraft } from './validation';
import type { ParamRecord } from './types';

/** What the mutation layer must do, expressed as data so it can be asserted
 *  without touching a database. */
export type ParamWrite = {
  name: string;
  unit: string;
  value: string;
  sortOrder: number;
};

export type ParamPlan = {
  create: ParamWrite[];
  update: (ParamWrite & { id: string })[];
  /** Row ids to destroy — rows the user removed from the form. */
  destroy: string[];
};

/**
 * sort_order is ALWAYS the row's index in the visible form, renumbered from
 * zero on every save. Deleting the middle row therefore closes the gap
 * automatically instead of leaving 0,2,3 behind — which would eventually
 * collide once a later insert reused a number.
 *
 * Blank rows are dropped, not written: the form always keeps a trailing empty
 * row for the next entry, and that row is not data. (validateSubmit rejects
 * HALF-filled rows separately, so nothing meaningful is silently discarded
 * here — a row reaching this function is either complete or entirely empty.)
 *
 * Destroy is safe on this table in a way it is NOT on work_order_crew: draft
 * reports and their parameters are never pushed, so a deleted row has no sheet
 * counterpart for the next full-snapshot pull to resurrect. That is precisely
 * what the drafts-never-sync decision bought.
 */
export function planParamWrites(
  drafts: readonly ParamDraft[],
  existing: readonly ParamRecord[],
): ParamPlan {
  const plan: ParamPlan = { create: [], update: [], destroy: [] };

  const kept = new Set<string>();
  let sortOrder = 0;

  for (const draft of drafts) {
    if (isBlankParam(draft)) continue;

    const write: ParamWrite = {
      name: normalizeText(draft.name),
      unit: normalizeText(draft.unit),
      value: normalizeText(draft.value),
      sortOrder,
    };
    sortOrder += 1;

    // A draft carrying an id that no longer exists (the row was destroyed by
    // another path between render and save) becomes a create, not a lost edit.
    if (draft.id !== undefined && existing.some((row) => row.id === draft.id)) {
      kept.add(draft.id);
      plan.update.push({ ...write, id: draft.id });
    } else {
      plan.create.push(write);
    }
  }

  for (const row of existing) {
    if (!kept.has(row.id)) plan.destroy.push(row.id);
  }

  return plan;
}

/** True when the plan would change nothing — lets the mutation layer skip an
 *  entire write transaction on a no-op save. */
export function isNoopPlan(plan: ParamPlan): boolean {
  return plan.create.length === 0 && plan.update.length === 0 && plan.destroy.length === 0;
}

// ---------- form-side helpers ----------

let keySeed = 0;

/** Form-only identity. Never persisted — `id` is the database's business. */
export function newParamKey(): string {
  keySeed += 1;
  return `p${keySeed}`;
}

export function blankParam(): ParamDraft {
  return { key: newParamKey(), name: '', unit: '', value: '' };
}

/** Existing rows → form drafts, in stored order (nulls last, then id so the
 *  order is stable across reopens of the same draft). */
export function draftsFromRecords(rows: readonly ParamRecord[]): ParamDraft[] {
  return [...rows].sort(paramCompare).map((row) => ({
    key: row.id,
    id: row.id,
    name: row.paramName ?? '',
    unit: row.unit ?? '',
    value: row.measuredValue ?? '',
  }));
}

export function paramCompare(a: ParamRecord, b: ParamRecord): number {
  const aOrder = a.sortOrder ?? Number.POSITIVE_INFINITY;
  const bOrder = b.sortOrder ?? Number.POSITIVE_INFINITY;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.id.localeCompare(b.id);
}

/**
 * The form's invariant: exactly one trailing blank row, always. Called after
 * every edit so the user never has to press "add" — and so a form that somehow
 * lost its blank row cannot become un-addable.
 */
export function withTrailingBlank(drafts: readonly ParamDraft[]): ParamDraft[] {
  const filled = drafts.filter((row, index) => !isBlankParam(row) || index === drafts.length - 1);
  if (filled.length === 0 || !isBlankParam(filled[filled.length - 1])) {
    return [...filled, blankParam()];
  }
  return filled;
}
