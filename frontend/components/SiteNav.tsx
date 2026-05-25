'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';
import LangToggle from './LangToggle';
import { useLang } from '@/lib/i18n';

export default function SiteNav() {
  const { t } = useLang();
  const path  = usePathname();

  const links = [
    { label: t('nav_platform'),    href: '/' },
    { label: t('nav_methodology'), href: '/#methodology' },
    { label: t('nav_about'),       href: '/about' },
  ];

  return (
    <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--cream)' }}>
      {/*
        3-column grid: logo | nav | actions
        The middle column is auto-sized and centred via justify-self.
        Left and right columns each take 1fr so they're equal width,
        which pushes the nav to the exact visual centre.
      */}
      <div className="wrap" style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '16px 32px',
        gap: 16,
      }}>

        {/* LEFT — Logo */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link href="/" style={{ textDecoration: 'none' }}><Logo /></Link>
        </div>

        {/* CENTRE — Nav links */}
        <nav style={{ display: 'flex', gap: 28, justifyContent: 'center' }}>
          {links.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontWeight: 500, fontSize: 12,
                color: 'var(--ink)', textDecoration: 'none',
                paddingBottom: 4,
                borderBottom: path === href
                  ? '1px solid var(--ink)'
                  : '1px solid transparent',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* RIGHT — Lang + Auth buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'flex-end' }}>
          <LangToggle />
          <Link
            href="/login"
            style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: 12, fontWeight: 500,
              color: 'var(--ink)', textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {t('nav_signin')}
          </Link>
          <Link href="/register" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>
              {t('nav_get_started')} →
            </button>
          </Link>
        </div>

      </div>
    </header>
  );
}
