'use client';

import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import { useLang } from '@/lib/i18n';
import { Icon } from '@/components/shared';

function CTABanner() {
  const { t } = useLang();
  return (
    <section style={{ padding: '40px 0 96px', background: 'var(--cream-deep)' }}>
      <div className="wrap" style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, marginBottom: 14, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
          {t('cta_short')}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 440, margin: '0 auto 28px' }}>
          {t('cta_desc_short')}
        </p>
        <div style={{ display: 'inline-flex', gap: 10 }}>
          <Link href="/register" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary btn-lg">{t('hero_cta_main')} <Icon.arrow /></button>
          </Link>
          <Link href="/login" style={{ textDecoration: 'none' }}>
            <button className="btn btn-outline btn-lg">{t('nav_signin')}</button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function AboutPage() {
  const { t, lang } = useLang();

  const offers = [
    [t('about_o_1_t'), t('about_o_1_d')],
    [t('about_o_2_t'), t('about_o_2_d')],
    [t('about_o_3_t'), t('about_o_3_d')],
    [t('about_o_4_t'), t('about_o_4_d')],
  ] as [string, string][];

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <SiteNav />

      {/* Hero section */}
      <section style={{ padding: '72px 0 56px', borderBottom: '1px solid var(--ink)' }}>
        <div className="wrap-narrow">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>·</span>
            <span className="eyebrow">{t('about_eye')}</span>
          </div>
          <h1 style={{ fontSize: 48, marginBottom: 24, maxWidth: 760, lineHeight: 1.05 }}>
            {t('about_title_1')}{' '}
            <em style={{ fontWeight: 500, color: 'var(--olive-deep)' }}>{t('about_title_2')}</em>{' '}
            {t('about_title_3')}
          </h1>
          <p style={{ fontSize: 15, color: 'var(--ink-2)', maxWidth: 600, lineHeight: 1.6 }}>
            {t('about_desc')}
          </p>
        </div>
      </section>

      {/* Mission */}
      <section style={{ padding: '72px 0' }}>
        <div className="wrap" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 64 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>01</span>
            <span className="eyebrow">{t('about_mission')}</span>
          </div>
          <div>
            <h2 style={{ fontSize: 28, marginBottom: 18, lineHeight: 1.2 }}>{t('about_mission_h')}</h2>
            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.7 }}>{t('about_mission_d')}</p>
          </div>
        </div>
      </section>

      {/* What we offer */}
      <section style={{ padding: '0 0 72px' }}>
        <div className="wrap" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 64 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>02</span>
            <span className="eyebrow">{t('about_offer')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--ink)' }}>
            {offers.map(([h, d], i) => (
              <div key={i} style={{ padding: '24px 0', borderBottom: '1px solid var(--line)', display: 'grid', gridTemplateColumns: '36px 1fr', gap: 20 }}>
                <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>0{i + 1}</span>
                <div>
                  <h3 style={{ fontSize: 18, marginBottom: 6 }}>{h}</h3>
                  <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: 600 }}>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section style={{ padding: '0 0 72px' }}>
        <div className="wrap" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 64 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>03</span>
            <span className="eyebrow">{t('about_contact')}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 28, borderTop: '1px solid var(--ink)', paddingTop: 24 }}>
            <div>
              <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>{t('about_address')}</span>
              <p style={{ fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{t('about_address_v')}</p>
            </div>
            <div>
              <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>{t('about_phone')}</span>
              <p style={{ fontSize: 12.5, marginBottom: 14 }}>+90 212 613 58 80</p>
              <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>{t('about_fax')}</span>
              <p style={{ fontSize: 12.5 }}>+90 212 322 04 11</p>
            </div>
            <div>
              <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>{t('about_parent')}</span>
              <p style={{ fontSize: 12.5, marginBottom: 14 }}>Academia Danışmanlık</p>
              <a href="https://academiadanismanlik.com" target="_blank" rel="noopener noreferrer" className="ulink" style={{ fontSize: 12 }}>
                academiadanismanlik.com <Icon.external />
              </a>
            </div>
          </div>
        </div>
      </section>

      <CTABanner />
      <SiteFooter />
    </div>
  );
}
