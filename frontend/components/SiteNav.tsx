'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';
import LangToggle from './LangToggle';
import { useLang } from '@/lib/i18n';

export default function SiteNav() {
  const { t } = useLang();
  const path   = usePathname();
  const [open, setOpen] = useState(false);

  // Close menu on route change
  useEffect(() => { setOpen(false); }, [path]);
  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const links = [
    { label: t('nav_platform'),    href: '/' },
    { label: t('nav_methodology'), href: '/#methodology' },
    { label: t('nav_about'),       href: '/about' },
  ];

  return (
    <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--cream)', position: 'relative', zIndex: 100 }}>
      {/* ── Top bar ── */}
      <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: 58 }}>

        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}><Logo /></Link>

        {/* Desktop nav — hidden on mobile */}
        <nav className="sitenav-links" style={{ display: 'flex', gap: 28, justifyContent: 'center' }}>
          {links.map(({ label, href }) => (
            <Link key={href} href={href} style={{
              fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 12,
              color: 'var(--ink)', textDecoration: 'none',
              paddingBottom: 4,
              borderBottom: path === href ? '1px solid var(--ink)' : '1px solid transparent',
              whiteSpace: 'nowrap',
            }}>
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop actions — hidden on mobile */}
        <div className="sitenav-actions" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <LangToggle />
          <Link href="/login" style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, fontWeight: 500, color: 'var(--ink)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {t('nav_signin')}
          </Link>
          <Link href="/register" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>
              {t('nav_get_started')} →
            </button>
          </Link>
        </div>

        {/* Mobile: lang + hamburger */}
        <div className="sitenav-mobile-controls" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
          <LangToggle />
          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, display: 'flex', flexDirection: 'column',
              gap: 5, width: 34, height: 34, justifyContent: 'center', alignItems: 'center',
            }}
          >
            <span style={{
              display: 'block', width: 22, height: 1.5,
              background: 'var(--ink)',
              transform: open ? 'translateY(6.5px) rotate(45deg)' : 'none',
              transition: 'transform 0.2s',
            }} />
            <span style={{
              display: 'block', width: 22, height: 1.5,
              background: 'var(--ink)',
              opacity: open ? 0 : 1,
              transition: 'opacity 0.15s',
            }} />
            <span style={{
              display: 'block', width: 22, height: 1.5,
              background: 'var(--ink)',
              transform: open ? 'translateY(-6.5px) rotate(-45deg)' : 'none',
              transition: 'transform 0.2s',
            }} />
          </button>
        </div>
      </div>

      {/* ── Mobile dropdown menu ── */}
      {open && (
        <div className="sitenav-drawer" style={{
          position: 'fixed', top: 58, left: 0, right: 0, bottom: 0,
          background: 'var(--cream)', zIndex: 99,
          display: 'flex', flexDirection: 'column',
          padding: '0 24px 32px',
          overflowY: 'auto',
        }}>
          {/* Nav links */}
          <nav style={{ borderBottom: '1px solid var(--line)', paddingBottom: 20, marginBottom: 20 }}>
            {links.map(({ label, href }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} style={{
                display: 'block', padding: '14px 0',
                fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 16,
                color: path === href ? 'var(--olive-deep)' : 'var(--ink)',
                textDecoration: 'none',
                borderBottom: '1px solid var(--line)',
              }}>
                {label}
              </Link>
            ))}
          </nav>

          {/* Auth actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link href="/register" style={{ textDecoration: 'none' }} onClick={() => setOpen(false)}>
              <button className="btn btn-primary" style={{ width: '100%', padding: '14px 18px', fontSize: 14 }}>
                {t('nav_get_started')} →
              </button>
            </Link>
            <Link href="/login" style={{ textDecoration: 'none' }} onClick={() => setOpen(false)}>
              <button className="btn btn-outline" style={{ width: '100%', padding: '14px 18px', fontSize: 14 }}>
                {t('nav_signin')}
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* CSS for responsive switching */}
      <style>{`
        @media (max-width: 760px) {
          .sitenav-links     { display: none !important; }
          .sitenav-actions   { display: none !important; }
          .sitenav-mobile-controls { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
