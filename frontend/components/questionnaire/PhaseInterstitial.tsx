'use client';
/* CO-2: Phase completion interstitial screen.
   Shown full-page between GRI phases (Foundation → General Disclosures, etc.) */

import Logo from '@/components/Logo';
import { Icon } from '@/components/shared';
import type { GriPhase, PhaseBoundary } from './types';

interface Props {
  phaseComplete: number;
  GRI_PHASES: GriPhase[];
  phaseBoundaries: Record<number, PhaseBoundary>;
  lang: string;
  exitSaving: boolean;
  /** Called with the start index of the next phase when user clicks "Continue" */
  onContinue: (nextStart: number) => void;
  onSaveAndExit: () => void;
}

export function PhaseInterstitial({
  phaseComplete,
  GRI_PHASES,
  phaseBoundaries,
  lang,
  exitSaving,
  onContinue,
  onSaveAndExit,
}: Props) {
  const nextPhaseNum = phaseComplete + 1;
  const nextPhase    = GRI_PHASES.find((p) => p.num === nextPhaseNum);
  const donePhase    = GRI_PHASES.find((p) => p.num === phaseComplete);
  const nextStart    = phaseBoundaries[nextPhaseNum]?.start ?? 0;

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ padding: '13px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo size={20} />
          <button
            className="btn btn-outline btn-sm"
            onClick={onSaveAndExit}
            disabled={exitSaving}
            style={{ opacity: exitSaving ? 0.6 : 1 }}
          >
            {lang === 'tr' ? 'Kaydet & Çık' : 'Save & Exit'}
          </button>
        </div>
      </header>

      {/* Centered card */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>

          {/* Checkmark badge */}
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--olive-deep)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', fontSize: 22, color: 'var(--paper)',
          }}>✓</div>

          <span className="eyebrow" style={{ display: 'block', marginBottom: 10 }}>
            {lang === 'tr' ? 'Aşama Tamamlandı' : 'Phase Complete'}
          </span>
          <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 16 }}>
            {donePhase?.label ?? (lang === 'tr' ? `Aşama ${phaseComplete}` : `Phase ${phaseComplete}`)}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.7, maxWidth: 380, margin: '0 auto 32px' }}>
            {lang === 'tr'
              ? 'Bu aşamayı başarıyla tamamladınız. Sıradaki aşamaya geçmeye hazırsınız.'
              : "You've completed this phase. You're ready to move on to the next one."}
          </p>

          {/* Next phase preview */}
          <div style={{
            background: 'var(--paper)', border: '1px solid var(--line)',
            padding: '16px 20px', marginBottom: 32, textAlign: 'left',
            display: 'inline-block', minWidth: 260,
          }}>
            <p style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5,
              color: 'var(--ink-4)', letterSpacing: '0.1em',
              textTransform: 'uppercase', marginBottom: 6,
            }}>
              {lang === 'tr' ? 'Sıradaki Aşama' : 'Next Phase'}
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              {nextPhase?.label ?? (lang === 'tr' ? `Aşama ${nextPhaseNum}` : `Phase ${nextPhaseNum}`)}
            </p>
          </div>

          {/* Continue button */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => onContinue(nextStart)}
              style={{ padding: '13px 28px', fontSize: 13 }}
            >
              {lang === 'tr' ? 'Devam Et' : 'Continue'}
              <Icon.arrow />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
