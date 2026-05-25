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

/** Read a token from whichever store currently holds it. */
export function getToken(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

/**
 * Write a token, persisting in the same store that currently holds the refresh
 * token (so access / refresh always stay together).  Falls back to localStorage.
 */
export function setToken(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  const useSession =
    !localStorage.getItem('refresh_token') &&
    !!sessionStorage.getItem('refresh_token');
  (useSession ? sessionStorage : localStorage).setItem(key, value);
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
  store.setItem('access_token', access);
  store.setItem('refresh_token', refresh);
}

/** Remove tokens from BOTH stores (logout / expired session). */
export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  for (const key of ['access_token', 'refresh_token']) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}
