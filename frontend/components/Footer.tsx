'use client';

import Link from 'next/link';
import { useLang } from '@/lib/i18n';

export default function Footer() {
  const { t, lang } = useLang();

  return (
    <footer style={{
      background: '#1a1a1a',
      color: '#a0a0a0',
      fontSize: 13,
      padding: '56px 0 0',
    }}>
      <div style={{
        maxWidth: 1120,
        margin: '0 auto',
        padding: '0 24px',
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
        gap: 48,
      }} className="footer-grid">

        {/* Brand */}
        <div>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #2d6a4f, #40916c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.5-3 2-7 2-10S13.5 5 12 2z" />
                <path d="M2 12h20" />
              </svg>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Sustindex</span>
          </Link>
          <p style={{ lineHeight: 1.7, marginBottom: 20, maxWidth: 280 }}>
            {lang === 'tr'
              ? 'GRI standartlarına dayalı kapsamlı ESG değerlendirmeleri. Sürdürülebilirlik muhasebesi, yeniden tasarlandı.'
              : 'Comprehensive ESG assessments based on GRI standards. Sustainability accounting, reimagined.'}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" style={{
              width: 34, height: 34, borderRadius: '50%', background: '#2a2a2a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#a0a0a0', textDecoration: 'none', transition: 'background 0.2s',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" style={{
              width: 34, height: 34, borderRadius: '50%', background: '#2a2a2a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#a0a0a0', textDecoration: 'none', transition: 'background 0.2s',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
          </div>
        </div>

        {/* Product */}
        <div>
          <h4 style={{ color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            {lang === 'tr' ? 'PLATFORM' : 'PRODUCT'}
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <li><Link href="/surveys" style={{ color: '#a0a0a0', textDecoration: 'none' }}>{lang === 'tr' ? 'Değerlendirmeler' : 'Assessments'}</Link></li>
            <li><Link href="/courses" style={{ color: '#a0a0a0', textDecoration: 'none' }}>{lang === 'tr' ? 'E-Öğrenme' : 'E-Learning'}</Link></li>
            <li><Link href="/register" style={{ color: '#a0a0a0', textDecoration: 'none' }}>{lang === 'tr' ? 'Ücretsiz Başla' : 'Get Started Free'}</Link></li>
          </ul>
        </div>

        {/* Company */}
        <div>
          <h4 style={{ color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            {lang === 'tr' ? 'ŞİRKET' : 'COMPANY'}
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <li><Link href="/about" style={{ color: '#a0a0a0', textDecoration: 'none' }}>{lang === 'tr' ? 'Hakkımızda' : 'About Us'}</Link></li>
            <li><Link href="/login" style={{ color: '#a0a0a0', textDecoration: 'none' }}>{lang === 'tr' ? 'Giriş Yap' : 'Login'}</Link></li>
            <li><Link href="/register" style={{ color: '#a0a0a0', textDecoration: 'none' }}>{lang === 'tr' ? 'Hesap Oluştur' : 'Create Account'}</Link></li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 style={{ color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            {lang === 'tr' ? 'YASAL' : 'LEGAL'}
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <li><Link href="#" style={{ color: '#a0a0a0', textDecoration: 'none' }}>{lang === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy'}</Link></li>
            <li><Link href="#" style={{ color: '#a0a0a0', textDecoration: 'none' }}>{lang === 'tr' ? 'Kullanım Şartları' : 'Terms of Service'}</Link></li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        marginTop: 48,
        borderTop: '1px solid #2a2a2a',
        padding: '20px 24px',
        maxWidth: 1120,
        margin: '48px auto 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }} className="footer-bottom">
        <span>&copy; 2026 Sustindex. {lang === 'tr' ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}</span>
        <div style={{ display: 'flex', gap: 24 }}>
          <Link href="#" style={{ color: '#a0a0a0', textDecoration: 'none' }}>{lang === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy'}</Link>
          <Link href="#" style={{ color: '#a0a0a0', textDecoration: 'none' }}>{lang === 'tr' ? 'Kullanım Şartları' : 'Terms of Service'}</Link>
        </div>
      </div>
    </footer>
  );
}
