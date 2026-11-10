/**
 * Token storage — TEMPORARY, session-scoped authentication.
 *
 * Tokens live ONLY in sessionStorage, which the browser discards when the tab/window session ends.
 * Nothing is written to localStorage, so closing the browser (or returning the next day) means the
 * user must sign in again. On top of that every session has an absolute maximum lifetime of 12 hours
 * from login (SESSION_MAX_MS), mirrored server-side in the refresh token (accounts/session_tokens.py).
 *
 * Why the 12 h limit is needed even though sessionStorage is temporary: some browsers can restore
 * session storage after a crash or with "continue where you left off", so the age of the session is
 * recorded explicitly and checked.
 */

// Wrap every storage call in try/catch: storage can throw (private mode, quota, SecurityError).
// A crash here would propagate up through AuthProvider and blank the entire app.
function safeGet(store: Storage, key: string): string | null {
  try { return store.getItem(key); } catch { return null; }
}
function safeSet(store: Storage, key: string, value: string): void {
  try { store.setItem(key, value); } catch { /* ignore */ }
}
function safeRemove(store: Storage, key: string): void {
  try { store.removeItem(key); } catch { /* ignore */ }
}

// Namespaced keys to avoid collisions with other apps on the same origin.
const KEY_ACCESS  = 'sustindex_access_token';
const KEY_REFRESH = 'sustindex_refresh_token';
const KEY_START   = 'sustindex_session_start';       // epoch ms the session began (server `session_start` claim)

/** Absolute maximum session length: 12 hours from login. Keep in sync with settings.SESSION_MAX_LIFETIME. */
export const SESSION_MAX_MS = 12 * 60 * 60 * 1000;

function storageKey(key: string): string {
  if (key === 'access_token')  return KEY_ACCESS;
  if (key === 'refresh_token') return KEY_REFRESH;
  return key;
}

/** Read a token (session storage only). */
export function getToken(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return safeGet(sessionStorage, storageKey(key));
}

/** Update a single token inside the current session (e.g. a refreshed access token). */
export function setToken(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  safeSet(sessionStorage, storageKey(key), value);
}

/** Epoch ms of the `session_start` claim inside a refresh token, or null when absent/unreadable. */
export function sessionStartFromJwt(jwt: string | null | undefined): number | null {
  if (!jwt) return null;
  try {
    const part = jwt.split('.')[1];
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    const claim = JSON.parse(json).session_start;
    return typeof claim === 'number' && claim > 0 ? claim * 1000 : null;
  } catch { return null; }
}

/**
 * Persist both tokens after a fresh login (password, Google, Google link, registration).
 * The third parameter is accepted for backwards compatibility and ignored: there is no persistent session.
 */
export function storeTokens(access: string, refresh: string, _legacyRemember?: boolean): void {
  if (typeof window === 'undefined') return;
  clearTokens();
  safeSet(sessionStorage, KEY_ACCESS, access);
  safeSet(sessionStorage, KEY_REFRESH, refresh);
  safeSet(sessionStorage, KEY_START, String(sessionStartFromJwt(refresh) ?? Date.now()));
}

/** Remove the session (and any token left in localStorage by older versions of the app). */
export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  for (const key of [KEY_ACCESS, KEY_REFRESH, KEY_START]) {
    safeRemove(sessionStorage, key);
    safeRemove(localStorage, key);
  }
}

/** Older versions stored tokens in localStorage ("Remember me"). They must never authenticate anyone. */
export function purgeLegacyTokens(): void {
  if (typeof window === 'undefined') return;
  for (const key of [KEY_ACCESS, KEY_REFRESH, KEY_START]) safeRemove(localStorage, key);
}

export function hasSession(): boolean {
  return !!getToken('access_token') || !!getToken('refresh_token');
}

/** Epoch ms the current session began, or null if unknown. */
export function sessionStartedAt(): number | null {
  if (typeof window === 'undefined') return null;
  const v = Number(safeGet(sessionStorage, KEY_START));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** True when a session exists but is older than 12 h — or its age cannot be established. */
export function isSessionExpired(now: number = Date.now()): boolean {
  if (!hasSession()) return false;
  const start = sessionStartedAt();
  return start === null || now >= start + SESSION_MAX_MS;
}

/** Milliseconds until the session reaches its maximum age (0 if already past), or null when there is no session. */
export function msUntilExpiry(now: number = Date.now()): number | null {
  if (!hasSession()) return null;
  const start = sessionStartedAt();
  return start === null ? 0 : Math.max(0, start + SESSION_MAX_MS - now);
}

/** Snapshot used to hand the session to another tab of the same browser session. */
export function exportSession(): { access: string; refresh: string; start: number } | null {
  const access = getToken('access_token'), refresh = getToken('refresh_token'), start = sessionStartedAt();
  return access && refresh && start && !isSessionExpired() ? { access, refresh, start } : null;
}

export function importSession(s: { access: string; refresh: string; start: number }): void {
  if (typeof window === 'undefined') return;
  safeSet(sessionStorage, KEY_ACCESS, s.access);
  safeSet(sessionStorage, KEY_REFRESH, s.refresh);
  safeSet(sessionStorage, KEY_START, String(s.start));
}
