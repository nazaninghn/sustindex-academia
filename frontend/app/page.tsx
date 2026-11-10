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

/* Small diagonal arrow used on hero links (matches the reference's ↗). */
const ArrowUR = (props?: React.SVGProps<SVGSVGElement>) => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M7 17L17 7M8 7h9v9" />
  </svg>
);

/* Entrance timing: every animated hero element takes its start delay from the
   `--d` custom property (ms). The whole sequence is driven by CSS keyframes and
   starts when the hero gets the `sx2-go` class (see MissionHero). */
const sxDelay = (ms: number) => ({ '--d': `${ms}ms` } as React.CSSProperties);

/* Splits a phrase into words, each inside an overflow-hidden mask so it can
   rise into place (the reference's line/word reveal). When `markDelay` is
   given, the last word gets the pale-green highlight pill, which sweeps in
   after that many ms. */
function SxWords({ text, start, step = 70, markDelay }: { text: string; start: number; step?: number; markDelay?: number }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((w, i) => {
        const word = (
          <span className="sx2-w"><span data-sx="word" style={sxDelay(start + i * step)}>{w}</span></span>
        );
        const isMarked = markDelay !== undefined && i === words.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && ' '}
            {isMarked
              ? <mark className="sx2-mark" style={{ '--dm': `${markDelay}ms` } as React.CSSProperties}>{word}</mark>
              : word}
          </React.Fragment>
        );
      })}
    </>
  );
}

/* ============================================================
   Hero image sequence — the four photos in /public/assets (1–4.jpg)
   play one after another inside the SAME rounded container.
   - Layered reveal: the incoming photo wipes in from the right while
     slowly settling from a slight zoom; the outgoing one drifts left,
     zooms a touch and fades underneath (CSS keyframes, no layout shift).
   - Photo 1 is preloaded (priority); the others are mounted lazily, one
     ahead of the cycle, and a slide only becomes active once its image has
     loaded, so a transition never shows an empty frame.
   - Container size is fixed by the parent; photos use object-fit: cover
     (never stretched). Reduced motion: no autoplay, no transitions — the
     dots still let the visitor switch photos.
   ============================================================ */
const HERO_SLIDES = [
  { src: '/assets/1.jpg', pos: '50% 50%', alt: 'Aerial view of a green forest with a lake shaped like a recycling symbol',
    blur: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDO1eJvtKxwWiQoD8rAkhge5NSaeEuYggBLLnJHQetO1+XZFDp8Q2xcMTnJLdPy9qoac8sDl45XGFIwD2PWueaRzo66C+MEQiWycBOMbv8AE0U3T7CHULKK5maXe45+eimuYvU//9k=' },
  { src: '/assets/2.jpg', pos: '40% 50%', alt: 'Aerial view of farmland with sustainability data overlays',
    blur: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAALABQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCC3169dCxueB03Hk0k3iCcnDTupx2brXOQyOGYbjip3+eH5gDg+lR1Avvrc245lk/7+GiscqPSimB//9k=' },
  { src: '/assets/3.jpg', pos: '36% 42%', alt: 'Wind turbines on a green hillside above the clouds',
    blur: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD//gA8Q1JFQVRPUjogZ2QtanBlZyB2MS4wICh1c2luZyBJSkcgSlBFRyB2ODApLCBxdWFsaXR5ID0gMTAwCv/bAEMAEAsMDgwKEA4NDhIREBMYKBoYFhYYMSMlHSg6Mz08OTM4N0BIXE5ARFdFNzhQbVFXX2JnaGc+TXF5cGR4XGVnY//bAEMBERISGBUYLxoaL2NCOEJjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY//AABEIAA0AFAMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/ANiTWtOVsCfcf9lTUtlqFpfDEEqlx1QnBFefMxdskt/30ajYshBRypB4IoVVmdj1Lyz/AHf1orE0K/uZ9NRpZSzAlcnqcUVtdhZH/9k=' },
  { src: '/assets/4.jpg', pos: '50% 50%', alt: 'Looking up through the tops of tall green trees',
    blur: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCO0vZfkzFyo6ggU+4dYJfPkO7Jyq44Wkt4o879vAyAufT19ajSRpPMBxlGLgnnPsa89NSdrnM1YmGpwEAndk9eQP0oqNLSK4RZRmPP8IORRXpRhUa0OVyhc//Z' },
];
const SLIDE_FIRST_MS = 6000;   // first change happens after the entrance has finished
const SLIDE_EVERY_MS = 5600;   // then every 5.6s (transition itself takes 1.6s)

function HeroSlides({ go, onFirstLoad }: { go: boolean; onFirstLoad: () => void }) {
  const N = HERO_SLIDES.length;
  const [view, setView] = React.useState<{ active: number; prev: number | null; changed: boolean }>({ active: 0, prev: null, changed: false });
  const [mounted, setMounted] = React.useState<boolean[]>([true, false, false, false]);
  const [hover, setHover] = React.useState(false);
  const [tabHidden, setTabHidden] = React.useState(false);
  const [reduce, setReduce] = React.useState(false);
  const loaded = React.useRef<boolean[]>([false, false, false, false]);
  const pending = React.useRef<number | null>(null);

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const onMq = () => setReduce(mq.matches);
    const onVis = () => setTabHidden(document.hidden);
    mq.addEventListener?.('change', onMq);
    document.addEventListener('visibilitychange', onVis);
    return () => { mq.removeEventListener?.('change', onMq); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const show = React.useCallback((i: number) => {
    setView((v) => (v.active === i ? v : { active: i, prev: v.active, changed: true }));
  }, []);

  // Switch to slide i — immediately if its image is ready, otherwise as soon as it has loaded.
  const request = React.useCallback((i: number) => {
    setMounted((m) => (m[i] ? m : m.map((x, k) => (k === i ? true : x))));
    if (loaded.current[i]) { pending.current = null; show(i); } else { pending.current = i; }
  }, [show]);

  const onLoaded = (i: number) => {
    loaded.current[i] = true;
    if (i === 0) onFirstLoad();
    if (pending.current === i) { pending.current = null; show(i); }
  };

  // Load the next photo shortly after the current one is showing (never competes with the first paint).
  React.useEffect(() => {
    if (!go) return;
    const next = (view.active + 1) % N;
    const id = window.setTimeout(() => setMounted((m) => (m[next] ? m : m.map((x, k) => (k === next ? true : x)))), view.changed ? 600 : 1800);
    return () => window.clearTimeout(id);
  }, [go, view.active, view.changed, N]);

  const paused = hover || tabHidden;
  const interval = view.changed ? SLIDE_EVERY_MS : SLIDE_FIRST_MS;

  // Autoplay (restarts after hover/tab pauses; off entirely for reduced motion).
  React.useEffect(() => {
    if (!go || reduce || paused) return;
    const id = window.setTimeout(() => request((view.active + 1) % N), interval);
    return () => window.clearTimeout(id);
  }, [go, reduce, paused, view.active, interval, request, N]);

  return (
    <div
      className="sx2-slider"
      role="group"
      aria-roledescription="carousel"
      aria-label="Sustainability imagery"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <div className="sx2-slides">
        {HERO_SLIDES.map((s, i) => {
          const isActive = i === view.active;
          const cls = 'sx2-slide'
            + (isActive ? ' is-active' : '')
            + (isActive && !view.changed ? ' is-static' : '')
            + (i === view.prev ? ' is-prev' : '');
          return (
            <div key={s.src} className={cls} aria-hidden={!isActive}>
              <div className="sx2-slide-img">
                {mounted[i] && (
                  <Image
                    src={s.src}
                    alt={isActive ? s.alt : ''}
                    fill
                    priority={i === 0}
                    quality={80}
                    sizes="(max-width: 1024px) 100vw, 640px"
                    placeholder="blur"
                    blurDataURL={s.blur}
                    style={{ objectFit: 'cover', objectPosition: s.pos }}
                    onLoad={() => onLoaded(i)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sx2-dots">
        {HERO_SLIDES.map((s, i) => {
          const on = i === view.active;
          return (
            <button
              key={s.src}
              type="button"
              className={`sx2-dot${on ? ' is-on' : ''}${on && (paused || reduce) ? ' is-held' : ''}`}
              aria-label={`Show image ${i + 1} of ${N}`}
              aria-current={on ? 'true' : undefined}
              onClick={() => request(i)}
            >
              {on && <span key={`${view.active}-${paused}`} className="sx2-dot-fill" style={{ '--iv': `${interval}ms` } as React.CSSProperties} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MissionHero() {
  const { t } = useLang();

  /* Start the sequence once the hero photo has loaded (so the reveal never
     plays over an empty frame), with a short safety timeout. Reduced-motion
     users get the finished layout immediately (CSS also disables every
     animation). The layout is identical before, during and after the
     sequence — only opacity/transform/clip-path are animated. */
  const [go, setGo] = React.useState(false);
  React.useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setGo(true); return; }
    const id = window.setTimeout(() => setGo(true), 900);
    return () => window.clearTimeout(id);
  }, []);
  const startSequence = React.useCallback(() => {
    window.requestAnimationFrame(() => setGo(true));
  }, []);

  // Message strip — the platform's purpose, one phrase per item. Two identical
  // groups run side by side and the track moves by exactly one group's width,
  // so the loop is seamless (each group is wider than any viewport).
  const messages = [
    t('hx3_m1'), t('hx3_m2'), t('hx3_m3'), t('hx3_m4'),
    t('hx3_m5'), t('hx3_m6'), t('hx3_m7'), t('hx3_m8'),
  ];

  const strip = (hidden: boolean) => (
    <div className="sx2-marquee-group" aria-hidden={hidden || undefined}>
      {messages.map((label, i) => (
        <React.Fragment key={i}>
          <span className={`sx2-topic ${i % 2 === 0 ? 'sx2-topic-a' : 'sx2-topic-b'}`}>{label}</span>
          <span className="sx2-sep" aria-hidden="true">
            {/* tiny four-point star */}
            <svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor"><path d="M12 1C12.6 7.4 16.6 11.4 23 12 16.6 12.6 12.6 16.6 12 23 11.4 16.6 7.4 12.6 1 12 7.4 11.4 11.4 7.4 12 1Z" /></svg>
          </span>
        </React.Fragment>
      ))}
    </div>
  );

  // Headline timing: two sentences; the last word of each is highlighted.
  const a = t('hx2_h1a');
  const b = t('hx2_h1b');
  const aN = a.split(' ').length;
  const aStart = 140;
  const bStart = aStart + aN * 70 + 30;
  const bN = b.split(' ').length;
  const aMark = aStart + (aN - 1) * 70 + 380;
  const bMark = bStart + (bN - 1) * 70 + 380;

  return (
    <section className="sx2-section">
      <noscript>
        <style>{`.sx2-hero [data-sx],.sx2-hero .sx2-media-img img,.sx2-hero .sx2-marquee-in{opacity:1!important;transform:none!important;clip-path:none!important;filter:none!important;animation:none!important}.sx2-hero .sx2-mark::before,.sx2-hero .sx2-marquee::before{transform:none!important}`}</style>
      </noscript>
      <div className="wrap">
        <div className={`sx2-hero${go ? ' sx2-go' : ''}`}>
          <div className="sx2-grid">
            {/* Left: message + CTAs + the three assessment steps */}
            <div className="sx2-copy">
              <span className="sx2-pill" data-sx="fade" style={sxDelay(60)}>
                {t('hx4_pill')}
              </span>

              <h1 className="sx2-title">
                <span className="sx2-line"><SxWords text={a} start={aStart} markDelay={aMark} /></span>
                <span className="sx2-line"><SxWords text={b} start={bStart} markDelay={bMark} /></span>
              </h1>

              <p className="sx2-sub" data-sx="fade" style={sxDelay(560)}>{t('hx2_sub')}</p>

              <div className="sx2-ctas">
                <Link href="/register" className="sx2-btn sx2-btn-dark" data-sx="btn" style={sxDelay(700)}>
                  <span className="sx2-btn-label">{t('hx2_cta1')} <Icon.arrow /></span>
                </Link>
                <Link href="/#methodology" className="sx2-btn sx2-btn-outline" data-sx="btn" style={sxDelay(820)}>
                  <span className="sx2-btn-label">{t('hx2_cta2')} <ArrowUR /></span>
                </Link>
              </div>

              <ol className="sx2-steps" aria-label="How it works">
                <li data-sx="fade" style={sxDelay(1000)}><b>1</b>{t('hx2_s1')}</li>
                <li data-sx="fade" style={sxDelay(1080)}><b>2</b>{t('hx2_s2')}</li>
                <li data-sx="fade" style={sxDelay(1160)}><b>3</b>{t('hx2_s3')}</li>
              </ol>
            </div>

            {/* Right: wide rounded photo with small floating cards */}
            <div className="sx2-media">
              <div className="sx2-media-img" data-sx="media" style={sxDelay(650)}>
                <HeroSlides go={go} onFirstLoad={startSequence} />
                <div className="sx2-media-tint" aria-hidden="true" />
              </div>

              <ul className="sx2-tags" aria-label="Focus areas">
                <li data-sx="fade" style={sxDelay(1300)}>{t('hx_tag_assess')}</li>
                <li data-sx="fade" style={sxDelay(1370)}>GRI</li>
                <li data-sx="fade" style={sxDelay(1440)}>ESG</li>
              </ul>

              {/* Brand seal: official SustIndex logo centered, "SUSTAINABILITY • ESG • GRI •" set around the perimeter */}
              <span className="sx2-badge" data-sx="pop" style={sxDelay(1500)}>
                <span className="sx2-badge-in" role="img" aria-label="SustIndex — Sustainability, ESG, GRI">
                  <svg className="sx2-badge-ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                    <defs>
                      {/* full circle, starting at 9 o'clock and running clockwise over the top */}
                      <path id="sx2SealPath" d="M12 50a38 38 0 1 1 76 0a38 38 0 1 1 -76 0" />
                    </defs>
                    <text className="sx2-badge-text">
                      <textPath href="#sx2SealPath" textLength="238.76" lengthAdjust="spacing">{'SUSTAINABILITY • ESG • GRI • '}</textPath>
                    </text>
                  </svg>
                  <span className="sx2-badge-logo">
                    <Image src="/assets/logo-leaf.png" alt="" fill sizes="48px" style={{ objectFit: 'contain' }} />
                  </span>
                </span>
              </span>

              {/* Small floating information cards — each enters on its own beat */}
              <div className="sx2-float sx2-float-q" data-sx="card" style={sxDelay(1450)} aria-label={t('hx2_c1_t')}>
                <div className="sx2-float-card">
                  <span className="sx2-float-icon" aria-hidden="true"><ThemeIcon.clipboard strokeWidth="1.7" /></span>
                  <span className="sx2-float-text">
                    <strong>{t('hx2_c1_t')}</strong>
                    <small>{t('hx2_c1_d')}</small>
                  </span>
                </div>
              </div>
              <div className="sx2-float sx2-float-r" data-sx="card" style={sxDelay(1650)} aria-label={t('hx2_c2_t')}>
                <div className="sx2-float-card">
                  <span className="sx2-float-text">
                    <strong>{t('hx2_c2_t')}</strong>
                    <small>{t('hx2_c2_d')}</small>
                  </span>
                  <span className="sx2-float-bars" aria-hidden="true"><i /><i /><i /><i /></span>
                </div>
              </div>

              {/* Notched bubble: grows up from the photo's bottom edge, then its text fades in */}
              <div className="sx2-bubble" data-sx="grow" style={sxDelay(1800)}>
                <p data-sx="fade" style={sxDelay(2050)}>{t('hx2_bubble')}</p>
              </div>
            </div>
          </div>

          {/* Bottom topic strip — last to arrive */}
          <div className="sx2-marquee" aria-label="Platform topics" style={sxDelay(1900)}>
            <div className="sx2-marquee-in">
              <div className="sx2-marquee-track">
                {strip(false)}
                {strip(true)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Bento section below the hero — "Explore Our Sustainability Assessment".
   Editorial, asymmetric composition (after the reference video):
   a tall photo with a notched corner, a step indicator, two small
   photos, a sage info card, a circular photo with a GRI card and a
   dark insight card. Three topics crossfade (large photo, small photos
   and the sage card change together), driven by the 01/02/03 steps.
   Entrance: everything reveals progressively once the section scrolls
   into view (CSS keyframes; delays come from `--d`).
   ============================================================ */
const ArrowDR = (props?: React.SVGProps<SVGSVGElement>) => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M7 7l10 10M17 8v9H8" />
  </svg>
);

/* Word-by-word mask reveal for the section heading. */
function Sx3Words({ text, start, step = 80 }: { text: string; start: number; step?: number }) {
  return (
    <>
      {text.split(' ').map((w, i) => (
        <React.Fragment key={i}>
          {i > 0 && ' '}
          <span className="sx3-w"><span data-s3="word" style={sxDelay(start + i * step)}>{w}</span></span>
        </React.Fragment>
      ))}
    </>
  );
}

/* Art-directed images: every slot has its own crop, pre-cut to that container's exact shape
   (tall ≈0.93:1, wide strip ≈5.2:1, small strip 3:1) from the project's non-Hero photos
   (5, 6, 7, 8, 9.jpg). Files live in /assets/explore (see scripts: crops of the originals,
   2x resolution, optimised JPEG). Each step tells its own story; no Hero image is used. */
/* Step -> image pairs (fixed mapping):
     Step 01: n1.jpg + n2.jpg      Step 02: n3.jpg + n4.jpg      Step 03: n7.jpg + n8.jpg
   `a` = wide strip (5.2:1), `b` = small strip (3:1). Within each pair the image whose own shape is
   closest to the wider/narrower container takes that slot (n2 4-icon row, n3 skyline banner and n7
   process diagram -> wide, i.e. first/left; n1 aerial forest, n4 hexagon network and n8 globe -> small, second/right).
   `big` (left block): optional bigFit/bigBg for images whose shape doesn't suit `cover`; bump the `?v=` to bust the image cache after replacing a file. None of the Hero's images are used. */
const SX3_SCENES = [
  { big: '/assets/explore/s1-tall.jpg', bigPos: '50% 50%', a: '/assets/n2.jpg', aPos: '50% 50%', b: '/assets/n1.jpg', bPos: '50% 50%',
    alt: 'Aerial view of a road running through a dense green forest' },
  { big: '/assets/left2.jpg?v=20261109-1326', bigPos: '50% 50%', bigFit: 'contain', bigBg: '#fefff3', bigClass: 'sx3-foot-img', a: '/assets/n3.jpg', aPos: '50% 50%', b: '/assets/n4.jpg', bPos: '50% 50%',
    alt: 'A hand holding a light bulb with a tree growing inside, against a blue sky' },
  { big: '/assets/explore/s3-tall.jpg', bigPos: '50% 50%', a: '/assets/n7.jpg', aPos: '50% 50%', b: '/assets/n8.jpg', bPos: '50% 50%',
    alt: 'Hands holding a young plant growing inside a light bulb' },
];
const SX3_EVERY_MS = 6500;

function ExploreAssessment() {
  const { t } = useLang();
  const ref = React.useRef<HTMLElement>(null);
  const [seen, setSeen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [hover, setHover] = React.useState(false);
  const [tabHidden, setTabHidden] = React.useState(false);
  const [reduce, setReduce] = React.useState(false);

  // Reveal once when the section scrolls into view (immediately for reduced motion / no IntersectionObserver).
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    let io: IntersectionObserver | null = null;
    if (mq.matches || typeof IntersectionObserver === 'undefined') {
      setSeen(true);
    } else if (ref.current) {
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { setSeen(true); io?.disconnect(); }
      }, { threshold: 0.18 });
      io.observe(ref.current);
    }
    return () => { io?.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const paused = hover || tabHidden;
  React.useEffect(() => {
    if (!seen || reduce || paused) return;
    const id = window.setTimeout(() => setActive((a) => (a + 1) % SX3_SCENES.length), SX3_EVERY_MS);
    return () => window.clearTimeout(id);
  }, [seen, reduce, paused, active]);

  const titles = [t('hx5_s1_t'), t('hx5_s2_t'), t('hx5_s3_t')];
  const descs = [t('hx5_s1_d'), t('hx5_s2_d'), t('hx5_s3_d')];

  // heading timing
  const h1 = t('hx5_h1');
  const h2 = t('hx5_h2');
  const h1n = h1.split(' ').length;
  const h2Start = 140 + h1n * 80 + 30;
  const h2n = h2.split(' ').length;
  const markAt = h2Start + (h2n - 1) * 80 + 340;

  return (
    <>
    <section ref={ref} id="methodology" className={`sx3-section sx3-bentosec${seen ? ' sx3-in' : ''}`}>
      <noscript>
        <style>{`.sx3-section [data-s3],.sx3-section .sx3-w>span{opacity:1!important;transform:none!important;clip-path:none!important;filter:none!important;animation:none!important}.sx3-section .sx3-mark::before{transform:none!important}`}</style>
      </noscript>
      <div className="wrap">
        {/* Header: label + heading on the left, supporting text on the right */}
        <div className="sx3-head">
          <div>
            <span className="sx3-label" data-s3="fade" style={sxDelay(0)}>
              {t('hx5_label')}
            </span>
            <h2 className="sx3-title">
              <Sx3Words text={h1} start={140} />{' '}
              <mark className="sx3-mark" style={{ '--dm': `${markAt}ms` } as React.CSSProperties}>
                <Sx3Words text={h2} start={h2Start} />
              </mark>
            </h2>
          </div>
          <p className="sx3-sub" data-s3="fade" style={sxDelay(markAt - 60)}>{t('hx5_sub')}</p>
        </div>

        <div
          className="sx3-bento"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onFocus={() => setHover(true)}
          onBlur={() => setHover(false)}
        >
          {/* Left: tall photo with notched corner + insight card */}
          <div className="sx3-big">
            <div className="sx3-bigimg" data-s3="media" style={sxDelay(450)}>
              {SX3_SCENES.map((s, i) => (
                <div key={s.big} className={`sx3-layer${i === active ? ' is-on' : ''}`} aria-hidden={i !== active} style={s.bigBg ? { background: s.bigBg } : undefined}>
                  <Image className={s.bigClass} src={s.big} alt={i === active ? s.alt : ''} fill sizes="(max-width: 1024px) 100vw, 420px" quality={75} style={{ objectFit: (s.bigFit ?? 'cover') as React.CSSProperties['objectFit'], objectPosition: s.bigPos }} />
                </div>
              ))}
              <div className="sx3-bigshade" aria-hidden="true" />
            </div>

            <Link href="/#methodology" className="sx3-notch" data-s3="notch" style={sxDelay(1000)}>
              <span className="sx3-notch-t">{t('hx5_notch')}</span>
              <ArrowDR />
            </Link>

            <div className="sx3-insight" data-s3="card" style={sxDelay(2050)}>
              <span className="sx3-insight-star" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 1C12.6 7.4 16.6 11.4 23 12 16.6 12.6 12.6 16.6 12 23 11.4 16.6 7.4 12.6 1 12 7.4 11.4 11.4 7.4 12 1Z" /></svg>
              </span>
              <strong>{t('hx5_ins_t')}</strong>
              <span>{t('hx5_ins_d')}</span>
            </div>
          </div>

          {/* Right: steps, small photos, sage card, circular photo + GRI card */}
          <div className="sx3-right">
            <div className="sx3-steps" role="group" aria-label="Topics" data-s3="fade" style={sxDelay(1050)}>
              {SX3_SCENES.map((_, i) => {
                const on = i === active;
                return (
                  <button key={i} type="button" className={`sx3-step${on ? ' is-on' : ''}`} aria-label={`${t('hx5_step')} ${i + 1}`} aria-current={on ? 'true' : undefined} onClick={() => setActive(i)}>
                    <span className="sx3-step-n">0{i + 1}</span>
                    <span className="sx3-step-line">
                      {on && <span key={`${active}-${paused}`} className={`sx3-step-fill${paused || reduce ? ' is-held' : ''}`} style={{ '--iv': `${SX3_EVERY_MS}ms` } as React.CSSProperties} />}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="sx3-minis">
              <div className="sx3-mini sx3-mini-a" data-s3="pop" style={sxDelay(1150)}>
                {SX3_SCENES.map((s, i) => (
                  <div key={s.a} className={`sx3-layer${i === active ? ' is-on' : ''}`} aria-hidden="true">
                    <Image src={s.a} alt="" fill sizes="(max-width: 820px) 70vw, 520px" quality={85} style={{ objectFit: 'cover', objectPosition: s.aPos }} />
                  </div>
                ))}
              </div>
              <div className="sx3-mini sx3-mini-b" data-s3="pop" style={sxDelay(1300)}>
                {SX3_SCENES.map((s, i) => (
                  <div key={s.b} className={`sx3-layer${i === active ? ' is-on' : ''}`} aria-hidden="true">
                    <Image src={s.b} alt="" fill sizes="(max-width: 820px) 45vw, 300px" quality={85} style={{ objectFit: 'cover', objectPosition: s.bPos }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="sx3-sage" data-s3="card" style={sxDelay(1450)}>
              <div className="sx3-swap">
                {SX3_SCENES.map((_, i) => (
                  <div key={i} className={`sx3-swap-i${i === active ? ' is-on' : ''}`} aria-hidden={i !== active}>
                    <h3>{titles[i]}</h3>
                    <p>{descs[i]}</p>
                  </div>
                ))}
              </div>
              <Link href="/register" className="sx3-go" aria-label={t('hx2_cta1')}><ArrowDR /></Link>
            </div>

            <div className="sx3-gri">
              <span className="sx3-circ" data-s3="pop" style={sxDelay(1700)}>
                <Image
                  src="/assets/circle.jpg" alt="Illustration of a clipboard checklist with a pen" fill sizes="320px" quality={80}
                  style={{ objectFit: 'cover', objectPosition: '50% 50%' }}
                />
              </span>
              <div className="sx3-gri-card" data-s3="grow" style={sxDelay(1800)}>
                <div className="sx3-gri-in">
                  <strong>{t('hx5_gri_t')}</strong>
                  <span>{t('hx5_gri_d')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
    <EsgExplainer />
    </>
  );
}

/* "Understanding ESG" — what E, S and G mean, and how ESG relates to GRI and the
   SustIndex assessment. Its own scroll-triggered reveal. */
function EsgExplainer() {
  const { t } = useLang();
  const ref = React.useRef<HTMLElement>(null);
  const [seen, setSeen] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    let io: IntersectionObserver | null = null;
    if (ref.current) {
      io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io?.disconnect(); } }, { threshold: 0.2 });
      io.observe(ref.current);
    }
    return () => io?.disconnect();
  }, []);

  const items = [
    { k: 'E', name: t('pillar_env'), d: t('hx6_e_d'), icon: <ThemeIcon.leaf strokeWidth="1.6" /> },
    { k: 'S', name: t('pillar_soc'), d: t('hx6_s_d'), icon: <ThemeIcon.people strokeWidth="1.6" /> },
    { k: 'G', name: t('pillar_gov'), d: t('hx6_g_d'), icon: <ThemeIcon.shield strokeWidth="1.6" /> },
  ];
  const chips = [t('hx5_gri_t'), t('hx6_c2'), t('hx2_c2_t')];

  return (
    <section ref={ref} className={`sx3-section sx3-esgsec${seen ? ' sx3-in' : ''}`}>
      <noscript>
        <style>{`.sx3-esgsec [data-s3]{opacity:1!important;transform:none!important;clip-path:none!important;filter:none!important;animation:none!important}`}</style>
      </noscript>
      <div className="wrap">
        <div className="sx3-esg">
          <div className="sx3-esg-r">
            <div className="sx3-esg-cards">
              {items.map((it, i) => (
                <div key={it.k} className={`sx3-esg-card sx3-esg-${it.k.toLowerCase()}`} data-s3="card" style={sxDelay(120 + i * 170)}>
                  <div className="sx3-esg-top">
                    <span className="sx3-esg-letter" aria-hidden="true">{it.k}</span>
                    <span className="sx3-esg-ico" aria-hidden="true">{it.icon}</span>
                  </div>
                  <strong>{it.k} — {it.name}</strong>
                  <span>{it.d}</span>
                </div>
              ))}
            </div>

            <div className="sx3-flow" data-s3="fade" style={sxDelay(760)}>
              <p>{t('hx6_rel')}</p>
              <ol>
                {chips.map((c, i) => (<li key={i}>{c}</li>))}
              </ol>
            </div>
          </div>
        </div>
        <span className="sx3-deco" aria-hidden="true" data-s3="pop" style={sxDelay(1000)}><i /><i /></span>
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
      <ExploreAssessment />
      <CTABanner />
      <SiteFooter />
    </div>
  );
}
