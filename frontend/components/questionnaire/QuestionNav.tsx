'use client';
/* CO-2: Question navigation bar (sticky at the bottom of the question column).
   Renders: inline error alert, Previous button, numbered question chips for the
   current chapter, an optional "Next flagged" jump, and Next / Finish button.     */

import { Icon } from '@/components/shared';
import { Ic } from '@/components/dashboard/icons';
import { GRI_PHASE_DEFS } from './utils';
import type { Question } from './types';
import './questionnaire.css';

interface Props {
  questions: Question[];
  currentIdx: number;
  /** Indexes (into `questions`) of the current chapter's visible questions — shown as chips. */
  chapterIdxs: number[];
  answers: Record<number, number[]>;
  textAnswers: Record<number, string>;
  bookmarks?: Record<number, boolean>;
  naAnswers?: Record<number, boolean>;
  unlockedUpToPhase: number;
  lang: string;
  isFirst: boolean;
  isLast: boolean;
  canSubmit: boolean;
  saving: boolean;
  /** Inline error message — shown with role="alert" above the nav buttons */
  error: string;
  onPrev: () => void;
  onNext: () => void;
  onJumpTo: (idx: number) => void;
  /** When provided, shows a 'Next Flagged' button to jump to the next bookmarked question. */
  onJumpToNextFlagged?: () => void;
}

export function QuestionNav({
  questions,
  currentIdx,
  chapterIdxs,
  answers,
  textAnswers,
  bookmarks = {},
  naAnswers = {},
  unlockedUpToPhase,
  lang,
  isFirst,
  isLast,
  canSubmit,
  saving,
  error,
  onPrev,
  onNext,
  onJumpTo,
  onJumpToNextFlagged,
}: Props) {
  const bookmarkedCount = Object.values(bookmarks).filter(Boolean).length;
  return (
    <div className="qx-nav">
      {/* Inline error — Fix A-2: role="alert" so AT announces it immediately */}
      {error && <p role="alert" className="qx-nav-error">{error}</p>}

      <div className="qx-nav-row q-nav-row">
        {/* Previous */}
        <button
          className="btn btn-outline qx-nav-btn"
          onClick={onPrev}
          disabled={isFirst}
          style={{ opacity: isFirst ? 0.3 : 1 }}
        >
          <Ic name="arrow" size={14} className="qx-flip" />
          {lang === 'tr' ? 'Önceki' : 'Previous'}
        </button>

        {/* Question chips for the current chapter */}
        <div className="qx-chips" role="group" aria-label={lang === 'tr' ? 'Bölümdeki sorular' : 'Questions in this chapter'}>
          {chapterIdxs.map((i, n) => {
            const qItem        = questions[i];
            if (!qItem) return null;
            const dotPhaseNum  = GRI_PHASE_DEFS.find(({ match }) => qItem.category_name?.includes(match))?.num ?? 1;
            const isLocked     = dotPhaseNum > unlockedUpToPhase;
            const isAnswered   = naAnswers[qItem.id] || (answers[qItem.id] ?? []).length > 0 || (textAnswers[qItem.id] ?? '').trim().length > 0;
            const isBookmarked = bookmarks[qItem.id] ?? false;
            const isCurrent    = i === currentIdx;
            return (
              <span
                key={qItem.id}
                role={isLocked ? undefined : 'button'}
                tabIndex={isLocked ? -1 : 0}
                aria-disabled={isLocked ? 'true' : undefined}
                aria-label={`Question ${i + 1}${isAnswered ? ' (answered)' : ''}${isLocked ? ' (locked)' : ''}${isBookmarked ? ' (flagged)' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => { if (!isLocked) onJumpTo(i); }}
                onKeyDown={(e) => { if (!isLocked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onJumpTo(i); } }}
                title={`Q${i + 1}${isAnswered ? (lang === 'tr' ? ' · cevaplandı' : ' · answered') : ''}${isBookmarked ? (lang === 'tr' ? ' · işaretli' : ' · flagged') : ''}`}
                className={`qx-chip${isCurrent ? ' is-current' : isAnswered ? ' is-answered' : ''}${isBookmarked ? ' is-flagged' : ''}`}
              >
                {n + 1}
              </span>
            );
          })}
        </div>

        {/* Next-flagged jump — shown only when ≥1 question is bookmarked */}
        {onJumpToNextFlagged && bookmarkedCount > 0 && (
          <button type="button" onClick={onJumpToNextFlagged} className="qx-flagjump">
            <Ic name="flag" size={12} /> {lang === 'tr' ? `Sonraki İşaretli (${bookmarkedCount})` : `Next Flagged (${bookmarkedCount})`}
          </button>
        )}

        {/* Next / Finish */}
        <button
          className="btn btn-primary qx-nav-btn"
          onClick={onNext}
          disabled={!canSubmit || saving}
          style={{ opacity: canSubmit ? 1 : 0.4 }}
        >
          {saving
            ? (lang === 'tr' ? 'Kaydediliyor…' : 'Saving…')
            : isLast
              ? (lang === 'tr' ? 'Tamamla' : 'Finish')
              : (lang === 'tr' ? 'Sonraki' : 'Next')}
          {!saving && !isLast && <Icon.arrow />}
        </button>
      </div>
    </div>
  );
}
