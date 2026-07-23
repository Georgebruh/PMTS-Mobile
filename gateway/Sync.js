/**
 * WatermelonDB synchronize() endpoints — Feature C.
 *
 * POST /sync/pull  body: { token, last_pulled_at, schema_version }
 *   → { ok: true, changes, timestamp }
 *   Full snapshot: every row the caller may see arrives in each table's
 *   `updated` array on every pull (the client syncs with sendCreatedAsUpdated
 *   semantics — unknown ids insert, known ids update). `created` and `deleted`
 *   stay empty: this backend never hard-deletes; `active`/status columns
 *   govern visibility. Snapshot-over-incremental is deliberate — hand-edited
 *   sheet rows carry no reliable updated_at, and Apps Script reads whole tabs
 *   either way.
 *
 * POST /sync/push  body: { token, last_pulled_at, changes }
 *   → { ok: true }
 *   Upserts by `id` (client_uuid), addressing cells by header name so sheet
 *   column order never matters. The server stamps `updated_at` (and
 *   `created_at` on insert); re-pushing the same batch is idempotent — that is
 *   the "flush exactly once" guarantee. Client values win over concurrent
 *   sheet edits (last-writer-wins, accepted for v1). `users`, sheet-owned
 *   tables, unknown tables, and `deleted` arrays are ignored.
 *
 * NB: the token rides in the POST body because Apps Script web apps cannot
 * read HTTP request headers.
 *
 * Scope matrix (server-enforced; the app only mirrors):
 *   assets / work_orders — L1: site ∈ assigned_area AND (assigned_locations
 *     empty OR location ∈ assigned_locations); L2: site ∈ assigned_area.
 *   users — active role-1/2 users sharing an area with the caller, minus pin.
 *   pms_schedule / asset_history — via visible assets.
 *   maintenance_reports — via visible work orders or assets.
 *   work_order_crew — via visible work orders; report_parameters — via
 *     visible reports.
 *
 * Date columns ('ms' types) accept real date cells or ISO text in the sheet;
 * a bare number is taken as unix ms. The wire format is unix ms both ways.
 */

// Column types: s string · n number · b boolean · ms unix-ms date; '?' = the
// schema column is optional (empty cell → null instead of ''/0).
// `push: false` tables are sheet-owned — client pushes to them are ignored.
var TABLE_SPECS = {
  users: {
    push: false,
    columns: {
      user_code: 's', full_name: 's', email: 's', role_level: 'n',
      is_lead: 'b', assigned_area: 's', assigned_locations: 's?', active: 'b',
    },
  },
  assets: {
    push: false,
    columns: {
      asset_code: 's', equipment_name: 's', equipment_no: 's', tier: 'n',
      site: 's', location: 's', code: 's', asset_number: 's?', asset_type: 's',
      specs: 's?', health_pct: 'n?', current_status_color: 's',
      in_charge_email: 's', active: 'b',
    },
  },
  pms_schedule: {
    push: false,
    columns: {
      schedule_code: 's', asset_id: 's', week_no: 'n', due_date: 'ms',
      frequency_type: 's', generated: 'b',
    },
  },
  work_orders: {
    push: true,
    columns: {
      wo_code: 's', asset_id: 's', tier: 'n', wo_type: 's',
      source_report_id: 's?', status: 's', assigned_to: 's?',
      assigned_by: 's?', assigned_at: 'ms?', due_date: 'ms?', created_by: 's',
      started_at: 'ms?', ended_at: 'ms?', site: 's', location: 's',
    },
  },
  work_order_crew: {
    push: true,
    columns: {
      crew_code: 's', work_order_id: 's', worker_name: 's', added_by: 's',
    },
  },
  maintenance_reports: {
    push: true,
    columns: {
      report_code: 's', work_order_id: 's', asset_id: 's', action_taken: 's?',
      status_color: 's?', photo_urls: 's?', signature_url: 's?',
      reporter_user_id: 's', is_draft: 'b', submitted_at: 'ms?',
      approval_status: 's', approved_by: 's?', approved_at: 'ms?',
    },
  },
  report_parameters: {
    push: true,
    columns: {
      param_code: 's', report_id: 's', param_name: 's', unit: 's?',
      measured_value: 's', sort_order: 'n?',
    },
  },
  asset_history: {
    push: true,
    columns: {
      history_code: 's', asset_id: 's', event_type: 's', work_order_id: 's?',
      report_id: 's?', status_color: 's?', actor: 's?', notes: 's?',
      event_at: 'ms',
    },
  },
};

function handlePull_(body) {
  var auth = authCaller_(body);
  if (auth.ok !== true) return auth;
  var caller = auth.caller;

  var role = Number(caller.role_level);
  var areas = splitList_(caller.assigned_area);
  var locations = role === 1 ? splitList_(caller.assigned_locations) : [];

  var inScope = function (row) {
    if (areas.indexOf(norm_(row.site)) < 0) return false;
    return locations.length === 0 || locations.indexOf(norm_(row.location)) >= 0;
  };

  var users = readTable_('users').filter(function (row) {
    if (rowId_(row) === auth.uid) return true;
    var r = Number(row.role_level);
    return (
      isTruthyCell_(row.active) &&
      (r === 1 || r === 2) &&
      intersects_(splitList_(row.assigned_area), areas)
    );
  });

  var assets = readTable_('assets').filter(inScope);
  var workOrders = readTable_('work_orders').filter(inScope);
  var assetIds = idSet_(assets);
  var woIds = idSet_(workOrders);

  var pms = readTable_('pms_schedule').filter(function (r) {
    return inSet_(assetIds, r.asset_id);
  });
  var crew = readTable_('work_order_crew').filter(function (r) {
    return inSet_(woIds, r.work_order_id);
  });
  var reports = readTable_('maintenance_reports').filter(function (r) {
    return inSet_(woIds, r.work_order_id) || inSet_(assetIds, r.asset_id);
  });
  var reportIds = idSet_(reports);
  var params = readTable_('report_parameters').filter(function (r) {
    return inSet_(reportIds, r.report_id);
  });
  var history = readTable_('asset_history').filter(function (r) {
    return inSet_(assetIds, r.asset_id);
  });

  return {
    ok: true,
    changes: {
      users: snapshot_('users', users),
      assets: snapshot_('assets', assets),
      pms_schedule: snapshot_('pms_schedule', pms),
      work_orders: snapshot_('work_orders', workOrders),
      work_order_crew: snapshot_('work_order_crew', crew),
      maintenance_reports: snapshot_('maintenance_reports', reports),
      report_parameters: snapshot_('report_parameters', params),
      asset_history: snapshot_('asset_history', history),
    },
    timestamp: Date.now(),
  };
}

function handlePush_(body) {
  var auth = authCaller_(body);
  if (auth.ok !== true) return auth;

  var changes = (body && body.changes) || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(30 * 1000); // serialize writers; timeout throws → server_error
  try {
    Object.keys(TABLE_SPECS).forEach(function (table) {
      if (!TABLE_SPECS[table].push) return;
      var tableChanges = changes[table];
      if (!tableChanges) return;
      var records = [].concat(tableChanges.created || [], tableChanges.updated || []);
      if (records.length) pushTable_(table, records);
      // tableChanges.deleted is ignored — no hard deletes in this backend.
    });

    // Feature L — the approval loop the spec puts server-side. The app only
    // ever stamps approval_status/approved_by/approved_at on a report; every
    // consequence (close, rework spawn, send-back) is reconciled here, still
    // under this lock. Guarded on the push actually carrying reports so an
    // ordinary work-order push does not pay for a full three-tab scan.
    if (changes.maintenance_reports) reconcileApprovals_();

    // Feature M — turn the just-landed state into push notifications, AFTER
    // reconcile so server-spawned rework/unassigned WOs also notify. Still under
    // this lock (like Upload.js's Drive write) so a concurrent push cannot claim
    // the same event keys and double-ring. Guarded on the tables that can
    // produce a notification so an unrelated push pays nothing.
    if (changes.work_orders || changes.maintenance_reports) dispatchNotifications_();
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

/**
 * Feature L — turns a just-pushed approval decision into its consequences.
 * Runs inside handlePush_'s lock, reading the tabs AFTER the upserts so it sees
 * the decision the app just wrote.
 *
 *   APPROVED + green      → close the work order            (+ REPORT_APPROVED)
 *   APPROVED + non-green  → close it AND spawn a REPAIR      (+ REPORT_APPROVED,
 *                           rework order linked by             REWORK_CREATED)
 *                           source_report_id
 *   REJECTED              → send the work order back to      (+ REPORT_REJECTED)
 *                           COMPLETED for revision
 *
 * IDEMPOTENT two ways: every branch acts only while the work order is still
 * PENDING_APPROVAL (once it moves to CLOSED/COMPLETED a re-push is a no-op), and
 * the rework spawn additionally checks that no work order already carries this
 * report's id in source_report_id — so a decision that syncs twice can never
 * double-close, double-send-back, or double-spawn.
 *
 * This is also the first place the backend ASSIGNS DISPLAY CODES (wo_code,
 * history_code) to rows it creates — the standing blank-code gap, answered for
 * server-authored rows.
 */
function reconcileApprovals_() {
  var reports = readTable_('maintenance_reports');
  var wos = readTable_('work_orders');
  var assets = readTable_('assets');
  var users = readTable_('users');

  var woById = {};
  wos.forEach(function (w) { woById[rowId_(w)] = w; });
  var assetById = {};
  assets.forEach(function (a) { assetById[rowId_(a)] = a; });
  var nameById = {};
  users.forEach(function (u) { nameById[rowId_(u)] = String(u.full_name || ''); });
  var reworkExists = {};
  wos.forEach(function (w) {
    var src = String(w.source_report_id == null ? '' : w.source_report_id).trim();
    if (src) reworkExists[src] = true;
  });

  var woWrites = [];
  var historyWrites = [];
  var now = Date.now();

  reports.forEach(function (r) {
    var reportId = rowId_(r);
    var decision = String(r.approval_status == null ? '' : r.approval_status).trim().toUpperCase();
    if (decision !== 'APPROVED' && decision !== 'REJECTED') return;

    var wo = woById[String(r.work_order_id == null ? '' : r.work_order_id).trim()];
    if (!wo) return;
    // The idempotency gate: only a work order still awaiting approval is acted
    // on. After this run it is CLOSED or COMPLETED, so a re-push does nothing.
    if (norm_(wo.status) !== 'pending_approval') return;

    var reviewer = nameById[String(r.approved_by == null ? '' : r.approved_by).trim()] || '';

    if (decision === 'REJECTED') {
      woWrites.push({ id: rowId_(wo), status: 'COMPLETED' });
      historyWrites.push(historyRow_(rowId_(wo), r, 'REPORT_REJECTED', reviewer, now));
      return;
    }

    // APPROVED — the report is accepted; the work order closes either way.
    woWrites.push({ id: rowId_(wo), status: 'CLOSED' });
    historyWrites.push(historyRow_(rowId_(wo), r, 'REPORT_APPROVED', reviewer, now));

    // Non-green means the equipment still needs work: spawn one repair order,
    // unless one already exists for this report (the second idempotency gate).
    var green = norm_(r.status_color) === 'green';
    if (!green && !reworkExists[reportId]) {
      var asset = assetById[String(r.asset_id == null ? '' : r.asset_id).trim()] || {};
      var newWoId = Utilities.getUuid();
      woWrites.push({
        id: newWoId,
        wo_code: nextCode_('WO'),
        asset_id: r.asset_id,
        tier: Number(asset.tier) || 0,
        wo_type: 'REPAIR',
        source_report_id: reportId,
        status: 'UNASSIGNED',
        created_by: r.approved_by || '',
        site: asset.site || wo.site || '',
        location: asset.location || wo.location || '',
        created_at: now,
      });
      historyWrites.push(historyRow_(newWoId, r, 'REWORK_CREATED', reviewer, now));
      reworkExists[reportId] = true;
    }
  });

  // Batched by table so the whole reconcile is two sheet passes, not one per
  // report. pushTable_ upserts by id, so the status-only work-order writes patch
  // just that cell and the new rows insert.
  if (woWrites.length) pushTable_('work_orders', woWrites);
  if (historyWrites.length) pushTable_('asset_history', historyWrites);
}

/** Builds an asset_history record for a reconcile event. actor holds the
 *  reviewer's DISPLAY NAME (gap #11: HistoryTimeline prints actor verbatim, so
 *  an id would show as a raw UUID). */
function historyRow_(woId, report, eventType, actor, now) {
  return {
    id: Utilities.getUuid(),
    history_code: nextCode_('HIST'),
    asset_id: report.asset_id,
    event_type: eventType,
    work_order_id: woId,
    report_id: rowId_(report),
    status_color: report.status_color || '',
    actor: actor,
    notes: '',
    event_at: now,
    created_at: now,
  };
}

/**
 * A readable, unique display code: PREFIX-YYYY-NNNNNN. The counter lives in a
 * Script Property and is incremented under handlePush_'s lock, so it is
 * serialized against every other writer — no two calls can mint the same code.
 */
function nextCode_(prefix) {
  var props = PropertiesService.getScriptProperties();
  var key = 'SEQ_' + prefix;
  var n = Number(props.getProperty(key) || '0') + 1;
  props.setProperty(key, String(n));
  return prefix + '-' + new Date().getFullYear() + '-' + ('000000' + n).slice(-6);
}

/** Verifies the token and loads the caller's users row. */
function authCaller_(body) {
  var uid = verifyToken(body && body.token);
  if (!uid) return { ok: false, error: 'invalid_token' };
  var caller = findUserById_(uid);
  if (!caller) return { ok: false, error: 'invalid_token' };
  if (!isTruthyCell_(caller.active)) return { ok: false, error: 'inactive' };
  return { ok: true, uid: uid, caller: caller };
}

// ---------- pull helpers ----------

function readTable_(table) {
  var sheet = sheetForTable_(table);
  requireHeaders_(sheet, table);
  return readRows_(sheet);
}

function snapshot_(table, rows) {
  var updated = [];
  rows.forEach(function (row) {
    var rec = toRecord_(table, row);
    if (rec.id) updated.push(rec); // half-filled sheet rows without id: skip
  });
  return { created: [], updated: updated, deleted: [] };
}

function toRecord_(table, row) {
  var spec = TABLE_SPECS[table].columns;
  var rec = { id: rowId_(row) };
  Object.keys(spec).forEach(function (col) {
    rec[col] = fromCell_(row[col], spec[col]);
  });
  rec.created_at = toMs_(row.created_at) || 0;
  rec.updated_at = toMs_(row.updated_at) || 0;
  return rec;
}

function fromCell_(v, type) {
  var optional = type.charAt(type.length - 1) === '?';
  var base = optional ? type.slice(0, -1) : type;
  var empty = v == null || v === '';
  if (base === 'b') return isTruthyCell_(v);
  if (base === 'n') {
    if (empty) return optional ? null : 0;
    var n = Number(v);
    return isNaN(n) ? (optional ? null : 0) : n;
  }
  if (base === 'ms') {
    var ms = toMs_(v);
    return ms == null ? (optional ? null : 0) : ms;
  }
  if (empty) return optional ? null : '';
  return String(v);
}

// ---------- push helpers ----------

function pushTable_(table, records) {
  var sheet = sheetForTable_(table);
  requireHeaders_(sheet, table);

  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(normalizeHeader_);
  var col = {};
  headers.forEach(function (h, i) {
    if (h && !(h in col)) col[h] = i;
  });

  var rowByIdx = {}; // id → 0-based index into `values` (sheet row = idx + 1)
  for (var r = 1; r < values.length; r++) {
    var existingId = String(values[r][col.id] == null ? '' : values[r][col.id]).trim();
    if (existingId && !(existingId in rowByIdx)) rowByIdx[existingId] = r;
  }

  var spec = TABLE_SPECS[table].columns;
  var nowIso = new Date().toISOString();

  records.forEach(function (rec) {
    var id = String((rec && rec.id) || '').trim();
    if (!id) return;

    if (id in rowByIdx) {
      var idx = rowByIdx[id];
      var rowArr = values[idx]; // start from current cells → extra columns survive
      Object.keys(spec).forEach(function (c) {
        if (c in rec) rowArr[col[c]] = toCell_(rec[c], spec[c]);
      });
      rowArr[col.updated_at] = nowIso;
      sheet.getRange(idx + 1, 1, 1, rowArr.length).setValues([rowArr]);
    } else {
      var newArr = [];
      for (var i = 0; i < headers.length; i++) newArr.push('');
      newArr[col.id] = id;
      Object.keys(spec).forEach(function (c) {
        newArr[col[c]] = toCell_(rec[c], spec[c]);
      });
      var createdMs = toMs_(rec.created_at);
      newArr[col.created_at] = createdMs ? new Date(createdMs).toISOString() : nowIso;
      newArr[col.updated_at] = nowIso;
      sheet.appendRow(newArr);
      values.push(newArr); // appendRow lands at getLastRow()+1 === values.length
      rowByIdx[id] = values.length - 1;
    }
  });
}

function toCell_(v, type) {
  var base = type.charAt(type.length - 1) === '?' ? type.slice(0, -1) : type;
  if (v == null || v === '') return '';
  if (base === 'ms') {
    var n = Number(v);
    return isFinite(n) && n !== 0 ? new Date(n).toISOString() : '';
  }
  if (base === 'b') return !!v;
  if (base === 'n') {
    var num = Number(v);
    return isFinite(num) ? num : '';
  }
  return String(v);
}

// ---------- shared helpers ----------

function sheetForTable_(table) {
  return getSheet_(table === 'users' ? usersSheetName_() : table);
}

/** Fails loudly when a tab lacks a synced column — catches sheet-setup drift. */
function requireHeaders_(sheet, table) {
  var wanted = ['id', 'created_at', 'updated_at'].concat(Object.keys(TABLE_SPECS[table].columns));
  var have = sheet
    .getRange(1, 1, 1, Math.max(1, sheet.getLastColumn()))
    .getValues()[0]
    .map(normalizeHeader_);
  var missing = wanted.filter(function (h) {
    return have.indexOf(h) < 0;
  });
  if (missing.length) {
    throw new Error('sheet tab "' + sheet.getName() + '" is missing column(s): ' + missing.join(', '));
  }
}

function rowId_(row) {
  return String(row.id == null ? '' : row.id).trim();
}

function toMs_(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number' && isFinite(v)) return v; // bare number = unix ms
  var parsed = new Date(String(v)).getTime();
  return isNaN(parsed) ? null : parsed;
}

function norm_(v) {
  return String(v == null ? '' : v).trim().toLowerCase();
}

/** "MEZ2; CBU" → ['mez2', 'cbu'] */
function splitList_(v) {
  return String(v == null ? '' : v)
    .split(';')
    .map(function (s) {
      return s.trim().toLowerCase();
    })
    .filter(function (s) {
      return s.length > 0;
    });
}

function intersects_(a, b) {
  return a.some(function (x) {
    return b.indexOf(x) >= 0;
  });
}

function idSet_(rows) {
  var set = {};
  rows.forEach(function (row) {
    var id = rowId_(row);
    if (id) set[id] = true;
  });
  return set;
}

function inSet_(set, v) {
  return set[String(v == null ? '' : v).trim()] === true;
}
