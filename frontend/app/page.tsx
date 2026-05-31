'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import { useLang } from '@/lib/i18n';
import { Icon } from '@/components/shared';

/* ============================================================
   Hero Illustration — hover scale only (no click, no animation)
   ============================================================ */
function HeroIllustration() {
  const [hovering, setHovering] = useState(false);

  return (
    <div style={{ display: 'inline-block', position: 'relative', maxWidth: 720, width: '100%' }}>
      {/* Image */}
      <div
        style={{ overflow: 'hidden', borderRadius: '4px 4px 0 0' }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <Image
          src="/assets/hero-s.png"
          alt="Sustindex hero"
          width={720}
          height={400}
          style={{
            width: '100%', height: 'auto', display: 'block',
            transform: hovering ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          priority
        />
      </div>

      {/* Caption — glued to bottom of image */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        background: 'var(--olive-deep)',
        padding: '11px 28px',
        borderRadius: '0 0 4px 4px',
      }}>
        {/* Leaf icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.85)" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21c0-9 7-16 18-18-2 11-9 18-18 18zM3 21l9-9"/>
        </svg>
        <span style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontWeight: 600,
          fontSize: 12,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.92)',
        }}>
          Sustainability Index Platform
        </span>
      </div>
    </div>
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
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'center' }}>
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
