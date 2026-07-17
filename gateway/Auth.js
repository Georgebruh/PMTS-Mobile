/**
 * Login + stateless token auth.
 *
 * POST /login  body: { email, pin }
 *   → { ok: true, token, user }   user = the users row minus the pin
 *   → { ok: false, error: 'bad_request' | 'invalid_credentials' | 'inactive'
 *                        | 'role_not_allowed' | 'user_missing_id' }
 *
 * Token = base64url(payload) + '.' + base64url(HMAC-SHA256(payload, secret))
 * where payload = JSON { uid, exp }. No session storage — /sync (Feature C)
 * just calls verifyToken() on each request.
 */

var TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days; field staff sync rarely

function handleLogin_(body) {
  var email = String(body.email || '').trim().toLowerCase();
  var pin = String(body.pin || '').trim();
  if (!email || !pin) return { ok: false, error: 'bad_request' };

  var user = findUserByEmail_(email);
  // Same error for unknown email and wrong PIN — don't reveal which emails exist.
  if (!user || String(user.pin || '').trim() !== pin) {
    return { ok: false, error: 'invalid_credentials' };
  }
  if (!isTruthyCell_(user.active)) return { ok: false, error: 'inactive' };

  var role = Number(user.role_level);
  if (role !== 1 && role !== 2) return { ok: false, error: 'role_not_allowed' };

  var id = String(user.id || '').trim();
  if (!id) return { ok: false, error: 'user_missing_id' }; // fix the sheet row

  return { ok: true, token: issueToken_(id), user: publicUser_(user, id, role) };
}

/** The shape the app upserts into its local `users` table (schema.js names). */
function publicUser_(row, id, role) {
  return {
    id: id,
    user_code: String(row.user_code || ''),
    full_name: String(row.full_name || ''),
    email: String(row.email || '').trim().toLowerCase(),
    role_level: role,
    is_lead: isTruthyCell_(row.is_lead),
    assigned_area: String(row.assigned_area || ''),
    assigned_locations: String(row.assigned_locations || ''),
    active: true,
  };
}

function issueToken_(userId) {
  var payload = Utilities.base64EncodeWebSafe(
    JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_TTL_MS }),
  );
  return payload + '.' + sign_(payload);
}

/** Returns the user id for a valid unexpired token, else null. Feature C's /sync uses this. */
function verifyToken(token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  if (sign_(parts[0]) !== parts[1]) return null;
  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  } catch (err) {
    return null;
  }
  if (!payload || !payload.uid || Date.now() > Number(payload.exp)) return null;
  return String(payload.uid);
}

function sign_(payload) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payload, getRequiredProp_('PMTS_TOKEN_SECRET')),
  );
}
