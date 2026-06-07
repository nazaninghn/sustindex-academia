'use client';

// Fix M-9: Global error boundary for the Next.js App Router.
// Catches rendering errors from any client component in the app — including
// AuthProvider / LangProvider — and shows a recoverable UI instead of a blank page.
// Per Next.js docs, this file MUST be a Client Component.

import { useEffect, useState } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service if available
    console.error('[GlobalError boundary]', error);
  }, [error]);

  // Fix L-06: add bilingual support — useLang() may itself be broken (it's inside
  // the crashed subtree), so we read the stored language preference directly from
  // localStorage and fall back to 'en' rather than calling useLang().
  const [lang, setLangState] = useState<'en' | 'tr'>('en');
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sx_lang');
      if (stored === 'tr') setLangState('tr');
    } catch { /* localStorage unavailable */ }
  }, []);

  const isTr = lang === 'tr';

  const clearAndReload = () => {
    // Wipe tokens so a corrupt auth state doesn't re-trigger the crash
    try {
      for (const key of ['access_token', 'refresh_token']) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
    } catch { /* ignore — storage may itself be unavailable */ }
    window.location.href = '/login';
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAF9F7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'IBM Plex Sans', sans-serif",
      padding: '40px 24px',
    }}>
      <div style={{ maxWidth: 440, width: '100%' }}>
        {/* Monospace label */}
        <span style={{
          display: 'block',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          letterSpacing: '0.1em',
          color: '#B45D4C',
          marginBottom: 16,
          textTransform: 'uppercase',
        }}>
          {isTr ? 'Hata · bir şeyler ters gitti' : 'Error · something went wrong'}
        </span>

        <h1 style={{
          fontSize: 28,
          fontWeight: 400,
          letterSpacing: '-0.02em',
          color: '#1A1A18',
          marginBottom: 12,
          lineHeight: 1.2,
        }}>
          {isTr ? 'Uygulama yüklenemedi.' : 'The application could not load.'}
        </h1>

        <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 28 }}>
          {isTr
            ? 'Bir render hatası oluştu. Bu, uygulama durumu bozulduysa gerçekleşebilir. Önce sayfayı yenilemeyi deneyin; sorun devam ederse depolamayı temizleyip tekrar giriş yapın.'
            : 'A rendering error occurred. This can happen if the app state is corrupted. Try reloading first; if the problem persists, clear storage and log in again.'}
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            style={{
              padding: '10px 20px',
              background: '#1A1A18',
              color: '#FAF9F7',
              border: 'none',
              borderRadius: 6,
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: 500,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {isTr ? 'Tekrar dene' : 'Try again'}
          </button>
          <button
            onClick={clearAndReload}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              color: '#B45D4C',
              border: '1px solid #B45D4C',
              borderRadius: 6,
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: 500,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {isTr ? 'Depolamayı temizle ve giriş yap' : 'Clear storage & go to login'}
          </button>
        </div>
      </div>
    </div>
  );
}
