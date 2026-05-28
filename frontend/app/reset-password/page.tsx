'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { useLang } from '@/lib/i18n';
import { userAPI } from '@/lib/api';
import { Icon } from '@/components/shared';

/* ── Inner component (must be wrapped in Suspense for useSearchParams) ──────── */
function ResetPasswordForm() {
  const { lang }       = useLang();
  const router         = useRouter();
  const searchParams   = useSearchParams();

  const uid   = searchParams.get('uid')   ?? '';
  const token = searchParams.get('token') ?? '';

  const [pw1,     setPw1]     = useState('');
  const [pw2,     setPw2]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  // Validate that the link actually has uid + token
  const linkValid = Boolean(uid && token);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (pw1 !== pw2) {
      setError(lang === 'tr' ? 'Şifreler eşleşmiyor.' : 'Passwords do not match.');
      return;
    }
    if (pw1.length < 8) {
      setError(lang === 'tr' ? 'Şifre en az 8 karakter olmalıdır.' : 'Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await userAPI.resetPassword(uid, token, pw1);
      setSuccess(true);
      // redirect is handled by the useEffect below (with cleanup)
    } catch (err: unknown) {
      // Fix #1: narrow err from unknown before property access.
      const e = err as { response?: { data?: { detail?: string | string[] } } };
      const detail = e?.response?.data?.detail;
      setError(
        (Array.isArray(detail) ? detail.join(' ') : detail) ||
        (lang === 'tr' ? 'Bağlantı geçersiz veya süresi dolmuş.' : 'Reset link is invalid or has expired.')
      );
    } finally {
      setLoading(false);
    }
  };

  // Fix #11: use an effect with cleanup so the redirect timer doesn't leak
  // if the component unmounts before the 3-second delay fires.
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => router.push('/login'), 3000);
    return () => clearTimeout(timer);
  }, [success, router]);

  /* ── Invalid link state ── */
  if (!linkValid) {
    return (
      <div>
        <div style={{ background: '#FFF5F3', border: '1px solid var(--danger)', padding: '18px 20px', marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--danger)', marginBottom: 4 }}>
            {lang === 'tr' ? 'Geçersiz Bağlantı' : 'Invalid Link'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            {lang === 'tr'
              ? 'Bu sıfırlama bağlantısı geçersiz veya süresi dolmuş. Lütfen yeni bir bağlantı isteyin.'
              : 'This password-reset link is invalid or has expired. Please request a new one.'}
          </p>
        </div>
        <Link href="/forgot-password" style={{ textDecoration: 'none' }}>
          <button className="btn btn-primary" style={{ width: '100%' }}>
            {lang === 'tr' ? 'Yeni Bağlantı İste' : 'Request New Link'} <Icon.arrow />
          </button>
        </Link>
      </div>
    );
  }

  /* ── Success state ── */
  if (success) {
    return (
      <div style={{ background: 'var(--olive-wash)', border: '1px solid var(--olive)', padding: '20px 22px' }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--olive-deep)', marginBottom: 6 }}>
          {lang === 'tr' ? '✓  Şifre başarıyla değiştirildi' : '✓  Password changed successfully'}
        </p>
        <p style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          {lang === 'tr'
            ? '3 saniye içinde giriş sayfasına yönlendirileceksiniz…'
            : 'Redirecting you to login in 3 seconds…'}
        </p>
      </div>
    );
  }

  /* ── Form state ── */
  return (
    <>
      <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 28, lineHeight: 1.6 }}>
        {lang === 'tr'
          ? 'Hesabınız için yeni bir şifre belirleyin. Şifreniz en az 8 karakter olmalıdır.'
          : 'Set a new password for your account. It must be at least 8 characters.'}
      </p>

      {error && (
        <div style={{ background: '#FFF5F3', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: 12, padding: '12px 16px', marginBottom: 20, lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="field">
          <label>{lang === 'tr' ? 'Yeni Şifre' : 'New Password'}</label>
          <input
            className="input"
            type="password"
            placeholder="••••••••"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label>{lang === 'tr' ? 'Şifreyi Onayla' : 'Confirm New Password'}</label>
          <input
            className="input"
            type="password"
            placeholder="••••••••"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            required
          />
        </div>

        <button
          className="btn btn-primary"
          type="submit"
          disabled={loading}
          style={{ padding: '12px 18px', fontSize: 12.5, justifyContent: 'space-between', opacity: loading ? 0.6 : 1 }}
        >
          {loading
            ? (lang === 'tr' ? 'Kaydediliyor…' : 'Saving…')
            : (lang === 'tr' ? 'Şifreyi Güncelle' : 'Update Password')}
          {!loading && <Icon.arrow />}
        </button>
      </form>
    </>
  );
}

/* ── Page shell ─────────────────────────────────────────────────────────────── */
export default function ResetPasswordPage() {
  const { lang } = useLang();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 32px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}><Logo size={20} /></Link>
          <Link href="/login" style={{ textDecoration: 'none', fontSize: 11.5, color: 'var(--ink-3)' }}>
            ← {lang === 'tr' ? 'Girişe Dön' : 'Back to Login'}
          </Link>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <span className="eyebrow" style={{ marginBottom: 10, display: 'block' }}>
            {lang === 'tr' ? 'Şifre Sıfırlama' : 'Password Reset'}
          </span>
          <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 10 }}>
            {lang === 'tr' ? 'Yeni şifre belirle' : 'Set a new password'}
          </h1>

          {/* useSearchParams must be inside Suspense */}
          <Suspense fallback={<div style={{ height: 200 }} />}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
