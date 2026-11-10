'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { beginOAuthState, consumeOAuthState, clearOAuthState } from '@/lib/oauth-state';
import { takeSessionNotice } from '@/lib/session';
import Logo from '@/components/Logo';
import { Icon } from '@/components/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
// Public OAuth client ID (safe in the browser). The client SECRET lives only on the backend.
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GSI_SRC = 'https://accounts.google.com/gsi/client';

/* Official multi-colour Google "G" mark (Google brand guidelines). */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function LoginPage() {
  const router   = useRouter();
  const { login, loginWithGoogle, linkGoogle, user, isLoading: authLoading } = useAuth();
  const { t, lang } = useLang();

  // M4: redirect already-authenticated users away from the login page.
  useEffect(() => {
    if (!authLoading && user) router.replace('/dashboard');
  }, [authLoading, user, router]);

  // Pre-warm the Render dyno as soon as the page loads.
  // By the time the user types their credentials and clicks Sign In
  // the cold-start delay is already paid — the login call responds instantly.
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${API_BASE}/health/`, { signal: ctrl.signal, cache: 'no-store' })
      .catch(() => { /* server may be sleeping — that's fine, ping still wakes it */ });
    return () => ctrl.abort();
  }, []);

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error,    setError]    = useState('');
  const [notice,   setNotice]   = useState('');      // neutral message (e.g. Google popup cancelled)
  const [loading,  setLoading]  = useState(false);
  // One-time message when the previous session ended (12 h limit reached / no longer valid)
  useEffect(() => {
    const why = takeSessionNotice();
    if (why) setNotice(t('login_session_ended'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [gLoading, setGLoading] = useState(false);
  // Set when Google's email matches an existing, unlinked SustIndex account: the user must
  // confirm with that account's password before anything is linked.
  const [linkInfo, setLinkInfo] = useState<{ token: string; email: string } | null>(null);
  const [linkPw,   setLinkPw]   = useState('');
  const [linkOk,   setLinkOk]   = useState(false);
  const [linking,  setLinking]  = useState(false);

  // Load Google Identity Services only when a client ID is configured.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || document.querySelector(`script[src="${GSI_SRC}"]`)) return;
    const s = document.createElement('script');
    s.src = GSI_SRC; s.async = true; s.defer = true;
    document.head.appendChild(s);
  }, []);

  const googleError = (err: unknown) => {
    const e = err as { response?: { status?: number; data?: { code?: string } } };
    const code = e.response?.data?.code;
    if (e.response?.status === 429)          return t('err_throttle');
    if (code === 'not_configured')           return t('g_err_unconfigured');
    if (code === 'email_not_verified')       return t('g_err_unverified');
    if (code === 'admin_link_blocked')       return t('g_err_admin');
    if (code === 'inactive')                 return t('g_err_disabled');
    return t('g_err_generic');
  };

  const linkError = (err: unknown) => {
    const e = err as { response?: { status?: number; data?: { code?: string } } };
    const code = e.response?.data?.code;
    if (e.response?.status === 429)                              return t('err_throttle');
    if (code === 'invalid_password')                             return t('g_err_link_pw');
    if (code === 'password_not_set')                             return t('g_err_link_nopw');
    if (code === 'admin_link_blocked')                           return t('g_err_admin');
    if (code === 'inactive')                                     return t('g_err_disabled');
    if (code === 'already_linked')                               return t('g_err_already');
    return t('g_err_generic');
  };

  const cancelLink = () => { setLinkInfo(null); setLinkPw(''); setLinkOk(false); setError(''); setNotice(''); };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkInfo) return;
    setError('');
    setLinking(true);
    try {
      await linkGoogle(linkInfo.token, linkPw);
      router.replace('/dashboard');
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
      if (code === 'link_expired' || code === 'invalid_link_token' || code === 'link_failed') {
        cancelLink();                       // start over from Google
        setError(t('g_err_link_expired'));
      } else {
        setError(linkError(err));
      }
    } finally {
      setLinking(false);
    }
  };

  // Each Google attempt gets an id; callbacks from any earlier attempt are ignored outright.
  const googleAttempt = useRef(0);
  useEffect(() => () => { googleAttempt.current += 1; clearOAuthState(); }, []);   // unmount: invalidate

  const handleGoogle = () => {
    setError(''); setNotice('');
    if (!GOOGLE_CLIENT_ID) { setError(t('g_err_unconfigured')); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oauth2 = (window as any).google?.accounts?.oauth2;
    if (!oauth2) { setError(t('g_err_unavailable')); return; }   // script blocked / offline

    const attempt = ++googleAttempt.current;
    const isCurrent = () => attempt === googleAttempt.current;
    setGLoading(true);
    try {
      // Login-CSRF protection: a fresh, random, single-use `state` per click (see lib/oauth-state.ts).
      // Google echoes it back with the code; it must match exactly before the code goes to our API.
      const client = oauth2.initCodeClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        ux_mode: 'popup',
        state: beginOAuthState(),
        callback: async (resp: { code?: string; error?: string; state?: string }) => {
          if (!isCurrent()) return;                      // stale popup from an earlier attempt
          if (!resp.code) {
            clearOAuthState(); setGLoading(false);
            if (resp.error === 'access_denied') setNotice(t('g_err_cancel')); else setError(t('g_err_generic'));
            return;
          }
          if (!consumeOAuthState(resp.state)) {          // forged / mismatched / reused / expired state
            setGLoading(false);
            setError(t('g_err_state'));                  // the code is never sent anywhere
            return;
          }
          try {
            await loginWithGoogle(resp.code);
            router.replace('/dashboard');
          } catch (err) {
            const e = err as { response?: { status?: number; data?: { code?: string; link_token?: string; email?: string } } };
            if (e.response?.status === 409 && e.response.data?.code === 'link_required' && e.response.data.link_token) {
              // Existing SustIndex account with this email: ask for its password before linking.
              setLinkInfo({ token: e.response.data.link_token, email: e.response.data.email || '' });
            } else {
              setError(googleError(err));
            }
          } finally {
            setGLoading(false);
          }
        },
        error_callback: (e: { type?: string }) => {
          if (!isCurrent()) return;
          clearOAuthState(); setGLoading(false);
          if (e?.type === 'popup_closed')              setNotice(t('g_err_cancel'));
          else if (e?.type === 'popup_failed_to_open') setError(t('g_err_popup'));
          else                                         setError(t('g_err_generic'));
        },
      });
      client.requestCode();
    } catch {
      clearOAuthState(); setGLoading(false); setError(t('g_err_generic'));
    }
  };
  // Show a friendly "server warming up" notice if login takes > 7 s
  const [slowConn, setSlowConn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSlowConn(false);
    setLoading(true);
    // After 7 s still loading → server is waking from cold start, show notice
    const slowTimer = setTimeout(() => setSlowConn(true), 7000);
    try {
      await login(formData.username, formData.password);
      router.replace('/dashboard');
    } catch (err: unknown) {
      // L1: narrow err from unknown before property access.
      const e = err as { response?: { status?: number; data?: { detail?: string } } };
      // Fix R5-M-06: distinguish HTTP 429 throttle from generic auth failure
      if (e.response?.status === 429) {
        setError(t('err_throttle'));
      } else {
        // 401 = wrong credentials: use the translated message rather than the server's English detail.
        setError(e.response?.status === 401 ? t('login_fail') : (e.response?.data?.detail || t('login_fail')));
      }
    } finally {
      clearTimeout(slowTimer);
      setSlowConn(false);
      setLoading(false);
    }
  };

  // Don't flash the login form while the auth state is still being determined.
  // All hooks are above this point — safe to early-return here.
  // Fix R5-L-08: use t() so the loading label is bilingual
  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>{t('t_loading_auth')}</span>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <header style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 32px',
        }}>
          <Link href="/" style={{ textDecoration: 'none' }}><Logo size={22} /></Link>
          <Link href="/" style={{ textDecoration: 'none', fontSize: 11.5, color: 'var(--ink-3)' }}>
            ← {t('nav_back_home')}
          </Link>
        </div>
      </header>

      {/* Centered card */}
      <main style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {linkInfo && (
            <>
              <span className="eyebrow" style={{ marginBottom: 10, display: 'block' }}>{t('g_link_eyebrow')}</span>
              <h1 style={{ fontSize: 32, marginBottom: 10, fontWeight: 600, letterSpacing: '-0.02em' }}>
                {t('g_link_title')}
              </h1>
              <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 28, lineHeight: 1.6 }}>
                {t('g_link_desc').replace('{email}', linkInfo.email)}
              </p>

              {error && (
                <div role="alert" style={{
                  background: '#FFF5F3', border: '1px solid var(--danger)',
                  color: 'var(--danger)', fontSize: 12, padding: '12px 16px',
                  marginBottom: 20, lineHeight: 1.5,
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleLink} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                    <label htmlFor="link-password">{t('login_password')}</label>
                    <Link href="/forgot-password" style={{ fontSize: 10, color: 'var(--ink-3)', textDecoration: 'none', textAlign: 'right' }}>
                      {t('g_link_forgot')}
                    </Link>
                  </div>
                  <input
                    id="link-password"
                    className="input"
                    type="password"
                    placeholder="••••••••"
                    value={linkPw}
                    onChange={(e) => setLinkPw(e.target.value)}
                    required
                    autoFocus
                    autoComplete="current-password"
                  />
                </div>

                <label htmlFor="link-confirm" style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', lineHeight: 1.5,
                  margin: '4px 0 8px',
                }}>
                  <input
                    id="link-confirm"
                    type="checkbox"
                    checked={linkOk}
                    onChange={(e) => setLinkOk(e.target.checked)}
                    style={{ width: 14, height: 14, marginTop: 2, flexShrink: 0, accentColor: 'var(--olive-deep)' }}
                  />
                  {t('g_link_confirm')}
                </label>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={linking || !linkOk || !linkPw}
                  style={{ padding: '12px 18px', fontSize: 12.5, justifyContent: 'space-between', opacity: (linking || !linkOk || !linkPw) ? 0.6 : 1 }}
                >
                  {linking ? t('g_link_submitting') : t('g_link_submit')}
                  <Icon.arrow />
                </button>
              </form>

              <button
                type="button"
                className="btn btn-outline"
                onClick={cancelLink}
                style={{ width: '100%', padding: '12px 18px', fontSize: 12.5, marginTop: 14 }}
              >
                {t('g_link_cancel')}
              </button>
            </>
          )}

          {!linkInfo && (<>
          <span className="eyebrow" style={{ marginBottom: 10, display: 'block' }}>{t('login_eyebrow')}</span>
          <h1 style={{ fontSize: 32, marginBottom: 10, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {t('login_title')}
          </h1>
          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 32, lineHeight: 1.6 }}>
            {t('login_desc')}
          </p>

          {/* Slow-connection notice — shown when Render dyno is waking from cold start */}
          {slowConn && !error && (
            <div style={{
              background: '#FFFBEA', border: '1px solid #D4A017',
              color: '#7A5800', fontSize: 12, padding: '12px 16px',
              marginBottom: 20, lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⏳</span>
              <span>
                {lang === 'tr'
                  ? 'Sunucu başlatılıyor, lütfen bekleyin… (ilk bağlantı ~30 sn sürebilir)'
                  : 'سرور در حال راه‌اندازی است، لطفاً صبر کنید… (اولین اتصال تا ۳۰ ثانیه ممکن است طول بکشد)'}
              </span>
            </div>
          )}

          {error && (
            <div style={{
              background: '#FFF5F3', border: '1px solid var(--danger)',
              color: 'var(--danger)', fontSize: 12, padding: '12px 16px',
              marginBottom: 20, lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {notice && !error && (
            <div role="status" style={{
              background: 'var(--paper)', border: '1px solid var(--line)',
              color: 'var(--ink-3)', fontSize: 12, padding: '12px 16px',
              marginBottom: 20, lineHeight: 1.5,
            }}>
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="field">
              <label htmlFor="login-username">{t('login_username')}</label>
              <input
                id="login-username"
                className="input"
                type="text"
                placeholder="elif.demir"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                autoComplete="username"
              />
            </div>
            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label htmlFor="login-password">{t('login_password')}</label>
                <Link href="/forgot-password" style={{ fontSize: 10, color: 'var(--ink-3)', textDecoration: 'none' }}>
                  {t('login_forgot')}
                </Link>
              </div>
              <input
                id="login-password"
                className="input"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading || gLoading}
              style={{ padding: '12px 18px', fontSize: 12.5, justifyContent: 'space-between', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? t('login_submitting') : t('login_submit')}
              <Icon.arrow />
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }}></div>
            <span style={{ fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {t('t_or')}
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }}></div>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleGoogle}
            disabled={loading || gLoading}
            style={{ width: '100%', padding: '12px 18px', fontSize: 12.5, gap: 10, marginBottom: 10, opacity: gLoading ? 0.6 : 1 }}
          >
            <GoogleG />
            {gLoading ? t('login_google_wait') : t('login_google')}
          </button>

          <Link href="/register" style={{ textDecoration: 'none', display: 'block' }}>
            <button className="btn btn-outline" style={{ width: '100%', padding: '12px 18px', fontSize: 12.5 }}>
              {t('login_create')}
            </button>
          </Link>
          </>)}
        </div>
      </main>

      {/* Footer trust strip */}
      <footer style={{ borderTop: '1px solid var(--line)' }}>
        <div className="wrap" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 32px',
          fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em',
          textTransform: 'uppercase', fontFamily: "'IBM Plex Sans', sans-serif",
        }}>
          {/* Fix L-04: use i18n key so year is always current and
              the copy matches the rest of the site */}
          <span>{t('foot_copy')}</span>
          <div style={{ display: 'flex', gap: 14 }}>
            <span>{t('login_secure')}</span><span>·</span>
            <span>{t('login_iso')}</span><span>·</span>
            <span>{t('login_gdpr')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
