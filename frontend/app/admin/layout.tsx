'use client';
/**
 * Admin console shell — /admin/*
 *
 * Signed-out visitors never get here (AuthGate redirects them).  Signed-in members who are
 * not staff see a "no access" panel; the real enforcement is server-side (IsAdminUser on
 * every /api/v1/admin/ endpoint), this only avoids showing an empty console.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { djangoAdminUrl, initialsOf } from '@/lib/admin';
import { Icon, useTx } from '@/components/admin/ui';
import './admin.css';

const THEME_KEY = 'sx_admin_theme';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { setLang } = useLang();
  const { tx, lang } = useTx();
  const path = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Stored choice wins; otherwise follow the OS. Applied after mount so SSR and first paint agree.
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch { /* storage unavailable */ }
    if (stored === 'dark' || stored === 'light') setTheme(stored);
    else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) setTheme('dark');
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
  };

  useEffect(() => { setMenu(false); }, [path]);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menu]);

  const items = [
    { href: '/admin', label: tx('Overview', 'Genel Bakış'), icon: 'home' },
    { href: '/admin/users', label: tx('Users', 'Kullanıcılar'), icon: 'users' },
    { href: '/admin/assessments', label: tx('Assessments', 'Değerlendirmeler'), icon: 'clipboard' },
    { href: '/admin/content', label: tx('Content', 'İçerik'), icon: 'layers' },
  ];
  const isActive = (href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/'));
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || '';

  return (
    <div className="adm" data-theme={theme}>
      <div className="adm-shell">
        <header className="adm-top">
          <Link href="/admin" className="adm-brand">
            <span className="adm-brand-mark"><Icon name="leaf" size={20} /></span>
            <span className="adm-brand-text">
              <div className="adm-brand-name">Sustindex</div>
              <div className="adm-brand-sub">{tx('Admin console', 'Yönetim konsolu')}</div>
            </span>
          </Link>

          <nav className="adm-nav" aria-label={tx('Admin sections', 'Yönetim bölümleri')}>
            {items.map((it) => (
              <Link key={it.href} href={it.href} aria-current={isActive(it.href) ? 'page' : undefined}>
                <Icon name={it.icon} size={15} />{it.label}
              </Link>
            ))}
          </nav>

          <div className="adm-top-actions">
            <div className="adm-lang" role="group" aria-label={tx('Language', 'Dil')}>
              {(['en', 'tr'] as const).map((l) => (
                <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
            <button className="adm-icon-btn" onClick={toggleTheme}
              aria-label={theme === 'dark' ? tx('Switch to light theme', 'Açık temaya geç') : tx('Switch to dark theme', 'Koyu temaya geç')}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button className="adm-avatar" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}
                aria-label={tx('Account menu', 'Hesap menüsü')}>
                {initialsOf(displayName)}
              </button>
              {menu && (
                <div className="adm-menu" role="menu">
                  <div className="adm-menu-head">
                    <div style={{ fontWeight: 600 }}>{displayName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--a-ink-3)' }}>{user?.email}</div>
                  </div>
                  <Link href="/dashboard" role="menuitem"><Icon name="home" size={14} />{tx('Back to the app', 'Uygulamaya dön')}</Link>
                  <a href={djangoAdminUrl()} target="_blank" rel="noopener noreferrer" role="menuitem">
                    <Icon name="external" size={14} />{tx('Django admin', 'Django yönetimi')}
                  </a>
                  <button role="menuitem" onClick={() => { logout(); router.push('/login'); }}>
                    <Icon name="logout" size={14} />{tx('Sign out', 'Çıkış yap')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {user && user.is_staff === false ? (
          <div className="adm-center">
            <div>
              <h1 className="adm-title" style={{ fontSize: 22 }}>{tx('Staff access only', 'Yalnızca yetkili erişimi')}</h1>
              <p style={{ margin: '8px 0 18px' }}>
                {tx('Your account does not have permission to open the admin console.',
                    'Hesabınızın yönetim konsolunu açma yetkisi yok.')}
              </p>
              <Link href="/dashboard" className="adm-btn solid">{tx('Back to dashboard', 'Panele dön')}</Link>
            </div>
          </div>
        ) : children}
      </div>
    </div>
  );
}
