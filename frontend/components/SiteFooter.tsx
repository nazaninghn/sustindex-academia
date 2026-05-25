'use client';
import Link from 'next/link';
import Logo from './Logo';
import { useLang } from '@/lib/i18n';

export default function SiteFooter() {
  const { t, lang } = useLang();

  return (
    <footer style={{
      background: 'var(--cream)',
      color: 'var(--ink)',
      borderTop: '1px solid var(--line)',
      padding: '56px 0 24px',
      marginTop: 56,
    }}>
      <div className="wrap">
        {/* Main row */}
        <div className="site-footer-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 1fr',
          gap: 56,
          paddingBottom: 40,
        }}>
          {/* Brand */}
          <div>
            <Logo size={20} />
            <p style={{ marginTop: 16, fontSize: 12.5, color: 'var(--ink-3)', maxWidth: 320, lineHeight: 1.6 }}>
              {lang === 'tr'
                ? 'Academia Danışmanlık tarafından geliştirilen kapsamlı ESG değerlendirme platformu — uluslararası standartlara dayalı.'
                : 'A comprehensive ESG assessment platform from Academia Consulting — built on international standards.'}
            </p>
            <div style={{ marginTop: 20, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['ISO 26000', 'GRI', 'SASB', 'UN SDG'].map((s) => (
                <span key={s} style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10, padding: '4px 9px',
                  border: '1px solid var(--line)', borderRadius: 999,
                  color: 'var(--ink-3)',
                }}>{s}</span>
              ))}
            </div>
          </div>

          {/* Platform links */}
          <div>
            <h5 style={{
              fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600,
              fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'var(--ink-4)', marginBottom: 14,
            }}>
              {t('foot_platform')}
            </h5>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                [t('foot_overview'),    '/'],
                [t('foot_methodology'), '/#methodology'],
                [t('foot_assessments'), '/surveys'],
                [t('foot_reports'),     '/results'],
              ].map(([label, href]) => (
                <li key={label}>
                  <Link href={href} style={{ color: 'var(--ink)', textDecoration: 'none', fontSize: 12.5 }}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h5 style={{
              fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600,
              fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'var(--ink-4)', marginBottom: 14,
            }}>
              {lang === 'tr' ? 'İletişim' : 'Contact'}
            </h5>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <li style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                Bilişim Vadisi · Sarıyer, İstanbul
              </li>
              <li>
                <a href="mailto:info@sustindex.com" style={{ color: 'var(--ink)', textDecoration: 'none', fontSize: 12.5 }}>
                  info@sustindex.com
                </a>
              </li>
              <li style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--ink-3)' }}>
                +90 212 613 58 80
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="site-footer-bottom" style={{
          borderTop: '1px solid var(--line)', paddingTop: 18,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 11, color: 'var(--ink-3)',
        }}>
          <span>{t('foot_copy')}</span>
          <div style={{ display: 'flex', gap: 18 }}>
            {[t('foot_priv'), t('foot_terms'), t('foot_cookies')].map((l) => (
              <a key={l} href="#" style={{ color: 'inherit', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
