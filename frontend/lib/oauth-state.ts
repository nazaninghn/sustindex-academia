/**
 * OAuth `state` handling for the Google popup flow (login-CSRF protection).
 *
 * Rules enforced here:
 *   • cryptographically random (crypto.getRandomValues, 256 bits) — never Math.random
 *   • a brand-new value for every login attempt; beginning an attempt invalidates any
 *     earlier pending value
 *   • single-use: consumeOAuthState() burns the pending value whether or not it matches
 *     (fail closed), so a late / duplicated / replayed callback can never authorize anything
 *   • expires after STATE_TTL_MS
 *   • cancellation, errors and page unmount call clearOAuthState()
 *
 * Only erasable TypeScript syntax is used so Node's built-in test runner can execute it directly.
 */
export const STATE_TTL_MS = 5 * 60 * 1000;
const STATE_BYTES = 32;

type Clock = () => number;
let pending: { value: string; expires: number } | null = null;

function randomHex(bytes: number): string {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('A secure random source is required for Google sign-in.');
  }
  const buf = new Uint8Array(bytes);
  c.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < buf.length; i++) out += buf[i].toString(16).padStart(2, '0');
  return out;
}

/** Start a login attempt: returns the `state` to pass to Google and remembers it (replacing any older one). */
export function beginOAuthState(now: Clock = Date.now): string {
  const value = randomHex(STATE_BYTES);
  pending = { value, expires: now() + STATE_TTL_MS };
  return value;
}

/** Validate the `state` Google echoed back. Single-use: the pending value is always discarded. */
export function consumeOAuthState(received: unknown, now: Clock = Date.now): boolean {
  const p = pending;
  pending = null;
  if (!p) return false;
  if (typeof received !== 'string' || received.length !== p.value.length) return false;
  if (now() > p.expires) return false;
  let diff = 0;                                   // exact comparison, no early exit
  for (let i = 0; i < p.value.length; i++) diff |= received.charCodeAt(i) ^ p.value.charCodeAt(i);
  return diff === 0;
}

/** Discard the pending state (cancel, popup closed, error, unmount). */
export function clearOAuthState(): void {
  pending = null;
}

export function hasPendingOAuthState(): boolean {
  return pending !== null;
}
