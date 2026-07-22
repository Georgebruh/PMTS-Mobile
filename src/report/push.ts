// Feature I — what must never leave the device.
//
// Import-pure (no database, no react-native) so the Node harness compiles it
// standalone, exactly like src/wo/actions.ts.
//
// Three things are stripped from every push:
//
//   pending_uploads      Local-only by design: it holds file:// URIs, and
//                        `photo_urls` may only ever contain final Drive URLs
//                        (design gap #6). The gateway would ignore the table
//                        anyway — this is the belt to that braces.
//
//   draft reports        Frozen Feature I decision: a draft never reaches the
//                        sheet. This is what keeps parameter rows editable.
//                        The gateway ignores `deleted` arrays and every pull is
//                        a full snapshot, so a param row that had once synced
//                        could not be removed without the next pull bringing it
//                        back — and freezing rows mid-edit on the app's longest
//                        form is not acceptable. Never sending them removes the
//                        problem instead of managing it.
//
//   draft reports' params  Filtered by PARENT, not by anything on the row
//                        itself: a param can be added to a draft whose own row
//                        is unchanged and therefore absent from this batch.
//                        Matching on the batch alone would leak it.
//
// ⚠️ The cost, and why submitReport() exists in the shape it does: WatermelonDB
// marks every record it computed as synced once the push resolves — including
// the ones stripped here, which never reached the server. So a report's params
// can sit marked 'synced' while the sheet has never seen them. submitReport()
// therefore TOUCHES every child row to force it dirty again. Remove that touch
// and submitted reports arrive in the sheet with no parameters.

/** WatermelonDB's raw record shape, as far as this module needs to care. */
export type RawRecord = { id: string; [column: string]: unknown };

export type TableChanges = {
  created: RawRecord[];
  updated: RawRecord[];
  deleted: string[];
};

export type ChangeSet = Record<string, TableChanges>;

/** Tables that are never pushed under any circumstances. */
export const LOCAL_ONLY_TABLES: readonly string[] = ['pending_uploads'];

/**
 * Sheets and raw columns disagree about how a boolean looks depending on which
 * layer wrote it, so accept every spelling rather than trusting one.
 */
function isDraftRaw(record: RawRecord): boolean {
  const v = record.is_draft;
  return v === true || v === 1 || v === '1' || v === 'true';
}

function isEmpty(changes: TableChanges): boolean {
  return (
    changes.created.length === 0 && changes.updated.length === 0 && changes.deleted.length === 0
  );
}

function filterTable(
  changes: TableChanges,
  keep: (record: RawRecord) => boolean,
): TableChanges {
  return {
    created: changes.created.filter(keep),
    updated: changes.updated.filter(keep),
    // Deleted ids carry no columns to test, and the gateway discards the array
    // regardless — pass it through untouched rather than guessing.
    deleted: changes.deleted,
  };
}

/**
 * Returns a new ChangeSet with everything local-only removed. Never mutates
 * its argument: WatermelonDB reuses the object it handed us to decide what to
 * mark as synced, and editing it in place would corrupt that bookkeeping.
 *
 * Tables left with nothing to say are dropped entirely — Apps Script request
 * bodies are a real constraint, and an empty table object is pure overhead.
 *
 * @param draftReportIds ids of every local report with is_draft = true, read
 *   from the database rather than inferred from `changes` (see the note on
 *   parent-filtering above).
 */
export function stripLocalOnlyChanges(
  changes: ChangeSet,
  draftReportIds: ReadonlySet<string>,
): ChangeSet {
  const out: ChangeSet = {};

  for (const table of Object.keys(changes)) {
    if (LOCAL_ONLY_TABLES.includes(table)) continue;

    const tableChanges = changes[table];
    let filtered: TableChanges;

    if (table === 'maintenance_reports') {
      filtered = filterTable(tableChanges, (record) => !isDraftRaw(record));
    } else if (table === 'report_parameters') {
      filtered = filterTable(
        tableChanges,
        (record) => !draftReportIds.has(String(record.report_id ?? '')),
      );
    } else {
      filtered = tableChanges;
    }

    if (!isEmpty(filtered)) out[table] = filtered;
  }

  return out;
}
