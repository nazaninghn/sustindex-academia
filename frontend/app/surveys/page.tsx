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
  cycle_name: string;
}

type StepStatus = 'completed' | 'in_progress' | 'active' | 'locked';

interface WizardStep {
  phase: 1 | 2 | 3 | 4 | 5;
  labelEn: string;
  labelTr: string;
  descEn: string;
  descTr: string;
  questions: number;
  nameMatch: string;
  status: StepStatus;
  survey: Survey | null;
  done: Attempt | null;      // most recent completed attempt (for score display)
  allDone: Attempt[];        // all completed attempts for this phase
  live: Attempt | null;      // most recent in-progress attempt
}

const STEP_DEFS: Omit<WizardStep, 'status' | 'survey' | 'done' | 'allDone' | 'live'>[] = [
  {
    phase: 1,
    labelEn: 'Governance & Strategy',
    labelTr: 'Yönetişim ve Strateji',
    descEn:  'Corporate governance, ethics, board oversight and strategic sustainability commitments (G1–G16)',
    descTr:  'Kurumsal yönetişim, etik, yönetim kurulu gözetimi ve stratejik sürdürülebilirlik taahhütleri (G1–G16)',
    questions: 82,
    nameMatch: 'Strateji',
  },
  {
    phase: 2,
    labelEn: 'Environmental Performance',
    labelTr: 'Çevre Performansı',
    descEn:  'Climate, energy, water, biodiversity and circular economy (E1–E14)',
    descTr:  'İklim, enerji, su, biyoçeşitlilik ve döngüsel ekonomi (E1–E14)',
    questions: 74,
    nameMatch: 'Cevre',
  },
  {
    phase: 3,
    labelEn: 'Social Performance',
    labelTr: 'Sosyal Performans',
    descEn:  'Workforce, health & safety, community, human rights and diversity (S1–S24)',
    descTr:  'İşgücü, iş sağlığı güvenliği, toplum, insan hakları ve çeşitlilik (S1–S24)',
    questions: 116,
    nameMatch: 'Sosyal',
  },
  {
    phase: 4,
    labelEn: 'Economic Performance',
    labelTr: 'Ekonomik Performans',
    descEn:  'Economic value, procurement, tax transparency and anti-corruption (EC1–EC9)',
    descTr:  'Ekonomik değer, tedarik, vergi şeffaflığı ve yolsuzlukla mücadele (EC1–EC9)',
    questions: 44,
    nameMatch: 'Ekonomik',
  },
  {
    phase: 5,
    labelEn: 'Sector Standard',
    labelTr: 'Sektör Standardı',
    descEn:  'Industry-specific sustainability topics for your sector (3 criteria · 14 questions)',
    descTr:  'Sektörünüze özgü sürdürülebilirlik konuları (3 kriter · 14 soru)',
    questions: 14,
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
  onRetry: (step: WizardStep) => void;  // kept for sector phase 4 compat
  starting: boolean;
  stepErr?: string;
}) {
  const { status, phase, done, allDone, live } = step;
  const isLocked   = status === 'locked';
  const isActive   = status === 'active';
  const isDone     = allDone.length > 0;   // has at least one completed attempt
  const isLive     = live !== null;         // has an in-progress attempt
  // Can start a new attempt: not locked and survey data loaded
  const canStart   = !isLocked && phase < 5 && !!step.survey;

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

        {/* ── Completed: score + Results ── */}
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
                  fontSize: 26, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums',
                }}>
                  {Math.round(done.total_score ?? 0)}
                </span>
                <span style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 4 }}>pts</span>
              </div>
              {done.overall_grade && (
                <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 18, color: gradeColor(done.overall_grade) }}>
                  {done.overall_grade}
                </span>
              )}
              {done.completed_at && (
                <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {new Date(done.completed_at).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB')}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {allDone.length > 1 && (
                <a href="/history" style={{ textDecoration: 'none' }}>
                  <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace", cursor: 'pointer' }}>
                    +{allDone.length - 1} {lang === 'tr' ? 'önceki →' : 'prev →'}
                  </span>
                </a>
              )}
              <a href={`/results/${done.id}`} style={{ textDecoration: 'none' }}>
                <button className="btn btn-outline btn-sm">
                  {lang === 'tr' ? 'Sonuçlar' : 'Results'} <Icon.arrow />
                </button>
              </a>
              {/* Start New alongside Results — clearly separated */}
              {canStart && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onStart(step)}
                  disabled={starting}
                >
                  {starting ? (lang === 'tr' ? 'Açılıyor…' : 'Opening…') : (lang === 'tr' ? '+ Yeni' : '+ New')} <Icon.arrow />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── In-progress: continue ── */}
        {isLive && live && (
          <div style={{
            marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 8,
          }}>
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
              {lang === 'tr' ? 'Kaldığınız yerden devam edin.' : 'Pick up where you left off.'}
            </span>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onContinue(live)}
              disabled={starting}
            >
              {lang === 'tr' ? 'Devam Et' : 'Continue'} <Icon.arrow />
            </button>
          </div>
        )}

        {/* ── Active (no attempts yet): start ── */}
        {isActive && phase < 5 && !isDone && !isLive && (
          <div style={{
            marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            {!step.survey ? (
              <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em' }}>
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

        {/* Step 5 (Sector): sector picker + start — shown whenever not locked */}
        {!isLocked && phase === 5 && (
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
                ? `${STEP_DEFS[phase - 2]?.labelTr ?? `Aşama ${phase - 1}`} tamamlandıktan sonra açılır`
                : `Unlock after completing ${STEP_DEFS[phase - 2]?.labelEn ?? `Phase ${phase - 1}`}`}
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
  const [showNewCycleModal, setShowNewCycleModal] = useState(false);
  const [newCycleName, setNewCycleName] = useState('');
  // Pending cycle name set by the Dashboard "New Assessment" form
  const [pendingDashCycle, setPendingDashCycle] = useState<string | null>(null);

  // On mount: pick up any cycle name stored by the Dashboard "New Assessment" modal.
  // We DON'T auto-start — just store it so the user can click Start on Phase 1.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sx_pending_cycle');
      if (saved) {
        setPendingDashCycle(saved);
        localStorage.removeItem('sx_pending_cycle');
      }
    } catch { /* ignore */ }
  }, []);

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

  // Active cycle = cycle_name of the most recent attempt (sorted by id desc)
  // Empty string means legacy/unnamed attempts
  const activeCycleName = attempts.length > 0
    ? (attempts.slice().sort((a, b) => b.id - a.id)[0].cycle_name ?? '')
    : '';

  /* ── Build wizard steps ─────────────────────────────────── */
  const steps: WizardStep[] = STEP_DEFS.map((def, idx) => {
    const sname = (s: Survey) => s.name_en || s.name || '';
    const aname = (a: Attempt) => a.survey_name || '';

    // Survey match for steps 1-4 (core phases); sector (phase 5) resolved later
    const survey = def.phase < 5
      ? (surveys.find((s) => sname(s).includes(def.nameMatch)) ?? null)
      : null;  // sector survey resolved later by selected sector

    // Attempt match — sort by id desc so index 0 = most recent
    // Filter by activeCycleName so each cycle only shows its own attempts
    const stepAttempts = attempts
      .filter((a) => aname(a).includes(def.nameMatch) && (a.cycle_name ?? '') === activeCycleName)
      .sort((a, b) => b.id - a.id);

    // Most-recent attempt (highest id) drives the card state.
    // Old attempts superseded by the backend (set to is_completed=False when a
    // newer attempt completes) must NOT be treated as "live" — only the single
    // most-recent attempt determines whether this step is in_progress or completed.
    const mostRecent = stepAttempts[0] ?? null;   // sorted by id desc above
    const live    = mostRecent && !mostRecent.is_completed ? mostRecent : null;
    const done    = mostRecent &&  mostRecent.is_completed ? mostRecent : null;
    const allDone = stepAttempts.filter((a) => a.is_completed);

    // Status
    let status: StepStatus;
    if (live)       { status = 'in_progress'; }
    else if (done)  { status = 'completed';   }
    else if (idx === 0) { status = 'active';  }
    else {
      const prevMatch = STEP_DEFS[idx - 1].nameMatch;
      // Fix: filter by activeCycleName so completing Phase 1 in a previous cycle
      // does NOT unlock Phase 2 in a new cycle — each cycle must be sequential.
      const prevDone  = attempts.some(
        (a) => a.is_completed && aname(a).includes(prevMatch) && (a.cycle_name ?? '') === activeCycleName,
      );
      status = prevDone ? 'active' : 'locked';
    }

    return { ...def, survey, done, allDone, live, status };
  });

  /* ── Handlers ───────────────────────────────────────────── */
  const handleStart = useCallback(async (step: WizardStep, sector?: string, cycleName?: string) => {
    if (submitLockRef.current) return;
    setStartErr('');

    let survey = step.survey;

    if (step.phase === 5 && sector) {
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
      // Priority: explicit cycleName → pendingDashCycle (from dashboard form) → activeCycleName
      const effectiveCycle = cycleName ?? pendingDashCycle ?? activeCycleName;
      if (pendingDashCycle) setPendingDashCycle(null); // consume it
      const attempt = await attemptAPI.startAttempt(survey.id, sector, effectiveCycle);
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
  }, [surveys, lang, router, activeCycleName, pendingDashCycle]);

  const handleContinue = useCallback((attempt: Attempt) => {
    router.push(`/questionnaire/${attempt.id}`);
  }, [router]);

  // Retry = start a fresh attempt for the same survey (no sector needed for 1-3)
  const handleRetry = useCallback((step: WizardStep) => {
    handleStart(step);
  }, [handleStart]);

  // New Cycle = show modal to name the cycle, then start GRI 1
  const handleNewCycle = useCallback(() => {
    setNewCycleName('');
    setShowNewCycleModal(true);
  }, []);

  const handleNewCycleConfirm = useCallback(async () => {
    const name = newCycleName.trim() || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    setShowNewCycleModal(false);
    const gri1Step = steps.find((s) => s.phase === 1);
    if (gri1Step) await handleStart(gri1Step, undefined, name);
  }, [newCycleName, steps, handleStart]);

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
        <div style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10, color: 'var(--ink-4)',
              letterSpacing: '0.14em', textTransform: 'uppercase',
              display: 'block', marginBottom: 10,
            }}>
              GRI v5 · {lang === 'tr' ? '5 Aşama' : '5 Phases'} · 330 Q
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
          {/* New Assessment Cycle — only shown when ALL 5 phases are completed */}
          {allDone && (
            <div style={{ flexShrink: 0 }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={handleNewCycle}
                disabled={starting}
                title={lang === 'tr' ? 'Tüm aşamalar için yeni bağımsız değerlendirme başlat' : 'Start a new independent assessment cycle for all phases'}
                style={{ whiteSpace: 'nowrap' }}
              >
                {lang === 'tr' ? '+ Yeni Döngü' : '+ New Cycle'}
              </button>
              <div style={{ marginTop: 4, fontSize: 10, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace", textAlign: 'center' }}>
                <a href="/history" style={{ color: 'inherit' }}>
                  {lang === 'tr' ? 'geçmişi gör' : 'view history'}
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Pending cycle banner — shown when arriving from Dashboard "New Assessment" form */}
        {pendingDashCycle && (
          <div style={{
            marginBottom: 16, padding: '12px 16px',
            background: '#F0F7F0', border: '1px solid var(--olive-deep)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 16 }}>✅</span>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--olive-deep)', marginBottom: 2 }}>
                {lang === 'tr' ? 'Yeni Döngü Hazır' : 'New Cycle Ready'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                &ldquo;{pendingDashCycle}&rdquo; — {lang === 'tr' ? 'Başlamak için Aşama 1\'e tıklayın' : 'click Start on Phase 1 to begin'}
              </div>
            </div>
          </div>
        )}

        {/* Current cycle label */}
        {activeCycleName && !pendingDashCycle && (
          <div style={{
            marginBottom: 24, padding: '8px 16px',
            background: 'var(--cream-deep)', border: '1px solid var(--line)',
            display: 'inline-flex', alignItems: 'center', gap: 10,
            fontFamily: "'IBM Plex Mono', monospace",
          }}>
            <span style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>
              {lang === 'tr' ? 'AKTİF DÖNGÜ' : 'ACTIVE CYCLE'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>{activeCycleName}</span>
          </div>
        )}

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
                {completedPhases} / 5 {lang === 'tr' ? 'aşama' : 'phases'}
              </span>
            </div>
            <div className="bar bar-olive">
              <span style={{ width: `${(completedPhases / 5) * 100}%`, transition: 'width 0.4s ease' }} />
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
              stepErr={step.phase === 5 && step.status === 'active' ? startErr : undefined}
            />
          ))}
        </div>

        {/* ── Total footer ─────────────────────────────────── */}
        <div style={{
          marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--line)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
            {lang === 'tr' ? 'Toplam 330 soru · Yönetişim + Çevre + Sosyal + Ekonomik + Sektör' : 'Total 330 questions · Governance + Environmental + Social + Economic + Sector'}
          </span>
          <a href="/history" style={{ textDecoration: 'none', fontSize: 11, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {lang === 'tr' ? 'Geçmiş' : 'History'} <Icon.arrow />
          </a>
        </div>
      </main>

      {/* ── New Cycle Modal ── */}
      {showNewCycleModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowNewCycleModal(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--paper)', border: '1px solid var(--line)',
              padding: '36px 40px', maxWidth: 440, width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }}
          >
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-4)', display: 'block', marginBottom: 14 }}>
              {lang === 'tr' ? 'Yeni Değerlendirme Döngüsü' : 'New Assessment Cycle'}
            </span>
            <h2 style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 8 }}>
              {lang === 'tr' ? 'Yeni döngüyü başlat' : 'Start a new cycle'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 24, lineHeight: 1.6 }}>
              {lang === 'tr'
                ? 'İsteğe bağlı: Bu döngüye bir isim verin. Boş bırakırsanız tarih otomatik atanır.'
                : 'Optional: give this cycle a name. Leave blank to use today\'s date automatically.'}
            </p>
            <input
              type="text"
              autoFocus
              value={newCycleName}
              onChange={(e) => setNewCycleName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNewCycleConfirm()}
              placeholder={lang === 'tr' ? 'örn. Q1 2026 (isteğe bağlı)' : 'e.g. Q1 2026 (optional)'}
              style={{
                width: '100%', padding: '11px 14px',
                border: '1px solid var(--line)', background: 'var(--cream)',
                fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13,
                outline: 'none', marginBottom: 20, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowNewCycleModal(false)}
              >
                {lang === 'tr' ? 'İptal' : 'Cancel'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleNewCycleConfirm}
                disabled={starting}
              >
                {starting ? (lang === 'tr' ? 'Açılıyor…' : 'Starting…') : (lang === 'tr' ? 'Başlat' : 'Start')} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
