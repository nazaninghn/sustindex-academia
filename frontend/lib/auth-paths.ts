/**
 * Endpoints that CHECK credentials rather than use a session.
 *
 * A 401 from one of these means "wrong username/password" (or rejected Google sign-in).
 * It must be shown to the user as an error. It must NOT trigger the session-refresh /
 * redirect-to-/login logic in lib/api.ts, because there is no session to refresh — that
 * logic would reload the login page and wipe the error message.
 *
 * Every other 401 (an expired access token on a normal API call) still goes through the
 * automatic refresh flow unchanged. Note: /auth/token/refresh/ and /auth/token/blacklist/
 * are deliberately NOT matched.
 *
 * Plain TypeScript with no imports, so Node's test runner can execute it directly.
 */
export function isCredentialEndpoint(url?: string | null): boolean {
  if (!url) return false;
  const path = url.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0];
  return /^\/api\/v1\/auth\/token\/?$/.test(path)
      || /^\/api\/v1\/auth\/google\/(link\/)?$/.test(path);
}

/** Pages that require a signed-in user. Used by AuthGate (client) and mirrored in next.config.js (no-store headers). */
export const PROTECTED_PREFIXES = [
  '/dashboard', '/surveys', '/questionnaire', '/results', '/history',
  '/action-plan', '/compare', '/courses', '/documents', '/profile', '/admin',
];

export function isProtectedPath(path: string | null | undefined): boolean {
  if (!path) return false;
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}
