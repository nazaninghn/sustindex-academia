'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';
import LangToggle from './LangToggle';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';

export default function AppNav() {
  const { t } = useLang();
  const path = usePathname();
  const { user } = useAuth();

  // Fix J: removed dead '/results' route (no index page — only /results/[id] exists);
  // '/history' already covers the assessments list.
  const items: [string, string][] = [
    [t('nav_overview'), '/dashboard'],
    [t('nav_surveys'),  '/surveys'],
    [t('nav_courses'),  '/courses'],
    [t('nav_history'),  '/history'],
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
      <div className="wrap" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link href="/" style={{ textDecoration: 'none' }}><Logo size={22} /></Link>
          <span style={{ width: 1, height: 22, background: 'var(--line)' }}></span>
          <nav style={{ display: 'flex', gap: 2 }}>
            {items.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontWeight: 500, fontSize: 12,
                  color: path === href ? 'var(--ink)' : 'var(--ink-3)',
                  padding: '5px 11px', borderRadius: 999,
                  background: path === href ? 'var(--cream-deep)' : 'transparent',
                  textDecoration: 'none',
                }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <LangToggle />
          <div style={{ width: 1, height: 22, background: 'var(--line)' }}></div>
          <Link href="/profile" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--olive)', color: 'var(--ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 11,
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
        </div>
      </div>
    </header>
  );
}
