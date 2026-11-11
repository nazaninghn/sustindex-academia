'use client';
/* CO-2: Question display component.
   Renders one compact question card: chapter/criterion header (code, layer,
   GRI reference, position counter), question text, flag / N/A tools, and the
   answer control (binary, numerical, single/multi choice, text).
   The GRI phase stepper now lives in <ChapterRail /> (phase + chapter navigation). */

import { sanitizeHtml } from '@/lib/utils';
import { API_URL } from '@/lib/api';
import { getGriRef } from '@/lib/gri-references';
import { Ic } from '@/components/dashboard/icons';
import { LETTERS, loc, PaperclipIcon } from './utils';
import type { Question, GriPhase } from './types';
import './questionnaire.css';

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
  /** Current notes/comments for this question — also used as N/A justification */
  note?: string;
  isTextType: boolean;
  isMixedType: boolean;
  hasChoices: boolean;
  isNA: boolean;
  isBookmarked: boolean;
  /** Phase data is now rendered by <ChapterRail />; kept optional for compatibility. */
  GRI_PHASES?: GriPhase[];
  currentPhase?: GriPhase | null;
  unlockedUpToPhase?: number;
  onToggleChoice: (choiceId: number) => void;
  onTextChange: (val: string) => void;
  onNumericalChange: (val: string) => void;
  onToggleNA: () => void;
  onToggleBookmark: () => void;
  /** Called when the N/A justification text changes (updates the notes field) */
  onNoteChange?: (val: string) => void;
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
  note = '',
  isTextType,
  isMixedType,
  hasChoices,
  isNA,
  isBookmarked,
  onToggleChoice,
  onTextChange,
  onNumericalChange,
  onToggleNA,
  onToggleBookmark,
  onNoteChange,
}: Props) {
  const isNumerical = q.question_type === 'numerical';
  const isBinary    = q.question_type === 'binary';
  const layerInfo   = q.layer ? LAYER_LABEL[q.layer] : null;
  const griRef      = getGriRef(q.category_name, q.criterion_code);
  const chapterName = (lang === 'tr' ? q.category_name_tr : q.category_name_en) || q.category_name || catLabel;
  const off         = isNA ? ' is-off' : '';

  return (
    <article className="qx-card">
      {/* ── Header: criterion / chapter / badges / position ── */}
      <div className="qx-card-top">
        {griRef && (
          <a
            href={griRef.url}
            target="_blank"
            rel="noreferrer noopener"
            title={griRef.description}
            className="qx-gri"
          >
            {griRef.standard} <span aria-hidden="true">↗</span>
          </a>
        )}
        {q.criterion_code && <span className="qx-code">{q.criterion_code}</span>}
        {/* when no localised chapter title exists the name equals the code — show it once */}
        <span className="qx-chapter">{chapterName !== q.criterion_code ? chapterName : ''}</span>

        {layerInfo && (
          <span className="qx-badge" style={{ color: layerInfo.color }}>
            <i aria-hidden="true" />{lang === 'tr' ? layerInfo.tr : layerInfo.en}
          </span>
        )}
      </div>

      {(q.is_gate || (q.layer === 'CONDITIONAL' && (q.bonus_points ?? 0) > 0)) && (
        <div className="qx-note-line">
          {q.is_gate && (
            <span style={{ color: '#c0392b' }}>
              <Ic name="info" size={13} />
              {lang === 'tr'
                ? 'Kapı sorusu — Hayır cevabı bu kriteri atlar'
                : 'Gate question — No answer skips this criterion'}
            </span>
          )}
          {q.layer === 'CONDITIONAL' && (q.bonus_points ?? 0) > 0 && (
            <span style={{ color: '#b5891b' }}>
              +{q.bonus_points} {lang === 'tr' ? 'bonus puan' : 'bonus pts'}
            </span>
          )}
        </div>
      )}

      <div className="qx-body">
        {/* ── Question number + text ── */}
        <div className="qx-counter">
          {lang === 'tr' ? 'Soru' : 'Question'} <b>{currentIdx + 1}</b> <span>/ {total}</span>
        </div>
        <div
          className="prose qx-qtext"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(qText) }}
        />
        {q.allow_multiple && (
          <p className="qx-hint">
            {lang === 'tr' ? 'Birden fazla seçeneği işaretleyebilirsiniz' : 'Multiple answers allowed — select all that apply'}
          </p>
        )}
        {/* Fix R7-04: use authenticated DRF attachment endpoint — raw q.attachment
            is a /media/ URL that bypasses Django auth and exposes the file to anyone
            with the link.  The /attachment/ action enforces IsAuthenticated. */}
        {q.attachment && (
          <a
            href={`${API_URL}/api/v1/questions/${q.id}/attachment/`}
            target="_blank" rel="noreferrer"
            className="qx-attach"
          >
            <PaperclipIcon /> {lang === 'tr' ? 'Ek dosyayı görüntüle' : 'View attachment'}
          </a>
        )}

        <div className="qx-answer">
          {/* ── Binary (Yes / No) ── */}
          {isBinary && hasChoices && (
            <div className={`qx-binary qx-dim${off}`}>
              {q.choices.map((choice) => {
                const isSel      = selection.includes(choice.id);
                const label      = loc(choice, lang) || choice.text;
                const labelLower = (label || '').toLowerCase();
                // First choice = Yes/positive when the label doesn't say
                const isYes      = labelLower.includes('evet') || labelLower.includes('yes') || choice.order === 1;
                const selColor   = isYes ? 'var(--olive-deep)' : 'var(--danger)';
                return (
                  <button
                    key={choice.id}
                    type="button"
                    role="button"
                    aria-pressed={isSel}
                    onClick={() => onToggleChoice(choice.id)}
                    className={`qx-bin${isSel ? ' is-sel' : ''}`}
                    style={isSel ? { background: selColor, borderColor: selColor } : undefined}
                  >
                    <span className="qx-bin-icon"><Ic name={isYes ? 'check' : 'plus'} size={16} className={isYes ? undefined : 'qx-x'} /></span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Numerical input ── */}
          {isNumerical && (
            <div className={`qx-dim${off}`}>
              <label htmlFor="qa-numerical" className="qx-label">
                {lang === 'tr' ? 'Sayısal değer girin' : 'Enter numerical value'}
              </label>
              <input
                id="qa-numerical"
                type="number"
                value={numericalValue}
                onChange={(e) => onNumericalChange(e.target.value)}
                placeholder="0"
                className="qx-input"
              />
              {q.numerical_thresholds && q.numerical_thresholds.length > 0 && (
                <div className="qx-thresholds">
                  {q.numerical_thresholds.map((t, i) => (
                    <span key={i} className="qx-threshold">
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

          {/* ── Standard choices (single / multi) ── */}
          {!isBinary && !isNumerical && hasChoices && (
            <div className={`qx-choices qx-dim${off}`}>
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
                    className={`qx-choice${isSel ? ' is-sel' : ''}`}
                  >
                    <span className="qx-choice-mark" style={{ borderRadius: q.allow_multiple ? 3 : '50%' }}>
                      {isSel ? <Ic name="check" size={12} /> : (LETTERS[i] ?? String(i + 1))}
                    </span>
                    <span className="qx-choice-text">{choiceText}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Text answer (text / mixed type) ── */}
          {(isTextType || isMixedType) && (
            <div className={`qx-dim${off}`} style={{ marginTop: hasChoices ? 14 : 0 }}>
              {/* Fix A-5: associate label with textarea via htmlFor/id */}
              <label htmlFor="qa-text-answer" className="qx-label">
                {lang === 'tr' ? 'Yanıtınız' : 'Your Answer'}
              </label>
              <textarea
                id="qa-text-answer"
                value={textAns}
                onChange={(e) => onTextChange(e.target.value)}
                rows={4}
                className="qx-textarea"
                placeholder={lang === 'tr' ? 'Yanıtınızı buraya yazın…' : 'Type your answer here…'}
              />
            </div>
          )}
        </div>

        {/* ── Tools: flag + not applicable ── */}
        <div className="qx-tools">
          <span className="qx-tools-label">{lang === 'tr' ? 'Bu soru için' : 'For this question'}</span>
          <button
            type="button"
            onClick={onToggleBookmark}
            aria-pressed={isBookmarked}
            title={lang === 'tr'
              ? (isBookmarked ? 'Yer imini kaldır' : 'Bu soruyu yer imine ekle')
              : (isBookmarked ? 'Remove bookmark' : 'Bookmark this question')}
            className={`qx-tool${isBookmarked ? ' is-flag' : ''}`}
          >
            <Ic name="flag" size={13} /> {isBookmarked
              ? (lang === 'tr' ? 'İşaretlendi' : 'Flagged')
              : (lang === 'tr' ? 'İşaretle' : 'Flag')}
          </button>

          <button
            type="button"
            onClick={onToggleNA}
            aria-pressed={isNA}
            className={`qx-tool${isNA ? ' is-na' : ''}`}
          >
            <span className="qx-tool-box">{isNA && <Ic name="check" size={10} />}</span>
            {lang === 'tr' ? 'Bu soru geçerli değil (N/A)' : 'Not applicable to my organisation'}
          </button>
          {isNA && (
            <span className="qx-tool-note">
              {lang === 'tr' ? '— puandan muaf tutulacak' : '— excluded from score'}
            </span>
          )}
        </div>

        {/* N/A Justification — shown inline when isNA is active */}
        {isNA && onNoteChange && (
          <div className="qx-na-reason">
            <label htmlFor="qa-na-reason" className="qx-label">
              {lang === 'tr' ? 'Geçersizlik Gerekçesi (isteğe bağlı)' : 'Justification for N/A (optional)'}
            </label>
            <textarea
              id="qa-na-reason"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              rows={2}
              className="qx-textarea"
              placeholder={lang === 'tr'
                ? 'Bu sorunun neden geçerli olmadığını açıklayın…'
                : 'Explain why this question is not applicable to your organisation…'}
            />
          </div>
        )}
      </div>
    </article>
  );
}
