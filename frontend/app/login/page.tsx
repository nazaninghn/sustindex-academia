'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import Logo from '@/components/Logo';
import { Icon } from '@/components/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export default function LoginPage() {
  const router   = useRouter();
  const { login, user, isLoading: authLoading } = useAuth();
  const { t, lang } = useLang();

  // M4: redirect already-authenticated users away from the login page.
  useEffect(() => {
    if (!authLoading && user) router.replace('/dashboard');
  }, [authLoading, user, router]);

  // Pre-warm the Render dyno as soon as the page loads.
  // By the time the user types their credentials and clicks Sign In
  // the cold-start delay is already paid — the login call responds instantly.
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${API_BASE}/health/`, { signal: ctrl.signal, cache: 'no-store' })
      .catch(() => { /* server may be sleeping — that's fine, ping still wakes it */ });
    return () => ctrl.abort();
  }, []);

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  // Show a friendly "server warming up" notice if login takes > 7 s
  const [slowConn, setSlowConn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSlowConn(false);
    setLoading(true);
    // After 7 s still loading → server is waking from cold start, show notice
    const slowTimer = setTimeout(() => setSlowConn(true), 7000);
    try {
      await login(formData.username, formData.password, remember);
      router.replace('/dashboard');
    } catch (err: unknown) {
      // L1: narrow err from unknown before property access.
      const e = err as { response?: { status?: number; data?: { detail?: string } } };
      // Fix R5-M-06: distinguish HTTP 429 throttle from generic auth failure
      if (e.response?.status === 429) {
        setError(t('err_throttle'));
      } else {
        setError(e.response?.data?.detail || t('login_fail'));
      }
    } finally {
      clearTimeout(slowTimer);
      setSlowConn(false);
      setLoading(false);
    }
  };

  // Don't flash the login form while the auth state is still being determined.
  // All hooks are above this point — safe to early-return here.
  // Fix R5-L-08: use t() so the loading label is bilingual
  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>{t('t_loading_auth')}</span>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <header style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 32px',
        }}>
          <Link href="/" style={{ textDecoration: 'none' }}><Logo size={20} /></Link>
          <Link href="/" style={{ textDecoration: 'none', fontSize: 11.5, color: 'var(--ink-3)' }}>
            ← {t('nav_back_home')}
          </Link>
        </div>
      </header>

      {/* Centered card */}
      <main style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <span className="eyebrow" style={{ marginBottom: 10, display: 'block' }}>{t('login_eyebrow')}</span>
          <h1 style={{ fontSize: 32, marginBottom: 10, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {t('login_title')}
          </h1>
          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 32, lineHeight: 1.6 }}>
            {t('login_desc')}
          </p>

          {/* Slow-connection notice — shown when Render dyno is waking from cold start */}
          {slowConn && !error && (
            <div style={{
              background: '#FFFBEA', border: '1px solid #D4A017',
              color: '#7A5800', fontSize: 12, padding: '12px 16px',
              marginBottom: 20, lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⏳</span>
              <span>
                {lang === 'tr'
                  ? 'Sunucu başlatılıyor, lütfen bekleyin… (ilk bağlantı ~30 sn sürebilir)'
                  : 'سرور در حال راه‌اندازی است، لطفاً صبر کنید… (اولین اتصال تا ۳۰ ثانیه ممکن است طول بکشد)'}
              </span>
            </div>
          )}

          {error && (
            <div style={{
              background: '#FFF5F3', border: '1px solid var(--danger)',
              color: 'var(--danger)', fontSize: 12, padding: '12px 16px',
              marginBottom: 20, lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="field">
              <label htmlFor="login-username">{t('login_username')}</label>
              <input
                id="login-username"
                className="input"
                type="text"
                placeholder="elif.demir"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                autoComplete="username"
              />
            </div>
            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label htmlFor="login-password">{t('login_password')}</label>
                <Link href="/forgot-password" style={{ fontSize: 10, color: 'var(--ink-3)', textDecoration: 'none' }}>
                  {t('login_forgot')}
                </Link>
              </div>
              <input
                id="login-password"
                className="input"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                autoComplete="current-password"
              />
            </div>

            <label htmlFor="login-remember" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer',
              margin: '4px 0 8px',
            }}>
              <input
                id="login-remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: 'var(--olive-deep)' }}
              />
              {t('login_remember')}
            </label>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ padding: '12px 18px', fontSize: 12.5, justifyContent: 'space-between', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? t('login_submitting') : t('login_submit')}
              <Icon.arrow />
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }}></div>
            <span style={{ fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {t('t_or')}
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }}></div>
          </div>

          <Link href="/register" style={{ textDecoration: 'none', display: 'block' }}>
            <button className="btn btn-outline" style={{ width: '100%', padding: '12px 18px', fontSize: 12.5 }}>
              {t('login_create')}
            </button>
          </Link>
        </div>
      </main>

      {/* Footer trust strip */}
      <footer style={{ borderTop: '1px solid var(--line)' }}>
        <div className="wrap" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 32px',
          fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em',
          textTransform: 'uppercase', fontFamily: "'IBM Plex Sans', sans-serif",
        }}>
          {/* Fix L-04: use i18n key so year is always current and
              the copy matches the rest of the site */}
          <span>{t('foot_copy')}</span>
          <div style={{ display: 'flex', gap: 14 }}>
            <span>{t('login_secure')}</span><span>·</span>
            <span>{t('login_iso')}</span><span>·</span>
            <span>{t('login_gdpr')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
