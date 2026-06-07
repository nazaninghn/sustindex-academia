/**
 * Token storage helpers.
 *
 * Tokens land in:
 *   • localStorage   — when the user chose "Remember me" (default / persistent)
 *   • sessionStorage — when the user UNchecked "Remember me" (cleared on tab close)
 *
 * All *read* helpers transparently check both stores so the rest of the app
 * never needs to know which one was actually used.
 */

// Fix M-9: wrap every storage call in try/catch.
// localStorage can throw in Safari private-browsing (SecurityError),
// when the storage quota is exceeded, or when the entry is corrupt.
// A crash here would propagate up through AuthProvider and blank the entire app.

function safeGet(store: Storage, key: string): string | null {
  try { return store.getItem(key); } catch { return null; }
}
function safeSet(store: Storage, key: string, value: string): void {
  try { store.setItem(key, value); } catch { /* quota / SecurityError — ignore */ }
}
function safeRemove(store: Storage, key: string): void {
  try { store.removeItem(key); } catch { /* ignore */ }
}

/** Read a token from whichever store currently holds it. */
export function getToken(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return safeGet(localStorage, key) ?? safeGet(sessionStorage, key);
}

/**
 * Write a token, persisting in the same store that currently holds the refresh
 * token (so access / refresh always stay together).  Falls back to localStorage.
 */
export function setToken(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  const useSession =
    !safeGet(localStorage, 'refresh_token') &&
    !!safeGet(sessionStorage, 'refresh_token');
  safeSet(useSession ? sessionStorage : localStorage, key, value);
}

/**
 * Persist both tokens after a fresh login.
 * @param remember  true  → localStorage (persistent across browser restarts)
 *                  false → sessionStorage (cleared when tab closes)
 */
export function storeTokens(
  access: string,
  refresh: string,
  remember: boolean,
): void {
  if (typeof window === 'undefined') return;
  clearTokens(); // avoid stale tokens in either store
  const store = remember ? localStorage : sessionStorage;
  safeSet(store, 'access_token', access);
  safeSet(store, 'refresh_token', refresh);
}

/** Remove tokens from BOTH stores (logout / expired session). */
export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  for (const key of ['access_token', 'refresh_token']) {
    safeRemove(localStorage, key);
    safeRemove(sessionStorage, key);
  }
}
