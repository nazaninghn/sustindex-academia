'use client';
/* Dependency-free SVG/HTML charts for the analytics dashboard.
   - Every chart draws exactly the numbers it is given (0-100 scale, labelled axes, legend).
   - A dimension without a real result is drawn as "not assessed" — never as 0.
   - Animation is one-shot, scroll-triggered and CSS-driven (see motion.tsx); nothing loops.
   - Hover AND keyboard focus show a detailed tooltip; chart elements with an `onOpen` are real links to results. */

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PHASES } from '@/lib/dashboard-data';
import type { ResultPoint } from '@/lib/dashboard-data';
import { useInView } from './motion';
import { Ic } from './icons';

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
  const [tip, setTip] = useState<{ x: number; y: number; below: boolean; content: ReactNode } | null>(null);
  const place = (cx: number, cy: number, content: ReactNode) => {
    // fixed positioning: never clipped by scroll containers; clamped to the viewport, flipped below near the top edge
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const half = Math.min(130, vw / 2 - 8);
    setTip({ x: Math.min(Math.max(cx, half + 8), Math.max(vw - half - 8, half + 8)), y: cy, below: cy < 120, content });
  };
  const hide = () => setTip(null);
  const bind = (content: ReactNode) => ({
    onMouseMove: (e: React.MouseEvent) => place(e.clientX, e.clientY, content),
    onMouseLeave: hide,
    onFocus: (e: React.FocusEvent<Element>) => { const b = e.currentTarget.getBoundingClientRect(); place(b.left + b.width / 2, b.top, content); },
    onBlur: hide,
  });
  const node = tip ? <div className={`da-tip${tip.below ? ' is-below' : ''}`} role="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.content}</div> : null;
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

/** Small "i" affordance that explains how a figure is calculated (hover or keyboard focus). */
export function Hint({ text }: { text: string }) {
  const tt = useTooltip();
  return (
    <>
      <span className="da-hint" tabIndex={0} role="img" aria-label={text} {...tt.bind(<em>{text}</em>)}><Ic name="info" size={14} /></span>
      {tt.node}
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

/** Ring with a centred label. */
export function RingStat({ pct, size = 48, stroke = 5, color, track, children, className = '' }:
  { pct: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode; className?: string }) {
  return (
    <div className={`da-ring ${className}`} style={{ width: size, height: size }}>
      <Ring pct={pct} size={size} stroke={stroke} color={color} track={track} />
      <span>{children}</span>
    </div>
  );
}

/* ── Shared 0-100 plot frame (SVG; used by the trend chart) ───── */
const W = 640, H = 240, PL = 38, PR = 14, PT = 14, PB = 34;
const yOf = (v: number) => PT + (1 - Math.min(Math.max(v, 0), 100) / 100) * (H - PT - PB);

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: 'block', overflow: 'visible' }}>
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={PL} x2={W - PR} y1={yOf(v)} y2={yOf(v)} stroke="var(--line)" strokeWidth={v === 0 ? 1.2 : 0.8} strokeDasharray={v === 0 ? undefined : '3 4'} />
          <text x={PL - 8} y={yOf(v) + 3.5} textAnchor="end" fontSize="10.5" fill="var(--ink-3)" fontFamily="'IBM Plex Sans', sans-serif">{v}</text>
        </g>
      ))}
      {children}
    </svg>
  );
}

export function Legend({ items }: { items: { color: string; label: string; hollow?: boolean }[] }) {
  return (
    <div className="da-legend-inline">
      {items.map((it) => (
        <span key={it.label}><i className={it.hollow ? 'is-hollow' : ''} style={it.hollow ? undefined : { background: it.color }} />{it.label}</span>
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

/* ── Column chart: one column per GRI phase ──────────────────────
   HTML/CSS (not a scaled SVG) so labels keep their size at every width.
   Assessed phases grow from the axis to the real score; unassessed phases are a hatched stub, not a 0-height bar. */
export interface PhaseCol { num: number; result: ResultPoint | null; locked: boolean }

export function PhaseColumns({ cols, lang, onOpen }: { cols: PhaseCol[]; lang: string; onOpen?: (id: number) => void }) {
  const [ref, shown] = useInView<HTMLDivElement>(0.2);
  const tt = useTooltip();
  const tr = lang === 'tr';
  const naText = tr ? 'Değerlendirilmedi' : 'Not assessed';
  return (
    <div ref={ref} className="da-cols" role="group" aria-label={tr ? 'Aşama skorları, 0-100 ölçeği' : 'Phase scores, 0-100 scale'}>
      <div className="da-cols-y" aria-hidden="true">
        {[0, 25, 50, 75, 100].map((v) => <span key={v} style={{ bottom: `${v}%` }}>{v}</span>)}
      </div>
      <div className="da-cols-plot">
        {[0, 25, 50, 75, 100].map((v) => <i key={v} className={`da-cols-grid${v === 0 ? ' is-base' : ''}`} style={{ bottom: `${v}%` }} />)}
        <div className="da-cols-bars">
          {cols.map((c, i) => {
            const r = c.result;
            if (!r) {
              return (
                <div key={c.num} className="da-col is-na" tabIndex={0} role="img" aria-label={`${phaseLabel(c.num, lang)}: ${naText}`}
                  {...tt.bind(<TipRows title={phaseLabel(c.num, lang)} rows={[[tr ? 'Durum' : 'Status', c.locked ? (tr ? 'Kilitli' : 'Locked') : naText]]} />)}>
                  <span className="da-col-stub" />
                </div>
              );
            }
            const h = Math.min(Math.max(r.score, 0), 100);
            return (
              <button key={c.num} type="button" className="da-col" aria-label={`${phaseLabel(c.num, lang)} ${r.score.toFixed(1)}%`}
                onClick={() => onOpen?.(r.id)} {...tt.bind(resultTip(r, lang))}>
                <span className="da-col-val da-anim-fade" style={{ bottom: `calc(${h}% + 6px)`, opacity: shown ? 1 : 0, transitionDelay: `${280 + i * 80}ms` }}>{Math.round(r.score)}%</span>
                <span className="da-col-bar" style={{ height: shown ? `${h}%` : '0%', background: PHASE_COLORS[c.num], transitionDelay: `${i * 80}ms` }} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="da-cols-x">
        {cols.map((c) => (
          <span key={c.num} className={c.result ? '' : 'is-na'}>
            <b>{phaseLabel(c.num, lang)}</b>
            <small>{c.result ? fmtShort(c.result.iso, lang) : naText}</small>
          </span>
        ))}
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
            <text key={r.id} x={xOf(i)} y={H - 10} textAnchor="middle" fontSize="10.5" fill="var(--ink-3)" fontFamily="'IBM Plex Sans', sans-serif">{fmtShort(r.iso, lang)}</text>
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

/* ── Horizontal bar rows (categories, comparisons) ─────────────── */
export interface BarRow { key: string; label: string; sub?: string; pct: number; color: string; tip?: ReactNode; href?: string }
export function HBars({ rows, onOpen, tick, dense }: { rows: BarRow[]; onOpen?: (href: string) => void; tick?: number; dense?: boolean }) {
  const [ref, shown] = useInView<HTMLDivElement>(0.12);
  const tt = useTooltip();
  return (
    <div ref={ref} className={`da-hbars${dense ? ' is-dense' : ''}`}>
      {rows.map((r, i) => (
        <div key={r.key} className={`da-hrow${r.href ? ' is-link' : ''}`} tabIndex={r.tip || r.href ? 0 : undefined} role={r.href ? 'link' : undefined}
          onClick={() => r.href && onOpen?.(r.href)} onKeyDown={(e) => { if (e.key === 'Enter' && r.href) onOpen?.(r.href); }}
          {...(r.tip ? tt.bind(r.tip) : {})}>
          <span className="da-hlabel">{r.label}{r.sub && <small>{r.sub}</small>}</span>
          <span className="da-htrack">
            <span className="da-hfill da-anim-w" style={{ width: shown ? `${r.pct}%` : '0%', background: r.color, transitionDelay: `${Math.min(i, 12) * 40}ms` }} />
            {typeof tick === 'number' && <i className="da-htick" style={{ left: `${tick}%` }} />}
          </span>
          <span className="da-hpct">{Math.round(r.pct)}%</span>
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

/* ── Radar: one fixed axis per dimension ─────────────────────────
   Every axis is always drawn so the shape is stable. An assessed axis gets a coloured spoke and marker at its real
   value. The filled area is drawn only between two NEIGHBOURING axes that both have a real value, so nothing is
   interpolated across an unassessed dimension, and an unassessed axis is dashed and labelled "—", never 0. */
export interface RadarAxis { key: number; label: string; value: number | null; color: string }

export function Radar({ axes, lang }: { axes: RadarAxis[]; lang: string }) {
  const [ref, shown] = useInView<SVGSVGElement>(0.2);
  const tt = useTooltip();
  const SW = 284, SH = 232, cx = SW / 2, cy = 118, R = 70, n = axes.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, v: number) => [cx + Math.cos(ang(i)) * R * (v / 100), cy + Math.sin(ang(i)) * R * (v / 100)] as const;
  const ring = (v: number) => axes.map((_, i) => pt(i, v).join(',')).join(' ');
  const tr = lang === 'tr';
  const wedges = axes.map((a, i) => ({ a, b: axes[(i + 1) % n], i, j: (i + 1) % n })).filter((w) => n > 2 && w.a.value !== null && w.b.value !== null);
  return (
    <div className="da-radar">
      <svg ref={ref} viewBox={`0 0 ${SW} ${SH}`} width={SW} height={SH} role="img"
        aria-label={tr ? 'Boyutlara göre skor radar grafiği' : 'Radar chart of scores by dimension'}>
        {[25, 50, 75, 100].map((v) => <polygon key={v} points={ring(v)} fill="none" stroke="var(--line)" strokeWidth={v === 100 ? 1.1 : 0.8} />)}
        {axes.map((a, i) => { const [x, y] = pt(i, 100); return <line key={a.key} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth="0.9" strokeDasharray={a.value === null ? '2 3' : undefined} />; })}
        {[50, 100].map((v) => <text key={v} x={cx - 4} y={cy - (R * v) / 100 + 10} textAnchor="end" fontSize="9" fill="var(--ink-4)" fontFamily="'IBM Plex Sans', sans-serif">{v}</text>)}
        <g className="da-anim-scale" style={{ transformOrigin: `${cx}px ${cy}px`, transform: shown ? 'scale(1)' : 'scale(0.02)', opacity: shown ? 1 : 0 }}>
          {wedges.map((w) => {
            const [x1, y1] = pt(w.i, w.a.value as number), [x2, y2] = pt(w.j, w.b.value as number);
            return (
              <g key={`${w.i}-${w.j}`}>
                <path d={`M ${cx} ${cy} L ${x1} ${y1} L ${x2} ${y2} Z`} fill="rgba(60,92,63,.14)" />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--olive-deep)" strokeWidth="1.8" strokeLinecap="round" />
              </g>
            );
          })}
          {axes.map((a, i) => {
            if (a.value === null) return null;
            const [x, y] = pt(i, a.value);
            return (
              <g key={a.key}>
                <line x1={cx} y1={cy} x2={x} y2={y} stroke={a.color} strokeWidth="2" strokeLinecap="round" opacity=".4" />
                <circle className="da-hit" cx={x} cy={y} r="5" fill={a.color} stroke="var(--paper)" strokeWidth="1.6" tabIndex={0} role="img"
                  aria-label={`${a.label} ${a.value.toFixed(1)}%`} {...tt.bind(<TipRows title={a.label} rows={[[tr ? 'Skor' : 'Score', `${a.value.toFixed(1)}%`]]} />)} />
              </g>
            );
          })}
        </g>
        {axes.map((a, i) => {
          const [lx, ly] = pt(i, 100);
          const c = Math.cos(ang(i)), s = Math.sin(ang(i));
          const anchor = c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle';
          const x = lx + c * 9, y = ly + s * 9 + (s < -0.5 ? -15 : s > 0.5 ? 10 : -2);
          return (
            <text key={a.key} x={x} y={y} textAnchor={anchor} fontFamily="'IBM Plex Sans', sans-serif">
              <tspan fontSize="11" fill={a.value === null ? 'var(--ink-4)' : 'var(--ink-2)'}>{a.label}</tspan>
              <tspan x={x} dy="13" fontSize="11.5" fontWeight="600" fill={a.value === null ? 'var(--ink-4)' : 'var(--ink)'}>{a.value === null ? '—' : `${Math.round(a.value)}%`}</tspan>
            </text>
          );
        })}
      </svg>
      {tt.node}
    </div>
  );
}
