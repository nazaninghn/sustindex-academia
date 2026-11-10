/**
 * Session lifecycle helpers shared by the auth provider and the axios interceptors (no React in here).
 *
 *  - expireSession():  the session ended (12 h limit reached / server says it is invalid) → clear everything,
 *                      remember a one-time message for the login page, go to /login.
 *  - Cross-tab sync:   sessionStorage is per tab, so tabs of one browser session talk over a BroadcastChannel:
 *                        · logout in one tab logs out the others;
 *                        · a NEW tab asks the open tabs for the session instead of forcing a second login.
 *                      Nothing is persisted: when every tab/window is closed the session is gone.
 */
import { clearTokens, exportSession, getToken, importSession } from '@/lib/token-storage';

const NOTICE_KEY = 'sx_session_notice';     // sessionStorage: shown once on the login page
const CHANNEL    = 'sustindex-session';

export type SessionEndReason = 'expired' | 'invalid';

/** Per-user data the app keeps in localStorage that should not outlive the session. Language preference stays. */
export function clearPrivateLocalData(): void {
  if (typeof window === 'undefined') return;
  try {
    const drop: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('sx_bookmarks_') || k === 'sx_pending_cycle')) drop.push(k);
    }
    drop.forEach((k) => localStorage.removeItem(k));
  } catch { /* storage unavailable */ }
}

export function takeSessionNotice(): SessionEndReason | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(NOTICE_KEY) as SessionEndReason | null;
    if (v) sessionStorage.removeItem(NOTICE_KEY);
    return v === 'expired' || v === 'invalid' ? v : null;
  } catch { return null; }
}

function setNotice(reason: SessionEndReason) {
  try { sessionStorage.setItem(NOTICE_KEY, reason); } catch { /* ignore */ }
}

/** The session is over (not an explicit logout): clear it everywhere in this browser and go to the login page. */
export function expireSession(reason: SessionEndReason = 'expired'): void {
  if (typeof window === 'undefined') return;
  clearTokens();
  clearPrivateLocalData();
  setNotice(reason);
  broadcast({ type: 'logout' });
  window.location.replace('/login');          // replace(): the protected page is not left in the history stack
}

/** Remember a message for the login page without leaving the current page (used when a session is found expired on load). */
export function markSessionEnded(reason: SessionEndReason): void { setNotice(reason); }

/* ─────────────── cross-tab sync (BroadcastChannel; silently absent in old browsers) ─────────────── */
type Msg =
  | { type: 'logout' }
  | { type: 'request'; id: string }
  | { type: 'offer'; id: string; access: string; refresh: string; start: number };

function open(): BroadcastChannel | null {
  try { return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL); } catch { return null; }
}
function broadcast(m: Msg) {
  const ch = open();
  if (!ch) return;
  try { ch.postMessage(m); } catch { /* ignore */ }
  ch.close();
}
export function broadcastLogout() { broadcast({ type: 'logout' }); }

/** Long-lived listener for an open tab: handles "logout" and answers session requests from new tabs. */
export function startSessionSync(onLogout: () => void): () => void {
  const ch = open();
  if (!ch) return () => {};
  ch.onmessage = (e: MessageEvent<Msg>) => {
    const m = e.data;
    if (!m) return;
    if (m.type === 'logout') onLogout();
    else if (m.type === 'request') {
      const s = exportSession();                 // only while this tab has a live, unexpired session
      if (s) ch.postMessage({ type: 'offer', id: m.id, ...s } satisfies Msg);
    }
  };
  return () => ch.close();
}

/** New tab without a session: ask the other tabs of this browser session. Resolves true when a session was handed over. */
export function requestSessionFromOtherTabs(timeoutMs = 350): Promise<boolean> {
  const ch = open();
  if (!ch || getToken('access_token')) { ch?.close(); return Promise.resolve(!!getToken('access_token')); }
  const id = Math.random().toString(36).slice(2);
  return new Promise<boolean>((resolve) => {
    const done = (ok: boolean) => { clearTimeout(t); ch.close(); resolve(ok); };
    const t = setTimeout(() => done(false), timeoutMs);
    ch.onmessage = (e: MessageEvent<Msg>) => {
      const m = e.data;
      if (m && m.type === 'offer' && m.id === id && m.access && m.refresh && m.start) {
        importSession({ access: m.access, refresh: m.refresh, start: m.start });
        done(true);
      }
    };
    try { ch.postMessage({ type: 'request', id } satisfies Msg); } catch { done(false); }
  });
}
