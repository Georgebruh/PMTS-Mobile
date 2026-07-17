import { API_URL } from '../config';

/** The users row as the gateway returns it (wire shape, schema.js names). */
export type SessionUser = {
  id: string;
  user_code: string;
  full_name: string;
  email: string;
  role_level: 1 | 2;
  is_lead: boolean;
  assigned_area: string;
  assigned_locations: string;
  active: boolean;
};

export type LoginErrorCode =
  | 'unconfigured'
  | 'offline'
  | 'bad_request'
  | 'invalid_credentials'
  | 'inactive'
  | 'role_not_allowed'
  | 'user_missing_id'
  | 'server_error';

const KNOWN_ERRORS: readonly LoginErrorCode[] = [
  'bad_request',
  'invalid_credentials',
  'inactive',
  'role_not_allowed',
  'user_missing_id',
  'server_error',
];

export class LoginError extends Error {
  readonly code: LoginErrorCode;

  constructor(code: LoginErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'LoginError';
    this.code = code;
  }
}

/**
 * POST ${API_URL}/login — resolves to a token + user or throws LoginError.
 * The gateway always answers HTTP 200 (Apps Script ContentService cannot set
 * status codes); success/failure is carried in the JSON `ok`/`error` body.
 */
export async function loginRequest(
  email: string,
  pin: string,
): Promise<{ token: string; user: SessionUser }> {
  if (!API_URL) throw new LoginError('unconfigured');

  let res: Response;
  try {
    res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      // text/plain keeps web builds preflight-free (Apps Script can't answer
      // OPTIONS); the gateway parses e.postData.contents as JSON regardless.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), pin: pin.trim() }),
    });
  } catch {
    throw new LoginError('offline');
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new LoginError('server_error', `unexpected response (HTTP ${res.status})`);
  }

  if (!data || data.ok !== true) {
    const code: LoginErrorCode = KNOWN_ERRORS.includes(data?.error) ? data.error : 'server_error';
    throw new LoginError(code, data?.message);
  }

  const user = data.user;
  if (!data.token || !user?.id || (user.role_level !== 1 && user.role_level !== 2)) {
    throw new LoginError('server_error', 'malformed login response');
  }
  return { token: String(data.token), user: user as SessionUser };
}

/** User-facing copy per error code — the login screen renders this verbatim. */
export function loginErrorMessage(error: unknown): string {
  const code = error instanceof LoginError ? error.code : 'server_error';
  switch (code) {
    case 'unconfigured':
      return 'This build has no server URL configured (EXPO_PUBLIC_PMTS_API_URL).';
    case 'offline':
      return 'Could not reach the server. First-time login needs a connection — check your network and try again.';
    case 'invalid_credentials':
      return 'Email or PIN is incorrect.';
    case 'inactive':
      return 'This account is deactivated. Contact your administrator.';
    case 'role_not_allowed':
      return 'This account cannot use the mobile app.';
    default:
      return 'Something went wrong on the server. Try again or contact your administrator.';
  }
}
