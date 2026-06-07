'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import Logo from '@/components/Logo';
import { Icon } from '@/components/shared';

function Field({
  id, label, placeholder, type = 'text', required, value, onChange, autoComplete,
}: {
  id: string; label: string; placeholder: string; type?: string;
  required?: boolean; value: string; onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}{required && <span style={{ color: 'var(--olive-deep)', marginLeft: 4 }}>*</span>}</label>
      <input id={id} className="input" type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} required={required} autoComplete={autoComplete} />
    </div>
  );
}

function Section({ num, title, subtitle, children }: { num: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{num}</span>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginRight: 8 }}>{title}</h3>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{subtitle}</span>
      </div>
      {children}
    </div>
  );
}

export default function RegisterPage() {
  const router     = useRouter();
  const { register, user, isLoading: authLoading } = useAuth();
  const { t } = useLang();

  // M4: redirect already-authenticated users away from the register page.
  useEffect(() => {
    if (!authLoading && user) router.replace('/dashboard');
  }, [authLoading, user, router]);

  const [formData, setFormData] = useState({
    username: '', email: '', password: '', password_confirm: '',
    first_name: '', last_name: '', company_name: '', phone: '',
  });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof formData) => (v: string) => setFormData((f) => ({ ...f, [key]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.password_confirm) {
      setError(t('reg_pw_mismatch'));
      return;
    }
    setLoading(true);
    try {
      // Send all fields including password_confirm — backend validates them server-side too
      await register(formData);
      router.replace('/dashboard');
    } catch (err: unknown) {
      // L1: narrow err from unknown before property access.
      const e = err as { response?: { status?: number; data?: { username?: string[]; email?: string[]; password?: string[]; password_confirm?: string[]; non_field_errors?: string[]; detail?: string } } };
      // Fix R5-M-06: surface HTTP 429 throttle clearly
      if (e.response?.status === 429) {
        setError(t('err_throttle'));
      } else {
        setError(
          e.response?.data?.username?.[0] ||
          e.response?.data?.email?.[0] ||
          // Fix R6-07: surface password validation errors from Django's
          // AUTH_PASSWORD_VALIDATORS (e.g. "too common", "too short") so the
          // user knows exactly what to fix rather than seeing a generic message.
          e.response?.data?.password?.[0] ||
          e.response?.data?.password_confirm?.[0] ||
          e.response?.data?.non_field_errors?.[0] ||
          e.response?.data?.detail ||
          t('reg_fail')
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Don't flash the registration form while the auth state is still being determined.
  // All hooks are above this point — safe to early-return here.
  // Fix R5-L-08: use t() for bilingual loading label
  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>{t('t_loading_auth')}</span>
    </div>
  );

  const steps = [
    [t('reg_sec_1_t'), 'active'],
    [t('reg_sec_2_t'), ''],
    [t('reg_sec_3_t'), ''],
    [t('reg_sec_4_t'), ''],
  ] as [string, string][];

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      {/* Top bar */}
      <header style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 32px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}><Logo size={20} /></Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: 'var(--ink-3)' }}>
            {t('reg_top_member')}
            <Link href="/login" style={{ textDecoration: 'none' }}>
              <button className="btn btn-outline btn-sm">{t('nav_signin')}</button>
            </Link>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="wrap reg-layout" style={{
        maxWidth: 980, margin: '0 auto', padding: '48px 32px 72px',
        display: 'grid', gridTemplateColumns: '300px 1fr', gap: 56,
      }}>
        {/* Sticky left rail */}
        <aside className="reg-aside" style={{ position: 'sticky', top: 80, height: 'fit-content' }}>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 10 }}>{t('reg_eyebrow')}</span>
          <h1 style={{ fontSize: 30, marginBottom: 12, lineHeight: 1.1, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {t('reg_title_1')}<br/>
            <em style={{ fontWeight: 500, color: 'var(--olive-deep)', fontStyle: 'normal' }}>{t('reg_title_2')}</em> {t('reg_title_3')}
          </h1>
          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 24 }}>
            {t('reg_desc')}
          </p>
          {/* Step indicator */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderLeft: '1px solid var(--line)' }}>
            {steps.map(([label, state], i) => (
              <div key={i} style={{
                padding: '8px 14px', position: 'relative',
                borderLeft: state === 'active' ? '2px solid var(--ink)' : '2px solid transparent',
                marginLeft: -1,
              }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)', marginRight: 8 }}>0{i + 1}</span>
                <span style={{ fontSize: 12, color: state === 'active' ? 'var(--ink)' : 'var(--ink-3)' }}>{label}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {error && (
            <div style={{
              background: '#FFF5F3', border: '1px solid var(--danger)',
              color: 'var(--danger)', fontSize: 12, padding: '12px 16px', lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <Section num="01" title={t('reg_sec_1_t')} subtitle={t('reg_sec_1_s')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Field id="reg-username" label={t('reg_username')} placeholder="elif.demir" required value={formData.username} onChange={set('username')} autoComplete="username" />
              <Field id="reg-email"    label={t('reg_email')}    placeholder="elif@atlas.com" required value={formData.email} onChange={set('email')} autoComplete="email" />
            </div>
          </Section>

          <Section num="02" title={t('reg_sec_2_t')} subtitle={t('reg_sec_2_s')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Field id="reg-first" label={t('reg_first')} placeholder="Elif"  value={formData.first_name} onChange={set('first_name')} autoComplete="given-name" />
              <Field id="reg-last"  label={t('reg_last')}  placeholder="Demir" value={formData.last_name}  onChange={set('last_name')}  autoComplete="family-name" />
            </div>
          </Section>

          <Section num="03" title={t('reg_sec_3_t')} subtitle={t('reg_sec_3_s')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Field id="reg-company" label={t('reg_company')} placeholder="Atlas Consulting Co." value={formData.company_name} onChange={set('company_name')} autoComplete="organization" />
              <Field id="reg-phone"   label={t('reg_phone')}   placeholder="+90 555 123 4567"     value={formData.phone}        onChange={set('phone')}         autoComplete="tel" />
            </div>
          </Section>

          <Section num="04" title={t('reg_sec_4_t')} subtitle={t('reg_sec_4_s')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Field id="reg-pw"         label={t('reg_pw')}        placeholder={t('reg_pw_hint')}  type="password" required value={formData.password}         onChange={set('password')}         autoComplete="new-password" />
              <Field id="reg-pw-confirm" label={t('reg_pw_confirm')} placeholder={t('reg_pw_again')} type="password" required value={formData.password_confirm} onChange={set('password_confirm')} autoComplete="new-password" />
            </div>
          </Section>

          <div className="reg-submit-row" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderTop: '1px solid var(--ink)', paddingTop: 20, marginTop: 8, gap: 24,
          }}>
            <p style={{ fontSize: 11, color: 'var(--ink-3)', maxWidth: 400, lineHeight: 1.5 }}>
              {t('reg_legal')}{' '}
              <a href="/terms" className="ulink">{t('reg_legal_terms')}</a>{' '}
              {t('reg_legal_and')}{' '}
              <a href="/privacy" className="ulink">{t('reg_legal_priv')}</a>.
            </p>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ minWidth: 180, padding: '12px 18px', justifyContent: 'space-between', fontSize: 12.5, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? t('reg_submitting') : t('reg_submit')}
              <Icon.arrow />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
