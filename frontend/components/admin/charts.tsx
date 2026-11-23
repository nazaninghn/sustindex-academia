'use client';
/**
 * Hand-built SVG charts for the admin console (no chart dependency).
 * Rules followed: one y-axis per chart, thin marks, recessive grid, a legend whenever
 * there are two series, and a hover layer (crosshair / per-mark tooltip) on every plot.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Round a maximum up to a tidy axis ceiling (1, 2, 5 × 10ⁿ steps). */
function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10) * pow;
}

export interface LinePoint { label: string; tip: string; a: number; b: number }

/** Two series on one shared y-axis, with crosshair + tooltip. */
export function LineChart({ data, nameA, nameB, height = 240 }: { data: LinePoint[]; nameA: string; nameB: string; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 30, r: 10, t: 10, b: 24 };
  const iw = Math.max(w - pad.l - pad.r, 10), ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.a, d.b))));
  const x = (i: number) => pad.l + (data.length > 1 ? (i / (data.length - 1)) * iw : iw / 2);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const path = (key: 'a' | 'b') => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join('');
  const ticks = [0, max / 2, max];
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 80))));
  const h = hover !== null ? data[hover] : null;

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - box.left) / box.width;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(rel * (data.length - 1)))));
  };

  return (
    <div className="adm-chart" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={`${nameA} / ${nameB}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--a-line)" strokeWidth={1} />
              <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end">{Number.isInteger(t) ? t : t.toFixed(1)}</text>
            </g>
          ))}
          {data.map((d, i) => (i % labelEvery === 0 && i + labelEvery / 2 < data.length + 1) && (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : 'middle'}>{d.label}</text>
          ))}
          <path d={`${path('a')}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill="var(--a-s1)" opacity={0.1} />
          <path d={path('b')} fill="none" stroke="var(--a-s2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={path('a')} fill="none" stroke="var(--a-s1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {h && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--a-ink-3)" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(h.b)} r={4.5} fill="var(--a-s2)" stroke="var(--a-card)" strokeWidth={2} />
              <circle cx={x(hover)} cy={y(h.a)} r={4.5} fill="var(--a-s1)" stroke="var(--a-card)" strokeWidth={2} />
            </g>
          )}
          <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </svg>
      )}
      {h && hover !== null && (
        <div className="adm-tip" style={{ left: Math.max(80, Math.min(w - 80, x(hover))), top: Math.min(y(h.a), y(h.b)) - 10 }}>
          <b>{h.tip}</b>
          <div className="adm-tip-row"><i style={{ background: 'var(--a-s1)' }} /><span>{nameA}</span><span>{h.a}</span></div>
          <div className="adm-tip-row"><i style={{ background: 'var(--a-s2)' }} /><span>{nameB}</span><span>{h.b}</span></div>
        </div>
      )}
    </div>
  );
}

/** Tiny trend line for a KPI tile — no axes; the tile's number is the label. */
export function Sparkline({ values, width = 96, height = 34 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [2 + (i / (values.length - 1)) * (width - 4), height - 3 - (v / max) * (height - 6)] as const);
  const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('');
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <path d={`${d}L${width - 2},${height}L2,${height}Z`} fill="currentColor" opacity={0.12} />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export interface Bar { label: string; value: number; tip: string }

/** Vertical bars from a zero baseline (histogram / ordered categories). Single series, single hue. */
export function BarChart({ data, height = 190, valueLabels = true }: { data: Bar[]; height?: number; valueLabels?: boolean }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 4, r: 4, t: 18, b: 22 };
  const iw = Math.max(w - pad.l - pad.r, 10), ih = height - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = iw / data.length;
  const bw = Math.min(Math.max(slot - 6, 4), 44);
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="adm-chart" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} role="img">
          <line x1={pad.l} x2={w - pad.r} y1={pad.t + ih} y2={pad.t + ih} stroke="var(--a-line-strong)" strokeWidth={1} />
          {data.map((d, i) => {
            const bh = d.value ? Math.max((d.value / max) * ih, 2) : 0;
            const bx = pad.l + i * slot + (slot - bw) / 2;
            const r = Math.min(4, bh);
            const top = pad.t + ih - bh;
            return (
              <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={pad.l + i * slot} y={pad.t} width={slot} height={ih + pad.b} fill="transparent" />
                {bh > 0 && (
                  <path d={`M${bx},${top + bh}V${top + r}Q${bx},${top} ${bx + r},${top}H${bx + bw - r}Q${bx + bw},${top} ${bx + bw},${top + r}V${top + bh}Z`}
                    fill="var(--a-s1)" opacity={hover === null || hover === i ? 1 : 0.45} />
                )}
                {valueLabels && d.value > 0 && slot >= 26 && (
                  <text x={bx + bw / 2} y={top - 5} textAnchor="middle" style={{ fill: 'var(--a-ink-2)', fontWeight: 600 }}>{d.value}</text>
                )}
                <text x={bx + bw / 2} y={height - 6} textAnchor="middle">{d.label}</text>
              </g>
            );
          })}
        </svg>
      )}
      {h && hover !== null && (
        <div className="adm-tip" style={{ left: Math.max(70, Math.min(w - 70, pad.l + hover * slot + slot / 2)), top: pad.t + ih - (h.value / max) * ih - 8 }}>
          {h.tip}
        </div>
      )}
    </div>
  );
}

/** GitHub-style activity calendar: columns are weeks, rows Monday→Sunday, one sequential hue. */
export function Heatmap({ days, tip }: { days: { date: string; count: number }[]; tip: (d: { date: string; count: number }) => string }) {
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const { cells, max } = useMemo(() => {
    const first = days.length ? (new Date(days[0].date + 'T00:00:00Z').getUTCDay() + 6) % 7 : 0;   // Monday = 0
    const lead = Array.from({ length: first }, () => null as null | { date: string; count: number });
    return { cells: [...lead, ...days], max: Math.max(1, ...days.map((d) => d.count)) };
  }, [days]);
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const h = hover ? cells[hover.i] : null;
  return (
    <div className="adm-chart" ref={wrap}>
      <div className="adm-heat" onMouseLeave={() => setHover(null)}>
        {cells.map((c, i) => c === null
          ? <span key={i} />
          : <i key={c.date} data-l={level(c.count)}
              onMouseEnter={(e) => {
                const box = wrap.current!.getBoundingClientRect();
                const r = e.currentTarget.getBoundingClientRect();
                setHover({ i, x: r.left - box.left + r.width / 2, y: r.top - box.top - 6 });
              }} />)}
      </div>
      {h && hover && (
        <div className="adm-tip" style={{ left: Math.max(80, Math.min((wrap.current?.clientWidth || 300) - 80, hover.x)), top: hover.y }}>{tip(h)}</div>
      )}
    </div>
  );
}
