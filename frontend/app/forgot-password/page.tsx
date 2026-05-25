'use client';

import { useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { useLang } from '@/lib/i18n';
import { userAPI } from '@/lib/api';
import { Icon } from '@/components/shared';

export default function ForgotPasswordPage() {
  const { lang } = useLang();

  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError(lang === 'tr' ? 'E-posta adresi gereklidir.' : 'Email address is required.');
      return;
    }
    setLoading(true);
    try {
      await userAPI.forgotPassword(email.trim());
      setSent(true);
    } catch {
      // The API always returns 200 — an error here means a network problem
      setError(lang === 'tr' ? 'Bir hata oluştu. Lütfen tekrar deneyin.' : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <header style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 32px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}><Logo size={20} /></Link>
          <Link href="/login" style={{ textDecoration: 'none', fontSize: 11.5, color: 'var(--ink-3)' }}>
            ← {lang === 'tr' ? 'Girişe Dön' : 'Back to Login'}
          </Link>
        </div>
      </header>

      {/* Card */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <span className="eyebrow" style={{ marginBottom: 10, display: 'block' }}>
            {lang === 'tr' ? 'Şifre Sıfırlama' : 'Password Reset'}
          </span>

          <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 10 }}>
            {lang === 'tr' ? 'Şifreni mi unuttun?' : 'Forgot your password?'}
          </h1>

          {!sent ? (
            <>
              <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 28, lineHeight: 1.6 }}>
                {lang === 'tr'
                  ? 'Hesabınla ilişkili e-posta adresini gir; sıfırlama bağlantısını göndereceğiz.'
                  : 'Enter the email address associated with your account and we\'ll send you a reset link.'}
              </p>

              {error && (
                <div style={{ background: '#FFF5F3', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: 12, padding: '12px 16px', marginBottom: 20, lineHeight: 1.5 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="field">
                  <label>{lang === 'tr' ? 'E-posta Adresi' : 'Email Address'}</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="elif@atlas.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={loading}
                  style={{ padding: '12px 18px', fontSize: 12.5, justifyContent: 'space-between', opacity: loading ? 0.6 : 1 }}
                >
                  {loading
                    ? (lang === 'tr' ? 'Gönderiliyor…' : 'Sending…')
                    : (lang === 'tr' ? 'Sıfırlama Bağlantısı Gönder' : 'Send Reset Link')}
                  {!loading && <Icon.arrow />}
                </button>
              </form>
            </>
          ) : (
            /* ── Success state ── */
            <div>
              <div style={{
                background: 'var(--olive-wash)', border: '1px solid var(--olive)',
                padding: '20px 22px', marginBottom: 24,
              }}>
                <p style={{ fontSize: 13, color: 'var(--olive-deep)', fontWeight: 500, marginBottom: 6 }}>
                  {lang === 'tr' ? '✓  Bağlantı gönderildi' : '✓  Link sent'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                  {lang === 'tr'
                    ? `${email} adresine bir sıfırlama bağlantısı gönderildi (hesap mevcutsa). Gelen kutunuzu kontrol edin.`
                    : `A reset link was sent to ${email} (if an account exists). Check your inbox — it may take a minute.`}
                </p>
              </div>

              <p style={{ fontSize: 11.5, color: 'var(--ink-4)', lineHeight: 1.6, marginBottom: 20 }}>
                {lang === 'tr'
                  ? 'E-posta gelmezse spam klasörünü kontrol edin veya tekrar deneyin.'
                  : 'If it doesn\'t arrive, check your spam folder or try again.'}
              </p>

              <button
                className="btn btn-outline"
                style={{ width: '100%' }}
                onClick={() => { setSent(false); setEmail(''); }}
              >
                {lang === 'tr' ? 'Farklı E-posta ile Tekrar Dene' : 'Try a Different Email'}
              </button>
            </div>
          )}

          {/* Divider + back to login */}
          {!sent && (
            <div style={{ marginTop: 28, textAlign: 'center' }}>
              <Link href="/login" style={{ fontSize: 11.5, color: 'var(--ink-3)', textDecoration: 'none' }}>
                {lang === 'tr' ? 'Girişe geri dön' : 'Return to login'}
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
