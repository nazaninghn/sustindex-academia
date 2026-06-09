'use client';
/* CO-2: Question display component.
   Renders: GRI phase stepper, category pill + counter, question text,
   choices (single/multi), and text answer textarea.                   */

import { sanitizeHtml } from '@/lib/utils';
import { API_URL } from '@/lib/api';
import { LETTERS, loc, PaperclipIcon } from './utils';
import type { Question, GriPhase } from './types';

interface Props {
  q: Question;
  currentIdx: number;
  total: number;
  lang: string;
  catLabel: string;
  qText: string;
  selection: number[];
  textAns: string;
  isTextType: boolean;
  isMixedType: boolean;
  hasChoices: boolean;
  GRI_PHASES: GriPhase[];
  currentPhase: GriPhase | null;
  unlockedUpToPhase: number;
  onToggleChoice: (choiceId: number) => void;
  onTextChange: (val: string) => void;
}

export function QuestionView({
  q,
  currentIdx,
  total,
  lang,
  catLabel,
  qText,
  selection,
  textAns,
  isTextType,
  isMixedType,
  hasChoices,
  GRI_PHASES,
  currentPhase,
  unlockedUpToPhase,
  onToggleChoice,
  onTextChange,
}: Props) {
  return (
    <>
      {/* GRI phase stepper — shown only when phase info is available */}
      {currentPhase && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28, overflowX: 'auto' }}>
          {GRI_PHASES.map((phase, i) => {
            const isActive = phase.num === currentPhase.num;
            const isDone   = phase.num < currentPhase.num;
            const isLocked = phase.num > unlockedUpToPhase;
            return (
              <div key={phase.num} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div
                  title={isLocked
                    ? (lang === 'tr' ? 'Önceki aşamayı tamamlayın' : 'Complete the previous phase first')
                    : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '5px 10px',
                    background: isActive ? 'var(--ink)' : 'transparent',
                    border: `1px solid ${isActive ? 'var(--ink)' : isDone ? 'var(--ink-3)' : 'var(--line)'}`,
                    opacity: isLocked ? 0.3 : isDone ? 0.55 : 1,
                  }}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 9, letterSpacing: '0.1em',
                    color: isActive ? 'var(--paper)' : isDone ? 'var(--ink-3)' : 'var(--ink-4)',
                  }}>
                    {isDone ? '✓' : String(phase.num).padStart(2, '0')}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--paper)' : isDone ? 'var(--ink-3)' : 'var(--ink-4)',
                  }}>
                    {phase.label}
                  </span>
                </div>
                {i < GRI_PHASES.length - 1 && (
                  <span style={{ fontSize: 12, color: 'var(--line)', padding: '0 4px', flexShrink: 0 }}>›</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Category pill + counter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
        <span className="pill pill-olive">
          {catLabel || `${lang === 'tr' ? 'Kategori' : 'Category'} ${q.category}`}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
            fontSize: 22, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
          }}>{String(currentIdx + 1).padStart(2, '0')}</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)' }}>
            {' '}/ {String(total).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Question text */}
      <div style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid var(--line)' }}>
        <div
          className="prose"
          style={{ fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--ink)' }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(qText) }}
        />
        {q.allow_multiple && (
          <p style={{
            fontSize: 11, color: 'var(--ink-4)',
            fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.04em',
            marginTop: 10,
          }}>
            {lang === 'tr' ? '↳ Birden fazla seçeneği işaretleyebilirsiniz' : '↳ Multiple answers allowed — select all that apply'}
          </p>
        )}
        {/* Fix R7-04: use authenticated DRF attachment endpoint — raw q.attachment
            is a /media/ URL that bypasses Django auth and exposes the file to anyone
            with the link.  The /attachment/ action enforces IsAuthenticated. */}
        {q.attachment && (
          <a
            href={`${API_URL}/api/v1/questions/${q.id}/attachment/`}
            target="_blank" rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
              fontSize: 11, color: 'var(--olive-deep)', textDecoration: 'none',
              fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.04em',
            }}
          >
            <PaperclipIcon /> {lang === 'tr' ? 'Ek dosyayı görüntüle' : 'View attachment'}
          </a>
        )}
      </div>

      {/* Choices */}
      {hasChoices && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 32 }}>
          {q.choices.map((choice, i) => {
            const isSel = selection.includes(choice.id);
            /* Use loc() first; fall back to choice.text (already in correct lang after refreshTexts) */
            const choiceText = loc(choice, lang) || choice.text;
            return (
              <button
                key={choice.id}
                type="button"
                // Fix A-1: convey selection state to screen readers.
                // Multi-select → checkbox semantics; single-select → toggle button.
                role={q.allow_multiple ? 'checkbox' : 'button'}
                aria-checked={q.allow_multiple ? isSel : undefined}
                aria-pressed={!q.allow_multiple ? isSel : undefined}
                onClick={() => onToggleChoice(choice.id)}
                style={{
                  background: isSel ? 'var(--ink)' : 'var(--paper)',
                  color:      isSel ? 'var(--cream)' : 'var(--ink)',
                  border:     `1px solid ${isSel ? 'var(--ink)' : 'var(--line)'}`,
                  borderLeft: `3px solid ${isSel ? 'var(--olive)' : 'transparent'}`,
                  padding: '15px 20px',
                  textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 16,
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.borderRightColor = e.currentTarget.style.borderTopColor = e.currentTarget.style.borderBottomColor = 'var(--ink-3)'; }}
                onMouseLeave={(e) => { if (!isSel) { e.currentTarget.style.borderRightColor = e.currentTarget.style.borderTopColor = e.currentTarget.style.borderBottomColor = 'var(--line)'; } }}
              >
                <span style={{
                  width: 24, height: 24,
                  borderRadius: q.allow_multiple ? 3 : '50%',
                  border: `1.5px solid ${isSel ? 'rgba(249,239,229,0.4)' : 'var(--line)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 10,
                  flexShrink: 0, color: isSel ? 'var(--cream)' : 'var(--ink-4)',
                  background: isSel && q.allow_multiple ? 'var(--olive-deep)' : 'transparent',
                  transition: 'all 0.12s',
                }}>
                  {isSel && q.allow_multiple ? '✓' : (LETTERS[i] ?? String(i + 1))}
                </span>

                <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>{choiceText}</span>

                {/* Score is hidden from non-staff by the backend (anti-gaming).
                    Only render it when a non-null value is returned. */}
                {choice.score !== null && choice.score !== undefined && (
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5,
                    opacity: isSel ? 0.65 : 0.4, letterSpacing: '0.04em',
                    flexShrink: 0, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {String(choice.score).padStart(3, '0')} {lang === 'tr' ? 'puan' : 'pts'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Text answer (text / mixed type) */}
      {(isTextType || isMixedType) && (
        <div style={{ marginBottom: 24 }}>
          {/* Fix A-5: associate label with textarea via htmlFor/id */}
          <label htmlFor="qa-text-answer" style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5,
            color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase',
            display: 'block', marginBottom: 8,
          }}>
            {lang === 'tr' ? 'Yanıtınız' : 'Your Answer'}
          </label>
          <textarea
            id="qa-text-answer"
            value={textAns}
            onChange={(e) => onTextChange(e.target.value)}
            rows={4}
            placeholder={lang === 'tr' ? 'Yanıtınızı buraya yazın…' : 'Type your answer here…'}
            style={{
              width: '100%', padding: '14px 16px',
              background: 'var(--paper)', border: '1px solid var(--line)',
              borderLeft: '3px solid var(--olive-deep)',
              fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13,
              color: 'var(--ink)', lineHeight: 1.6, resize: 'vertical',
              outline: 'none', borderRadius: 0,
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--ink)')}
            onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--line)')}
          />
        </div>
      )}
    </>
  );
}
