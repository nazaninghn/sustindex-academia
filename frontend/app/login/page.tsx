'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import Logo from '@/components/Logo';
import { Icon } from '@/components/shared';

export default function LoginPage() {
  const router   = useRouter();
  const { login, user, isLoading: authLoading } = useAuth();
  const { t } = useLang();

  // M4: redirect already-authenticated users away from the login page.
  useEffect(() => {
    if (!authLoading && user) router.push('/dashboard');
  }, [authLoading, user, router]);

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(formData.username, formData.password, remember);
      router.push('/dashboard');
    } catch (err: unknown) {
      // L1: narrow err from unknown before property access.
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || t('login_fail'));
    } finally {
      setLoading(false);
    }
  };

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
              <label>{t('login_username')}</label>
              <input
                className="input"
                type="text"
                placeholder="elif.demir"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label>{t('login_password')}</label>
                <Link href="/forgot-password" style={{ fontSize: 10, color: 'var(--ink-3)', textDecoration: 'none' }}>
                  {t('login_forgot')}
                </Link>
              </div>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer',
              margin: '4px 0 8px',
            }}>
              <input
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
          <span>© 2026 Sustindex</span>
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
