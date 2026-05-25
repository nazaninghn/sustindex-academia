'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import axios from 'axios';
import { API_URL } from '@/lib/api';  // single source of truth
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
  username:     string;
  email:        string;
  password:     string;
  first_name?:  string;
  last_name?:   string;
  company_name?: string;
  phone?:       string;
  // NOTE: password_confirm must be stripped before calling register()
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
const me = (token: string) =>
  axios.get<User>(`${API_URL}/api/v1/users/me/`, {
    headers: { Authorization: `Bearer ${token}` },
  });

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
    me(token)
      .then(({ data }) => setUser(data))
      .catch(() => clearTokens())
      .finally(() => setIsLoading(false));
  }, []);

  /* Re-fetch user from server (call after profile update) */
  const refreshUser = useCallback(async () => {
    const token = getToken('access_token');
    if (!token) return;
    try {
      const { data } = await me(token);
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
    const { data: tokens } = await axios.post(`${API_URL}/api/v1/auth/token/`, { username, password });
    storeTokens(tokens.access, tokens.refresh, remember);
    const { data: userData } = await me(tokens.access);
    setUser(userData);
  };

  const register = async (data: RegisterPayload) => {
    const { data: res } = await axios.post(`${API_URL}/api/v1/users/register/`, data);
    // Registration always remembers (user explicitly created an account)
    storeTokens(res.access, res.refresh, true);
    const { data: userData } = await me(res.access);
    setUser(userData);
  };

  const logout = () => {
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
