'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/AppNav';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/shared';
import { surveyAPI, attemptAPI } from '@/lib/api';
import { gradeColor } from '@/lib/utils';

/* ─── Sector definitions ─────────────────────────────────────── */
const SECTORS = [
  { value: 'agri',          en: 'Agriculture & Food',          tr: 'Tarım & Gıda',            match: 'Agriculture'   },
  { value: 'energy',        en: 'Energy & Utilities',          tr: 'Enerji & Hizmetler',      match: 'Energy'        },
  { value: 'finance',       en: 'Financial Services',          tr: 'Finansal Hizmetler',      match: 'Financial'     },
  { value: 'construction',  en: 'Construction & Real Estate',  tr: 'İnşaat & Gayrimenkul',    match: 'Construction'  },
  { value: 'manufacturing', en: 'Manufacturing & Industry',    tr: 'İmalat & Sanayi',         match: 'Manufacturing' },
  { value: 'health',        en: 'Healthcare & Pharma',         tr: 'Sağlık & İlaç',           match: 'Healthcare'    },
  { value: 'tech',          en: 'Technology & IT',             tr: 'Teknoloji & BT',          match: 'Technology'    },
  { value: 'retail',        en: 'Retail & Trade',              tr: 'Perakende & Ticaret',     match: 'Retail'        },
];

/* ─── Types ──────────────────────────────────────────────────── */
interface Survey {
  id: number;
  name: string; name_en?: string; name_tr?: string;
  question_count?: number; total_questions?: number;
}

interface Attempt {
  id: number;
  survey_name: string;
  is_completed: boolean;
  completed_at: string | null;
  total_score: number | null;
  overall_grade: string;
}

type StepStatus = 'completed' | 'in_progress' | 'active' | 'locked';

interface WizardStep {
  phase: 1 | 2 | 3 | 4;
  labelEn: string;
  labelTr: string;
  descEn: string;
  descTr: string;
  questions: number;
  nameMatch: string;
  status: StepStatus;
  survey: Survey | null;
  done: Attempt | null;   // most recent completed attempt
  live: Attempt | null;   // in-progress attempt
}

const STEP_DEFS: Omit<WizardStep, 'status' | 'survey' | 'done' | 'live'>[] = [
  {
    phase: 1,
    labelEn: 'GRI 1: Foundation',
    labelTr: 'GRI 1: Temel',
    descEn:  'Understanding GRI reporting requirements and principles',
    descTr:  'GRI raporlama gereksinimleri ve ilkelerini anlama',
    questions: 32,
    nameMatch: 'GRI 1:',
  },
  {
    phase: 2,
    labelEn: 'GRI 2: General Disclosures',
    labelTr: 'GRI 2: Genel Açıklamalar',
    descEn:  'Organisational profile, governance and stakeholder engagement',
    descTr:  'Kuruluş profili, yönetişim ve paydaş katılımı',
    questions: 80,
    nameMatch: 'GRI 2:',
  },
  {
    phase: 3,
    labelEn: 'GRI 3: Material Topics',
    labelTr: 'GRI 3: Önemli Konular',
    descEn:  'Materiality assessment and management approach for key topics',
    descTr:  'Önemlilik değerlendirmesi ve temel konular için yönetim yaklaşımı',
    questions: 60,
    nameMatch: 'GRI 3:',
  },
  {
    phase: 4,
    labelEn: 'Sector Standard',
    labelTr: 'Sektör Standardı',
    descEn:  'Industry-specific sustainability topics for your sector',
    descTr:  'Sektörünüze özgü sürdürülebilirlik konuları',
    questions: 8,
    nameMatch: 'GRI Sector:',
  },
];

/* ─── Step status badge ──────────────────────────────────────── */
function StatusBadge({ status, lang }: { status: StepStatus; lang: string }) {
  const cfg = {
    completed:   { bg: 'var(--olive-deep)', color: '#fff',            label: lang === 'tr' ? 'Tamamlandı' : 'Completed'   },
    in_progress: { bg: 'var(--amber)',      color: 'var(--ink)',       label: lang === 'tr' ? 'Devam Ediyor' : 'In Progress' },
    active:      { bg: 'var(--ink)',        color: 'var(--cream)',     label: lang === 'tr' ? 'Hazır' : 'Ready'            },
    locked:      { bg: 'transparent',       color: 'var(--ink-4)',     label: lang === 'tr' ? 'Kilitli' : 'Locked'         },
  }[status];

  return (
    <span style={{
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
      padding: '3px 8px',
      background: cfg.bg,
      color: cfg.color,
      border: status === 'locked' ? '1px solid var(--line)' : 'none',
      display: 'inline-block',
    }}>
      {status === 'locked' && '🔒 '}{cfg.label}
    </span>
  );
}

/* ─── Sector Picker (inline, for Step 4 when active) ────────── */
function SectorPicker({
  lang,
  selected,
  onChange,
}: {
  lang: string;
  selected: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginTop: 20 }}>
      <p style={{
        fontSize: 11, color: 'var(--ink-4)',
        fontFamily: "'IBM Plex Mono', monospace",
        letterSpacing: '0.08em', textTransform: 'uppercase',
        marginBottom: 12,
      }}>
        {lang === 'tr' ? 'Sektörünüzü seçin' : 'Choose your sector'}
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 6,
      }}>
        {SECTORS.map((s) => {
          const isSelected = selected === s.value;
          return (
            <button
              key={s.value}
              onClick={() => onChange(s.value)}
              style={{
                padding: '9px 14px',
                textAlign: 'left',
                border: `1px solid ${isSelected ? 'var(--ink)' : 'var(--line)'}`,
                background: isSelected ? 'var(--ink)' : 'var(--cream)',
                color: isSelected ? 'var(--paper)' : 'var(--ink)',
                cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 12, fontWeight: isSelected ? 500 : 400,
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'border-color 0.1s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.borderColor = 'var(--ink-3)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.borderColor = 'var(--line)';
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: isSelected ? 'var(--paper)' : 'var(--line)',
                display: 'inline-block',
              }} />
              {lang === 'tr' ? s.tr : s.en}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Single wizard step card ────────────────────────────────── */
function StepCard({
  step,
  lang,
  isLast,
  selectedSector,
  onSectorChange,
  onStart,
  onContinue,
  onRetry,
  starting,
  stepErr,
}: {
  step: WizardStep;
  lang: string;
  isLast: boolean;
  selectedSector: string | null;
  onSectorChange: (v: string) => void;
  onStart: (step: WizardStep, sector?: string) => void;
  onContinue: (attempt: Attempt) => void;
  onRetry: (step: WizardStep) => void;
  starting: boolean;
  stepErr?: string;
}) {
  const { status, phase, done, live } = step;
  const isLocked   = status === 'locked';
  const isActive   = status === 'active';
  const isDone     = status === 'completed';
  const isLive     = status === 'in_progress';

  const label = lang === 'tr' ? step.labelTr : step.labelEn;
  const desc  = lang === 'tr' ? step.descTr  : step.descEn;

  /* left-border accent colour */
  const accentColor = isDone   ? 'var(--olive-deep)'
                    : isLive   ? 'var(--amber)'
                    : isActive ? 'var(--ink)'
                    :            'var(--line)';

  return (
    <div style={{ display: 'flex', gap: 0 }}>
      {/* Connector column */}
      <div style={{ width: 40, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Phase dot */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: isDone   ? 'var(--olive-deep)'
                    : isLive   ? 'var(--amber)'
                    : isActive ? 'var(--ink)'
                    :            'var(--cream-deep)',
          border: `1px solid ${isDone || isLive || isActive ? 'transparent' : 'var(--line)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
          fontWeight: 600, letterSpacing: '-0.02em',
          color: isDone || isLive || isActive ? '#fff' : 'var(--ink-4)',
          zIndex: 1, position: 'relative',
        }}>
          {isDone ? '✓' : phase}
        </div>
        {/* Vertical line to next step */}
        {!isLast && (
          <div style={{
            flex: 1, width: 1,
            background: isDone ? 'var(--olive-deep)' : 'var(--line)',
            marginTop: 2, marginBottom: 2,
            minHeight: 16,
          }} />
        )}
      </div>

      {/* Card */}
      <div style={{
        flex: 1,
        marginLeft: 16,
        marginBottom: isLast ? 0 : 16,
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderLeft: `3px solid ${accentColor}`,
        padding: '20px 24px',
        opacity: isLocked ? 0.65 : 1,
        transition: 'opacity 0.2s',
      }}>
        {/* Card header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
              color: 'var(--ink-4)', letterSpacing: '0.12em',
              textTransform: 'uppercase', display: 'block', marginBottom: 5,
            }}>
              {lang === 'tr' ? 'AŞAMA' : 'PHASE'} {String(phase).padStart(2, '0')}
            </span>
            <h2 style={{
              fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
              color: isLocked ? 'var(--ink-3)' : 'var(--ink)',
              marginBottom: 4,
            }}>
              {label}
            </h2>
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              {desc}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0, marginLeft: 16 }}>
            <StatusBadge status={status} lang={lang} />
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10, color: 'var(--ink-4)', whiteSpace: 'nowrap',
            }}>
              {step.questions} {lang === 'tr' ? 'soru' : 'Q'}
            </span>
          </div>
        </div>

        {/* Completed: show score + actions */}
        {isDone && done && (
          <div style={{
            marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 10,
          }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'baseline' }}>
              <div>
                <span style={{
                  fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
                  fontSize: 26, letterSpacing: '-0.04em',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {Math.round(done.total_score ?? 0)}
                </span>
                <span style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 4 }}>pts</span>
              </div>
              {done.overall_grade && (
                <span style={{
                  fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600,
                  fontSize: 18, color: gradeColor(done.overall_grade),
                }}>
                  {done.overall_grade}
                </span>
              )}
              {done.completed_at && (
                <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {new Date(done.completed_at).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB')}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={`/results/${done.id}`} style={{ textDecoration: 'none' }}>
                <button className="btn btn-outline btn-sm">
                  {lang === 'tr' ? 'Sonuçlar' : 'Results'} <Icon.arrow />
                </button>
              </a>
              {/* Retry only for steps 1-3 (sector retry requires new sector pick) */}
              {phase < 4 && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => onRetry(step)}
                  disabled={starting}
                >
                  {lang === 'tr' ? 'Tekrar' : 'Retry'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* In-progress: continue + start-new buttons */}
        {isLive && live && (
          <div style={{
            marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 8,
          }}>
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
              {lang === 'tr' ? 'Kaldığınız yerden devam edin.' : 'Pick up where you left off.'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {/* Start fresh — creates a brand-new attempt */}
              {step.survey && phase < 4 && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => onStart(step)}
                  disabled={starting}
                  title={lang === 'tr' ? 'Yeni başlangıç' : 'Start from scratch'}
                >
                  {lang === 'tr' ? 'Yeniden Başla' : 'Restart'}
                </button>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onContinue(live)}
                disabled={starting}
              >
                {lang === 'tr' ? 'Devam Et' : 'Continue'} <Icon.arrow />
              </button>
            </div>
          </div>
        )}

        {/* Active (step 1–3): start button */}
        {isActive && phase < 4 && (
          <div style={{
            marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            {!step.survey ? (
              <span style={{
                fontSize: 10, color: 'var(--ink-4)',
                fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: '0.06em',
              }}>
                ⚠ {lang === 'tr' ? 'Anket verisi henüz yüklenmedi.' : 'Survey data not loaded yet.'}
              </span>
            ) : <span />}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onStart(step)}
              disabled={starting || !step.survey}
              style={!step.survey ? { opacity: 0.35, cursor: 'not-allowed' } : {}}
            >
              {starting ? (lang === 'tr' ? 'Açılıyor…' : 'Opening…') : (lang === 'tr' ? 'Başla' : 'Start')} <Icon.arrow />
            </button>
          </div>
        )}

        {/* Active (step 4): sector picker + start */}
        {isActive && phase === 4 && (
          <>
            <SectorPicker
              lang={lang}
              selected={selectedSector}
              onChange={onSectorChange}
            />
            {/* Inline error (e.g. sector survey not found) */}
            {stepErr && (
              <div style={{
                marginTop: 10,
                padding: '8px 12px',
                background: '#FEF2F0', border: '1px solid #F5C6BB',
                fontSize: 11, color: 'var(--danger)',
                fontFamily: "'IBM Plex Mono', monospace",
              }}>
                {stepErr}
              </div>
            )}
            <div style={{
              marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              {selectedSector === null && !stepErr && (
                <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                  * {lang === 'tr' ? 'Devam etmek için sektör seçin.' : 'Select a sector to continue.'}
                </span>
              )}
              <div style={{ marginLeft: 'auto' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => selectedSector && onStart(step, selectedSector)}
                  disabled={starting || selectedSector === null}
                  style={{ opacity: selectedSector === null ? 0.4 : 1, cursor: selectedSector === null ? 'not-allowed' : 'pointer' }}
                >
                  {starting ? (lang === 'tr' ? 'Açılıyor…' : 'Opening…') : (lang === 'tr' ? 'Başla' : 'Start')} <Icon.arrow />
                </button>
              </div>
            </div>
          </>
        )}

        {/* Locked: show which step to complete first */}
        {isLocked && (
          <div style={{ marginTop: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
              {lang === 'tr'
                ? `GRI ${phase - 1} tamamlandıktan sonra açılır`
                : `Unlock after completing GRI ${phase === 4 ? '3' : phase - 1}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════ */
export default function SurveysPage() {
  const { lang } = useLang();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const submitLockRef = useRef(false);

  const [surveys,  setSurveys]  = useState<Survey[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [loadErr,  setLoadErr]  = useState(false);
  const [starting, setStarting] = useState(false);
  const [startErr, setStartErr] = useState('');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    // Fix H-4: cancel in-flight requests when the component unmounts so we never
    // call setState on an already-unmounted component (prevents memory leaks and
    // the "Can't perform a React state update on an unmounted component" warning).
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      surveyAPI.getSurveys(),
      attemptAPI.getMyAttempts(),
    ])
      .then(([survData, attData]: [Survey[] | { results: Survey[] }, Attempt[] | { results: Attempt[] }]) => {
        if (controller.signal.aborted) return;
        const survList = Array.isArray(survData) ? survData : (survData?.results ?? []);
        const attList  = Array.isArray(attData)  ? attData  : (attData?.results  ?? []);
        setSurveys(survList);
        setAttempts(attList);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setLoadErr(true);
        void err;
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user]);

  /* ── Build wizard steps ─────────────────────────────────── */
  const steps: WizardStep[] = STEP_DEFS.map((def, idx) => {
    const sname = (s: Survey) => s.name_en || s.name || '';
    const aname = (a: Attempt) => a.survey_name || '';

    // Survey match for steps 1-3 (exact phase prefix)
    const survey = def.phase < 4
      ? (surveys.find((s) => sname(s).includes(def.nameMatch)) ?? null)
      : null;  // sector survey resolved later by selected sector

    // Attempt match
    const stepAttempts = attempts.filter((a) => aname(a).includes(def.nameMatch));
    // Newest completed + newest in-progress
    const done = stepAttempts.find((a) =>  a.is_completed) ?? null;
    const live = stepAttempts.find((a) => !a.is_completed) ?? null;

    // Status
    let status: StepStatus;
    if (live)       { status = 'in_progress'; }
    else if (done)  { status = 'completed';   }
    else if (idx === 0) { status = 'active';  }
    else {
      const prevMatch = STEP_DEFS[idx - 1].nameMatch;
      const prevDone  = attempts.some((a) => a.is_completed && aname(a).includes(prevMatch));
      status = prevDone ? 'active' : 'locked';
    }

    return { ...def, survey, done, live, status };
  });

  /* ── Handlers ───────────────────────────────────────────── */
  const handleStart = useCallback(async (step: WizardStep, sector?: string) => {
    if (submitLockRef.current) return;
    setStartErr('');

    let survey = step.survey;

    if (step.phase === 4 && sector) {
      const sectorDef = SECTORS.find((s) => s.value === sector);
      if (sectorDef) {
        survey = surveys.find((s) =>
          (s.name_en || s.name || '').includes(sectorDef.match) ||
          (s.name || '').includes(sectorDef.match)
        ) ?? null;
      }
    }

    if (!survey) {
      setStartErr(lang === 'tr' ? 'Anket bulunamadı.' : 'Survey not found.');
      return;
    }

    submitLockRef.current = true;
    setStarting(true);
    try {
      const attempt = await attemptAPI.startAttempt(survey.id, sector);
      router.push(`/questionnaire/${attempt.id}`);
    } catch (err: unknown) {
      // Fix START-1: parse the API error so the user sees WHY it failed.
      let msg = lang === 'tr' ? 'Başlatılamadı, lütfen tekrar deneyin.' : 'Failed to start. Please try again.';

      const axErr = err as { response?: { status?: number; data?: { detail?: string; error?: string } } };
      const status = axErr?.response?.status;
      const detail = axErr?.response?.data?.detail || axErr?.response?.data?.error || '';

      if (status === 403) {
        msg = lang === 'tr'
          ? 'Deneme limitinize ulaştınız. Plan yükseltmek için yöneticinizle iletişime geçin.'
          : 'You have reached your attempt limit. Contact your administrator to upgrade your plan.';
      } else if (status === 400 && typeof detail === 'string' && detail.toLowerCase().includes('multiple attempt')) {
        msg = lang === 'tr'
          ? 'Bu anket için yeniden denemeye izin verilmiyor.'
          : 'Multiple attempts are not allowed for this survey.';
      } else if (typeof detail === 'string' && detail.length > 0) {
        msg = detail;
      }

      setStartErr(msg);
      setStarting(false);
    } finally {
      submitLockRef.current = false;
    }
  }, [surveys, lang, router]);

  const handleContinue = useCallback((attempt: Attempt) => {
    router.push(`/questionnaire/${attempt.id}`);
  }, [router]);

  // Retry = start a fresh attempt for the same survey (no sector needed for 1-3)
  const handleRetry = useCallback((step: WizardStep) => {
    handleStart(step);
  }, [handleStart]);

  /* ── Loading ─────────────────────────────────────────────── */
  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>
          {lang === 'tr' ? 'YÜKLENİYOR…' : 'LOADING…'}
        </span>
      </div>
    );
  }

  /* ── Completed all 4 phases banner ───────────────────────── */
  const allDone = steps.every((s) => s.status === 'completed');

  /* ── Total questions answered ────────────────────────────── */
  const completedPhases = steps.filter((s) => s.status === 'completed').length;

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <AppNav />

      <main className="wrap" style={{ padding: '40px 32px 80px', maxWidth: 760 }}>

        {/* ── Page header ─────────────────────────────────── */}
        <div style={{ marginBottom: 40 }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10, color: 'var(--ink-4)',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            display: 'block', marginBottom: 10,
          }}>
            GRI Universal Standards · {lang === 'tr' ? '4 Aşama' : '4 Phases'} · 180 Q
          </span>
          <h1 style={{ fontSize: 32, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.05, marginBottom: 8 }}>
            {lang === 'tr'
              ? <><em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500 }}>GRI</em> Değerlendirme Yolculuğu</>
              : <><em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500 }}>GRI</em> Assessment Journey</>}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, maxWidth: 520 }}>
            {lang === 'tr'
              ? 'Her aşamayı sırayla tamamlayın. Bir sonraki aşama, bir öncekini bitirdikten sonra açılır.'
              : 'Complete each phase in order. The next phase unlocks when you finish the previous one.'}
          </p>
        </div>

        {/* ── Progress strip ───────────────────────────────── */}
        <div style={{
          background: 'var(--paper)', border: '1px solid var(--line)',
          padding: '14px 20px', marginBottom: 32,
          display: 'flex', alignItems: 'center', gap: 20,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {lang === 'tr' ? 'İlerleme' : 'Progress'}
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--olive-deep)', fontWeight: 600 }}>
                {completedPhases} / 4 {lang === 'tr' ? 'aşama' : 'phases'}
              </span>
            </div>
            <div className="bar bar-olive">
              <span style={{ width: `${(completedPhases / 4) * 100}%`, transition: 'width 0.4s ease' }} />
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
              fontSize: 28, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}>
              {completedPhases}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>
              {lang === 'tr' ? 'tamamlandı' : 'completed'}
            </div>
          </div>
        </div>

        {/* ── Error banner ─────────────────────────────────── */}
        {startErr && (
          <div style={{
            background: '#FEF2F0', border: '1px solid #F5C6BB',
            padding: '10px 16px', marginBottom: 20,
            fontSize: 12, color: 'var(--danger)',
            fontFamily: "'IBM Plex Mono', monospace",
          }}>
            {startErr}
          </div>
        )}

        {loadErr && (
          <div style={{
            background: '#FEF2F0', border: '1px solid #F5C6BB',
            padding: '28px 32px', textAlign: 'center', marginBottom: 20,
          }}>
            <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 8 }}>
              {lang === 'tr' ? 'Yüklenemedi.' : 'Failed to load.'}
            </p>
            <button className="btn btn-outline btn-sm" onClick={() => window.location.reload()}>
              {lang === 'tr' ? 'Tekrar Dene' : 'Retry'}
            </button>
          </div>
        )}

        {/* ── All-done banner ───────────────────────────────── */}
        {allDone && (
          <div style={{
            background: 'var(--olive-deep)', color: '#fff',
            padding: '20px 24px', marginBottom: 28,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>
                {lang === 'tr' ? '🎉 Tüm aşamalar tamamlandı!' : '🎉 All phases completed!'}
              </div>
              <div style={{ fontSize: 11.5, opacity: 0.8 }}>
                {lang === 'tr' ? 'Sonuçlarınızı görüntüleyebilir veya tekrar başlayabilirsiniz.' : 'You can view your results or start again.'}
              </div>
            </div>
            <a href="/history" style={{ textDecoration: 'none' }}>
              <button style={{
                padding: '8px 16px', background: '#fff', color: 'var(--ink)',
                border: 'none', cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {lang === 'tr' ? 'Geçmişi Görüntüle' : 'View History'} <Icon.arrow />
              </button>
            </a>
          </div>
        )}

        {/* ── Wizard steps ─────────────────────────────────── */}
        <div>
          {steps.map((step, idx) => (
            <StepCard
              key={step.phase}
              step={step}
              lang={lang}
              isLast={idx === steps.length - 1}
              selectedSector={selectedSector}
              onSectorChange={(v) => { setSelectedSector(v); setStartErr(''); }}
              onStart={handleStart}
              onContinue={handleContinue}
              onRetry={handleRetry}
              starting={starting}
              stepErr={step.phase === 4 && step.status === 'active' ? startErr : undefined}
            />
          ))}
        </div>

        {/* ── Total footer ─────────────────────────────────── */}
        <div style={{
          marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--line)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
            {lang === 'tr' ? 'Toplam 180 soru · GRI 1 + GRI 2 + GRI 3 + Sektör' : 'Total 180 questions · GRI 1 + GRI 2 + GRI 3 + Sector'}
          </span>
          <a href="/history" style={{ textDecoration: 'none', fontSize: 11, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {lang === 'tr' ? 'Geçmiş' : 'History'} <Icon.arrow />
          </a>
        </div>
      </main>
    </div>
  );
}
