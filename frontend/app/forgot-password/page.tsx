'use client';

import { useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { useLang } from '@/lib/i18n';
import { userAPI } from '@/lib/api';
import { Icon } from '@/components/shared';

export default function ForgotPasswordPage() {
  // Fix R13-02: destructure `t` — all strings now go through t() for consistent
  // bilingual i18n instead of raw lang === 'tr' ? … : … ternaries.
  const { t } = useLang();

  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError(t('fp_err_required'));
      return;
    }
    setLoading(true);
    try {
      await userAPI.forgotPassword(email.trim());
      setSent(true);
    } catch {
      // The API always returns 200 — an error here means a network problem.
      setError(t('fp_err_generic'));
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
            {t('fp_back_login')}
          </Link>
        </div>
      </header>

      {/* Card */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <span className="eyebrow" style={{ marginBottom: 10, display: 'block' }}>
            {t('fp_eyebrow')}
          </span>

          <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 10 }}>
            {t('fp_title')}
          </h1>

          {!sent ? (
            <>
              <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 28, lineHeight: 1.6 }}>
                {t('fp_desc')}
              </p>

              {error && (
                <div style={{ background: '#FFF5F3', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: 12, padding: '12px 16px', marginBottom: 20, lineHeight: 1.5 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="field">
                  {/* Fix R6-16: link label to input via htmlFor/id for accessibility */}
                  <label htmlFor="fp-email">{t('fp_email_label')}</label>
                  <input
                    id="fp-email"
                    className="input"
                    type="email"
                    placeholder="elif@atlas.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={loading}
                  style={{ padding: '12px 18px', fontSize: 12.5, justifyContent: 'space-between', opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? t('fp_sending') : t('fp_submit')}
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
                  {t('fp_sent_title')}
                </p>
                {/* Fix R13-05: uses t() variable interpolation to embed {email} in the bilingual string */}
                <p style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                  {t('fp_sent_body', { email })}
                </p>
              </div>

              <p style={{ fontSize: 11.5, color: 'var(--ink-4)', lineHeight: 1.6, marginBottom: 20 }}>
                {t('fp_spam_hint')}
              </p>

              <button
                className="btn btn-outline"
                style={{ width: '100%' }}
                onClick={() => { setSent(false); setEmail(''); }}
              >
                {t('fp_try_different')}
              </button>
            </div>
          )}

          {/* Back to login */}
          {!sent && (
            <div style={{ marginTop: 28, textAlign: 'center' }}>
              <Link href="/login" style={{ fontSize: 11.5, color: 'var(--ink-3)', textDecoration: 'none' }}>
                {t('fp_return_login')}
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
