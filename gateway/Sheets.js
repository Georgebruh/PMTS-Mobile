/**
 * Sheet access. The `users` tab is expected to carry (header names are
 * normalized, so "Full Name" == full_name):
 *
 *   id · user_code · full_name · email · pin · role_level · is_lead
 *   assigned_area · assigned_locations · active · created_at · updated_at
 *
 * `id` is the row's client_uuid — the same value that becomes the
 * WatermelonDB id on devices. `pin` exists ONLY here; it is never synced.
 */

function getRequiredProp_(key) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Script Property "' + key + '" is not set');
  return v;
}

function usersSheetName_() {
  return PropertiesService.getScriptProperties().getProperty('USERS_SHEET_NAME') || 'users';
}

function getSheet_(name) {
  var ss = SpreadsheetApp.openById(getRequiredProp_('SPREADSHEET_ID'));
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet tab "' + name + '" not found');
  return sheet;
}

/** Reads a whole tab into objects keyed by normalized header names. */
function readRows_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(normalizeHeader_);
  return values.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) {
      if (h) obj[h] = row[i];
    });
    return obj;
  });
}

/** "Full Name " → full_name, "Role-Level" → role_level */
function normalizeHeader_(h) {
  return String(h)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function findUserByEmail_(email) {
  var rows = readRows_(getSheet_(usersSheetName_()));
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].email || '').trim().toLowerCase() === email) return rows[i];
  }
  return null;
}

/** id = the row's client_uuid (what verifyToken() returns as uid). */
function findUserById_(id) {
  var rows = readRows_(getSheet_(usersSheetName_()));
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id || '').trim() === id) return rows[i];
  }
  return null;
}

/** Sheets hand back TRUE, "TRUE", "yes", 1 … depending on how cells were filled. */
function isTruthyCell_(v) {
  if (v === true) return true;
  var s = String(v).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === 'y' || s === '1';
}
