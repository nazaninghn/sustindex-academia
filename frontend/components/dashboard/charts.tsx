'use client';
/* Dependency-free SVG/HTML charts for the analytics dashboard.
   - Every chart draws exactly the numbers it is given (0-100 scale, labelled axes, legend).
   - Animation is one-shot, scroll-triggered and CSS-driven (see motion.tsx); nothing loops.
   - Hover AND keyboard focus show a detailed tooltip; chart elements with an `onOpen` are real links to results. */

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PHASES } from '@/lib/dashboard-data';
import type { ResultPoint } from '@/lib/dashboard-data';
import { useInView } from './motion';

/** Restrained palette: forest + sage primary, navy / amber / plum as quiet secondaries. */
export const PHASE_COLORS: Record<number, string> = {
  1: '#17394B',   // Governance  — deep navy
  2: '#3C5C3F',   // Environment — forest
  3: '#5E8080',   // Social      — sage teal
  4: '#B58A2E',   // Economic    — amber
  5: '#7B6A8F',   // Sector      — muted plum
};

export const phaseLabel = (num: number, lang: string) => {
  const p = PHASES.find((x) => x.num === num);
  return p ? (lang === 'tr' ? p.tr : p.en) : '';
};

const loc = (lang: string) => (lang === 'tr' ? 'tr-TR' : 'en-GB');
export const fmtShort = (iso: string, lang: string) => new Date(iso).toLocaleDateString(loc(lang), { day: '2-digit', month: 'short' });
export const fmtFull  = (iso: string, lang: string) => new Date(iso).toLocaleDateString(loc(lang), { day: '2-digit', month: 'short', year: 'numeric' });

/* ── Tooltip plumbing ─────────────────────────────────────────── */
export function useTooltip() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);
  const place = (cx: number, cy: number, content: ReactNode) => {
    // fixed positioning: never clipped by scroll containers; clamped to the viewport
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    setTip({ x: Math.min(Math.max(cx, 110), Math.max(vw - 110, 110)), y: cy, content });
  };
  const hide = () => setTip(null);
  const bind = (content: ReactNode) => ({
    onMouseMove: (e: React.MouseEvent) => place(e.clientX, e.clientY, content),
    onMouseLeave: hide,
    onFocus: (e: React.FocusEvent<Element>) => { const b = e.currentTarget.getBoundingClientRect(); place(b.left + b.width / 2, b.top, content); },
    onBlur: hide,
  });
  const node = tip ? <div className="da-tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.content}</div> : null;
  return { boxRef, bind, node };
}

export function TipRows({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <>
      <b>{title}</b>
      {rows.map(([k, v]) => <span key={k}><i>{k}</i>{v}</span>)}
    </>
  );
}

/* ── Ring (animates from empty to its real value) ─────────────── */
export function Ring({ pct, size = 44, stroke = 5, color = 'var(--olive-deep)', track = 'var(--cream-deep)' }:
  { pct: number; size?: number; stroke?: number; color?: string; track?: string }) {
  const [ref, shown] = useInView<SVGSVGElement>(0.2);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const d = (Math.min(Math.max(pct, 0), 100) / 100) * c;
  return (
    <svg ref={ref} width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block' }} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle className="da-anim-ring" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${shown ? d : 0} ${c}`} strokeLinecap="round" strokeOpacity={d > 0 ? 1 : 0} />
    </svg>
  );
}

/* ── Shared 0-100 plot frame ──────────────────────────────────── */
const W = 640, H = 240, PL = 38, PR = 14, PT = 14, PB = 34;
const yOf = (v: number) => PT + (1 - Math.min(Math.max(v, 0), 100) / 100) * (H - PT - PB);

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: 'block', overflow: 'visible' }}>
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={PL} x2={W - PR} y1={yOf(v)} y2={yOf(v)} stroke="var(--line)" strokeWidth={v === 0 ? 1.2 : 0.8} strokeDasharray={v === 0 ? undefined : '3 4'} />
          <text x={PL - 8} y={yOf(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-4)" fontFamily="'IBM Plex Mono', monospace">{v}</text>
        </g>
      ))}
      {children}
    </svg>
  );
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="da-legend-inline">
      {items.map((it) => (
        <span key={it.label}><i style={{ background: it.color }} />{it.label}</span>
      ))}
    </div>
  );
}

const resultTip = (r: ResultPoint, lang: string) => (
  <TipRows title={phaseLabel(r.phase, lang)} rows={[
    [lang === 'tr' ? 'Skor' : 'Score', `${r.score.toFixed(1)}%${r.grade ? ' · ' + r.grade : ''}`],
    [lang === 'tr' ? 'Tarih' : 'Completed', fmtFull(r.iso, lang)],
    ...(r.cycle ? [[lang === 'tr' ? 'Dönem' : 'Cycle', r.cycle] as [string, string]] : []),
    [lang === 'tr' ? 'Cevap' : 'Answered', `${r.attempt.answered_count} / ${r.attempt.total_questions}`],
  ]} />
);

/* ── Bars: one per phase, growing from the axis to the real score ─ */
export function ResultBars({ results, lang, onOpen }: { results: ResultPoint[]; lang: string; onOpen?: (id: number) => void }) {
  const [ref, shown] = useInView<HTMLDivElement>(0.2);
  const tt = useTooltip();
  const n = results.length;
  const slot = (W - PL - PR) / Math.max(n, 1);
  const bw = Math.min(58, slot * 0.55);
  return (
    <div ref={tt.boxRef} className="da-chartbox">
      <div ref={ref} className="da-chart">
        <Frame label={lang === 'tr' ? 'Aşama skorları, 0-100 ölçeği' : 'Phase scores, 0-100 scale'}>
          {results.map((r, i) => {
            const cx = PL + slot * i + slot / 2;
            const y = yOf(r.score);
            const col = PHASE_COLORS[r.phase];
            return (
              <g key={r.id} className="da-hit" tabIndex={0} role="link" aria-label={`${phaseLabel(r.phase, lang)} ${Math.round(r.score)}%`}
                onClick={() => onOpen?.(r.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen?.(r.id); }} {...tt.bind(resultTip(r, lang))}>
                <rect x={cx - slot / 2 + 4} y={PT} width={slot - 8} height={H - PT - PB} fill="transparent" />
                <rect className="da-anim-bar" x={cx - bw / 2} y={y} width={bw} height={yOf(0) - y} rx="4" fill={col}
                  style={{ transform: shown ? 'scaleY(1)' : 'scaleY(0)', transitionDelay: `${i * 90}ms` }} />
                <text className="da-anim-fade" x={cx} y={y - 7} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)" fontFamily="'IBM Plex Sans', sans-serif"
                  style={{ opacity: shown ? 1 : 0, transitionDelay: `${300 + i * 90}ms` }}>{Math.round(r.score)}%</text>
                <text x={cx} y={H - 17} textAnchor="middle" fontSize="11" fill="var(--ink-2)" fontFamily="'IBM Plex Sans', sans-serif">{phaseLabel(r.phase, lang)}</text>
                <text x={cx} y={H - 5} textAnchor="middle" fontSize="9" fill="var(--ink-4)" fontFamily="'IBM Plex Mono', monospace">{fmtShort(r.iso, lang)}</text>
              </g>
            );
          })}
        </Frame>
      </div>
      {tt.node}
    </div>
  );
}

/* ── Trend lines: drawn left to right; only shown when a survey has >= 2 real results ── */
export function TrendChart({ results, lang, onOpen }: { results: ResultPoint[]; lang: string; onOpen?: (id: number) => void }) {
  const [ref, shown] = useInView<HTMLDivElement>(0.2);
  const tt = useTooltip();
  const n = results.length;
  const xOf = (i: number) => (n === 1 ? (PL + W - PR) / 2 : PL + 18 + (i / (n - 1)) * (W - PL - PR - 36));
  const surveys = Array.from(new Set(results.map((r) => r.survey)));
  const phases = PHASES.filter((p) => results.some((r) => r.phase === p.num));
  const step = Math.ceil(n / 7);
  return (
    <div ref={tt.boxRef} className="da-chartbox">
      <div ref={ref} className="da-chart">
        <Frame label={lang === 'tr' ? 'Skor geçmişi, 0-100 ölçeği' : 'Score history, 0-100 scale'}>
          {results.map((r, i) => (i % step === 0 || i === n - 1) && (
            <text key={r.id} x={xOf(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--ink-4)" fontFamily="'IBM Plex Mono', monospace">{fmtShort(r.iso, lang)}</text>
          ))}
          {surveys.map((sid) => {
            const pts = results.map((r, i) => ({ r, x: xOf(i), y: yOf(r.score) })).filter((q) => q.r.survey === sid);
            const col = PHASE_COLORS[pts[0].r.phase];
            return (
              <g key={sid}>
                {pts.length > 1 && (
                  <path className="da-anim-line" d={pts.map((q, i) => `${i ? 'L' : 'M'} ${q.x} ${q.y}`).join(' ')} pathLength={1}
                    fill="none" stroke={col} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"
                    style={{ strokeDasharray: 1, strokeDashoffset: shown ? 0 : 1 }} />
                )}
                {pts.map((q, i) => (
                  <circle key={q.r.id} className="da-hit da-anim-fade" cx={q.x} cy={q.y} r="5" fill="var(--paper)" stroke={col} strokeWidth="2.2" tabIndex={0} role="link"
                    aria-label={`${phaseLabel(q.r.phase, lang)} ${Math.round(q.r.score)}%`}
                    style={{ opacity: shown ? 1 : 0, transitionDelay: `${500 + i * 120}ms` }}
                    onClick={() => onOpen?.(q.r.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen?.(q.r.id); }} {...tt.bind(resultTip(q.r, lang))} />
                ))}
              </g>
            );
          })}
        </Frame>
      </div>
      <Legend items={phases.map((p) => ({ color: PHASE_COLORS[p.num], label: phaseLabel(p.num, lang) }))} />
      {tt.node}
    </div>
  );
}

/* ── Horizontal bar rows (categories, ESG, etc.) ───────────────── */
export interface BarRow { key: string; label: string; sub?: string; pct: number; color: string; tip?: ReactNode; href?: string }
export function HBars({ rows, onOpen, tick, dense }: { rows: BarRow[]; onOpen?: (href: string) => void; tick?: number; dense?: boolean }) {
  const [ref, shown] = useInView<HTMLDivElement>(0.12);
  const tt = useTooltip();
  return (
    <div ref={(el) => { (ref as React.MutableRefObject<HTMLDivElement | null>).current = el; (tt.boxRef as React.MutableRefObject<HTMLDivElement | null>).current = el; }} className={`da-hbars${dense ? ' is-dense' : ''}`}>
      {rows.map((r, i) => (
        <div key={r.key} className={`da-hrow${r.href ? ' is-link' : ''}`} tabIndex={r.tip || r.href ? 0 : undefined} role={r.href ? 'link' : undefined}
          onClick={() => r.href && onOpen?.(r.href)} onKeyDown={(e) => { if (e.key === 'Enter' && r.href) onOpen?.(r.href); }}
          {...(r.tip ? tt.bind(r.tip) : {})}>
          <span className="da-hlabel">{r.label}{r.sub && <small>{r.sub}</small>}</span>
          <span className="da-htrack">
            <span className="da-hfill da-anim-w" style={{ width: shown ? `${r.pct}%` : '0%', background: r.color, transitionDelay: `${Math.min(i, 12) * 40}ms` }} />
            {typeof tick === 'number' && <i className="da-htick" style={{ left: `${tick}%` }} />}
          </span>
          <span className="da-hpct" style={{ color: r.color }}>{Math.round(r.pct)}%</span>
        </div>
      ))}
      {tt.node}
    </div>
  );
}

/* ── Stacked share bar ─────────────────────────────────────────── */
export function StackBar({ parts, label }: { parts: { key: string; value: number; color: string; tip: string }[]; label: string }) {
  const [ref, shown] = useInView<HTMLDivElement>(0.2);
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div ref={ref} className="da-stack" role="img" aria-label={label}>
      {parts.map((p, i) => p.value > 0 && (
        <div key={p.key} className="da-anim-w" title={p.tip}
          style={{ width: shown ? `${(p.value / total) * 100}%` : '0%', background: p.color, transitionDelay: `${i * 120}ms` }} />
      ))}
    </div>
  );
}

/* ── Radar (drawn only when >= 3 axes have a real value) ──────── */
export function Radar({ axes, lang }: { axes: { label: string; value: number; color: string }[]; lang: string }) {
  const [ref, shown] = useInView<SVGSVGElement>(0.2);
  const tt = useTooltip();
  const S = 230, cx = S / 2, cy = S / 2 + 4, R = 80, n = axes.length;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)] as const;
  };
  const ring = (v: number) => axes.map((_, i) => pt(i, v).join(',')).join(' ');
  return (
    <div ref={tt.boxRef} className="da-chartbox" style={{ maxWidth: 270, margin: '0 auto' }}>
      <svg ref={ref} viewBox={`0 0 ${S} ${S}`} width="100%" style={{ display: 'block' }} role="img"
        aria-label={lang === 'tr' ? 'Boyutlara göre skor radar grafiği' : 'Radar chart of scores by dimension'}>
        {[25, 50, 75, 100].map((v) => <polygon key={v} points={ring(v)} fill="none" stroke="var(--line)" strokeWidth="0.9" />)}
        {axes.map((a, i) => { const [x, y] = pt(i, 100); return <line key={a.label} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth="0.9" />; })}
        <g className="da-anim-scale" style={{ transformOrigin: `${cx}px ${cy}px`, transform: shown ? 'scale(1)' : 'scale(0.02)', opacity: shown ? 1 : 0 }}>
          <polygon points={axes.map((a, i) => pt(i, a.value).join(',')).join(' ')} fill="rgba(60,92,63,.16)" stroke="var(--olive-deep)" strokeWidth="2" strokeLinejoin="round" />
          {axes.map((a, i) => {
            const [x, y] = pt(i, a.value);
            return <circle key={a.label} className="da-hit" cx={x} cy={y} r="4.2" fill={a.color} stroke="var(--paper)" strokeWidth="1.4" tabIndex={0}
              aria-label={`${a.label} ${Math.round(a.value)}%`} {...tt.bind(<TipRows title={a.label} rows={[[lang === 'tr' ? 'Skor' : 'Score', `${a.value.toFixed(1)}%`]]} />)} />;
          })}
        </g>
        {axes.map((a, i) => {
          const [lx, ly] = pt(i, 130);
          return <text key={a.label} x={lx} y={ly + 3} textAnchor={lx < cx - 6 ? 'end' : lx > cx + 6 ? 'start' : 'middle'} fontSize="10.5" fill="var(--ink-2)" fontFamily="'IBM Plex Sans', sans-serif">{a.label}</text>;
        })}
        {[50, 100].map((v) => <text key={v} x={cx + 3} y={cy - (R * v) / 100 + 9} fontSize="8" fill="var(--ink-4)" fontFamily="'IBM Plex Mono', monospace">{v}</text>)}
      </svg>
      {tt.node}
    </div>
  );
}
