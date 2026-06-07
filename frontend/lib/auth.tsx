'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '@/lib/api';  // Fix H-05 / CRITICAL: use singleton so the 401-refresh interceptor fires
import { getToken, storeTokens, clearTokens } from '@/lib/token-storage';

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
  /** @param remember  true = localStorage (persistent), false = sessionStorage (tab-scoped) */
  login:        (username: string, password: string, remember?: boolean) => Promise<void>;
  register:     (data: RegisterPayload) => Promise<void>;
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

  // Restore session on mount — checks both localStorage and sessionStorage
  useEffect(() => {
    const token = getToken('access_token');
    if (!token) { setIsLoading(false); return; }
    me()
      .then(({ data }) => setUser(data))
      .catch(() => clearTokens())
      .finally(() => setIsLoading(false));
  }, []);

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

  /**
   * @param remember  true (default) → tokens persist in localStorage across browser restarts.
   *                  false          → tokens live in sessionStorage (cleared when tab closes).
   */
  const login = async (username: string, password: string, remember = true) => {
    // Fix: clear stale tokens before login for the same reason as register —
    // an expired token in storage would cause SimpleJWT to return 401 on
    // the /auth/token/ endpoint before it even checks the credentials.
    clearTokens();
    // Fix H-05: use shared api instance (not bare axios) so the Accept-Language
    // header is sent and the 401-refresh interceptor is active for these calls.
    const { data: tokens } = await api.post('/api/v1/auth/token/', { username, password });
    storeTokens(tokens.access, tokens.refresh, remember);
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
    // Registration always remembers (user explicitly created an account)
    storeTokens(res.access, res.refresh, true);
    const { data: userData } = await me();
    setUser(userData);
  };

  const logout = () => {
    // Security fix: blacklist the refresh token server-side so it can't be reused
    // for the remaining REFRESH_TOKEN_LIFETIME (7 days) even if extracted from storage.
    // Fire-and-forget — user is logged out immediately regardless of network result.
    const refresh = getToken('refresh_token');
    if (refresh) {
      api
        .post('/api/v1/auth/token/blacklist/', { refresh })
        .catch(() => { /* ignore — token will expire naturally */ });
    }
    clearTokens();   // clears both localStorage and sessionStorage
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
