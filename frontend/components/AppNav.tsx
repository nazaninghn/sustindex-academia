'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import Logo from './Logo';
import LangToggle from './LangToggle';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';

export default function AppNav() {
  const { t, lang }        = useLang();
  const path               = usePathname();
  const router             = useRouter();
  const { user, logout }   = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close menu on route change
  useEffect(() => { setOpen(false); }, [path]);

  // Fix A-4: focus trap — keep Tab-key focus inside the mobile drawer while open.
  // Also handles Escape to close and moves initial focus to the first item on open.
  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key !== 'Tab') return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const focusable = Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', trapFocus);
    // Move initial focus to the first interactive element so keyboard users
    // don't have to Tab from the hamburger button all the way back in.
    const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(
      'a[href], button:not([disabled])'
    );
    firstFocusable?.focus();
    return () => document.removeEventListener('keydown', trapFocus);
  }, [open, trapFocus]);
  // Fix M-27: iOS Safari ignores overflow:hidden on body without position:fixed.
  // Store and restore the scroll position so the page doesn't jump on close.
  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY;
      document.body.style.overflow  = 'hidden';
      document.body.style.position  = 'fixed';
      document.body.style.width     = '100%';
      document.body.style.top       = `-${scrollY}px`;
    } else {
      const scrollY = parseInt(document.body.style.top || '0', 10) * -1;
      document.body.style.overflow  = '';
      document.body.style.position  = '';
      document.body.style.width     = '';
      document.body.style.top       = '';
      window.scrollTo(0, scrollY);
    }
    return () => {
      document.body.style.overflow  = '';
      document.body.style.position  = '';
      document.body.style.width     = '';
      document.body.style.top       = '';
    };
  }, [open]);

  const items: [string, string][] = [
    [t('nav_overview'),   '/dashboard'],
    [t('nav_surveys'),    '/surveys'],
    [t('nav_courses'),    '/courses'],
    [t('nav_history'),    '/history'],
    [lang === 'tr' ? 'Belgeler' : 'Documents',    '/documents'],
    [lang === 'tr' ? 'Eylem Planı' : 'Action Plan', '/action-plan'],
  ];

  const firstName = user?.first_name || user?.username || '—';
  const company   = user?.company_name || '';
  const initials  = ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')).toUpperCase()
    || user?.username?.[0]?.toUpperCase()
    || '?';

  return (
    <header style={{
      borderBottom: '1px solid var(--line)',
      background: 'var(--cream)',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      {/* ── Top bar ── */}
      <div className="wrap" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: 57,
      }}>

        {/* Left: logo + separator + nav links (desktop) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <Logo size={22} />
          </Link>
          <span className="appnav-separator" style={{ width: 1, height: 22, background: 'var(--line)', flexShrink: 0 }} />
          <nav className="appnav-links" style={{ display: 'flex', gap: 2 }}>
            {items.map(([label, href]) => (
              <Link key={href} href={href} style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontWeight: 500, fontSize: 12,
                color: path === href ? 'var(--ink)' : 'var(--ink-3)',
                padding: '5px 11px', borderRadius: 999,
                background: path === href ? 'var(--cream-deep)' : 'transparent',
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}>
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: user info (desktop) */}
        <div className="appnav-user" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <LangToggle />
          <div style={{ width: 1, height: 22, background: 'var(--line)', flexShrink: 0 }} />
          <Link href="/profile" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--olive)', color: 'var(--ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 11,
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--ink)' }}>
                {firstName}
              </span>
              {company && (
                <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{company}</span>
              )}
            </div>
          </Link>
          <div style={{ width: 1, height: 22, background: 'var(--line)', flexShrink: 0 }} />
          {/* Logout button — desktop */}
          {/* Fix R4-M-06: aria-label so screen readers announce the action */}
          <button
            onClick={handleLogout}
            title={t('nav_logout')}
            aria-label={t('nav_logout')}
            style={{
              background: 'none', border: '1px solid var(--line)',
              cursor: 'pointer', borderRadius: 6,
              padding: '5px 10px',
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: 11, fontWeight: 500,
              color: 'var(--ink-3)',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--danger)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-3)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)';
            }}
          >
            {/* logout icon */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {t('nav_logout')}
          </button>
        </div>

        {/* Mobile controls: lang + hamburger */}
        <div className="appnav-mobile-controls" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
          <LangToggle />
          {/* Fix R5-L-02: aria-controls links the button to the drawer for screen readers */}
          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav-drawer"
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

      {/* ── Mobile drawer ── */}
      {open && (
        <div ref={drawerRef} id="mobile-nav-drawer" style={{
          position: 'fixed', top: 57, left: 0, right: 0, bottom: 0,
          background: 'var(--cream)', zIndex: 51, /* Fix L-16: must exceed header z-index:50 */
          display: 'flex', flexDirection: 'column',
          padding: '0 24px 32px',
          overflowY: 'auto',
        }}>
          {/* Nav links */}
          <nav style={{ borderBottom: '1px solid var(--line)', paddingBottom: 16, marginBottom: 16 }}>
            {items.map(([label, href]) => (
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

          {/* User / Profile */}
          <Link href="/profile" onClick={() => setOpen(false)} style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '16px 0',
              borderBottom: '1px solid var(--line)',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'var(--olive)', color: 'var(--ink)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 14,
                flexShrink: 0,
              }}>
                {initials}
              </div>
              <div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--ink)' }}>
                  {firstName}
                </div>
                {company && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{company}</div>
                )}
              </div>
              <span style={{ marginLeft: 'auto', color: 'var(--ink-4)', fontSize: 14 }}>→</span>
            </div>
          </Link>

          {/* Logout — mobile drawer */}
          <button
            onClick={handleLogout}
            aria-label={t('nav_logout')}
            style={{
              marginTop: 8,
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', background: 'none',
              border: '1px solid var(--line)', borderRadius: 8,
              padding: '14px 16px', cursor: 'pointer',
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: 15, fontWeight: 500, color: 'var(--danger)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {t('nav_logout')}
          </button>
        </div>
      )}

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 760px) {
          .appnav-links           { display: none !important; }
          .appnav-separator       { display: none !important; }
          .appnav-user            { display: none !important; }
          .appnav-mobile-controls { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
