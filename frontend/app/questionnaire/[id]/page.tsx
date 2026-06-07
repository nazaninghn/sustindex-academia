'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/shared';
import { attemptAPI } from '@/lib/api';
import { sanitizeHtml, formatBytes } from '@/lib/utils';
import logger from '@/lib/logger';
import { emitDataChange } from '@/lib/events';

/* ─── Types ──────────────────────────────────────────────── */
interface Choice {
  id: number;
  text: string; text_en?: string; text_tr?: string;
  score: number; order: number;
}
interface Question {
  id: number;
  text: string; text_en?: string; text_tr?: string;
  category: number;
  category_name: string; category_name_en?: string; category_name_tr?: string;
  order: number; allow_multiple: boolean; question_type: string;
  choices: Choice[];
  attachment?: string;
}

/* ─── Constants ──────────────────────────────────────────── */
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

/* ─── Localised text helper ──────────────────────────────── */
function loc(
  obj: { text?: string; text_en?: string; text_tr?: string },
  lang: string
): string {
  if (lang === 'tr' && obj.text_tr) return obj.text_tr;
  if (lang === 'en' && obj.text_en) return obj.text_en;
  return obj.text || '';
}

/* ─── Paperclip icon ─────────────────────────────────────── */
function PaperclipIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05L12.25 20.24a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.42 17.41a2 2 0 01-2.83-2.83l8.49-8.48"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   Questionnaire Page
   ═══════════════════════════════════════════════════════════ */
export default function QuestionnairePage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { lang, t } = useLang();
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const langRef       = useRef(lang);
  const submitLockRef = useRef(false);
  /* surveyId stored so refreshTexts can re-fetch without re-loading the attempt */
  const surveyIdRef   = useRef<number | null>(null);
  /* Fix #22: track mount state so refreshTexts never calls setState after unmount */
  const mountedRef    = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => { langRef.current = lang; }, [lang]);

  /* ── Data state ── */
  const [questions,   setQuestions]   = useState<Question[]>([]);
  const [surveyName,  setSurveyName]  = useState('');
  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [exitSaving,  setExitSaving]  = useState(false);
  const [error,       setError]       = useState('');

  /* ── Answer state — keyed by question.id ── */
  const [answers,      setAnswers]      = useState<Record<number, number[]>>({});
  const [notes,        setNotes]        = useState<Record<number, string>>({});
  const [textAnswers,  setTextAnswers]  = useState<Record<number, string>>({});
  const [pendingFiles, setPendingFiles] = useState<Record<number, File[]>>({});

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  /**
   * Lightweight re-fetch: only updates question texts + survey name.
   * Does NOT touch answers, notes, currentIdx — so the user keeps their position.
   * Called whenever lang changes after initial load.
   */
  const refreshTexts = useCallback(async () => {
    const sid = surveyIdRef.current;
    if (!sid) return;
    try {
      const { surveyAPI } = await import('@/lib/api');
      const survey = await surveyAPI.getSurvey(sid);
      // Fix #22: abort if the component was unmounted while the fetch was in flight
      if (!mountedRef.current) return;
      setSurveyName(survey.name || '');
      const qs: Question[] = (survey.questions || []).sort(
        (a: Question, b: Question) => a.order - b.order
      );
      setQuestions(qs);
    } catch { /* non-fatal — keep showing previous texts */ }
  }, []); // no deps — reads surveyIdRef/mountedRef directly

  /* Re-fetch question texts whenever language changes (after initial load) */
  useEffect(() => {
    if (surveyIdRef.current) refreshTexts();
  }, [lang, refreshTexts]);

  const loadData = useCallback(async () => {
    try {
      const attempt = await attemptAPI.getAttempt(Number(id));
      if (attempt.is_completed) { router.replace(`/results/${id}`); return; }

      const { surveyAPI } = await import('@/lib/api');
      if (!attempt.survey) {
        /* Fix L-3: correct Turkish diacritics */
        setError(langRef.current === 'tr' ? 'Ankete bağlı deneme bulunamadı.' : 'Attempt has no associated survey.');
        return;
      }
      /* Save survey ID so refreshTexts can use it on lang switch */
      surveyIdRef.current = attempt.survey;

      const survey = await surveyAPI.getSurvey(attempt.survey);
      setSurveyName(survey.name || '');

      const qs: Question[] = (survey.questions || []).sort(
        (a: Question, b: Question) => a.order - b.order
      );
      setQuestions(qs);

      const preAnswers: Record<number, number[]> = {};
      const preNotes:   Record<number, string>   = {};
      const preText:    Record<number, string>   = {};
      for (const ans of attempt.answers || []) {
        if (Array.isArray(ans.choices) && ans.choices.length > 0) preAnswers[ans.question] = ans.choices;
        else if (ans.choice) preAnswers[ans.question] = [ans.choice];
        if (ans.notes)       preNotes[ans.question]   = ans.notes;
        if (ans.text_answer) preText[ans.question]    = ans.text_answer;
      }
      setAnswers(preAnswers);
      setNotes(preNotes);
      setTextAnswers(preText);

      const firstUnanswered = qs.findIndex((q: Question) => !preAnswers[q.id]);
      setCurrentIdx(firstUnanswered >= 0 ? firstUnanswered : qs.length - 1);
    } catch (err) {
      // Fix R4-H-04: environment-gated logger — silent in production
      logger.error('Failed to load questionnaire:', err);
      setError(langRef.current === 'tr' ? 'Yüklenemedi.' : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (user && id) loadData();
  }, [user, id, loadData]);

  /* ── Derived ── */
  const q           = questions[currentIdx];
  const total       = questions.length;
  const isFirst     = currentIdx === 0;
  const isLast      = currentIdx === total - 1;
  const selection   = q ? (answers[q.id]      || []) : [];
  const note        = q ? (notes[q.id]        || '') : '';
  const textAns     = q ? (textAnswers[q.id]  || '') : '';
  const files       = q ? (pendingFiles[q.id] || []) : [];

  // Fix R5-M-01: count only questions where at least one choice has been selected
  // (not every key in `answers` — empty arrays count as "answered" otherwise).
  const answeredCount = Object.values(answers).filter((sel) => sel.length > 0).length;
  const progress      = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  const isTextType  = q?.question_type === 'text' || q?.choices?.length === 0;
  const isMixedType = q?.question_type === 'mixed';
  const hasChoices  = (q?.choices?.length ?? 0) > 0 && !isTextType;

  const canSubmit =
    (hasChoices && selection.length > 0) ||
    (isTextType && textAns.trim().length > 0) ||
    (isMixedType && (selection.length > 0 || textAns.trim().length > 0)) ||
    (!hasChoices && !isTextType);

  /* ── Localised helpers for current question ──
   * qText / choiceText: use `text` directly — after refreshTexts() the API already
   * returns the correct language in `text`.  loc() is kept as extra safety for
   * cases where text_tr is populated but the API didn't override text.
   * catLabel: always resolved from the stored _tr/_en fields (set by import command). */
  const qText    = q ? (loc(q, lang) || q.text) : '';
  const catLabel = q
    ? (lang === 'tr' && q.category_name_tr) ? q.category_name_tr
      : (lang === 'en' && q.category_name_en) ? q.category_name_en
      : q.category_name
    : '';

  /* ── Handlers ── */
  const toggleChoice = (choiceId: number) => {
    if (!q) return;
    if (q.allow_multiple) {
      const prev = answers[q.id] || [];
      setAnswers({ ...answers, [q.id]: prev.includes(choiceId) ? prev.filter((c) => c !== choiceId) : [...prev, choiceId] });
    } else {
      setAnswers({ ...answers, [q.id]: [choiceId] });
    }
  };

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles || !q) return;
    const arr = Array.from(newFiles);
    setPendingFiles({ ...pendingFiles, [q.id]: [...files, ...arr] });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    if (!q) return;
    const updated = files.filter((_, i) => i !== idx);
    setPendingFiles({ ...pendingFiles, [q.id]: updated });
  };

  const handleNext = async () => {
    if (!q || saving || submitLockRef.current) return;
    submitLockRef.current = true;
    setSaving(true);
    setError('');
    try {
      let answerId: number | null = null;

      if (hasChoices && q.allow_multiple && selection.length > 0) {
        const res = await attemptAPI.submitAnswer(Number(id), q.id, null, selection, note, textAns);
        answerId = res?.id ?? null;
      } else if (hasChoices && selection.length > 0) {
        const res = await attemptAPI.submitAnswer(Number(id), q.id, selection[0], undefined, note, textAns);
        answerId = res?.id ?? null;
      } else if (textAns.trim() || note.trim()) {
        const res = await attemptAPI.submitAnswer(Number(id), q.id, null, undefined, note, textAns);
        answerId = res?.id ?? null;
      } else if (!hasChoices && !isTextType && q) {
        // Fix C-07: "no-choice, non-text" question — canSubmit is true because
        // the question has no required inputs, but we still need to create/update
        // an answer record (with empty payload) so progress is recorded server-side.
        const res = await attemptAPI.submitAnswer(Number(id), q.id, null, undefined, note, textAns);
        answerId = res?.id ?? null;
      }

      if (answerId && files.length > 0) {
        const failedUploads: string[] = [];
        for (const file of files) {
          try { await attemptAPI.uploadDocument(answerId, file); }
          catch { failedUploads.push(file.name); }
        }
        if (failedUploads.length > 0) {
          setError(lang === 'tr'
            ? `Bazı belgeler yüklenemedi: ${failedUploads.join(', ')}`
            : `Some documents failed to upload: ${failedUploads.join(', ')}`);
          // Fix H-06: do NOT complete the attempt when uploads failed on the
          // last question — the user must retry or acknowledge before we mark
          // the assessment complete.  Without this return, evidence files were
          // silently lost while the questionnaire appeared successfully submitted.
          return;
        }
      }

      if (isLast) {
        await attemptAPI.completeAttempt(Number(id));
        emitDataChange({ source: 'questionnaire', id });
        router.push(`/results/${id}`);
      } else {
        setCurrentIdx((i) => i + 1);
      }
    } catch (err) {
      // Fix R4-H-04: environment-gated logger — silent in production
      logger.error('Failed to save answer:', err);
      setError(lang === 'tr' ? 'Kaydedilemedi, tekrar dene.' : 'Could not save — please retry.');
    } finally {
      setSaving(false);
      submitLockRef.current = false;
    }
  };

  const handlePrev = () => { if (!isFirst) setCurrentIdx((i) => i - 1); };

  const handleJumpTo = async (targetIdx: number) => {
    if (targetIdx === currentIdx) return;
    if (q && (selection.length > 0 || note.trim() || textAns.trim())) {
      try {
        let answerId: number | null = null;
        if (hasChoices && q.allow_multiple && selection.length > 0) {
          const res = await attemptAPI.submitAnswer(Number(id), q.id, null, selection, note, textAns);
          answerId = res?.id ?? null;
        } else if (hasChoices && selection.length > 0) {
          const res = await attemptAPI.submitAnswer(Number(id), q.id, selection[0], undefined, note, textAns);
          answerId = res?.id ?? null;
        } else if (textAns.trim() || note.trim()) {
          const res = await attemptAPI.submitAnswer(Number(id), q.id, null, undefined, note, textAns);
          answerId = res?.id ?? null;
        }
        // Fix M-6: upload pending files when jumping — previously they were
        // silently discarded, leaving evidence permanently lost.
        // Fix R4-M-04: surface upload failures with a user confirmation so they
        // can decide whether to abort and retry rather than silently losing evidence.
        if (answerId && files.length > 0) {
          const failedUploads: string[] = [];
          for (const file of files) {
            try { await attemptAPI.uploadDocument(answerId, file); }
            catch { failedUploads.push(file.name); }
          }
          if (failedUploads.length > 0) {
            const proceed = window.confirm(
              lang === 'tr'
                ? `${failedUploads.length} dosya yüklenemedi: ${failedUploads.join(', ')}.\nYine de devam etmek istiyor musunuz? Dosyalar kaydedilmeyecek.`
                : `${failedUploads.length} file(s) failed to upload: ${failedUploads.join(', ')}.\nProceed anyway? Those files will not be saved.`
            );
            if (!proceed) return;  // stay on current question so user can retry
          }
        }
      } catch { /* non-fatal */ }
    }
    // Fix R5-M-04: always clear pending files for the current question when
    // jumping away, regardless of whether the answer or upload succeeded.
    // Previously, if answerId was null (submit failed), files were never cleared
    // and persisted as stale state on the question when the user returned.
    if (q) {
      setPendingFiles((prev) => { const next = { ...prev }; delete next[q.id]; return next; });
    }
    setCurrentIdx(targetIdx);
  };

  const handleSaveAndExit = async () => {
    if (exitSaving) return;
    setExitSaving(true);
    try {
      if (q) {
        let answerId: number | null = null;
        try {
          if (hasChoices && q.allow_multiple && selection.length > 0) {
            const res = await attemptAPI.submitAnswer(Number(id), q.id, null, selection, note, textAns);
            answerId = res?.id ?? null;
          } else if (hasChoices && selection.length > 0) {
            const res = await attemptAPI.submitAnswer(Number(id), q.id, selection[0], undefined, note, textAns);
            answerId = res?.id ?? null;
          } else if (textAns.trim() || note.trim()) {
            const res = await attemptAPI.submitAnswer(Number(id), q.id, null, undefined, note, textAns);
            answerId = res?.id ?? null;
          }
        } catch { /* non-fatal */ }

        if (answerId && files.length > 0) {
          for (const file of files) {
            try { await attemptAPI.uploadDocument(answerId, file); } catch { /* non-fatal */ }
          }
        }
      }
    } finally {
      setExitSaving(false);
      router.push('/dashboard');
    }
  };

  /* ── Loading / error states ── */
  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>
          {/* Fix R11-05: use shared i18n key — consistent with all other pages */}
          {t('t_loading_auth')}
        </span>
      </div>
    );
  }

  if (!q) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>
          {/* Fix L-3: correct Turkish diacritics */}
          {error || (lang === 'tr' ? 'Soru bulunamadı.' : 'No questions found.')}
        </p>
        <Link href="/surveys" style={{ textDecoration: 'none' }}>
          <button className="btn btn-outline">{lang === 'tr' ? '← Anketlere Dön' : '← Back to Surveys'}</button>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>

      {/* ─── Sticky header ─────────────────────────────── */}
      <header style={{ borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--cream)', zIndex: 10 }}>
        <div className="wrap" style={{ padding: '13px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Logo size={20} />
            <span style={{ width: 1, height: 18, background: 'var(--line)' }} />
            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--ink-2)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {surveyName}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 80, height: 2, background: 'var(--line)', borderRadius: 1 }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--olive-deep)', borderRadius: 1, transition: 'width 0.4s' }} />
              </div>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
                {progress}%
              </span>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={handleSaveAndExit}
              disabled={exitSaving}
              style={{ opacity: exitSaving ? 0.6 : 1 }}
            >
              {exitSaving
                ? (lang === 'tr' ? 'Kaydediliyor…' : 'Saving…')
                : (lang === 'tr' ? 'Kaydet & Çık' : 'Save & Exit')}
            </button>
          </div>
        </div>
        <div style={{ height: 2, background: 'var(--line-soft)' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--ink)', transition: 'width 0.4s ease' }} />
        </div>
      </header>

      {/* ─── Main content ──────────────────────────────── */}
      <main className="wrap-narrow" style={{ paddingTop: 52, paddingBottom: 80 }}>

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

        {/* ─── Question text ─── */}
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
              href={`/api/v1/questions/${q.id}/attachment/`} target="_blank" rel="noreferrer"
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

        {/* ─── Choices ─── */}
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
                  onClick={() => toggleChoice(choice.id)}
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

                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5,
                    opacity: isSel ? 0.65 : 0.4, letterSpacing: '0.04em',
                    flexShrink: 0, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {String(choice.score).padStart(3, '0')} {lang === 'tr' ? 'puan' : 'pts'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Text answer (text / mixed type) ─── */}
        {(isTextType || isMixedType) && (
          <div style={{ marginBottom: 24 }}>
            <label style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5,
              color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'block', marginBottom: 8,
            }}>
              {lang === 'tr' ? 'Yanıtınız' : 'Your Answer'}
            </label>
            <textarea
              value={textAns}
              onChange={(e) => setTextAnswers({ ...textAnswers, [q.id]: e.target.value })}
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

        {/* ─── Notes & Evidence — always visible ────────────── */}
        <div style={{
          borderTop: '1px solid var(--line)',
          paddingTop: 20,
          marginBottom: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {/* Section title */}
          <p style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5,
            color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase',
            margin: 0,
          }}>
            {/* Fix L-02: 'Kanit' → 'Kanıt' (dotless ı, U+0131) */}
            {lang === 'tr' ? 'Not & Kanıt (isteğe bağlı)' : 'Notes & Evidence (optional)'}
          </p>

          {/* Notes textarea */}
          <div>
            <label style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
              color: 'var(--ink-4)', letterSpacing: '0.08em',
              display: 'block', marginBottom: 6,
            }}>
              {lang === 'tr' ? 'Notlar / Yorumlar' : 'Notes / Comments'}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNotes({ ...notes, [q.id]: e.target.value })}
              rows={3}
              placeholder={lang === 'tr'
                ? 'Bu soruyla ilgili ek not veya yorum ekleyin…'
                : 'Add context, clarifications, or additional comments…'}
              style={{
                width: '100%', padding: '12px 14px',
                background: 'var(--cream-deep)', border: '1px solid var(--line)',
                fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5,
                color: 'var(--ink)', lineHeight: 1.6, resize: 'vertical',
                outline: 'none', borderRadius: 0,
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--ink-3)')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--line)')}
            />
          </div>

          {/* File upload */}
          <div>
            <label style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
              color: 'var(--ink-4)', letterSpacing: '0.08em',
              display: 'block', marginBottom: 6,
            }}>
              {lang === 'tr' ? 'Kanıt Belgesi Yükle' : 'Upload Evidence'}
            </label>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', background: 'transparent',
                border: '1px dashed var(--line)', cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: 'var(--ink-3)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ink-3)'; e.currentTarget.style.color = 'var(--ink)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-3)'; }}
            >
              <PaperclipIcon />
              {lang === 'tr' ? 'Dosya seç veya sürükle' : 'Choose file or drag & drop'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              style={{ display: 'none' }}
              onChange={(e) => addFiles(e.target.files)}
            />

            {files.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {files.map((file, idx) => (
                  <div key={`${file.name}-${file.size}`} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', background: 'var(--paper)',
                    border: '1px solid var(--line)',
                  }}>
                    <PaperclipIcon />
                    <span style={{ flex: 1, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </span>
                    {/* Fix L-03: use shared formatBytes() from utils.ts — eliminates
                        the inline duplicate and ensures consistent formatting site-wide */}
                    <span style={{ fontSize: 10, color: 'var(--ink-4)', flexShrink: 0 }}>
                      {formatBytes(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      /* Fix R5-L-03: aria-label so screen readers announce the action */
                      aria-label={lang === 'tr' ? 'Dosyayı kaldır' : 'Remove file'}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--ink-4)', fontSize: 13, lineHeight: 1, padding: '0 2px',
                        flexShrink: 0,
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 8 }}>
              {lang === 'tr' ? 'PDF, Word, Excel, resim — maks. 10 MB' : 'PDF, Word, Excel, images — max 10 MB per file'}
            </p>
          </div>
        </div>

        {/* ─── Error ─── */}
        {error && (
          <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 16, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.02em' }}>
            {error}
          </p>
        )}

        {/* ─── Navigation ─── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingTop: 8,
        }}>
          <button
            className="btn btn-outline"
            onClick={handlePrev}
            disabled={isFirst}
            style={{ opacity: isFirst ? 0.3 : 1 }}
          >
            {lang === 'tr' ? '← Önceki' : '← Previous'}
          </button>

          {/* Dot progress */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', maxWidth: 400, justifyContent: 'center' }}>
            {questions.map((qItem, i) => (
              <span
                key={qItem.id}
                role="button"
                tabIndex={0}
                aria-label={`Question ${i + 1}${answers[qItem.id] ? ' (answered)' : ''}`}
                aria-current={i === currentIdx ? 'step' : undefined}
                onClick={() => handleJumpTo(i)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleJumpTo(i); } }}
                title={`${i + 1}`}
                style={{
                  width:  i === currentIdx ? 18 : 5, height: 5,
                  background: answers[qItem.id]
                    ? 'var(--olive-deep)'
                    : i === currentIdx ? 'var(--ink)' : 'var(--line)',
                  borderRadius: 3, transition: 'all 0.2s ease', cursor: 'pointer',
                  outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--olive)'; }}
                onBlur={(e)  => { e.currentTarget.style.boxShadow = 'none'; }}
              />
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={handleNext}
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
      </main>
    </div>
  );
}
