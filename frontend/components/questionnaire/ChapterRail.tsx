'use client';
/* Chapter / section navigation for the questionnaire.
   Lists the chapters (categories) with answered counts, grouped under the GRI phases
   when the survey has them. Clicking a chapter jumps to its first unanswered question
   (or its first question when complete) through the existing handleJumpTo handler.
   Phase locking is unchanged: chapters of a locked phase are disabled.                */

import { useEffect, useRef, useState } from 'react';
import type { ChapterInfo, GriPhase } from './types';

interface Props {
  chapters: ChapterInfo[];
  GRI_PHASES: GriPhase[];
  /** category_name of the question currently shown */
  currentCategory: string | undefined;
  unlockedUpToPhase: number;
  lang: string;
  onJumpTo: (idx: number) => void;
}

export function ChapterRail({ chapters, GRI_PHASES, currentCategory, unlockedUpToPhase, lang, onJumpTo }: Props) {
  const [open, setOpen] = useState(false);
  const railRef = useRef<HTMLElement>(null);
  const current = chapters.find((c) => c.key === currentCategory);
  const title = lang === 'tr' ? 'Bölümler' : 'Chapters';

  // Keep the current chapter visible inside the scrollable rail without moving the page.
  useEffect(() => {
    const rail = railRef.current;
    const cur  = rail?.querySelector<HTMLElement>('.qx-chap.is-current');
    if (!rail || !cur) return;
    const scroller = rail.scrollHeight > rail.clientHeight
      ? rail
      : rail.querySelector<HTMLElement>('.qx-rail-body') ?? rail;
    const top = cur.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    if (top < scroller.scrollTop + 40 || top > scroller.scrollTop + scroller.clientHeight - 70) {
      scroller.scrollTop = Math.max(0, top - 90);
    }
  }, [currentCategory, open]);

  const renderChapters = (items: ChapterInfo[], locked: boolean) =>
    items.map((ch) => {
      const isCurrent = ch.key === currentCategory;
      const done = ch.total > 0 && ch.answered >= ch.total;
      const pct  = ch.total > 0 ? Math.round((ch.answered / ch.total) * 100) : 0;
      return (
        <button
          key={ch.key}
          type="button"
          disabled={locked}
          aria-current={isCurrent ? 'true' : undefined}
          className={`qx-chap${isCurrent ? ' is-current' : ''}${done ? ' is-done' : ''}`}
          onClick={() => {
            onJumpTo(ch.firstOpenIdx >= 0 ? ch.firstOpenIdx : ch.firstIdx);
            setOpen(false);
          }}
        >
          <span className="qx-chap-line">
            <span className="qx-chap-name" title={ch.label}>{ch.label}</span>
            <span className="qx-chap-n">{done ? '✓' : `${ch.answered}/${ch.total}`}</span>
          </span>
          <span className="qx-chap-track"><span style={{ width: `${pct}%` }} /></span>
        </button>
      );
    });

  const flat = chapters.filter((c) => c.phaseNum === 0);

  return (
    <nav ref={railRef} className={`qx-rail${open ? ' is-open' : ''}`} aria-label={title}>
      {/* Mobile / tablet: collapsed summary that expands the list */}
      <button
        type="button"
        className="qx-rail-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ minWidth: 0 }}>
          <span className="qx-rail-sub">{title}{current ? ` · ${current.answered}/${current.total}` : ''}</span>
          <span className="qx-rail-cur">{current?.label ?? title}</span>
        </span>
        <span className="qx-phase-count">{open ? '▲' : '▼'}</span>
      </button>

      <div className="qx-rail-body">
        <span className="qx-rail-title">{title}</span>

        {/* Chapters that are not part of a GRI phase: plain list, never locked */}
        {flat.length > 0 && <div className="qx-phase">{renderChapters(flat, false)}</div>}

        {GRI_PHASES.map((phase) => {
          const items = chapters.filter((c) => c.phaseNum === phase.num);
          if (items.length === 0) return null;
          const locked   = phase.num > unlockedUpToPhase;
          const answered = items.reduce((s, c) => s + c.answered, 0);
          const total    = items.reduce((s, c) => s + c.total, 0);
          return (
            <div key={phase.num} className={`qx-phase${locked ? ' is-locked' : ''}`}>
              <div
                className="qx-phase-head"
                title={locked ? (lang === 'tr' ? 'Önceki aşamayı tamamlayın' : 'Complete the previous phase first') : undefined}
              >
                <span className="qx-phase-num">{answered >= total && total > 0 ? '✓' : String(phase.num).padStart(2, '0')}</span>
                <span>{phase.label}</span>
                <span className="qx-phase-count">{answered}/{total}</span>
              </div>
              {renderChapters(items, locked)}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
