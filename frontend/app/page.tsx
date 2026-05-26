'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import { useLang } from '@/lib/i18n';
import { Icon } from '@/components/shared';

/* ============================================================
   Hero Illustration — hover scale + click lightbox
   ============================================================ */
function HeroIllustration() {
  const [expanded, setExpanded] = useState(false);
  const [hovering, setHovering] = useState(false);

  return (
    <>
      {/* Thumbnail — floats gently, hover scales up, click opens lightbox */}
      <div
        style={{
          display: 'flex', justifyContent: 'center', cursor: 'zoom-in',
          animation: 'heroFloat 5s ease-in-out infinite',
          animationPlayState: hovering ? 'paused' : 'running',
        }}
        onClick={() => setExpanded(true)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <Image
          src="/assets/hero-s.png"
          alt="Sustindex hero"
          width={720}
          height={400}
          style={{
            width: '100%', maxWidth: 720, height: 'auto', display: 'block',
            transform: hovering ? 'scale(1.03)' : 'scale(1)',
            transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
            borderRadius: 4,
          }}
          priority
        />
      </div>

      {/* Lightbox overlay */}
      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setExpanded(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(26,26,20,0.90)',
            zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', padding: 24,
            backdropFilter: 'blur(6px)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <Image
            src="/assets/hero-s.png"
            alt="Sustindex hero — full view"
            width={1440}
            height={800}
            style={{
              maxWidth: '90vw', maxHeight: '85vh',
              width: 'auto', height: 'auto', display: 'block',
              boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
              borderRadius: 4,
              transform: 'scale(1)',
              transition: 'transform 0.3s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Close button */}
          <button
            onClick={() => setExpanded(false)}
            aria-label="Close"
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'rgba(249,239,229,0.12)',
              border: '1px solid rgba(249,239,229,0.25)',
              color: '#F9EFE5', cursor: 'pointer',
              width: 42, height: 42, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, lineHeight: 1,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(249,239,229,0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(249,239,229,0.12)')}
          >
            ×
          </button>
        </div>
      )}

      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes heroFloat {
          0%,  100% { transform: translateY(0px)   rotate(0deg);    }
          25%        { transform: translateY(-9px)  rotate(0.4deg);  }
          75%        { transform: translateY(5px)   rotate(-0.3deg); }
        }
      `}</style>
    </>
  );
}

/* ============================================================
   Hero
   ============================================================ */
function Hero() {
  const { t } = useLang();
  return (
    <section style={{ padding: '32px 0 80px', position: 'relative' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '0 32px', textAlign: 'center' }}>
        <div style={{ marginBottom: 8 }}>
          <HeroIllustration />
        </div>

        {/* Eyebrow pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'var(--cream-pill)', color: 'var(--olive-deep)',
          padding: '7px 18px', borderRadius: 999,
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
          marginBottom: 28,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 21c0-9 7-16 18-18-2 11-9 18-18 18zM3 21l9-9"/>
          </svg>
          {t('hero_pill')}
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 60px)', lineHeight: 1.05,
          letterSpacing: '-0.025em', fontWeight: 700,
          maxWidth: 820, margin: '0 auto 22px',
        }}>
          {t('hero_h_1')}{' '}
          <span style={{ color: 'var(--olive)' }}>{t('hero_h_2')}</span>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 14, lineHeight: 1.7, color: 'var(--ink-3)',
          maxWidth: 560, margin: '0 auto 24px',
        }}>
          {t('hero_sub')}
        </p>

        <div style={{ width: 48, height: 1, background: 'var(--olive)', margin: '0 auto 28px' }}></div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary btn-lg" style={{ minWidth: 180, justifyContent: 'space-between' }}>
              {t('hero_cta_main')} <Icon.arrow />
            </button>
          </Link>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <button className="btn btn-outline btn-lg" style={{ minWidth: 180 }}>
              {t('hero_cta_alt')}
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   ESG Pillars
   ============================================================ */
function PillarsCompact() {
  const { t } = useLang();
  const pillars = [
    { n: 'E', label: t('pillar_env'), sub: t('pillar_env_sub') },
    { n: 'S', label: t('pillar_soc'), sub: t('pillar_soc_sub') },
    { n: 'G', label: t('pillar_gov'), sub: t('pillar_gov_sub') },
  ];
  return (
    <section style={{ padding: '0 0 80px' }}>
      <div className="wrap">
        <div className="pillars-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          borderTop: '1px solid var(--line)',
          borderBottom: '1px solid var(--line)',
        }}>
          {pillars.map((p, i) => (
            <div key={p.n} className="pillar-cell" style={{
              padding: '40px 32px',
              borderRight: i < 2 ? '1px solid var(--line)' : 'none',
              display: 'flex', alignItems: 'center', gap: 24,
            }}>
              <span style={{
                fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600,
                fontSize: 72, lineHeight: 0.85, letterSpacing: '-0.06em',
                color: 'var(--olive)',
              }}>{p.n}</span>
              <div>
                <h3 style={{ fontSize: 18, marginBottom: 4 }}>{p.label}</h3>
                <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>{p.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   How It Works
   ============================================================ */
function HowItWorks() {
  const { t } = useLang();
  // Fix K: was [step_4_t, step_5_d] — mismatched keys (title from step 4, desc from step 5)
  const steps: [string, string][] = [
    [t('step_1_t'), t('step_1_d')],
    [t('step_2_t'), t('step_2_d')],
    [t('step_3_t'), t('step_3_d')],
  ];
  return (
    <section style={{ padding: '0 0 96px' }} id="methodology">
      <div className="wrap">
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span className="eyebrow">{t('meth_process')}</span>
        </div>
        <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {steps.map(([h, d], i) => (
            <div key={i} className="step-cell" style={{
              padding: '0 28px',
              borderRight: i < 2 ? '1px solid var(--line)' : 'none',
              textAlign: 'center',
            }}>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11, color: 'var(--olive)', letterSpacing: '0.12em',
              }}>0{i + 1}</span>
              <h4 style={{ fontSize: 18, marginTop: 10, marginBottom: 8 }}>{h}</h4>
              <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6, maxWidth: 240, margin: '0 auto' }}>{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   CTA Banner
   ============================================================ */
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
        <div className="cta-btns" style={{ display: 'inline-flex', gap: 10 }}>
          <Link href="/register" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary btn-lg">
              {t('hero_cta_main')} <Icon.arrow />
            </button>
          </Link>
          <Link href="/login" style={{ textDecoration: 'none' }}>
            <button className="btn btn-outline btn-lg">
              {t('nav_signin')}
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Page Export
   ============================================================ */
export default function HomePage() {
  return (
    <div style={{ background: 'var(--cream)' }}>
      <SiteNav />
      <Hero />
      <PillarsCompact />
      <HowItWorks />
      <CTABanner />
      <SiteFooter />
    </div>
  );
}
