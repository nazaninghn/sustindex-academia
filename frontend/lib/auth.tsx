'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '@/lib/api';  // Fix H-05 / CRITICAL: use singleton so the 401-refresh interceptor fires
import {
  getToken, storeTokens, clearTokens, purgeLegacyTokens, isSessionExpired, msUntilExpiry, hasSession,
} from '@/lib/token-storage';
import {
  expireSession, markSessionEnded, broadcastLogout, clearPrivateLocalData, startSessionSync, requestSessionFromOtherTabs,
} from '@/lib/session';

/* ─── Types ───────────────────────────────────────────────── */
export interface User {
  id:              number;
  username:        string;
  email:           string;
  first_name?:     string;
  last_name?:      string;
  company_name?:   string;
  phone?:          string;
  membership_type: string;
}

export interface RegisterPayload {
  username:         string;
  email:            string;
  password:         string;
  password_confirm: string;
  first_name?:      string;
  last_name?:       string;
  company_name?:    string;
  phone?:           string;
}

interface AuthContextType {
  user:         User | null;
  isLoading:    boolean;
  /** Starts a temporary session (sessionStorage only, 12 h maximum). */
  login:        (username: string, password: string) => Promise<void>;
  register:     (data: RegisterPayload) => Promise<void>;
  /** Exchange a Google OAuth authorization code (from the popup) for a SustIndex session. */
  loginWithGoogle: (code: string) => Promise<void>;
  /** Finish linking Google to an EXISTING account after the user proves ownership with its password. */
  linkGoogle: (linkToken: string, password: string) => Promise<void>;
  logout:       () => void;
  refreshUser:  () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ─── Helper ──────────────────────────────────────────────── */
// Fix CRITICAL: use the shared api singleton (not bare axios) so the response
// interceptor's automatic JWT refresh is active even during session restore on mount.
const me = () => api.get<User>('/api/v1/users/me/');

/* ═══════════════════════════════════════════════════════════
   Provider
   ═══════════════════════════════════════════════════════════ */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore the session on mount.
  //  • tokens are read from sessionStorage only (never localStorage) — see lib/token-storage.ts
  //  • a session older than 12 h is discarded, not restored
  //  • a brand-new tab of the same browser session asks the open tabs for the session (BroadcastChannel)
  useEffect(() => {
    purgeLegacyTokens();                          // sessions persisted by older versions must not authenticate anyone
    let active = true;
    (async () => {
      if (hasSession() && isSessionExpired()) {   // e.g. browser restored the tab the next day
        clearTokens(); clearPrivateLocalData(); markSessionEnded('expired');
      }
      if (!getToken('access_token')) {
        const handedOver = await requestSessionFromOtherTabs();
        if (!handedOver) { if (active) setIsLoading(false); return; }
      }
      try {
        const { data } = await me();
        if (active) setUser(data);
      } catch (err) {
        // Only a definite "not authenticated" answer ends the session. A network blip or a 5xx while the
        // page loads (or while navigating back/forward) must not log the user out.
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) clearTokens();
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Logout in another tab of this browser session → this tab ends too (and never shows stale private content).
  useEffect(() => startSessionSync(() => {
    clearTokens(); clearPrivateLocalData(); setUser(null);
    window.location.replace('/login');
  }), []);

  // 12-hour watchdog: ONE timer for the exact deadline (no polling) + re-checks when the tab becomes visible,
  // regains focus, or is restored from the back/forward cache (timers do not run while a page is frozen).
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      if (isSessionExpired()) { expireSession('expired'); return; }
      if (!hasSession()) { setUser(null); window.location.replace('/login'); return; }   // cleared elsewhere (logout in another tab)
      schedule();
    };
    const schedule = () => {
      clearTimeout(timer);
      const ms = msUntilExpiry();
      if (ms !== null) timer = setTimeout(check, Math.min(ms + 50, 2 ** 31 - 1));
    };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) check(); };     // Back/Forward restored a frozen page
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', onShow);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
      window.removeEventListener('pageshow', onShow);
    };
  }, [user]);

  /* Re-fetch user from server (call after profile update) */
  const refreshUser = useCallback(async () => {
    if (!getToken('access_token')) return;
    try {
      const { data } = await me();
      setUser(data);
    } catch {
      // Silently ignore; api interceptor will handle 401
    }
  }, []);

  /** Password login → a temporary session (sessionStorage, 12 h maximum). */
  const login = async (username: string, password: string) => {
    // Fix: clear stale tokens before login for the same reason as register —
    // an expired token in storage would cause SimpleJWT to return 401 on
    // the /auth/token/ endpoint before it even checks the credentials.
    clearTokens();
    // Fix H-05: use shared api instance (not bare axios) so the Accept-Language
    // header is sent and the 401-refresh interceptor is active for these calls.
    const { data: tokens } = await api.post('/api/v1/auth/token/', { username, password });
    storeTokens(tokens.access, tokens.refresh);
    const { data: userData } = await me();
    setUser(userData);
  };

  const loginWithGoogle = async (code: string) => {
    clearTokens();  // same stale-token reasoning as login()
    const { data: res } = await api.post('/api/v1/auth/google/', { code });
    storeTokens(res.access, res.refresh);
    const { data: userData } = await me();
    setUser(userData);
  };

  const linkGoogle = async (linkToken: string, password: string) => {
    clearTokens();
    // confirm:true is the explicit user confirmation required by the backend.
    const { data: res } = await api.post('/api/v1/auth/google/link/', { link_token: linkToken, password, confirm: true });
    storeTokens(res.access, res.refresh);
    const { data: userData } = await me();
    setUser(userData);
  };

  const register = async (data: RegisterPayload) => {
    // Fix: clear any stale/expired tokens before the call.
    // The api interceptor adds Authorization: Bearer <token> to every request;
    // if an old token is in storage, SimpleJWT raises 401 AuthenticationFailed
    // even on AllowAny endpoints like /register/.
    clearTokens();
    const { data: res } = await api.post('/api/v1/users/register/', data);
    // Registration signs the user in with the same temporary session as a normal login
    storeTokens(res.access, res.refresh);
    const { data: userData } = await me();
    setUser(userData);
  };

  const logout = () => {
    // Blacklist the refresh token server-side so it can never be used again, even if it had been copied.
    // Fire-and-forget — the user is logged out immediately regardless of the network result.
    const refresh = getToken('refresh_token');
    if (refresh) {
      api
        .post('/api/v1/auth/token/blacklist/', { refresh })
        .catch(() => { /* ignore — the refresh token also expires with the session */ });
    }
    clearTokens();              // session storage (and any legacy localStorage copy)
    clearPrivateLocalData();    // per-user data kept in localStorage (e.g. flagged questions)
    broadcastLogout();          // other tabs of this browser session end too
    setUser(null);
    // replace(): the login page takes the place of the current history entry. Pressing Back later lands on an
    // earlier protected URL, which AuthGate sends to /login — it can never show private content again.
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginWithGoogle, linkGoogle, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
