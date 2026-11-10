'use client';
/**
 * Central route protection.
 *
 * Protected pages are never rendered without an authenticated user: not while the session is being restored,
 * not after logout / expiry, and not when the browser restores a frozen page from its back/forward cache.
 * An unauthenticated visitor is sent to /login with replace(), so the protected URL is not kept in the history.
 *
 * Browser Back/Forward by themselves never end a session — this gate only reacts to "there is no session".
 * (The individual pages keep their own redirect as a second line of defence.)
 */
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { isProtectedPath } from '@/lib/auth-paths';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { t } = useLang();
  const guarded = isProtectedPath(path);

  useEffect(() => {
    if (guarded && !isLoading && !user) router.replace('/login');
  }, [guarded, isLoading, user, router]);

  if (guarded && !user) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>
          {t('t_loading_auth')}
        </span>
      </div>
    );
  }
  return <>{children}</>;
}
