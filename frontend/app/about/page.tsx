'use client';

import React from 'react';
import Link from 'next/link';
import './about.css';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import { useLang } from '@/lib/i18n';
import { Icon } from '@/components/shared';

/* ------------------------------------------------------------------
   About — an editorial company profile. Deliberately a different
   composition from the landing page: square-edged, hairline running
   headers, a distinct layout for every section, no photography.
   Reveal motion is minimal: fades and drawn hairlines, triggered once
   per section (immediately when reduced motion is on).
   ------------------------------------------------------------------ */
const d = (ms: number) => ({ '--d': `${ms}ms` } as React.CSSProperties);

function useSeen<T extends HTMLElement>(threshold = 0.15, immediate = false) {
  const ref = React.useRef<T>(null);
  const [seen, setSeen] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    if (immediate) { const id = requestAnimationFrame(() => setSeen(true)); return () => cancelAnimationFrame(id); }
    let io: IntersectionObserver | null = null;
    if (ref.current) {
      io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) { setSeen(true); io?.disconnect(); }
      }, { threshold, rootMargin: '0px 0px -8% 0px' });
      io.observe(ref.current);
    }
    return () => io?.disconnect();
  }, [threshold, immediate]);
  return [ref, seen] as const;
}

/* Magazine-style running header: hairline, section number + name on the left, a quiet tag on the right. */
function Run({ n, label, right }: { n: string; label: string; right?: string }) {
  return (
    <header className="ab-run" data-ab="fade" style={d(0)}>
      <span><i>{n}</i>{label}</span>
      {right ? <span className="ab-run-r">{right}</span> : null}
    </header>
  );
}

/* Split a paragraph at its first sentence so the intro and the story can share the same source text. */
function splitFirst(text: string): [string, string] {
  const i = text.indexOf('. ');
  return i === -1 ? [text, ''] : [text.slice(0, i + 1), text.slice(i + 2)];
}

const NOSCRIPT = `.ab [data-ab]{opacity:1!important;transform:none!important;animation:none!important}.ab .ab-run::before,.ab .ab-flow li::before,.ab .ab-rows li::before{transform:none!important}`;

/* ------------------------------------------------------------------ */

function Intro() {
  const { t } = useLang();
  const [ref, seen] = useSeen<HTMLElement>(0.1, true);
  const [first] = splitFirst(t('about_desc'));
  return (
    <section ref={ref} className={`ab-sec ab-r ab-intro${seen ? ' ab-in' : ''}`}>
      <div className="wrap">
        <Run n="00" label={t('ab_pill')} right={t('ab_seal')} />
        <div className="ab-intro-grid">
          <span className="ab-guides" aria-hidden="true" />
          <h1 className="ab-title">
            <span data-ab="fade" style={d(150)}>{t('ab_h1a')}</span>{' '}
            <span className="ab-title-2" data-ab="fade" style={d(330)}>{t('ab_h1b')}</span>
          </h1>
          <p className="ab-lead" data-ab="fade" style={d(600)}>{first}</p>
        </div>
      </div>
    </section>
  );
}

function Story() {
  const { t } = useLang();
  const [ref, seen] = useSeen<HTMLElement>(0.2);
  const [, rest] = splitFirst(t('about_desc'));
  const quote = `${t('about_title_1')} ${t('about_title_2')} ${t('about_title_3')}`;
  return (
    <section ref={ref} id="story" className={`ab-r ab-story${seen ? ' ab-in' : ''}`}>
      <div className="wrap">
        <Run n="01" label={t('ab_story')} />
        <div className="ab-story-grid">
          <blockquote className="ab-quote" data-ab="fade" style={d(150)}>
            <span className="ab-qm" aria-hidden="true">“</span>
            {quote}
          </blockquote>
          <div className="ab-story-side">
            <p data-ab="fade" style={d(350)}>{rest}</p>
            <dl className="ab-parent" data-ab="fade" style={d(500)}>
              <dt>{t('about_parent')}</dt>
              <dd>Academia Danışmanlık</dd>
              <dd>
                <a href="https://academiadanismanlik.com" target="_blank" rel="noopener noreferrer" className="ab-link">
                  {t('ab_visit')} <Icon.external />
                </a>
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

function Mission() {
  const { t } = useLang();
  const [ref, seen] = useSeen<HTMLElement>(0.2);
  const trio = [t('ab_m1'), t('ab_m2'), t('ab_m3')];
  return (
    <section ref={ref} id="mission" className={`ab-sec ab-r ab-mission${seen ? ' ab-in' : ''}`}>
      <div className="wrap">
        <Run n="02" label={t('ab_mission_s')} />
        <h2 className="ab-statement" data-ab="fade" style={d(150)}>{t('about_mission_h')}</h2>
        <ol className="ab-trio" aria-hidden="true">
          {trio.map((w, i) => (
            <li key={i} className={`ab-trio-${i + 1}`} data-ab="fade" style={d(450 + i * 160)}>{w}</li>
          ))}
        </ol>
        <div className="ab-mission-grid">
          <p className="ab-mission-p" data-ab="fade" style={d(900)}>{t('about_mission_d')}</p>
          <div className="ab-std" data-ab="fade" style={d(1050)}>
            <span>{t('ab_std')}</span>
            <ul>
              {['GRI', 'SASB', 'UN SDGs', 'ISO 26000'].map((s) => (<li key={s}>{s}</li>))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhatWeDo() {
  const { t } = useLang();
  const [ref, seen] = useSeen<HTMLElement>(0.1);
  const rows = [
    [t('about_o_1_t'), t('about_o_1_d')],
    [t('about_o_2_t'), t('about_o_2_d')],
    [t('about_o_3_t'), t('about_o_3_d')],
    [t('about_o_4_t'), t('about_o_4_d')],
  ];
  return (
    <section ref={ref} id="what" className={`ab-sec ab-r ab-what${seen ? ' ab-in' : ''}`}>
      <div className="wrap">
        <Run n="03" label={t('ab_do')} />
        <h2 className="ab-h2" data-ab="fade" style={d(120)}>{t('ab_do_h')}</h2>
        <ol className="ab-rows">
          {rows.map(([h, p], i) => (
            <li key={i} data-ab="fade" style={d(300 + i * 130)}>
              <span className="ab-rows-n">0{i + 1}</span>
              <h3>{h}</h3>
              <p>{p}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Approach() {
  const { t } = useLang();
  const [ref, seen] = useSeen<HTMLElement>(0.12);
  const nodes: [string, string, string | null][] = [
    [t('hx5_s1_t'), t('hx5_s1_d'), t('ab_ph1')],
    [t('hx5_gri_t'), t('hx5_gri_d'), null],
    [t('hx5_s2_t'), t('hx5_s2_d'), t('ab_ph2')],
    [t('hx5_ins_t'), t('hx5_ins_d'), null],
    [t('hx5_s3_t'), t('hx5_s3_d'), t('ab_ph3')],
  ];
  return (
    <section ref={ref} id="approach" className={`ab-sec ab-r ab-approach${seen ? ' ab-in' : ''}`}>
      <div className="wrap">
        <Run n="04" label={t('ab_app')} />
        <h2 className="ab-h2" data-ab="fade" style={d(120)}>{t('ab_app_h')}</h2>

        <div className="ab-phases" aria-hidden="true" data-ab="fade" style={d(350)}>
          <span className="ab-phase ab-phase-1">{t('ab_ph1')}</span>
          <span className="ab-phase ab-phase-2">{t('ab_ph2')}</span>
          <span className="ab-phase ab-phase-3">{t('ab_ph3')}</span>
        </div>

        <ol className="ab-flow">
          {nodes.map(([h, p, ph], i) => (
            <li key={i} data-ab="fade" style={d(450 + i * 170)}>
              {ph ? <span className="ab-ph">{ph}</span> : null}
              <span className="ab-fn">0{i + 1}</span>
              <h3>{h}</h3>
              <p>{p}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Values() {
  const { t } = useLang();
  const [ref, seen] = useSeen<HTMLElement>(0.15);
  const vals = [
    [t('ab_v1_t'), t('ab_v1_d')],
    [t('ab_v2_t'), t('ab_v2_d')],
    [t('ab_v3_t'), t('ab_v3_d')],
    [t('ab_v4_t'), t('ab_v4_d')],
  ];
  return (
    <section ref={ref} id="values" className={`ab-sec ab-r ab-values${seen ? ' ab-in' : ''}`}>
      <div className="wrap">
        <Run n="05" label={t('ab_val')} />
        <h2 className="ab-h2" data-ab="fade" style={d(120)}>{t('ab_val_h')}</h2>
        <ul className="ab-vals">
          {vals.map(([h, p], i) => (
            <li key={i} data-ab="fade" style={d(300 + i * 130)}>
              <span className="ab-vals-n">0{i + 1}</span>
              <h3>{h}</h3>
              <p>{p}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="ab" style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <noscript><style>{NOSCRIPT}</style></noscript>
      <SiteNav />
      <main>
        <Intro />
        <Story />
        <Mission />
        <WhatWeDo />
        <Approach />
        <Values />
      </main>
      <SiteFooter />
    </div>
  );
}
