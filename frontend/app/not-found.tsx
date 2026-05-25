'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--cream)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 96, fontWeight: 300,
          letterSpacing: '-0.06em', lineHeight: 1,
          color: 'var(--ink)', display: 'block', marginBottom: 24,
          fontVariantNumeric: 'tabular-nums',
        }}>404</span>

        <div style={{ width: 48, height: 1, background: 'var(--olive)', margin: '0 auto 24px' }}></div>

        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 12, letterSpacing: '-0.01em' }}>
          Page not found
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 36 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div style={{ display: 'inline-flex', gap: 10 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary">← Back to home</button>
          </Link>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <button className="btn btn-outline">Dashboard</button>
          </Link>
        </div>
      </div>
    </div>
  );
}
