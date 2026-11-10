// Client-side session rules (lib/token-storage.ts): temporary sessions, 12 h absolute limit, no persistence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_MAX_MS, getToken, setToken, storeTokens, clearTokens, purgeLegacyTokens, hasSession,
  isSessionExpired, msUntilExpiry, sessionStartFromJwt, sessionStartedAt, exportSession, importSession,
} from '../lib/token-storage.ts';
import { isProtectedPath } from '../lib/auth-paths.ts';

class Store {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  get length() { return this.m.size; }
}
const fresh = () => { globalThis.window = globalThis; globalThis.sessionStorage = new Store(); globalThis.localStorage = new Store(); };
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims) => `${b64u({ alg: 'HS256' })}.${b64u(claims)}.sig`;
const A = 'sustindex_access_token', R = 'sustindex_refresh_token', S = 'sustindex_session_start';
const H = 3600 * 1000;

test('tokens are stored in sessionStorage ONLY — never in localStorage', () => {
  fresh();
  storeTokens('acc', jwt({ session_start: 1000 }));
  assert.equal(sessionStorage.getItem(A), 'acc');
  assert.ok(sessionStorage.getItem(R));
  assert.equal(localStorage.length, 0);
  assert.equal(getToken('access_token'), 'acc');
});

test('the old "remember me" argument no longer persists anything', () => {
  fresh();
  storeTokens('acc', jwt({ session_start: 1000 }), true);
  assert.equal(localStorage.length, 0);
});

test('a token left in localStorage by an older version never authenticates, and is purged', () => {
  fresh();
  localStorage.setItem(A, 'old-access'); localStorage.setItem(R, 'old-refresh'); localStorage.setItem(S, '123');
  assert.equal(getToken('access_token'), null);
  assert.equal(hasSession(), false);
  purgeLegacyTokens();
  assert.equal(localStorage.length, 0);
});

test('clearTokens removes the session from both storages', () => {
  fresh();
  storeTokens('acc', jwt({ session_start: 1000 }));
  localStorage.setItem(A, 'stale');
  clearTokens();
  assert.equal(sessionStorage.length, 0); assert.equal(localStorage.length, 0);
  assert.equal(hasSession(), false);
});

test('session start is read from the server-issued session_start claim (seconds → ms)', () => {
  assert.equal(sessionStartFromJwt(jwt({ session_start: 1700000000 })), 1700000000 * 1000);
  assert.equal(sessionStartFromJwt(jwt({})), null);
  assert.equal(sessionStartFromJwt('not-a-jwt'), null);
  assert.equal(sessionStartFromJwt(null), null);
  fresh();
  storeTokens('acc', jwt({ session_start: 1700000000 }));
  assert.equal(sessionStartedAt(), 1700000000 * 1000);
});

test('without a server claim the start time falls back to "now"', () => {
  fresh();
  const before = Date.now();
  storeTokens('acc', 'opaque-refresh');
  assert.ok(sessionStartedAt() >= before && sessionStartedAt() <= Date.now());
});

test('12-hour limit: valid up to the deadline, expired from the deadline on', () => {
  fresh();
  const t0 = 1_800_000_000_000;
  storeTokens('acc', jwt({ session_start: t0 / 1000 }));
  assert.equal(SESSION_MAX_MS, 12 * H);
  assert.equal(isSessionExpired(t0), false);
  assert.equal(isSessionExpired(t0 + 11 * H + 59 * 60 * 1000), false);
  assert.equal(isSessionExpired(t0 + 12 * H - 1), false);
  assert.equal(isSessionExpired(t0 + 12 * H), true);
  assert.equal(isSessionExpired(t0 + 24 * H), true);                       // "the next day"
  assert.equal(msUntilExpiry(t0 + 2 * H), 10 * H);
  assert.equal(msUntilExpiry(t0 + 13 * H), 0);
});

test('no session → never "expired" (nothing to expire)', () => {
  fresh();
  assert.equal(isSessionExpired(), false);
  assert.equal(msUntilExpiry(), null);
});

test('a session whose age cannot be established is treated as expired (fail closed)', () => {
  fresh();
  sessionStorage.setItem(A, 'acc'); sessionStorage.setItem(R, 'ref');       // no start timestamp
  assert.equal(isSessionExpired(), true);
  assert.equal(msUntilExpiry(), 0);
});

test('refreshing the access token does not restart the 12 h clock', () => {
  fresh();
  const t0 = 1_800_000_000_000;
  storeTokens('acc', jwt({ session_start: t0 / 1000 }));
  setToken('access_token', 'refreshed-access');
  assert.equal(sessionStartedAt(), t0);
  assert.equal(isSessionExpired(t0 + 12 * H), true);
});

test('session hand-over to a new tab keeps the ORIGINAL start time; an expired session is not handed over', () => {
  fresh();
  const t0 = Date.now() - 3 * H;
  storeTokens('acc', jwt({ session_start: Math.floor(t0 / 1000) }));
  const snap = exportSession();
  assert.ok(snap && snap.start === Math.floor(t0 / 1000) * 1000);
  fresh();                                                                  // the "new tab"
  importSession(snap);
  assert.equal(getToken('access_token'), 'acc');
  assert.equal(sessionStartedAt(), snap.start);                             // not reset to "now"
  fresh();
  storeTokens('acc', jwt({ session_start: Math.floor((Date.now() - 13 * H) / 1000) }));
  assert.equal(exportSession(), null);
});

test('route guard: private areas are protected, public pages are not', () => {
  for (const p of ['/dashboard', '/surveys', '/questionnaire/150', '/results/153', '/results/combined', '/history', '/action-plan', '/compare', '/courses/2', '/documents', '/profile', '/admin/analytics'])
    assert.equal(isProtectedPath(p), true, p);
  for (const p of ['/', '/login', '/register', '/forgot-password', '/reset-password', '/about', '/dashboardx', '/nope', null, undefined])
    assert.equal(isProtectedPath(p), false, String(p));
});
