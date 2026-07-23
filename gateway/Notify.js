/**
 * Feature M — the notification DECISION logic and its I/O.
 *
 * Phase 1 (pure): given the current sheet state, which pushes should exist, who
 * receives each, and how a re-run is deduped — notifyPlanForState_ and friends.
 * Phase 4 (I/O, lower in this file): the device_tokens tab, the register /
 * unregister endpoints, the Expo send over UrlFetchApp, and dispatchNotifications_
 * (wired into handlePush_ after reconcileApprovals_). The I/O leans on a few more
 * pure helpers (tokensForRecipients_, buildExpoMessages_, receiptsToDeactivate_)
 * so the harness can pin the message shape and the dead-token detection too.
 *
 * Everything here reuses Sync.js / Sheets.js helpers (splitList_, intersects_,
 * norm_, rowId_, isTruthyCell_) so area-matching cannot drift from the pull
 * scope the app already trusts — the Node harness loads all three files into
 * one sandbox and cross-checks exactly that.
 *
 * The event a push carries:
 *   { eventKey, kind, recipientUids, title, body, data }
 * `data` is recipient-AGNOSTIC here ({ kind, woId? , reportId? }); the sender
 * stamps each recipient's own id as `data.uid` at send time (phase 4), which is
 * what the app's shared-device guard checks. `eventKey` is what the dedup log
 * records so handlePush_ re-running never double-rings.
 */

var NOTIF_KIND = {
  WO_ASSIGNED: 'wo_assigned',
  REPORT_PENDING: 'report_pending',
  WO_UNASSIGNED: 'wo_unassigned',
};

/**
 * The dedup identity of an event — recorded in the notifications_log after a
 * send, checked before the next. A reassignment is a DISTINCT event because the
 * assignee id is part of the key, so the new assignee is notified while a plain
 * re-push of the same batch is not.
 */
function dedupKey_(kind, ids) {
  ids = ids || {};
  if (kind === NOTIF_KIND.WO_ASSIGNED) {
    return 'assign:' + strv_(ids.woId) + ':' + strv_(ids.assignee);
  }
  if (kind === NOTIF_KIND.WO_UNASSIGNED) {
    return 'unassigned:' + strv_(ids.woId);
  }
  if (kind === NOTIF_KIND.REPORT_PENDING) {
    return 'approval:' + strv_(ids.reportId);
  }
  return kind + ':' + strv_(ids.woId || ids.reportId);
}

/**
 * The L2 recipients for an area event: active role-2 users whose assigned_area
 * intersects the row's site — mirroring handlePull_'s user scope — minus the
 * user who caused the event (never notify the actor). Returns a list of user
 * ids.
 */
function recipientsForArea_(users, area, causingUid) {
  var areas = splitList_(area);
  if (areas.length === 0) return [];
  var cause = strv_(causingUid);
  var out = [];
  (users || []).forEach(function (u) {
    var uid = rowId_(u);
    if (!uid || uid === cause) return;
    if (Number(u.role_level) !== 2) return;
    if (!isTruthyCell_(u.active)) return;
    if (!intersects_(splitList_(u.assigned_area), areas)) return;
    out.push(uid);
  });
  return out;
}

/**
 * The full plan for the current sheet state: every push that SHOULD exist,
 * with the already-sent ones filtered out. Pure — the caller supplies the rows
 * (readTable_ output) and the set of keys already in the log.
 *
 *   state = { workOrders, reports, users, alreadyNotified }
 *   alreadyNotified: a { eventKey: true } map (default {})
 *
 * Rules:
 *   work order ASSIGNED w/ assigned_to  → wo_assigned to that assignee
 *   work order UNASSIGNED               → wo_unassigned to L2s in its area
 *   report submitted (not draft) PENDING→ report_pending to L2s in the WO's area
 * Events with no valid recipient are dropped.
 */
function notifyPlanForState_(state) {
  state = state || {};
  var workOrders = state.workOrders || [];
  var reports = state.reports || [];
  var users = state.users || [];
  var already = state.alreadyNotified || {};

  var woById = {};
  workOrders.forEach(function (w) {
    var id = rowId_(w);
    if (id) woById[id] = w;
  });

  var events = [];

  workOrders.forEach(function (w) {
    var woId = rowId_(w);
    if (!woId) return;
    var status = norm_(w.status);

    if (status === 'assigned') {
      var assignee = strv_(w.assigned_to);
      if (!assignee) return;
      if (assignee === strv_(w.assigned_by)) return; // never notify the actor
      var key = dedupKey_(NOTIF_KIND.WO_ASSIGNED, { woId: woId, assignee: assignee });
      if (already[key]) return;
      events.push({
        eventKey: key,
        kind: NOTIF_KIND.WO_ASSIGNED,
        recipientUids: [assignee],
        title: 'Work order assigned to you',
        body: woLabel_(w),
        data: { kind: NOTIF_KIND.WO_ASSIGNED, woId: woId },
      });
    } else if (status === 'unassigned') {
      var key2 = dedupKey_(NOTIF_KIND.WO_UNASSIGNED, { woId: woId });
      if (already[key2]) return;
      var recips = recipientsForArea_(users, w.site, w.created_by);
      if (recips.length === 0) return;
      events.push({
        eventKey: key2,
        kind: NOTIF_KIND.WO_UNASSIGNED,
        recipientUids: recips,
        title: 'New unassigned work order',
        body: woLabel_(w),
        data: { kind: NOTIF_KIND.WO_UNASSIGNED, woId: woId },
      });
    }
  });

  reports.forEach(function (r) {
    var reportId = rowId_(r);
    if (!reportId) return;
    if (isTruthyCell_(r.is_draft)) return; // drafts never notify
    if (norm_(r.approval_status) !== 'pending') return;
    var key = dedupKey_(NOTIF_KIND.REPORT_PENDING, { reportId: reportId });
    if (already[key]) return;
    var wo = woById[strv_(r.work_order_id)];
    var area = wo ? wo.site : '';
    var recips = recipientsForArea_(users, area, r.reporter_user_id);
    if (recips.length === 0) return;
    events.push({
      eventKey: key,
      kind: NOTIF_KIND.REPORT_PENDING,
      recipientUids: recips,
      title: 'Report awaiting approval',
      body: reportLabel_(r),
      data: { kind: NOTIF_KIND.REPORT_PENDING, reportId: reportId },
    });
  });

  return events;
}

// ---------- label helpers (the push body; kept tolerant of blank cells) ----------

function woLabel_(w) {
  var code = strv_(w.wo_code);
  var parts = [];
  var type = strv_(w.wo_type);
  var loc = strv_(w.location);
  if (type) parts.push(type);
  if (loc) parts.push(loc);
  var tail = parts.join(' · ');
  if (code) return tail ? code + ' — ' + tail : code;
  return tail || 'Tap to view';
}

function reportLabel_(r) {
  var code = strv_(r.report_code);
  var color = strv_(r.status_color);
  var tail = color ? 'Status: ' + color : 'Tap to review';
  return code ? code + ' — ' + tail : tail;
}

/** Trim-to-string that treats null/undefined as ''. Local so the harness can
 *  load Notify.js without pulling a helper that lives elsewhere. */
function strv_(v) {
  return String(v == null ? '' : v).trim();
}

// ============================================================================
// Phase 4 — I/O: token store, register/unregister, dispatch, Expo send.
// ============================================================================

var EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
var EXPO_CHUNK = 100; // Expo accepts up to 100 messages per request

var DEVICE_TOKENS_SHEET = 'device_tokens';
var DEVICE_TOKENS_HEADERS = [
  'id', 'expo_push_token', 'user_id', 'platform', 'active', 'created_at', 'updated_at',
];
var NOTIF_LOG_SHEET = 'notifications_log';
var NOTIF_LOG_HEADERS = ['event_key', 'sent_at'];
// Feature N — how long a dedup key stays in notifications_log before it is
// trimmed. Comfortably longer than any event stays actionable, so a re-push of
// something recent still dedups, while the log cannot grow without bound.
var NOTIF_LOG_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ---------- pure helpers the I/O leans on (harnessed) ----------

/** An Expo push token as the SDK mints it: ExponentPushToken[...] / ExpoPushToken[...]. */
function isExpoPushToken_(t) {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(strv_(t));
}

/** The active device tokens whose user is a recipient of this event. */
function tokensForRecipients_(tokenRows, recipientUids) {
  var want = {};
  (recipientUids || []).forEach(function (u) {
    var id = strv_(u);
    if (id) want[id] = true;
  });
  var out = [];
  (tokenRows || []).forEach(function (r) {
    if (!isTruthyCell_(r.active)) return;
    var tok = strv_(r.expo_push_token);
    var uid = strv_(r.user_id);
    if (!tok || !want[uid]) return;
    out.push({ expo_push_token: tok, user_id: uid });
  });
  return out;
}

/** One Expo message per token, stamping THAT recipient's uid into data — the
 *  value the app's shared-device guard checks. */
function buildExpoMessages_(event, tokens) {
  return (tokens || []).map(function (t) {
    return {
      to: t.expo_push_token,
      title: event.title,
      body: event.body,
      channelId: 'default',
      priority: 'high',
      data: mergeData_(event.data, t.user_id),
    };
  });
}

function mergeData_(data, uid) {
  var out = {};
  Object.keys(data || {}).forEach(function (k) {
    out[k] = data[k];
  });
  out.uid = strv_(uid); // stamped LAST so the recipient's id always wins
  return out;
}

/** Tokens Expo reported as DeviceNotRegistered — dead, to be deactivated.
 *  Tickets come back in the same order as the messages sent. */
function receiptsToDeactivate_(tickets, messages) {
  var dead = [];
  (tickets || []).forEach(function (ticket, i) {
    if (
      ticket &&
      ticket.status === 'error' &&
      ticket.details &&
      ticket.details.error === 'DeviceNotRegistered'
    ) {
      var msg = messages[i];
      if (msg && msg.to) dead.push(msg.to);
    }
  });
  return dead;
}

// ---------- endpoints ----------

/**
 * POST ?path=registerPush  body: { token, expo_push_token, platform }
 * Upserts this device's token against the caller. Idempotent (keyed by the push
 * token), and a token that moves to a new user simply re-points — which is how a
 * shared phone stops ringing for the previous account.
 */
function handleRegisterPush_(body) {
  var auth = authCaller_(body);
  if (auth.ok !== true) return auth;
  var expoToken = strv_(body && body.expo_push_token);
  if (!isExpoPushToken_(expoToken)) {
    return { ok: false, error: 'bad_request', message: 'bad expo_push_token' };
  }
  var platform = strv_(body && body.platform);
  var lock = LockService.getScriptLock();
  lock.waitLock(30 * 1000);
  try {
    upsertDeviceToken_(expoToken, auth.uid, platform);
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

/**
 * POST ?path=unregisterPush  body: { token, expo_push_token }
 * Deactivates the caller's own copy of a token (logout). Scoped to the caller so
 * one user cannot silence another's device.
 */
function handleUnregisterPush_(body) {
  var auth = authCaller_(body);
  if (auth.ok !== true) return auth;
  var expoToken = strv_(body && body.expo_push_token);
  if (!expoToken) return { ok: false, error: 'bad_request' };
  var lock = LockService.getScriptLock();
  lock.waitLock(30 * 1000);
  try {
    deactivateDeviceToken_(expoToken, auth.uid);
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

// ---------- dispatch (called from handlePush_, under its lock) ----------

/**
 * Turns the current sheet state into Expo pushes. Reads work_orders / reports /
 * users and the notifications_log (already-sent event keys), computes the plan,
 * and for each new event sends one message per recipient device token.
 *
 * DEDUP: an event key is written to the log only when its Expo POST succeeded
 * (or when the event had no device to deliver to — still "processed"). A total
 * send failure leaves the key unlogged, so the next push retries; a re-push that
 * finds the key already logged sends nothing. Per-recipient receipt errors do
 * not un-log the event — the delivery attempt happened. This runs under
 * handlePush_'s lock so two concurrent pushes cannot both claim the same key.
 */
function dispatchNotifications_() {
  var plan = notifyPlanForState_({
    workOrders: readTable_('work_orders'),
    reports: readTable_('maintenance_reports'),
    users: readTable_('users'),
    alreadyNotified: readNotifiedKeys_(),
  });

  // Feature N — keep the dedup log bounded. It only grows in this function
  // (appendNotifiedKeys_ below), so trimming here couples growth to cleanup.
  // Runs under handlePush_'s lock; cheap (one column read, at most one
  // deleteRows), and placed before the early return so it happens on every
  // dispatch, not only when there is something new to send.
  trimNotifLog_();

  if (plan.length === 0) return;

  var tokenRows = readDeviceTokenRows_();
  var keysToLog = [];
  var deadTokens = {};

  plan.forEach(function (event) {
    var tokens = tokensForRecipients_(tokenRows, event.recipientUids);
    if (tokens.length === 0) {
      keysToLog.push(event.eventKey); // no device to deliver to, but processed
      return;
    }
    var result = sendExpoPush_(buildExpoMessages_(event, tokens));
    if (result.ok) keysToLog.push(event.eventKey);
    result.dead.forEach(function (t) {
      deadTokens[t] = true;
    });
  });

  if (keysToLog.length) appendNotifiedKeys_(keysToLog);
  Object.keys(deadTokens).forEach(function (t) {
    deactivateDeviceToken_(t, null);
  });
}

/**
 * Run ONCE from the editor immediately after the Feature M deploy (right after
 * smokeCheck's re-auth), BEFORE staff devices start registering push tokens.
 *
 * Writes every event key the CURRENT state would produce into notifications_log
 * WITHOUT sending, so the standing backlog — every already-open assignment,
 * pending report, and unassigned work order — counts as "already notified". The
 * first real push then rings only genuinely new events, not the whole history.
 *
 * Safe to re-run: keys already in the log are filtered out, so a second call
 * only picks up whatever became notifiable since the first. Returns the count.
 *
 * No trailing underscore ON PURPOSE: the editor's run dropdown hides
 * underscore-suffixed functions, and this one exists to be run from there.
 */
function backfillNotifyLog() {
  var plan = notifyPlanForState_({
    workOrders: readTable_('work_orders'),
    reports: readTable_('maintenance_reports'),
    users: readTable_('users'),
    alreadyNotified: readNotifiedKeys_(),
  });
  var keys = plan.map(function (e) {
    return e.eventKey;
  });
  appendNotifiedKeys_(keys);
  Logger.log('backfilled ' + keys.length + ' notification event key(s) — no pushes sent');
  return keys.length;
}

/**
 * Editor-run probe (Feature M phase 6) — DevProbes' server half. Logs every
 * push the CURRENT sheet state would produce — event key, title, and each
 * recipient with their active-device-token count — without sending anything or
 * writing the log. The device gate compares this against what actually rang.
 * (Editor-runnable, hence no trailing underscore, like backfillNotifyLog.)
 */
function dumpNotifyPlan() {
  var plan = notifyPlanForState_({
    workOrders: readTable_('work_orders'),
    reports: readTable_('maintenance_reports'),
    users: readTable_('users'),
    alreadyNotified: readNotifiedKeys_(),
  });
  var tokenRows = readDeviceTokenRows_();
  var lines = plan.map(function (event) {
    var recips = event.recipientUids.map(function (uid) {
      return uid + ' (' + tokensForRecipients_(tokenRows, [uid]).length + ' active token(s))';
    });
    return event.eventKey + ' "' + event.title + '" → ' + recips.join(', ');
  });
  Logger.log(
    'notify plan: ' + plan.length + ' unsent event(s)' + (lines.length ? '\n' + lines.join('\n') : ''),
  );
  return plan.length;
}

/** POSTs messages to Expo in chunks. Returns { ok, dead:[tokens] }: ok is true
 *  only if every chunk's POST succeeded; dead lists DeviceNotRegistered tokens. */
function sendExpoPush_(messages) {
  var dead = [];
  var allOk = true;
  for (var i = 0; i < messages.length; i += EXPO_CHUNK) {
    var chunk = messages.slice(i, i + EXPO_CHUNK);
    var res;
    try {
      res = UrlFetchApp.fetch(EXPO_PUSH_URL, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(chunk),
        muteHttpExceptions: true,
      });
    } catch (err) {
      Logger.log('expo push fetch threw: ' + err);
      allOk = false;
      continue;
    }
    if (res.getResponseCode() !== 200) {
      Logger.log('expo push HTTP ' + res.getResponseCode() + ': ' + res.getContentText());
      allOk = false;
      continue;
    }
    var parsed;
    try {
      parsed = JSON.parse(res.getContentText());
    } catch (err) {
      allOk = false;
      continue;
    }
    receiptsToDeactivate_((parsed && parsed.data) || [], chunk).forEach(function (t) {
      dead.push(t);
    });
  }
  return { ok: allOk, dead: dead };
}

// ---------- gateway-owned sheet tabs (device_tokens, notifications_log) ----------

/** Like getSheet_ but creates the tab (with headers) when missing — these tabs
 *  are internal bookkeeping, so the gateway owns their existence, not setup. */
function getOrCreateSheet_(name, headers) {
  var ss = SpreadsheetApp.openById(getRequiredProp_('SPREADSHEET_ID'));
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

function deviceTokensSheet_() {
  return getOrCreateSheet_(DEVICE_TOKENS_SHEET, DEVICE_TOKENS_HEADERS);
}

function readDeviceTokenRows_() {
  return readRows_(deviceTokensSheet_());
}

function upsertDeviceToken_(expoToken, uid, platform) {
  var sheet = deviceTokensSheet_();
  var values = sheet.getDataRange().getValues();
  var col = headerIndex_(values[0]);
  var nowIso = new Date().toISOString();

  for (var r = 1; r < values.length; r++) {
    if (strv_(values[r][col.expo_push_token]) === expoToken) {
      values[r][col.user_id] = uid;
      if (platform) values[r][col.platform] = platform;
      values[r][col.active] = true;
      values[r][col.updated_at] = nowIso;
      sheet.getRange(r + 1, 1, 1, values[r].length).setValues([values[r]]);
      return;
    }
  }

  var row = [];
  for (var i = 0; i < values[0].length; i++) row.push('');
  row[col.id] = Utilities.getUuid();
  row[col.expo_push_token] = expoToken;
  row[col.user_id] = uid;
  row[col.platform] = platform || '';
  row[col.active] = true;
  row[col.created_at] = nowIso;
  row[col.updated_at] = nowIso;
  sheet.appendRow(row);
}

/** Deactivate a token. When uid is given, only the row owned by that user is
 *  touched (unregister); when null, any row with the token (a dead-token sweep). */
function deactivateDeviceToken_(expoToken, uid) {
  var sheet = deviceTokensSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  var col = headerIndex_(values[0]);
  var nowIso = new Date().toISOString();

  for (var r = 1; r < values.length; r++) {
    if (strv_(values[r][col.expo_push_token]) !== expoToken) continue;
    if (uid && strv_(values[r][col.user_id]) !== strv_(uid)) continue;
    values[r][col.active] = false;
    values[r][col.updated_at] = nowIso;
    sheet.getRange(r + 1, 1, 1, values[r].length).setValues([values[r]]);
  }
}

function notifLogSheet_() {
  return getOrCreateSheet_(NOTIF_LOG_SHEET, NOTIF_LOG_HEADERS);
}

function readNotifiedKeys_() {
  var set = {};
  readRows_(notifLogSheet_()).forEach(function (r) {
    var k = strv_(r.event_key);
    if (k) set[k] = true;
  });
  return set;
}

function appendNotifiedKeys_(keys) {
  if (!keys || keys.length === 0) return;
  var sheet = notifLogSheet_();
  var nowIso = new Date().toISOString();
  var rows = keys.map(function (k) {
    return [k, nowIso];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 2).setValues(rows);
}

/**
 * Feature N — deletes notifications_log rows older than NOTIF_LOG_TTL_MS.
 *
 * The log is append-only and each row is stamped at append time, so rows sit in
 * chronological order and the expired ones form a contiguous block at the top.
 * That lets a single deleteRows() clear them: scan sent_at (column 2) from the
 * top, counting the leading run older than the cutoff, then delete that run. A
 * blank or unparseable timestamp stops the scan — a row we cannot date is never
 * deleted, and everything below it is newer anyway. `toMs_` comes from Sync.js,
 * which shares this global scope.
 */
function trimNotifLog_() {
  var sheet = notifLogSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return; // header only, or empty

  var cutoff = Date.now() - NOTIF_LOG_TTL_MS;
  var sentAt = sheet.getRange(2, 2, last - 1, 1).getValues();

  var expired = 0;
  for (var i = 0; i < sentAt.length; i++) {
    var ms = toMs_(sentAt[i][0]);
    if (ms == null || ms >= cutoff) break;
    expired++;
  }

  if (expired > 0) sheet.deleteRows(2, expired);
}

/** { header_name: column_index } from a sheet's header row (normalized names). */
function headerIndex_(headerRow) {
  var col = {};
  headerRow.map(normalizeHeader_).forEach(function (h, i) {
    if (h && !(h in col)) col[h] = i;
  });
  return col;
}
