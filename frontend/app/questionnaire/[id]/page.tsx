'use client';
/* CO-2: QuestionnairePage — orchestrator shell.
   All state + handlers live in useQuestionnaire.
   UI is composed from four sub-components.        */

import Link from 'next/link';
import Logo from '@/components/Logo';
import { useQuestionnaire }   from './useQuestionnaire';
import { PhaseInterstitial }  from '@/components/questionnaire/PhaseInterstitial';
import { QuestionView }       from '@/components/questionnaire/QuestionView';
import { EvidencePanel }      from '@/components/questionnaire/EvidencePanel';
import { QuestionNav }        from '@/components/questionnaire/QuestionNav';

export default function QuestionnairePage() {
  const qs = useQuestionnaire();

  /* ── Loading state ── */
  if (qs.authLoading || qs.loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>
          {qs.t('t_loading_auth')}
        </span>
      </div>
    );
  }

  /* ── No questions / error state ── */
  if (!qs.q) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>
          {/* Fix L-3: correct Turkish diacritics */}
          {qs.error || (qs.lang === 'tr' ? 'Soru bulunamadı.' : 'No questions found.')}
        </p>
        <Link href="/surveys" style={{ textDecoration: 'none' }}>
          <button className="btn btn-outline">{qs.lang === 'tr' ? '← Anketlere Dön' : '← Back to Surveys'}</button>
        </Link>
      </div>
    );
  }

  /* ── Phase completion interstitial ── */
  if (qs.phaseComplete !== null) {
    return (
      <PhaseInterstitial
        phaseComplete={qs.phaseComplete}
        GRI_PHASES={qs.GRI_PHASES}
        phaseBoundaries={qs.phaseBoundaries}
        lang={qs.lang}
        exitSaving={qs.exitSaving}
        onContinue={(nextStart) => { qs.setPhaseComplete(null); qs.setCurrentIdx(nextStart); }}
        onSaveAndExit={qs.handleSaveAndExit}
      />
    );
  }

  /* ── Main questionnaire view ── */
  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>

      {/* Sticky header ─────────────────────────────────────── */}
      <header style={{ borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--cream)', zIndex: 10 }}>
        <div className="wrap" style={{ padding: '13px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Logo size={20} />
            <span style={{ width: 1, height: 18, background: 'var(--line)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 320 }}>
              {qs.cycleName && (
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                  color: 'var(--olive-deep)', letterSpacing: '0.1em',
                  textTransform: 'uppercase', lineHeight: 1,
                }}>
                  {qs.cycleName}
                </span>
              )}
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {qs.surveyName}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 80, height: 2, background: 'var(--line)', borderRadius: 1 }}>
                <div style={{ width: `${qs.progress}%`, height: '100%', background: 'var(--olive-deep)', borderRadius: 1, transition: 'width 0.4s' }} />
              </div>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
                {qs.progress}%
              </span>
            </div>
            {/* Bookmark indicator — shows count when questions are flagged */}
            {qs.bookmarkedCount > 0 && (
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10, color: 'var(--amber)',
                letterSpacing: '0.06em',
              }}>
                🔖 {qs.bookmarkedCount}
              </span>
            )}
            {/* Auto-save flash indicator */}
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10, color: 'var(--olive-deep)',
              letterSpacing: '0.08em',
              opacity: qs.savedFlash ? 1 : 0,
              transition: 'opacity 0.4s ease',
              pointerEvents: 'none',
              minWidth: 56,
            }}>
              ✓ {qs.lang === 'tr' ? 'Kaydedildi' : 'Saved'}
            </span>
            <button
              className="btn btn-outline btn-sm"
              onClick={qs.handleSaveAndExit}
              disabled={qs.exitSaving}
              style={{ opacity: qs.exitSaving ? 0.6 : 1 }}
            >
              {qs.exitSaving
                ? (qs.lang === 'tr' ? 'Kaydediliyor…' : 'Saving…')
                : (qs.lang === 'tr' ? 'Kaydet & Çık' : 'Save & Exit')}
            </button>
          </div>
        </div>
        {/* Dual progress bar: hairline at bottom of header */}
        <div style={{ height: 2, background: 'var(--line-soft)' }}>
          <div style={{ width: `${qs.progress}%`, height: '100%', background: 'var(--ink)', transition: 'width 0.4s ease' }} />
        </div>
      </header>

      {/* Save & Exit error banner ─────────────────────────── */}
      {/* Fix CRIT-3: shown when handleSaveAndExit fails to save the answer.
          Fix A-2: role="alert" so AT announces the banner immediately on mount */}
      {qs.exitErr && (
        <div role="alert" style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'var(--danger, #c0392b)', color: '#fff',
          padding: '10px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: '0.02em',
        }}>
          <span>{qs.exitErr}</span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={qs.navigateToDashboard}
              style={{
                background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.5)',
                color: '#fff', padding: '4px 12px', cursor: 'pointer', fontSize: 11,
                fontFamily: 'inherit', letterSpacing: 'inherit',
              }}
            >
              {qs.lang === 'tr' ? 'Yine de Çık' : 'Exit Anyway'}
            </button>
            <button
              onClick={() => qs.setExitErr('')}
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.5)',
                color: '#fff', padding: '4px 12px', cursor: 'pointer', fontSize: 11,
                fontFamily: 'inherit', letterSpacing: 'inherit',
              }}
            >
              {qs.lang === 'tr' ? 'İptal' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Main content ────────────────────────────────────── */}
      <main className="wrap-narrow" style={{ paddingTop: 52, paddingBottom: 80 }}>

        <QuestionView
          q={qs.q}
          currentIdx={qs.visibleIdx}
          total={qs.total}
          lang={qs.lang}
          catLabel={qs.catLabel}
          qText={qs.qText}
          selection={qs.selection}
          textAns={qs.textAns}
          numericalValue={qs.numericalValue}
          isTextType={qs.isTextType}
          isMixedType={qs.isMixedType}
          hasChoices={qs.hasChoices}
          isNA={qs.isNA}
          isBookmarked={qs.isBookmarked}
          GRI_PHASES={qs.GRI_PHASES}
          currentPhase={qs.currentPhase}
          unlockedUpToPhase={qs.unlockedUpToPhase}
          onToggleChoice={qs.toggleChoice}
          onTextChange={qs.updateTextAnswer}
          onNumericalChange={qs.updateNumericalAnswer}
          note={qs.note}
          onNoteChange={qs.updateNote}
          onToggleNA={qs.toggleNA}
          onToggleBookmark={qs.toggleBookmark}
        />

        <EvidencePanel
          note={qs.note}
          files={qs.files}
          lang={qs.lang}
          isNA={qs.isNA}
          fileInputRef={qs.fileInputRef}
          onNoteChange={qs.updateNote}
          onAddFiles={qs.addFiles}
          onRemoveFile={qs.removeFile}
        />

        <QuestionNav
          questions={qs.questions}
          currentIdx={qs.currentIdx}
          answers={qs.answers}
          textAnswers={qs.textAnswers}
          bookmarks={qs.bookmarks}
          naAnswers={qs.naAnswers}
          unlockedUpToPhase={qs.unlockedUpToPhase}
          lang={qs.lang}
          isFirst={qs.isFirst}
          isLast={qs.isLast}
          canSubmit={qs.canSubmit}
          saving={qs.saving}
          error={qs.error}
          onPrev={qs.handlePrev}
          onNext={qs.handleNext}
          onJumpTo={qs.handleJumpTo}
          onJumpToNextFlagged={qs.handleJumpToNextFlagged}
        />

      </main>
    </div>
  );
}
