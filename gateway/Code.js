/**
 * PMTS gateway — Apps Script web app in front of the Google Sheets backend.
 * The mobile app only ever talks to this; it never touches the Sheet directly.
 *
 * ONE-TIME SETUP (owner's Google account):
 *  1. Create a standalone project at https://script.google.com (New project).
 *  2. Project Settings → Script Properties:
 *       SPREADSHEET_ID    = the backend sheet's id (URL between /d/ and /edit)
 *       PMTS_TOKEN_SECRET = any long random string (signs login tokens)
 *       USERS_SHEET_NAME  = optional; tab name of the users table (default "users")
 *  3. Push this folder's code:  npx clasp login  (once, enable the Apps Script
 *     API at script.google.com/home/usersettings), copy .clasp.json.example to
 *     .clasp.json with your scriptId, then  npx clasp push  from gateway/.
 *     (Or paste the files into the editor by hand.)
 *  4. In the editor, run smokeCheck() once — it triggers the authorization
 *     prompt and proves the sheet + properties are reachable.
 *  5. Deploy → New deployment → Web app → Execute as: Me · Access: Anyone.
 *     Put the /exec URL in the app repo's .env as EXPO_PUBLIC_PMTS_API_URL.
 *
 * NB: ContentService cannot set HTTP status codes — every response is 200.
 * Clients must branch on the JSON body: { ok: true, ... } | { ok: false, error }.
 */

function doPost(e) {
  return route_(e, 'POST');
}

function doGet(e) {
  return route_(e, 'GET');
}

function route_(e, method) {
  var path = String((e && e.pathInfo) || '').replace(/^\/+|\/+$/g, '');
  try {
    if (method === 'POST' && path === 'login') {
      return json_(handleLogin_(parseBody_(e)));
    }
    if (method === 'GET' && path === 'ping') {
      return json_({ ok: true, service: 'pmts-gateway', time: new Date().toISOString() });
    }
    return json_({ ok: false, error: 'not_found', path: path });
  } catch (err) {
    return json_({ ok: false, error: 'server_error', message: String((err && err.message) || err) });
  }
}

function parseBody_(e) {
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/** Run once from the editor: authorizes the script and proves setup works. */
function smokeCheck() {
  getRequiredProp_('PMTS_TOKEN_SECRET');
  var sheet = getSheet_(usersSheetName_());
  Logger.log('OK: tab "' + sheet.getName() + '" with ' + (sheet.getLastRow() - 1) + ' data row(s)');
}
