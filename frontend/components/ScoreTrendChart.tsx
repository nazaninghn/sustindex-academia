'use client';
/**
 * ScoreTrendChart — pure-SVG score trend sparklines.
 * No external dependency required.
 *
 * Props:
 *   attempts  — array of completed attempts (with total_score + completed_at)
 *   lang      — 'en' | 'tr'
 *   height    — SVG canvas height in px (default 120)
 */

import { useMemo, useState } from 'react';

export interface TrendAttempt {
  id: number;
  survey_name: string;
  completed_at: string;
  total_score: number;
  overall_grade: string;
}

const SURVEY_COLOURS = [
  'var(--olive-deep)',
  '#5B6FA6',
  '#B05C3A',
  '#7A4FA8',
  '#2E8B6F',
];

const PAD = { top: 18, right: 20, bottom: 28, left: 38 };

function getPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const d = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');
  return d;
}

function getAreaPath(points: { x: number; y: number }[], baseline: number): string {
  if (points.length < 2) return '';
  const line = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
}

export default function ScoreTrendChart({
  attempts,
  lang = 'en',
  height = 140,
}: {
  attempts: TrendAttempt[];
  lang?: string;
  height?: number;
}) {
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; score: number; date: string; survey: string;
  } | null>(null);

  const width = 600; // viewBox width — SVG scales to container

  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  // Group attempts by survey name
  const grouped = useMemo(() => {
    const map: Record<string, TrendAttempt[]> = {};
    for (const a of attempts) {
      const key = a.survey_name || 'Unknown';
      if (!map[key]) map[key] = [];
      map[key].push(a);
    }
    // Sort each group by completed_at ascending
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
    }
    return map;
  }, [attempts]);

  const surveyNames = Object.keys(grouped);

  // Global date range across all attempts
  const allDates = attempts.map((a) => new Date(a.completed_at).getTime());
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const dateRange = maxDate - minDate || 1;

  // Y axis: always 0–100
  const toSvgX = (ts: number) => PAD.left + ((ts - minDate) / dateRange) * innerW;
  const toSvgY = (score: number) => PAD.top + innerH - (score / 100) * innerH;

  // Y-axis tick marks
  const yTicks = [0, 25, 50, 75, 100];

  if (attempts.length === 0) return null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height, overflow: 'visible', display: 'block' }}
        aria-label={lang === 'tr' ? 'Skor trendi grafiği' : 'Score trend chart'}
      >
        {/* Y-axis grid lines + labels */}
        {yTicks.map((tick) => {
          const y = toSvgY(tick);
          return (
            <g key={tick}>
              <line
                x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y}
                stroke="var(--line)" strokeWidth={tick === 0 ? 1.5 : 0.8}
                strokeDasharray={tick === 0 ? undefined : '4 4'}
              />
              <text
                x={PAD.left - 6} y={y + 3.5}
                textAnchor="end"
                fontSize={9}
                fontFamily="'IBM Plex Mono', monospace"
                fill="var(--ink-4)"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Per-survey lines */}
        {surveyNames.map((name, sIdx) => {
          const colour = SURVEY_COLOURS[sIdx % SURVEY_COLOURS.length];
          const pts = grouped[name].map((a) => ({
            x: toSvgX(new Date(a.completed_at).getTime()),
            y: toSvgY(a.total_score),
            attempt: a,
          }));
          const baseline = toSvgY(0);

          return (
            <g key={name}>
              {/* Area fill */}
              {pts.length > 1 && (
                <path
                  d={getAreaPath(pts, baseline)}
                  fill={colour}
                  opacity={0.07}
                />
              )}
              {/* Line */}
              <path
                d={getPath(pts)}
                fill="none"
                stroke={colour}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Dots */}
              {pts.map((pt) => (
                <circle
                  key={pt.attempt.id}
                  cx={pt.x}
                  cy={pt.y}
                  r={4}
                  fill={colour}
                  stroke="var(--paper)"
                  strokeWidth={1.5}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() =>
                    setTooltip({
                      x: pt.x,
                      y: pt.y,
                      score: pt.attempt.total_score,
                      date: new Date(pt.attempt.completed_at).toLocaleDateString(),
                      survey: name,
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </g>
          );
        })}

        {/* Tooltip anchor (SVG foreignObject works but is flaky; use overlay div instead) */}
        {tooltip && (
          <g>
            <line
              x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={PAD.top + innerH}
              stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 3"
            />
          </g>
        )}

        {/* X-axis date labels */}
        {surveyNames.flatMap((name) =>
          grouped[name]
            .filter((_, i) => {
              // Show only first + last label per group to avoid clutter
              const arr = grouped[name];
              return i === 0 || i === arr.length - 1;
            })
            .map((a) => {
              const x = toSvgX(new Date(a.completed_at).getTime());
              const y = PAD.top + innerH + 14;
              return (
                <text
                  key={`label-${a.id}`}
                  x={x} y={y}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontFamily="'IBM Plex Mono', monospace"
                  fill="var(--ink-4)"
                >
                  {new Date(a.completed_at).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', {
                    month: 'short', day: 'numeric',
                  })}
                </text>
              );
            })
        )}
      </svg>

      {/* Floating tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: `calc(${(tooltip.x / width) * 100}% + 8px)`,
          top: `calc(${(tooltip.y / height) * 100}% - 36px)`,
          background: 'var(--ink)',
          color: 'var(--cream)',
          padding: '6px 10px',
          fontSize: 10.5,
          fontFamily: "'IBM Plex Mono', monospace",
          letterSpacing: '0.04em',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 10,
        }}>
          <div style={{ fontWeight: 600 }}>{Math.round(tooltip.score)}%</div>
          <div style={{ opacity: 0.7, fontSize: 9.5 }}>{tooltip.date}</div>
        </div>
      )}

      {/* Legend */}
      {surveyNames.length > 1 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '8px 20px',
          marginTop: 6, paddingLeft: PAD.left,
        }}>
          {surveyNames.map((name, sIdx) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-block', width: 18, height: 2,
                background: SURVEY_COLOURS[sIdx % SURVEY_COLOURS.length],
                borderRadius: 1, flexShrink: 0,
              }} />
              <span style={{
                fontSize: 10, color: 'var(--ink-3)',
                fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: '0.03em',
              }}>{name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
