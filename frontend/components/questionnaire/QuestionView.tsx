'use client';
/* CO-2: Question display component.
   Renders: GRI phase stepper, category pill + counter, question text,
   choices (single/multi), and text answer textarea.                   */

import { sanitizeHtml } from '@/lib/utils';
import { API_URL } from '@/lib/api';
import { LETTERS, loc, PaperclipIcon } from './utils';
import type { Question, GriPhase } from './types';

/* ── Layer badge helpers ────────────────────────────────────────── */
const LAYER_LABEL: Record<string, { en: string; tr: string; color: string }> = {
  GATE:        { en: 'Gate',            tr: 'Kapı',             color: '#c0392b' },
  P:           { en: 'Policy',          tr: 'Politika',         color: '#2980b9' },
  I:           { en: 'Implementation',  tr: 'Uygulama',         color: '#27ae60' },
  M:           { en: 'Measurement',     tr: 'Ölçüm',            color: '#8e44ad' },
  R:           { en: 'Results',         tr: 'Sonuçlar',         color: '#d35400' },
  CONDITIONAL: { en: 'Bonus',           tr: 'Bonus',            color: '#b5891b' },
};

interface Props {
  q: Question;
  currentIdx: number;
  total: number;
  lang: string;
  catLabel: string;
  qText: string;
  selection: number[];
  textAns: string;
  numericalValue: string;
  isTextType: boolean;
  isMixedType: boolean;
  hasChoices: boolean;
  isNA: boolean;
  isBookmarked: boolean;
  GRI_PHASES: GriPhase[];
  currentPhase: GriPhase | null;
  unlockedUpToPhase: number;
  onToggleChoice: (choiceId: number) => void;
  onTextChange: (val: string) => void;
  onNumericalChange: (val: string) => void;
  onToggleNA: () => void;
  onToggleBookmark: () => void;
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
  numericalValue,
  isTextType,
  isMixedType,
  hasChoices,
  isNA,
  isBookmarked,
  GRI_PHASES,
  currentPhase,
  unlockedUpToPhase,
  onToggleChoice,
  onTextChange,
  onNumericalChange,
  onToggleNA,
  onToggleBookmark,
}: Props) {
  const isNumerical = q.question_type === 'numerical';
  const isBinary    = q.question_type === 'binary';
  const layerInfo   = q.layer ? LAYER_LABEL[q.layer] : null;

  return (
    <>
      {/* ── Criterion header (v5 questions only) ── */}
      {q.criterion_code && (
        <div style={{
          marginBottom: 20,
          padding: '10px 14px',
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderLeft: '3px solid var(--olive-deep)',
          display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 12px',
        }}>
          {/* Criterion code + title from category_name */}
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            color: 'var(--ink)',
          }}>
            {q.criterion_code}
          </span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)', flex: 1 }}>
            {(lang === 'tr' ? q.category_name_tr : q.category_name_en) || q.category_name}
          </span>

          {/* Layer badge */}
          {layerInfo && (
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '2px 7px',
              border: `1px solid ${layerInfo.color}`,
              color: layerInfo.color,
              borderRadius: 2,
              flexShrink: 0,
            }}>
              {lang === 'tr' ? layerInfo.tr : layerInfo.en}
            </span>
          )}

          {/* Gate warning */}
          {q.is_gate && (
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9, letterSpacing: '0.08em',
              color: '#c0392b', opacity: 0.8,
            }}>
              {lang === 'tr'
                ? '⚡ Kapı sorusu — Hayır cevabı bu kriteri atlar'
                : '⚡ Gate question — No answer skips this criterion'}
            </span>
          )}

          {/* Bonus badge for conditional */}
          {q.layer === 'CONDITIONAL' && (q.bonus_points ?? 0) > 0 && (
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9, letterSpacing: '0.08em',
              color: '#b5891b',
            }}>
              +{q.bonus_points} {lang === 'tr' ? 'bonus puan' : 'bonus pts'}
            </span>
          )}
        </div>
      )}

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

      {/* Not-Applicable toggle + Bookmark button */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Bookmark button */}
        <button
          type="button"
          onClick={onToggleBookmark}
          aria-pressed={isBookmarked}
          title={lang === 'tr'
            ? (isBookmarked ? 'Yer imini kaldır' : 'Bu soruyu yer imine ekle')
            : (isBookmarked ? 'Remove bookmark' : 'Bookmark this question')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 10px',
            background: isBookmarked ? 'rgba(181,138,46,0.12)' : 'transparent',
            border: `1px solid ${isBookmarked ? 'var(--amber)' : 'var(--line)'}`,
            color: isBookmarked ? 'var(--amber)' : 'var(--ink-4)',
            cursor: 'pointer',
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5,
            letterSpacing: '0.06em',
            transition: 'all 0.15s',
          }}
        >
          {isBookmarked ? '🔖' : '🏷'} {isBookmarked
            ? (lang === 'tr' ? 'İşaretlendi' : 'Flagged')
            : (lang === 'tr' ? 'İşaretle' : 'Flag')}
        </button>
      </div>
      {/* Not-Applicable toggle */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={onToggleNA}
          aria-pressed={isNA}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '6px 14px',
            background: isNA ? 'var(--ink-2)' : 'transparent',
            border: `1px solid ${isNA ? 'var(--ink-2)' : 'var(--line)'}`,
            color: isNA ? 'var(--cream)' : 'var(--ink-4)',
            cursor: 'pointer',
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5,
            letterSpacing: '0.07em',
            transition: 'all 0.15s',
          }}
        >
          <span style={{
            width: 14, height: 14,
            border: `1.5px solid ${isNA ? 'rgba(249,239,229,0.5)' : 'var(--ink-3)'}`,
            borderRadius: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700,
            background: isNA ? 'var(--ink)' : 'transparent',
            flexShrink: 0,
          }}>
            {isNA ? '✕' : ''}
          </span>
          {lang === 'tr' ? 'Bu soru geçerli değil (N/A)' : 'Not applicable to my organisation'}
        </button>
        {isNA && (
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
            color: 'var(--ink-4)', letterSpacing: '0.06em',
          }}>
            {lang === 'tr' ? '— puandan muaf tutulacak' : '— excluded from score'}
          </span>
        )}
      </div>

      {/* ── Binary (Yes / No) renderer ── */}
      {isBinary && hasChoices && (
        <div style={{
          display: 'flex', gap: 12, marginBottom: 32,
          opacity: isNA ? 0.35 : 1, pointerEvents: isNA ? 'none' : 'auto',
          transition: 'opacity 0.2s',
        }}>
          {q.choices.map((choice) => {
            const isSel    = selection.includes(choice.id);
            const label    = loc(choice, lang) || choice.text;
            // Fix: determine Yes/No by score (positive = Yes), not by order
            const isYes    = choice.score > 0;
            const selColor = isYes ? 'var(--olive-deep)' : '#c0392b';
            return (
              <button
                key={choice.id}
                type="button"
                role="button"
                aria-pressed={isSel}
                onClick={() => onToggleChoice(choice.id)}
                style={{
                  flex: 1, padding: '22px 16px',
                  background: isSel ? selColor : 'var(--paper)',
                  color:      isSel ? '#fff'   : 'var(--ink)',
                  border:     `2px solid ${isSel ? selColor : 'var(--line)'}`,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: 28 }}>{isYes ? '✓' : '✕'}</span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Numerical input renderer ── */}
      {isNumerical && (
        <div style={{
          marginBottom: 32,
          opacity: isNA ? 0.35 : 1, pointerEvents: isNA ? 'none' : 'auto',
          transition: 'opacity 0.2s',
        }}>
          <label htmlFor="qa-numerical" style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5,
            color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase',
            display: 'block', marginBottom: 8,
          }}>
            {lang === 'tr' ? 'Sayısal değer girin' : 'Enter numerical value'}
          </label>
          <input
            id="qa-numerical"
            type="number"
            value={numericalValue}
            onChange={(e) => onNumericalChange(e.target.value)}
            placeholder="0"
            style={{
              width: '100%', maxWidth: 240, padding: '12px 16px',
              background: 'var(--paper)', border: '1px solid var(--line)',
              borderLeft: '3px solid var(--olive-deep)',
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 18,
              color: 'var(--ink)', outline: 'none', borderRadius: 0,
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--ink)')}
            onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--line)')}
          />
          {/* Show threshold bands as hint */}
          {q.numerical_thresholds && q.numerical_thresholds.length > 0 && (
            <div style={{
              marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6,
            }}>
              {q.numerical_thresholds.map((t, i) => (
                <span key={i} style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                  padding: '2px 7px', border: '1px solid var(--line)',
                  color: 'var(--ink-4)', letterSpacing: '0.04em',
                }}>
                  {t.range
                    ? t.range
                    : t.min != null
                      ? `≥${t.min}${t.max != null ? ` – ≤${t.max}` : ''}`
                      : t.max != null ? `≤${t.max}` : ''}
                  {' → '}{t.score} {lang === 'tr' ? 'pt' : 'pts'}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Standard Choices (single / multi) ── */}
      {!isBinary && !isNumerical && hasChoices && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 32, opacity: isNA ? 0.35 : 1, pointerEvents: isNA ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
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

                {/* Score hidden from users — shown only in final report */}
              </button>
            );
          })}
        </div>
      )}

      {/* Text answer (text / mixed type) */}
      {(isTextType || isMixedType) && (
        <div style={{ marginBottom: 24, opacity: isNA ? 0.35 : 1, pointerEvents: isNA ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
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
