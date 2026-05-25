'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/shared';
import { attemptAPI } from '@/lib/api';
import { sanitizeHtml } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────────── */
interface Choice   { id: number; text: string; score: number; order: number }
interface Question {
  id: number; text: string; category: number; category_name: string;
  order: number; allow_multiple: boolean; question_type: string; choices: Choice[];
  attachment?: string;
}

/* ─── Constants (Fix 8: outside component — not re-created every render) ── */
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

/* ─── Paperclip icon ─────────────────────────────────────── */
function PaperclipIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  const { lang } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const langRef      = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);

  /* ── Data state ── */
  const [questions,   setQuestions]   = useState<Question[]>([]);
  const [surveyName,  setSurveyName]  = useState('');
  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [exitSaving,  setExitSaving]  = useState(false);   // Fix 7
  const [error,       setError]       = useState('');

  /* ── Answer state — keyed by question.id ── */
  const [answers,      setAnswers]      = useState<Record<number, number[]>>({});
  const [notes,        setNotes]        = useState<Record<number, string>>({});
  const [textAnswers,  setTextAnswers]  = useState<Record<number, string>>({});
  const [pendingFiles, setPendingFiles] = useState<Record<number, File[]>>({});

  /* ── UI state ── */
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  /* Fix 3: wrap in useCallback so the effect dependency is stable */
  const loadData = useCallback(async () => {
    try {
      const attempt = await attemptAPI.getAttempt(Number(id));
      if (attempt.is_completed) { router.replace(`/results/${id}`); return; }

      const { surveyAPI } = await import('@/lib/api');
      const survey = await surveyAPI.getSurvey(attempt.survey);
      setSurveyName(survey.name || '');

      const qs: Question[] = (survey.questions || []).sort(
        (a: Question, b: Question) => a.order - b.order
      );
      setQuestions(qs);

      // Pre-fill saved answers, notes, text answers
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
      console.error('Failed to load questionnaire:', err);
      setError(langRef.current === 'tr' ? 'Yüklenemedi.' : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [id, router]);   // Fix X: lang removed — was causing full re-load on language switch

  /* Fix 3: loadData now listed in deps — no stale closure */
  useEffect(() => {
    if (user && id) loadData();
  }, [user, id, loadData]);

  /* Collapse notes when switching questions */
  useEffect(() => { setNotesOpen(false); }, [currentIdx]);

  /* ── Derived ── */
  const q           = questions[currentIdx];
  const total       = questions.length;
  const isFirst     = currentIdx === 0;
  const isLast      = currentIdx === total - 1;
  const selection   = q ? (answers[q.id]      || []) : [];
  const note        = q ? (notes[q.id]        || '') : '';
  const textAns     = q ? (textAnswers[q.id]  || '') : '';
  const files       = q ? (pendingFiles[q.id] || []) : [];

  const answeredCount = Object.keys(answers).length;
  const progress      = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  const isTextType   = q?.question_type === 'text' || q?.choices?.length === 0;
  const isMixedType  = q?.question_type === 'mixed';
  const hasChoices   = (q?.choices?.length ?? 0) > 0 && !isTextType;

  const canSubmit =
    (hasChoices && selection.length > 0) ||
    (isTextType && textAns.trim().length > 0) ||
    (isMixedType && (selection.length > 0 || textAns.trim().length > 0)) ||
    (!hasChoices && !isTextType) ||       // edge: no choices, not text — allow skip
    note.trim().length > 0;

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
    // Fix 6: reset so re-selecting the same file fires onChange again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    if (!q) return;
    const updated = files.filter((_, i) => i !== idx);
    setPendingFiles({ ...pendingFiles, [q.id]: updated });
  };

  const handleNext = async () => {
    if (!q || saving) return;
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
      }

      // Upload pending files
      if (answerId && files.length > 0) {
        for (const file of files) {
          try { await attemptAPI.uploadDocument(answerId, file); } catch { /* non-fatal */ }
        }
      }

      if (isLast) {
        await attemptAPI.completeAttempt(Number(id));
        router.push(`/results/${id}`);
      } else {
        setCurrentIdx((i) => i + 1);
      }
    } catch (err) {
      console.error('Failed to save answer:', err);
      setError(lang === 'tr' ? 'Kaydedilemedi, tekrar dene.' : 'Could not save — please retry.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrev = () => { if (!isFirst) setCurrentIdx((i) => i - 1); };

  /* Fix 4 + Fix 7: upload files & show loading before navigating away */
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
        } catch { /* non-fatal — still exit */ }

        // Fix 4: upload pending files for current question before leaving
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
          {lang === 'tr' ? 'YÜKLENİYOR…' : 'LOADING…'}
        </span>
      </div>
    );
  }

  if (!q) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>
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
          {/* Left: logo + survey name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Logo size={20} />
            <span style={{ width: 1, height: 18, background: 'var(--line)' }} />
            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--ink-2)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {surveyName}
            </span>
          </div>
          {/* Right: progress + exit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 80, height: 2, background: 'var(--line)', borderRadius: 1 }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--olive-deep)', borderRadius: 1, transition: 'width 0.4s' }} />
              </div>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
                {progress}%
              </span>
            </div>
            {/* Fix 7: disabled + label change while saving */}
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
        {/* Thin progress line */}
        <div style={{ height: 2, background: 'var(--line-soft)' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--ink)', transition: 'width 0.4s ease' }} />
        </div>
      </header>

      {/* ─── Main content ──────────────────────────────── */}
      <main className="wrap-narrow" style={{ paddingTop: 52, paddingBottom: 80 }}>

        {/* Category pill + counter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
          <span className="pill pill-olive">
            {q.category_name || `${lang === 'tr' ? 'Kategori' : 'Category'} ${q.category}`}
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

        {/* ─── Question text (rendered HTML) ─── */}
        <div style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid var(--line)' }}>
          <div
            className="prose"
            style={{ fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--ink)' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.text) }}
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
          {/* Question attachment (if any) */}
          {q.attachment && (
            <a
              href={q.attachment} target="_blank" rel="noreferrer"
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

        {/* ─── Choices (choice / mixed type) ─── */}
        {hasChoices && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 32 }}>
            {q.choices.map((choice, i) => {
              const isSel = selection.includes(choice.id);
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
                  {/* Circle (single) or Square (multi) badge */}
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

                  <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>{choice.text}</span>

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

        {/* ─── Notes & Evidence section ─── */}
        <div style={{
          borderTop: '1px solid var(--line)',
          paddingTop: 20, marginBottom: 40,
        }}>
          {/* Toggle row */}
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, padding: 0,
              color: notesOpen ? 'var(--ink)' : 'var(--ink-3)',
              fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, fontWeight: 500,
              transition: 'color 0.15s',
            }}
          >
            <span style={{
              width: 20, height: 20,
              border: '1px solid var(--line)', borderRadius: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: 'var(--olive-deep)',
              background: (note || files.length > 0) ? 'var(--olive-wash)' : 'transparent',
            }}>
              {note || files.length > 0 ? '✓' : '+'}
            </span>
            {lang === 'tr' ? 'Not & Kanıt Ekle' : 'Add Notes & Evidence'}
            {(note || files.length > 0) && (
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--olive-deep)',
                background: 'var(--olive-wash)', padding: '2px 6px', letterSpacing: '0.05em',
              }}>
                {[note ? '1 note' : '', files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : '']
                  .filter(Boolean).join(' · ')}
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-4)' }}>{notesOpen ? '▲' : '▼'}</span>
          </button>

          {/* Expandable body */}
          {notesOpen && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Notes textarea */}
              <div>
                <label style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5,
                  color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase',
                  display: 'block', marginBottom: 8,
                }}>
                  {lang === 'tr' ? 'Notlar / Yorumlar' : 'Notes / Comments'}
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNotes({ ...notes, [q.id]: e.target.value })}
                  rows={3}
                  placeholder={lang === 'tr'
                    ? 'Bu soruyla ilgili ek not, yorum veya bağlam bilgisi ekleyin…'
                    : 'Add context, clarifications, or additional comments for this answer…'}
                  style={{
                    width: '100%', padding: '12px 14px',
                    background: 'var(--cream-deep)', border: '1px solid var(--line)',
                    fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5,
                    color: 'var(--ink)', lineHeight: 1.6, resize: 'vertical',
                    outline: 'none', borderRadius: 0,
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--ink-3)')}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--line)')}
                />
              </div>

              {/* File upload */}
              <div>
                <label style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5,
                  color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase',
                  display: 'block', marginBottom: 8,
                }}>
                  {lang === 'tr' ? 'Kanıt Belgesi Yükle' : 'Upload Evidence'}
                </label>

                {/* Upload button */}
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

                {/* Fix 5: stable key = name+size, not array index */}
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
                        <span style={{ fontSize: 10, color: 'var(--ink-4)', flexShrink: 0 }}>
                          {file.size < 1024 * 1024
                            ? `${Math.round(file.size / 1024)} KB`
                            : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
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
          )}
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
                onClick={() => setCurrentIdx(i)}
                title={`${i + 1}`}
                style={{
                  width:  i === currentIdx ? 18 : 5, height: 5,
                  background: answers[qItem.id]
                    ? 'var(--olive-deep)'
                    : i === currentIdx ? 'var(--ink)' : 'var(--line)',
                  borderRadius: 3, transition: 'all 0.2s ease', cursor: 'pointer',
                }}
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
                ? (lang === 'tr' ? 'Tamamla ✓' : 'Finish ✓')
                : (lang === 'tr' ? 'Sonraki' : 'Next')}
            {!saving && !isLast && <Icon.arrow />}
          </button>
        </div>
      </main>
    </div>
  );
}
