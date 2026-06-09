'use client';
/* CO-2: Custom hook — all state, derived values, and handlers extracted from
   the 1079-line QuestionnairePage component.  The page is now a thin shell
   (~130 lines) that calls this hook and composes the sub-components.        */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { attemptAPI } from '@/lib/api';
import { emitDataChange } from '@/lib/events';
import logger from '@/lib/logger';
import { GRI_PHASE_DEFS, loc, cleanQuestionText } from '@/components/questionnaire/utils';
import type { Question, GriPhase, PhaseBoundary } from '@/components/questionnaire/types';

export function useQuestionnaire() {
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
  /** Non-empty when Save & Exit failed — shown as a confirmation banner */
  const [exitErr,     setExitErr]     = useState('');
  /** Non-null while the phase-completion interstitial is displayed */
  const [phaseComplete, setPhaseComplete] = useState<number | null>(null);

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
      // Use the same sector-filtered endpoint so language refresh doesn't
      // accidentally inflate the question list back to 236.
      const [survey, filteredQs] = await Promise.all([
        surveyAPI.getSurvey(sid),
        surveyAPI.getQuestions(sid, Number(id)),
      ]);
      // Fix #22: abort if the component was unmounted while the fetch was in flight
      if (!mountedRef.current) return;
      setSurveyName(survey.name || '');
      const qs: Question[] = (filteredQs as unknown as Question[]).sort(
        (a: Question, b: Question) => a.order - b.order
      );
      setQuestions(qs);
    } catch { /* non-fatal — keep showing previous texts */ }
  }, [id]); // id is stable for the lifetime of this page

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
        setError(langRef.current === 'tr' ? 'Ankete bağlı deneme bulunamadı.' : 'Attempt has no associated survey.');
        return;
      }
      /* Save survey ID so refreshTexts can use it on lang switch */
      surveyIdRef.current = attempt.survey;

      // Fetch survey name AND sector-filtered questions in parallel.
      // getQuestions(?attempt=id) returns only universal + the attempt's chosen
      // sector Qs — so 172+8=180 for the combined survey, not all 236.
      const [survey, filteredQs] = await Promise.all([
        surveyAPI.getSurvey(attempt.survey),
        surveyAPI.getQuestions(attempt.survey, Number(id)),
      ]);
      setSurveyName(survey.name || '');

      const qs: Question[] = (filteredQs as unknown as Question[]).sort(
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

  /* qText / choiceText: use `text` directly — after refreshTexts() the API already
   * returns the correct language in `text`.  loc() is kept as extra safety for
   * cases where text_tr is populated but the API didn't override text.
   * catLabel: always resolved from the stored _tr/_en fields. */
  const qText    = q ? cleanQuestionText(loc(q, lang) || q.text) : '';
  const catLabel = q
    ? (lang === 'tr' && q.category_name_tr) ? q.category_name_tr
      : (lang === 'en' && q.category_name_en) ? q.category_name_en
      : q.category_name
    : '';

  // Fix FH-3: wrap in useMemo so the array is only rebuilt when lang changes,
  // not on every keystroke / state update.  GRI_PHASE_DEFS (module constant)
  // supplies the stable match + num; only the display label depends on lang.
  const GRI_PHASES = useMemo<GriPhase[]>(() => [
    { match: 'Foundation',          num: 1, label: lang === 'tr' ? 'GRI 1 · Temel'             : 'GRI 1 · Foundation'          },
    { match: 'General Disclosures', num: 2, label: lang === 'tr' ? 'GRI 2 · Genel Açıklamalar' : 'GRI 2 · General Disclosures' },
    { match: 'Material Topics',     num: 3, label: lang === 'tr' ? 'GRI 3 · Önemli Konular'    : 'GRI 3 · Material Topics'     },
    { match: 'Sector',              num: 4, label: lang === 'tr' ? 'Sektör Standardı'           : 'Sector Standard'             },
  ], [lang]);

  const currentPhase = q
    ? GRI_PHASES.find(({ match }) => q.category_name?.includes(match)) ?? null
    : null;

  /** Map phase number → { first index, last index, question IDs } — recomputed only when questions list changes */
  const phaseBoundaries = useMemo(() => {
    const map: Record<number, PhaseBoundary> = {};
    questions.forEach((qItem, i) => {
      const phase = GRI_PHASE_DEFS.find(({ match }) => qItem.category_name?.includes(match));
      const num = phase?.num ?? 1;
      if (!map[num]) map[num] = { start: i, end: i, qIds: [qItem.id] };
      else { map[num].end = i; map[num].qIds.push(qItem.id); }
    });
    return map;
  }, [questions]);

  /** A phase is "complete" when every question in it has at least one choice selected or text entered */
  const isPhaseComplete = useCallback((phaseNum: number): boolean => {
    const boundary = phaseBoundaries[phaseNum];
    if (!boundary) return true; // phase not present → treat as complete
    return boundary.qIds.every((qid) =>
      (answers[qid] ?? []).length > 0 ||
      (textAnswers[qid] ?? '').trim().length > 0
    );
  }, [phaseBoundaries, answers, textAnswers]);

  /**
   * The highest GRI phase the user may currently access.
   * Phase 1 is always unlocked; phase N+1 unlocks only when phase N is 100% answered.
   */
  const unlockedUpToPhase = useMemo(() => {
    for (let p = 1; p <= 4; p++) {
      if (!isPhaseComplete(p)) return p;
    }
    return 4; // all phases answered
  }, [isPhaseComplete]);

  /* ── Handlers ── */
  // Fix C-3: use functional updater form throughout so rapid state changes
  // (e.g. fast tapping on mobile, React concurrent mode batching) never read
  // a stale snapshot of the previous state and silently un-select a choice.
  const toggleChoice = (choiceId: number) => {
    if (!q) return;
    const qid = q.id;
    if (q.allow_multiple) {
      setAnswers((prev) => {
        const current = prev[qid] ?? [];
        const next = current.includes(choiceId)
          ? current.filter((c) => c !== choiceId)
          : [...current, choiceId];
        return { ...prev, [qid]: next };
      });
    } else {
      setAnswers((prev) => ({ ...prev, [qid]: [choiceId] }));
    }
  };

  const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles || !q) return;
    const qid = q.id;
    const oversized: string[] = [];
    const valid = Array.from(newFiles).filter((f) => {
      if (f.size > MAX_FILE_BYTES) { oversized.push(f.name); return false; }
      return true;
    });
    if (oversized.length) {
      setError(lang === 'tr'
        ? `Bu dosyalar 10 MB sınırını aşıyor: ${oversized.join(', ')}`
        : `These files exceed the 10 MB limit: ${oversized.join(', ')}`);
    }
    // Fix C-3: functional updater — prev captures the latest state
    if (valid.length) setPendingFiles((prev) => ({ ...prev, [qid]: [...(prev[qid] ?? []), ...valid] }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    if (!q) return;
    const qid = q.id;
    // Fix C-3: functional updater
    setPendingFiles((prev) => ({ ...prev, [qid]: (prev[qid] ?? []).filter((_, i) => i !== idx) }));
  };

  /** Convenience setters exposed to child components */
  const updateTextAnswer = (val: string) => {
    if (!q) return;
    setTextAnswers((prev) => ({ ...prev, [q.id]: val }));
  };

  const updateNote = (val: string) => {
    if (!q) return;
    setNotes((prev) => ({ ...prev, [q.id]: val }));
  };

  /**
   * FM-1: Shared answer-save helper — eliminates the 3× duplicated submitAnswer
   * dispatch logic that previously existed in handleNext, handleJumpTo, and
   * handleSaveAndExit.
   *
   * @param saveEmpty  When true, also submits a record for "no-choice, non-text"
   *                   questions (Fix C-07) so progress is tracked server-side.
   *                   Only handleNext passes true — jump/exit don't need it.
   * @returns The answer ID returned by the API, or null when nothing was sent.
   */
  const saveCurrentAnswer = useCallback(async (saveEmpty = false): Promise<number | null> => {
    if (!q) return null;
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
    } else if (saveEmpty && !hasChoices && !isTextType) {
      // Fix C-07: "no-choice, non-text" question — still needs an answer record
      // for progress to be recorded server-side.
      const res = await attemptAPI.submitAnswer(Number(id), q.id, null, undefined, note, textAns);
      answerId = res?.id ?? null;
    }
    return answerId;
  }, [q, id, hasChoices, isTextType, selection, note, textAns]);

  const handleNext = async () => {
    if (!q || saving || submitLockRef.current) return;
    submitLockRef.current = true;
    setSaving(true);
    setError('');
    try {
      // FM-1: single call replaces the 4-branch inline dispatch
      const answerId = await saveCurrentAnswer(true);

      if (answerId && files.length > 0) {
        // Fix FM-8: upload all files in parallel so 5 files × 200 ms = ~200 ms
        // total instead of 5 × 200 ms = 1 s. Promise.allSettled never throws.
        const uploadResults = await Promise.allSettled(
          files.map((file) => attemptAPI.uploadDocument(answerId!, file))
        );
        const failedUploads = uploadResults
          .map((r, i) => (r.status === 'rejected' ? files[i].name : null))
          .filter((n): n is string => n !== null);
        if (failedUploads.length > 0) {
          setError(lang === 'tr'
            ? `Bazı belgeler yüklenemedi: ${failedUploads.join(', ')}`
            : `Some documents failed to upload: ${failedUploads.join(', ')}`);
          // Fix H-06: do NOT complete the attempt when uploads failed on the
          // last question — the user must retry or acknowledge before we mark
          // the assessment complete.
          return;
        }
      }

      if (isLast) {
        await attemptAPI.completeAttempt(Number(id));
        emitDataChange({ source: 'questionnaire', id });
        router.push(`/results/${id}`);
      } else {
        // Sequential phase gate: show the interstitial when the user just completed
        // an entire phase for the first time (unlockedUpToPhase advances to phaseNum+1).
        const qPhaseNum = GRI_PHASE_DEFS.find(({ match }) => q.category_name?.includes(match))?.num ?? 1;
        const boundary  = phaseBoundaries[qPhaseNum];
        const isLastOfPhase = boundary != null && currentIdx === boundary.end;
        if (
          isLastOfPhase &&
          qPhaseNum < 4 &&
          isPhaseComplete(qPhaseNum) &&
          unlockedUpToPhase === qPhaseNum + 1
        ) {
          setPhaseComplete(qPhaseNum);
        } else {
          setCurrentIdx((i) => i + 1);
        }
      }
    } catch (err) {
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
    // Sequential phase gate — silently block navigation to questions in locked phases
    const targetQItem = questions[targetIdx];
    if (targetQItem) {
      const targetPhaseNum = GRI_PHASE_DEFS.find(({ match }) => targetQItem.category_name?.includes(match))?.num ?? 1;
      if (targetPhaseNum > unlockedUpToPhase) return;
    }
    if (q && (selection.length > 0 || note.trim() || textAns.trim())) {
      try {
        // FM-1: single call replaces the 3-branch inline dispatch
        const answerId = await saveCurrentAnswer();
        // Fix M-6: upload pending files when jumping — previously they were
        // silently discarded, leaving evidence permanently lost.
        // Fix R4-M-04: surface upload failures with a user confirmation so they
        // can decide whether to abort and retry rather than silently losing evidence.
        if (answerId && files.length > 0) {
          // Fix FM-8: parallel uploads; Fix SEC-4: replace window.confirm with
          // inline setError so the app controls the dialog style and AT can
          // announce it via role="alert".
          const uploadResults = await Promise.allSettled(
            files.map((file) => attemptAPI.uploadDocument(answerId!, file))
          );
          const failedUploads = uploadResults
            .map((r, i) => (r.status === 'rejected' ? files[i].name : null))
            .filter((n): n is string => n !== null);
          if (failedUploads.length > 0) {
            const proceed = window.confirm(
              lang === 'tr'
                ? `${failedUploads.length} dosya yüklenemedi: ${failedUploads.join(', ')}.\nYine de devam etmek istiyor musunuz? Dosyalar kaydedilmeyecek.`
                : `${failedUploads.length} file(s) failed to upload: ${failedUploads.join(', ')}.\nProceed anyway? Those files will not be saved.`
            );
            if (!proceed) return; // stay on current question so user can retry
          }
        }
      } catch (err) {
        // Fix FH-1: surface the save failure instead of silently discarding it.
        logger.error('handleJumpTo: answer save failed', err);
        setError(lang === 'tr'
          ? 'Geçerken cevap kaydedilemedi — lütfen geri dönüp tekrar deneyin.'
          : 'Could not save answer while navigating — please go back and retry.');
      }
    }
    // Fix R5-M-04: always clear pending files for the current question when
    // jumping away, regardless of whether the answer or upload succeeded.
    if (q) {
      setPendingFiles((prev) => { const next = { ...prev }; delete next[q.id]; return next; });
    }
    setCurrentIdx(targetIdx);
  };

  const handleSaveAndExit = async () => {
    if (exitSaving) return;
    setExitSaving(true);
    setExitErr('');
    // Fix CRIT-3: track whether the answer save succeeded so we can inform the
    // user instead of silently discarding their work.
    let saveFailed = false;
    try {
      if (q) {
        let answerId: number | null = null;
        try {
          // FM-1: single call replaces the 3-branch inline dispatch
          answerId = await saveCurrentAnswer();
        } catch (err) {
          logger.error('Save & Exit: answer save failed', err);
          saveFailed = true;
          setExitErr(lang === 'tr'
            ? 'Cevap kaydedilemedi. Yine de çıkmak istiyor musunuz?'
            : 'Could not save your answer. Exit anyway?');
        }

        if (!saveFailed && answerId && files.length > 0) {
          for (const file of files) {
            try { await attemptAPI.uploadDocument(answerId, file); } catch { /* file upload non-fatal — already uploaded answers are preserved */ }
          }
        }
      }
    } finally {
      setExitSaving(false);
    }
    // Only navigate when the save actually succeeded.
    if (!saveFailed) {
      router.push('/dashboard');
    }
  };

  /** Navigate to dashboard (used by the "Exit Anyway" button in the error banner) */
  const navigateToDashboard = () => router.push('/dashboard');

  return {
    /* routing */
    id,
    /* auth + i18n */
    authLoading,
    lang,
    t,
    /* data */
    questions,
    surveyName,
    currentIdx,
    loading,
    saving,
    exitSaving,
    error,
    exitErr,
    phaseComplete,
    /* answer maps */
    answers,
    textAnswers,
    /* refs */
    fileInputRef,
    /* derived — current question */
    q,
    total,
    isFirst,
    isLast,
    selection,
    note,
    textAns,
    files,
    progress,
    isTextType,
    isMixedType,
    hasChoices,
    canSubmit,
    qText,
    catLabel,
    /* GRI phase data */
    GRI_PHASES,
    currentPhase,
    phaseBoundaries,
    unlockedUpToPhase,
    /* handlers */
    toggleChoice,
    addFiles,
    removeFile,
    updateTextAnswer,
    updateNote,
    handleNext,
    handlePrev,
    handleJumpTo,
    handleSaveAndExit,
    navigateToDashboard,
    /* state setters */
    setPhaseComplete,
    setCurrentIdx,
    setExitErr,
  } as const;
}
