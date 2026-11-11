'use client';
/* Assessment navigation panel for the questionnaire.
   Shows overall progress, then the chapters (categories) with answered counts and a status ring.
   Chapters are organised into collapsible GRI-phase groups when the survey has phases; otherwise
   they are a single list. Clicking a chapter jumps to its first unanswered question (or its first
   question when complete) through the existing handleJumpTo handler.
   Phase locking is unchanged: chapters of a locked phase are disabled.                              */

import { useEffect, useRef, useState } from 'react';
import { Ic } from '@/components/dashboard/icons';
import type { ChapterInfo, GriPhase, Question } from './types';

interface Props {
  chapters: ChapterInfo[];
  GRI_PHASES: GriPhase[];
  /** category_name of the question currently shown */
  currentCategory: string | undefined;
  unlockedUpToPhase: number;
  lang: string;
  onJumpTo: (idx: number) => void;
  /** Optional: the question list, used only to show each chapter's criterion code (e.g. "S10"). */
  questions?: Question[];
}

/** 18px status ring: empty = not started, partial arc = in progress, filled check = complete, lock = locked. */
function StatusRing({ pct, done, locked }: { pct: number; done: boolean; locked: boolean }) {
  if (locked) return <span className="qx-ring is-locked"><Ic name="lock" size={12} /></span>;
  if (done)   return <span className="qx-ring is-done"><Ic name="check" size={11} /></span>;
  const r = 7, c = 2 * Math.PI * r;
  return (
    <svg className="qx-ring" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r={r} fill="none" stroke="var(--line)" strokeWidth="2" />
      {pct > 0 && (
        <circle cx="9" cy="9" r={r} fill="none" stroke="var(--olive-deep)" strokeWidth="2" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 9 9)" />
      )}
    </svg>
  );
}

export function ChapterRail({ chapters, GRI_PHASES, currentCategory, unlockedUpToPhase, lang, onJumpTo, questions }: Props) {
  const tr = lang === 'tr';
  const [open, setOpen] = useState(false);
  // Phase groups the user collapsed / expanded by hand. Undefined = default (locked phases start collapsed).
  const [groupOpen, setGroupOpen] = useState<Record<number, boolean>>({});
  const railRef = useRef<HTMLElement>(null);
  const current = chapters.find((c) => c.key === currentCategory);
  const title = tr ? 'Değerlendirme İlerlemesi' : 'Assessment Progress';

  const answered = chapters.reduce((s, c) => s + c.answered, 0);
  const total    = chapters.reduce((s, c) => s + c.total, 0);
  const pctAll   = total > 0 ? Math.round((answered / total) * 100) : 0;
  const doneChapters = chapters.filter((c) => c.total > 0 && c.answered >= c.total).length;

  const isGroupOpen = (num: number, locked: boolean) => groupOpen[num] ?? !locked;

  // The phase that contains the current chapter is always expanded, so the active chapter is never hidden.
  useEffect(() => {
    if (current && current.phaseNum > 0) setGroupOpen((g) => (g[current.phaseNum] === false ? { ...g, [current.phaseNum]: true } : g));
  }, [current]);

  // Keep the current chapter visible inside the scrollable list without moving the page.
  useEffect(() => {
    const rail = railRef.current;
    const cur  = rail?.querySelector<HTMLElement>('.qx-chap.is-current');
    if (!rail || !cur) return;
    const scroller = [rail.querySelector<HTMLElement>('.qx-rail-list'), rail.querySelector<HTMLElement>('.qx-rail-body'), rail]
      .find((el): el is HTMLElement => !!el && el.scrollHeight > el.clientHeight + 1);
    if (!scroller) return;
    const top = cur.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    if (top < scroller.scrollTop + 8 || top + cur.offsetHeight > scroller.scrollTop + scroller.clientHeight - 8) {
      scroller.scrollTop = Math.max(0, top - Math.round(scroller.clientHeight / 3));
    }
  }, [currentCategory, open, groupOpen]);

  const renderChapters = (items: ChapterInfo[], locked: boolean) =>
    items.map((ch) => {
      const isCurrent = ch.key === currentCategory;
      const done = ch.total > 0 && ch.answered >= ch.total;
      const pct  = ch.total > 0 ? Math.round((ch.answered / ch.total) * 100) : 0;
      // When the API has no localised chapter title the label IS the code — do not print it twice.
      const rawCode = questions?.[ch.firstIdx]?.criterion_code;
      const code = rawCode && rawCode !== ch.label ? rawCode : undefined;
      const status = locked ? (tr ? 'kilitli' : 'locked')
        : done ? (tr ? 'tamamlandı' : 'completed')
        : ch.answered > 0 ? (tr ? 'devam ediyor' : 'in progress')
        : (tr ? 'başlanmadı' : 'not started');
      return (
        <button
          key={ch.key}
          type="button"
          disabled={locked}
          aria-current={isCurrent ? 'true' : undefined}
          aria-label={`${ch.label}: ${ch.answered}/${ch.total} ${tr ? 'cevaplandı' : 'answered'}, ${status}`}
          title={locked ? (tr ? 'Önceki aşamayı tamamlayın' : 'Complete the previous phase first') : undefined}
          className={`qx-chap${isCurrent ? ' is-current' : ''}${done ? ' is-done' : ''}`}
          onClick={() => {
            onJumpTo(ch.firstOpenIdx >= 0 ? ch.firstOpenIdx : ch.firstIdx);
            setOpen(false);
          }}
        >
          <StatusRing pct={pct} done={done} locked={locked} />
          <span className="qx-chap-main">
            {code && <span className="qx-chap-code">{code}</span>}
            <span className="qx-chap-name">{ch.label}</span>
          </span>
          <span className="qx-chap-n">{ch.answered}/{ch.total}</span>
        </button>
      );
    });

  const flat = chapters.filter((c) => c.phaseNum === 0);

  return (
    <nav ref={railRef} className={`qx-rail${open ? ' is-open' : ''}`} aria-label={title}>
      {/* Mobile / tablet: collapsed summary that expands the panel */}
      <button
        type="button"
        className="qx-rail-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="qx-rail-toggle-main">
          <span className="qx-rail-sub">{title} · {pctAll}%{current ? ` · ${current.answered}/${current.total}` : ''}</span>
          <span className="qx-rail-cur">{current?.label ?? title}</span>
        </span>
        <Ic name="chevron" size={16} className={`qx-rail-chev${open ? ' is-open' : ''}`} />
      </button>

      <div className="qx-rail-body">
        <div className="qx-rail-head">
          <span className="qx-rail-title">{title}</span>
          <div className="qx-rail-overall">
            <b>{pctAll}%</b>
            <span>{tr ? `${total} sorudan ${answered} cevaplandı` : `${answered} of ${total} answered`}</span>
          </div>
          <div className="qx-rail-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pctAll} aria-label={title}>
            <span style={{ width: `${pctAll}%` }} />
          </div>
          <span className="qx-rail-meta">{tr ? `${chapters.length} bölümden ${doneChapters} tamamlandı` : `${doneChapters} of ${chapters.length} chapters complete`}</span>
        </div>

        <div className="qx-rail-list">
          {/* Chapters that are not part of a GRI phase: one list, never locked */}
          {flat.length > 0 && <div className="qx-phase">{renderChapters(flat, false)}</div>}

          {GRI_PHASES.map((phase) => {
            const items = chapters.filter((c) => c.phaseNum === phase.num);
            if (items.length === 0) return null;
            const locked   = phase.num > unlockedUpToPhase;
            const pAnswered = items.reduce((s, c) => s + c.answered, 0);
            const pTotal    = items.reduce((s, c) => s + c.total, 0);
            const complete  = pAnswered >= pTotal && pTotal > 0;
            const expanded  = isGroupOpen(phase.num, locked);
            return (
              <div key={phase.num} className={`qx-phase is-group${locked ? ' is-locked' : ''}`}>
                <button
                  type="button"
                  className="qx-phase-head"
                  aria-expanded={expanded}
                  aria-controls={`qx-phase-${phase.num}`}
                  title={locked ? (tr ? 'Önceki aşamayı tamamlayın' : 'Complete the previous phase first') : undefined}
                  onClick={() => setGroupOpen((g) => ({ ...g, [phase.num]: !expanded }))}
                >
                  <Ic name="chevron" size={14} className={`qx-phase-chev${expanded ? ' is-open' : ''}`} />
                  <span className="qx-phase-label">{phase.label}</span>
                  {locked ? <Ic name="lock" size={12} className="qx-phase-state" /> : complete ? <Ic name="check" size={13} className="qx-phase-state is-done" /> : null}
                  <span className="qx-phase-count">{pAnswered}/{pTotal}</span>
                </button>
                {expanded && <div id={`qx-phase-${phase.num}`}>{renderChapters(items, locked)}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
