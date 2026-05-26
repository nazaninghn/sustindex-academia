'use client';
import React from 'react';

/* ============================================================
   Icons
   ============================================================ */
export const Icon = {
  // Fix #43: aria-hidden="true" on all decorative icons so screen readers skip them.
  // Callers that use icons as meaningful content can pass aria-hidden={false} + aria-label.
  arrow:    (props?: React.SVGProps<SVGSVGElement>) => (
    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M5 12h14M13 5l7 7-7 7"/>
    </svg>
  ),
  arrowDown:(props?: React.SVGProps<SVGSVGElement>) => (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M12 5v14M19 13l-7 7-7-7"/>
    </svg>
  ),
  check:    (props?: React.SVGProps<SVGSVGElement>) => (
    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 12l5 5 11-11"/>
    </svg>
  ),
  plus:     (props?: React.SVGProps<SVGSVGElement>) => (
    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  download: (props?: React.SVGProps<SVGSVGElement>) => (
    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M12 4v12M6 12l6 6 6-6M4 20h16"/>
    </svg>
  ),
  external: (props?: React.SVGProps<SVGSVGElement>) => (
    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M14 4h6v6M20 4l-9 9M9 5H5a1 1 0 00-1 1v13a1 1 0 001 1h13a1 1 0 001-1v-4"/>
    </svg>
  ),
};

/* ============================================================
   GradeChip
   ============================================================ */
export function GradeChip({ grade = 'A-', size = 48 }: { grade?: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 12,
      background: 'var(--ink)', color: 'var(--cream)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600,
      fontSize: size * 0.42, letterSpacing: '-0.04em',
    }}>
      {grade}
    </div>
  );
}

/* ============================================================
   ScoreBar
   ============================================================ */
export function ScoreBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--ink)' }}>{label}</span>
        <span style={{ fontSize: 18, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
          {value}<span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}> / {max}</span>
        </span>
      </div>
      <div className="bar bar-olive"><span style={{ width: pct + '%' }}></span></div>
    </div>
  );
}

/* ============================================================
   Eyebrow primitive
   ============================================================ */
export function Eyebrow({ children, num }: { children: React.ReactNode; num?: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      {num && <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{num}</span>}
      <span className="eyebrow">{children}</span>
    </div>
  );
}
