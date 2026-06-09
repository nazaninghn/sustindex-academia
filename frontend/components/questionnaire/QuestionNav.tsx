'use client';
/* CO-2: Question navigation bar.
   Renders: inline error alert, Previous button, dot progress navigator,
   and Next / Finish button.                                            */

import { Icon } from '@/components/shared';
import { GRI_PHASE_DEFS } from './utils';
import type { Question } from './types';

interface Props {
  questions: Question[];
  currentIdx: number;
  answers: Record<number, number[]>;
  textAnswers: Record<number, string>;
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
}

export function QuestionNav({
  questions,
  currentIdx,
  answers,
  textAnswers,
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
}: Props) {
  return (
    <>
      {/* Inline error — Fix A-2: role="alert" so AT announces it immediately */}
      {error && (
        <p role="alert" style={{
          fontSize: 12, color: 'var(--danger)', marginBottom: 16,
          fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.02em',
        }}>
          {error}
        </p>
      )}

      {/* Navigation row */}
      <div className="q-nav-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>

        {/* Previous */}
        <button
          className="btn btn-outline"
          onClick={onPrev}
          disabled={isFirst}
          style={{ opacity: isFirst ? 0.3 : 1 }}
        >
          {lang === 'tr' ? '← Önceki' : '← Previous'}
        </button>

        {/* Dot progress */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', maxWidth: 400, justifyContent: 'center' }}>
          {questions.map((qItem, i) => {
            const dotPhaseNum = GRI_PHASE_DEFS.find(({ match }) => qItem.category_name?.includes(match))?.num ?? 1;
            const isLocked    = dotPhaseNum > unlockedUpToPhase;
            const isAnswered  = (answers[qItem.id] ?? []).length > 0 || (textAnswers[qItem.id] ?? '').trim().length > 0;
            return (
              <span
                key={qItem.id}
                role={isLocked ? undefined : 'button'}
                tabIndex={isLocked ? -1 : 0}
                aria-label={`Question ${i + 1}${isAnswered ? ' (answered)' : ''}${isLocked ? ' (locked)' : ''}`}
                aria-current={i === currentIdx ? 'step' : undefined}
                onClick={() => { if (!isLocked) onJumpTo(i); }}
                onKeyDown={(e) => { if (!isLocked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onJumpTo(i); } }}
                title={`${i + 1}`}
                style={{
                  width:  i === currentIdx ? 18 : 5, height: 5,
                  background: isLocked
                    ? 'var(--line)'
                    : isAnswered
                      ? 'var(--olive-deep)'
                      : i === currentIdx ? 'var(--ink)' : 'var(--line)',
                  borderRadius: 3, transition: 'all 0.2s ease',
                  cursor: isLocked ? 'default' : 'pointer',
                  outline: 'none', opacity: isLocked ? 0.35 : 1,
                }}
                onFocus={(e) => { if (!isLocked) e.currentTarget.style.boxShadow = '0 0 0 2px var(--olive)'; }}
                onBlur={(e)  => { e.currentTarget.style.boxShadow = 'none'; }}
              />
            );
          })}
        </div>

        {/* Next / Finish */}
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!canSubmit || saving}
          style={{ opacity: canSubmit ? 1 : 0.4, minWidth: 110 }}
        >
          {saving
            ? (lang === 'tr' ? 'Kaydediliyor…' : 'Saving…')
            : isLast
              ? (lang === 'tr' ? 'Tamamla' : 'Finish')
              : (lang === 'tr' ? 'Sonraki' : 'Next')}
          {!saving && !isLast && <Icon.arrow />}
        </button>
      </div>
    </>
  );
}
