'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import { useLang } from '@/lib/i18n';
import { Icon } from '@/components/shared';

/* ============================================================
   Themed line-icons for the mission collage — thin-stroke,
   currentColor, matching the weight of the shared Icon set.
   ============================================================ */
const ThemeIcon = {
  leaf: (props?: React.SVGProps<SVGSVGElement>) => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 13c0-5 4-9 9-9h7v2c0 8-6 14-14 14H4v-2c0-1 0-3 0-5z" />
      <path d="M6 20c2-6 6-10 12-12" />
    </svg>
  ),
  shield: (props?: React.SVGProps<SVGSVGElement>) => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  people: (props?: React.SVGProps<SVGSVGElement>) => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M15 20c.3-2.6 2-4.6 4.5-5.2" />
    </svg>
  ),
  clipboard: (props?: React.SVGProps<SVGSVGElement>) => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="6" y="4" width="12" height="17" rx="1.5" />
      <rect x="9" y="2.5" width="6" height="3" rx="1" />
      <path d="M9 11h6M9 15h6" />
    </svg>
  ),
  document: (props?: React.SVGProps<SVGSVGElement>) => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M8 17V11M12 17V8M16 17v-4" />
    </svg>
  ),
  bulb: (props?: React.SVGProps<SVGSVGElement>) => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 00-3.5 10.9c.5.4.8 1 .8 1.6h5.4c0-.6.3-1.2.8-1.6A6 6 0 0012 3z" />
    </svg>
  ),
};

/* ============================================================
   Photo panel — real photography (verified free-licence Unsplash
   images, not a screenshot of our own product) framed with a small
   icon badge + caption, used across the Mission collage and the
   How We Help carousel.
   ============================================================ */
function PhotoPanel({
  src, alt, label, icon, tall, aspect, sizes, priority, focus,
}: {
  src: string; alt: string; label?: string; icon?: React.ReactNode;
  tall?: boolean; aspect?: string; sizes?: string; priority?: boolean; focus?: string;
}) {
  // Detect local assets (our own images) vs external photos (Unsplash)
  const isLocalAsset = src.startsWith('/assets/');
  return (
    <div className="mission-panel" style={{
      position: 'relative', borderRadius: 20, overflow: 'hidden',
      aspectRatio: aspect ?? (tall ? '1 / 1.35' : '1 / 1'),
      background: isLocalAsset ? 'var(--cream)' : 'var(--olive-deep)',
    }}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? '(max-width: 1024px) 45vw, 190px'}
        style={{
          objectFit: isLocalAsset ? 'contain' : 'cover',
          objectPosition: focus ?? 'center',
          padding: isLocalAsset ? '12px' : undefined,
        }}
        priority={priority}
      />
      {label && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)',
        }} />
      )}
      {icon && (
        <span style={{
          position: 'absolute', top: 12, left: 12,
          width: 30, height: 30, borderRadius: '50%',
          background: 'rgba(255,255,255,0.85)', color: 'var(--olive-deep)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 6,
        }}>
          {icon}
        </span>
      )}
      {label && (
        <span style={{
          position: 'absolute', left: 12, right: 12, bottom: 12,
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
          fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: '#fff',
        }}>
          {label}
        </span>
      )}
    </div>
  );
}

/* ============================================================
   Illustration panel — for transparent-background graphics (the
   client-supplied concept art), shown uncropped on a solid brand
   backdrop rather than cover-cropped like a photograph.
   ============================================================ */
function IllustrationPanel({
  src, alt, label, bg, fg, tall, priority,
}: {
  src: string; alt: string; label: string; bg: string; fg?: string; tall?: boolean; priority?: boolean;
}) {
  return (
    <div className="mission-panel" style={{
      background: bg, borderRadius: 20,
      aspectRatio: tall ? '1 / 1.35' : '1 / 1',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ position: 'relative', flex: 1, padding: 18 }}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 45vw, 190px"
          style={{ objectFit: 'contain' }}
          priority={priority}
        />
      </div>
      <span style={{
        textAlign: 'center', paddingBottom: 14,
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
        fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase',
        color: fg ?? 'var(--olive-deep)',
      }}>
        {label}
      </span>
    </div>
  );
}

/* ============================================================
   Highlight known key-phrases inside a translated string without
   touching the approved copy — used to echo the reference design's
   inline-coloured mission statement.
   ============================================================ */
function highlightWords(text: string, words: string[]): React.ReactNode[] {
  if (words.length === 0) return [text];
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return text.split(pattern).map((part, i) =>
    words.includes(part)
      ? <span key={i} style={{ color: 'var(--olive-deep)' }}>{part}</span>
      : <span key={i}>{part}</span>
  );
}

/* ============================================================
   Mission Hero — mission statement flanked by a collage of
   themed panels, inspired by the reference layout.
   ============================================================ */
const MISSION_HIGHLIGHT_WORDS: Record<'en' | 'tr', string[]> = {
  en: ['measure, understand, and improve'],
  tr: ['ölçmesine, anlamasına ve iyileştirmesine'],
};

function MissionHero() {
  const { t, lang } = useLang();
  const missionHeadline = t('about_mission_h').replace(/\.$/, '');

  return (
    <section style={{ padding: '32px 0 72px' }}>
      <div className="wrap">
        <div className="mission-card" style={{
          background: 'linear-gradient(160deg, var(--olive-wash) 0%, var(--cream) 65%)',
          borderRadius: 32, padding: '56px 40px',
        }}>
          <div className="mission-hero-grid">
            {/* Left collage column */}
            <div className="mission-side-col">
              <IllustrationPanel
                src="/assets/hero-leaf-city.png"
                alt="A city skyline growing from a leaf"
                label={t('pillar_env')}
                bg="transparent" fg="var(--olive-deep)"
                priority
              />
              <IllustrationPanel
                src="/assets/hero-circular-economy.png"
                alt="A circular arrow of forest regenerating around an industrial plant"
                label={t('mission_transform')}
                bg="transparent" fg="var(--olive-deep)"
                tall
              />
            </div>

            {/* Center text */}
            <div className="mission-center" style={{ textAlign: 'center' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                marginBottom: 18,
              }}>
                <span style={{ width: 16, height: 16, color: 'var(--olive-deep)' }}><ThemeIcon.leaf /></span>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500,
                  letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--olive-deep)',
                }}>
                  {t('about_mission')}
                </span>
              </div>

              <h1 style={{
                fontSize: 'clamp(28px, 4.4vw, 44px)', lineHeight: 1.15,
                letterSpacing: '-0.02em', fontWeight: 700,
                maxWidth: 560, margin: '0 auto 20px',
              }}>
                {highlightWords(missionHeadline, MISSION_HIGHLIGHT_WORDS[lang])}
              </h1>

              <p style={{
                fontSize: 13.5, lineHeight: 1.75, color: 'var(--ink-3)',
                maxWidth: 460, margin: '0 auto 30px',
              }}>
                {t('about_mission_d')}
              </p>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/register" style={{ textDecoration: 'none' }}>
                  <button className="btn btn-primary btn-lg" style={{ minWidth: 180, justifyContent: 'space-between' }}>
                    {t('hero_cta_main')} <Icon.arrow />
                  </button>
                </Link>
                <Link href="/about" style={{ textDecoration: 'none' }}>
                  <button className="btn btn-outline btn-lg">
                    {t('nav_about')}
                  </button>
                </Link>
              </div>
            </div>

            {/* Right collage column */}
            <div className="mission-side-col">
              <IllustrationPanel
                src="/assets/hero-recycle-energy.png"
                alt="A recycling bin wired to a lightbulb growing a tree"
                label={t('mission_circular')}
                bg="transparent" fg="var(--olive-deep)"
                tall
              />
              <IllustrationPanel
                src="/assets/hero-carbon-footprint.png"
                alt="A footprint made of moss and clover"
                label={t('res_ind_env_1')}
                bg="transparent" fg="var(--olive-deep)"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   How We Help — horizontal carousel of what the platform offers.
   Reuses the About page's already-approved "What we offer" copy
   so the same claims aren't worded two different ways.
   ============================================================ */
function HowWeHelp() {
  const { t } = useLang();
  const trackRef = React.useRef<HTMLDivElement>(null);

  const cards = [
    {
      src: '/assets/help-1.jpg',
      alt: 'GRI-Based ESG Assessment',
      icon: <ThemeIcon.clipboard />, t: t('about_o_1_t'), d: t('about_o_1_d'),
    },
    {
      src: '/assets/help-2.jpg',
      alt: 'Sector-Specific Modules',
      icon: <ThemeIcon.document />, t: t('about_o_2_t'), d: t('about_o_2_d'),
    },
    {
      src: '/assets/help-3.jpg',
      alt: 'Actionable ESG Report',
      icon: <ThemeIcon.bulb />, t: t('about_o_4_t'), d: t('about_o_4_d'),
    },
    {
      src: '/assets/help-4.jpg',
      alt: 'Smart Question Flow',
      icon: <ThemeIcon.shield />, t: t('about_o_3_t'), d: t('about_o_3_d'),
    },
  ];

  const scrollByCard = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.help-card');
    const step = card ? card.offsetWidth + 20 : 300;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <section style={{ padding: '0 0 96px' }}>
      <div className="wrap">
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 28, gap: 16,
        }}>
          <h2 style={{ fontSize: 30, letterSpacing: '-0.02em' }}>{t('how_help_h')}</h2>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button" aria-label={t('how_help_prev')}
              onClick={() => scrollByCard(-1)}
              className="help-nav-btn"
            >
              <Icon.arrow style={{ transform: 'rotate(180deg)' }} />
            </button>
            <button
              type="button" aria-label={t('how_help_next')}
              onClick={() => scrollByCard(1)}
              className="help-nav-btn"
            >
              <Icon.arrow />
            </button>
          </div>
        </div>

        <div ref={trackRef} className="help-track">
          {cards.map((c, i) => (
            <div key={i} className="help-card">
              <div style={{ marginBottom: 20 }}>
                <PhotoPanel
                  src={c.src} alt={c.alt} icon={c.icon}
                  aspect="4 / 3" sizes="(max-width: 760px) 82vw, (max-width: 1024px) 45vw, 23vw"
                />
              </div>
              <h3 style={{ fontSize: 17, marginBottom: 8 }}>{c.t}</h3>
              <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.65 }}>{c.d}</p>
            </div>
          ))}
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
          border: '1px solid var(--line)', borderRadius: 24, overflow: 'hidden',
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
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--olive-wash)', color: 'var(--olive-deep)',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
                marginBottom: 14,
              }}>0{i + 1}</span>
              <h4 style={{ fontSize: 18, marginBottom: 8 }}>{h}</h4>
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
    <section style={{ padding: '0 0 96px' }}>
      <div className="wrap">
        <div style={{
          background: 'linear-gradient(160deg, var(--olive-wash) 0%, var(--cream-deep) 100%)',
          borderRadius: 32, padding: '56px 32px', textAlign: 'center',
        }}>
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
      <MissionHero />
      <HowWeHelp />
      <PillarsCompact />
      <HowItWorks />
      <CTABanner />
      <SiteFooter />
    </div>
  );
}
