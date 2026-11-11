'use client';
/* Assessment Centre (the Surveys page): manage assessment cycles and the five GRI phases.
   Every figure is read from the two requests this page has always made — GET /surveys/ and
   GET /attempts/my_attempts/ — and phase status comes from the shared, tested model in lib/dashboard-data.ts,
   so sequencing and locking are the same rules as before. Nothing here invents data. */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/AppNav';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { surveyAPI, attemptAPI } from '@/lib/api';
import { PHASES, buildModel, isInProgress, phaseOf } from '@/lib/dashboard-data';
import type { DashAttempt, PhaseState, PhaseStatus } from '@/lib/dashboard-data';
import { Ic } from '@/components/dashboard/icons';
import type { IconName } from '@/components/dashboard/icons';
import './surveys.css';

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
type Attempt = DashAttempt;

/** Titles and descriptions of the five GRI phases (order and survey-name keys come from PHASES). */
const PHASE_COPY: Record<number, { labelEn: string; labelTr: string; descEn: string; descTr: string }> = {
  1: { labelEn: 'Governance & Strategy',     labelTr: 'Yönetişim ve Strateji',
       descEn: 'Corporate governance, ethics, board oversight and strategic sustainability commitments (G1–G16)',
       descTr: 'Kurumsal yönetişim, etik, yönetim kurulu gözetimi ve stratejik sürdürülebilirlik taahhütleri (G1–G16)' },
  2: { labelEn: 'Environmental Performance', labelTr: 'Çevre Performansı',
       descEn: 'Climate, energy, water, biodiversity and circular economy (E1–E14)',
       descTr: 'İklim, enerji, su, biyoçeşitlilik ve döngüsel ekonomi (E1–E14)' },
  3: { labelEn: 'Social Performance',        labelTr: 'Sosyal Performans',
       descEn: 'Workforce, health & safety, community, human rights and diversity (S1–S24)',
       descTr: 'İşgücü, iş sağlığı güvenliği, toplum, insan hakları ve çeşitlilik (S1–S24)' },
  4: { labelEn: 'Economic Performance',      labelTr: 'Ekonomik Performans',
       descEn: 'Economic value, procurement, tax transparency and anti-corruption (EC1–EC9)',
       descTr: 'Ekonomik değer, tedarik, vergi şeffaflığı ve yolsuzlukla mücadele (EC1–EC9)' },
  5: { labelEn: 'Sector Standard',           labelTr: 'Sektör Standardı',
       descEn: 'Industry-specific sustainability topics for the sector you choose',
       descTr: 'Seçtiğiniz sektöre özgü sürdürülebilirlik konuları' },
};

const T = (lang: string, en: string, tr: string) => (lang === 'tr' ? tr : en);
const phaseTitle = (num: number, lang: string) => (lang === 'tr' ? PHASE_COPY[num].labelTr : PHASE_COPY[num].labelEn);
const fmtDate = (iso: string | null | undefined, lang: string) =>
  (iso ? new Date(iso).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const cycleLabel = (c: string | null | undefined, lang: string) => (c ? c : T(lang, 'Unnamed cycle', 'Adsız dönem'));
const surveyMatches = (s: Survey, key: string) => (s.name || '').includes(key) || (s.name_en || '').includes(key);
const qCount = (s: Survey | null | undefined) => (s && typeof s.question_count === 'number' ? s.question_count : null);

/** Grade letter exactly as returned by the API; colour family follows the app's gradeColor() rule (A / B / C / other). */
function GradeBadge({ grade }: { grade: string | null | undefined }) {
  const tone = !grade ? 'none' : grade.startsWith('A') ? 'a' : grade.startsWith('B') ? 'b' : grade.startsWith('C') ? 'c' : 'd';
  return <span className={`ac-gb is-${tone}`}>{grade || '—'}</span>;
}

function StatusChip({ status, lang }: { status: PhaseStatus | 'replaced'; lang: string }) {
  const map: Record<string, { label: string; icon?: IconName }> = {
    completed:   { label: T(lang, 'Completed', 'Tamamlandı'), icon: 'check' },
    in_progress: { label: T(lang, 'In Progress', 'Devam Ediyor') },
    available:   { label: T(lang, 'Ready', 'Hazır') },
    locked:      { label: T(lang, 'Locked', 'Kilitli'), icon: 'lock' },
    replaced:    { label: T(lang, 'Replaced', 'Yenilendi') },
  };
  const c = map[status];
  return <span className={`ac-chip c-${status}`}>{c.icon && <Ic name={c.icon} size={11} />}{c.label}</span>;
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
  // Pending cycle name set by the Dashboard / History "New Assessment" form
  const [pendingDashCycle, setPendingDashCycle] = useState<string | null>(null);
  // Cycle picked in the selector. null = default (pending new cycle if any, otherwise the most recent cycle).
  const [viewCycle, setViewCycle] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [showAllRows, setShowAllRows] = useState(false);
  // Phase shown in the detail panel under the journey. null = the active phase (in progress, else next ready).
  const [selNum, setSelNum] = useState<number | null>(null);
  const detailRef = useRef<HTMLElement>(null);

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
    // call setState on an already-unmounted component.
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

  /* ── Derived data ───────────────────────────────────────── */
  // Only attempts of the five GRI phases belong to this page (same name keys as before).
  const griAttempts = useMemo(() => attempts.filter((a) => phaseOf(a.survey_name) > 0), [attempts]);
  const all = useMemo(() => buildModel(griAttempts, surveys), [griAttempts, surveys]);

  // Active cycle = the cycle chosen in the selector; by default the pending new cycle (when the user arrived
  // from a "New Assessment" form) and otherwise the cycle of the most recent attempt — exactly as before.
  const pendingIsNew = pendingDashCycle !== null && !all.cycles.includes(pendingDashCycle);
  const activeCycleName = viewCycle !== null && (all.cycles.includes(viewCycle) || viewCycle === pendingDashCycle)
    ? viewCycle
    : pendingDashCycle !== null ? pendingDashCycle : all.latestCycle;
  const viewingPendingNew = pendingIsNew && activeCycleName === pendingDashCycle;

  // Phase states for the active cycle. A brand-new (not yet created) cycle has no attempts, so every phase
  // starts fresh: phase 1 ready, the rest locked.
  const cyc = useMemo(
    () => (viewingPendingNew ? buildModel([], surveys) : buildModel(griAttempts, surveys, activeCycleName)),
    [viewingPendingNew, griAttempts, surveys, activeCycleName],
  );

  const coreSurvey = useCallback((num: number): Survey | null => {
    const key = PHASES[num - 1].key;
    return num < 5 ? (surveys.find((s) => surveyMatches(s, key)) ?? null) : null;
  }, [surveys]);
  const sectorSurvey = useCallback((sector: string | null): Survey | null => {
    const def = SECTORS.find((s) => s.value === sector);
    return def ? (surveys.find((s) => surveyMatches(s, def.match)) ?? null) : null;
  }, [surveys]);
  // Sector assessments differ in length, so before a sector is chosen the honest figure is a range.
  const sectorRange = useMemo(() => {
    const counts = surveys.filter((s) => surveyMatches(s, PHASES[4].key)).map(qCount).filter((n): n is number => n !== null);
    return counts.length ? { min: Math.min(...counts), max: Math.max(...counts) } : null;
  }, [surveys]);

  /* ── Handlers ───────────────────────────────────────────── */
  const handleStart = useCallback(async (num: number, sector?: string, cycleName?: string) => {
    if (submitLockRef.current) return;
    setStartErr('');

    const survey = num === 5 ? sectorSurvey(sector ?? null) : coreSurvey(num);
    if (!survey) {
      setStartErr(lang === 'tr' ? 'Anket bulunamadı.' : 'Survey not found.');
      return;
    }

    submitLockRef.current = true;
    setStarting(true);
    try {
      // Priority: explicit cycleName (New Assessment modal) → the active cycle (pending new cycle or selected cycle)
      const effectiveCycle = cycleName ?? activeCycleName;
      if (pendingDashCycle !== null && effectiveCycle === pendingDashCycle) setPendingDashCycle(null); // consume it
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
  }, [coreSurvey, sectorSurvey, lang, router, activeCycleName, pendingDashCycle]);

  // New assessment = name a new cycle, then start phase 1 in it
  const handleNewCycle = useCallback(() => {
    setNewCycleName('');
    setShowNewCycleModal(true);
  }, []);

  const handleNewCycleConfirm = useCallback(async () => {
    const name = newCycleName.trim() || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    setShowNewCycleModal(false);
    await handleStart(1, undefined, name);
  }, [newCycleName, handleStart]);

  /* ── Loading ─────────────────────────────────────────────── */
  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
        <AppNav />
        <main className="wrap ac-main" aria-busy="true" aria-label={T(lang, 'Loading', 'Yükleniyor')}>
          <div className="ac-sk" style={{ height: 58, maxWidth: 380 }} />
          <div className="ac-sk" style={{ height: 250 }} />
          <div className="ac-sk" style={{ height: 220 }} />
          <div className="ac-kpis">{[0, 1, 2, 3].map((i) => <div key={i} className="ac-sk" style={{ height: 104 }} />)}</div>
        </main>
      </div>
    );
  }

  /* ── Figures (all from the loaded API data) ──────────────── */
  const total     = griAttempts.length;
  const completed = all.completedCount;
  const ongoing   = all.inProgressCount;
  const replaced  = total - completed - ongoing;       // completed earlier, superseded when the same assessment was completed again
  const allPhasesDone = cyc.phasesCompleted === PHASES.length;
  const livePhase = cyc.phases.find((p) => p.status === 'in_progress') ?? null;
  const focusNum  = (livePhase ?? cyc.phases.find((p) => p.status === 'available'))?.num ?? null;   // the card to emphasise

  const cycleOptions = [...(pendingIsNew ? [pendingDashCycle as string] : []), ...all.cycles];

  type Row = { a: Attempt; phase: number; status: 'completed' | 'in_progress' | 'replaced'; pct: number };
  const rows: Row[] = griAttempts.slice().sort((x, y) => y.id - x.id).map((a) => ({
    a, phase: phaseOf(a.survey_name),
    status: a.is_completed ? 'completed' : isInProgress(a) ? 'in_progress' : 'replaced',
    pct: a.total_questions > 0 ? Math.min(100, Math.round(((a.answered_count ?? 0) / a.total_questions) * 100)) : 0,
  }));
  const counts = { all: rows.length, completed: rows.filter((r) => r.status === 'completed').length, in_progress: rows.filter((r) => r.status === 'in_progress').length };
  const filtered = rows.filter((r) => filter === 'all' || r.status === filter);
  const visibleRows = showAllRows ? filtered : filtered.slice(0, 8);

  const latest = all.results.slice().reverse().slice(0, 3);      // most recent completed, scored results

  /* ── Per-phase facts shared by the journey tracker and the detail panel ── */
  const phaseInfo = (st: PhaseState) => {
    const num = st.num;
    const att = st.attempt;
    const isSector = num === 5;
    const locked = st.status === 'locked';
    const done = st.status === 'completed' ? att : null;
    const live = st.status === 'in_progress' ? att : null;
    const survey = isSector ? sectorSurvey(selectedSector) : coreSurvey(num);
    const prevDone = viewingPendingNew ? 0
      : griAttempts.filter((x) => x.is_completed && phaseOf(x.survey_name) === num && (x.cycle_name ?? '') === activeCycleName).length;
    const pct = st.status === 'completed' ? 100 : st.pct;
    // Question count: the attempt's own count once one exists, otherwise the survey's count from the API
    const questions = att ? `${att.total_questions}`
      : isSector ? (qCount(survey) !== null ? `${qCount(survey)}` : sectorRange ? (sectorRange.min === sectorRange.max ? `${sectorRange.min}` : `${sectorRange.min}–${sectorRange.max}`) : null)
      : (st.total !== null ? `${st.total}` : null);
    const canStartCore = !locked && !isSector && !!coreSurvey(num);
    return { num, att, isSector, locked, done, live, prevDone, pct, questions, canStartCore };
  };
  const startLabel = starting ? T(lang, 'Opening…', 'Açılıyor…') : T(lang, 'Start', 'Başla');
  // Default: the active phase; when every phase is done, the last one that has a result.
  const lastWithAttempt = cyc.phases.filter((p) => p.attempt).pop()?.num ?? 1;
  const selected = cyc.phases[(selNum ?? focusNum ?? lastWithAttempt) - 1];
  const selectPhase = (num: number, reveal = false) => {
    setSelNum(num);
    setStartErr('');
    if (reveal) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  /* ── One step of the connected journey ───────────────────── */
  const trackStep = (st: PhaseState) => {
    const { num, att, isSector, locked, done, live, pct, questions, canStartCore } = phaseInfo(st);
    const isSel = selected.num === num;
    return (
      <li key={num} className={`ac-step is-${st.status}${focusNum === num ? ' is-focus' : ''}${isSel ? ' is-sel' : ''}`} aria-current={focusNum === num ? 'step' : undefined}>
        <div className="ac-step-rail" aria-hidden="true">
          <span className="ac-step-node">{st.status === 'completed' ? <Ic name="check" size={17} /> : locked ? <Ic name="lock" size={15} /> : num}</span>
        </div>
        <button type="button" className="ac-step-body" aria-pressed={isSel} onClick={() => selectPhase(num)}
          title={T(lang, 'Show the details of this phase', 'Bu aşamanın ayrıntılarını göster')}>
          <span className="ac-step-eyebrow">{T(lang, 'Phase', 'Aşama')} {num}</span>
          <span className="ac-step-title">{phaseTitle(num, lang)}</span>
          <StatusChip status={st.status} lang={lang} />
          <span className="ac-step-prog">
            {done ? <><b>{(done.total_score ?? 0).toFixed(1)}%</b>{done.overall_grade ? <> · <b>{done.overall_grade}</b></> : null} · {att!.total_questions} {T(lang, 'questions', 'soru')}</>
              : live ? <><b>{st.answered} / {live.total_questions}</b> {T(lang, 'answered', 'cevaplandı')} · <b>{pct}%</b></>
              : <>{questions ?? '—'} {T(lang, 'questions', 'soru')}</>}
          </span>
          {live && <span className="ac-bar" role="img" aria-label={`${pct}%`}><span style={{ width: `${pct}%` }} /></span>}
        </button>
        <div className="ac-step-act">
          {done && <Link href={`/results/${done.id}`} className="ac-btn ac-btn-sm">{T(lang, 'View Results', 'Sonuçları Gör')} <Ic name="arrow" size={13} /></Link>}
          {live && (
            <button type="button" className="ac-btn ac-btn-sm ac-btn-primary" onClick={() => router.push(`/questionnaire/${live.id}`)} disabled={starting}>
              {T(lang, 'Continue', 'Devam Et')} <Ic name="arrow" size={13} />
            </button>
          )}
          {st.status === 'available' && !isSector && (
            <button type="button" className="ac-btn ac-btn-sm ac-btn-primary" onClick={() => handleStart(num)} disabled={starting || !canStartCore}>
              {startLabel} <Ic name="arrow" size={13} />
            </button>
          )}
          {st.status === 'available' && isSector && (
            <button type="button" className="ac-btn ac-btn-sm ac-btn-primary" onClick={() => selectPhase(num, true)}>
              {T(lang, 'Choose sector', 'Sektör seç')} <Ic name="arrow" size={13} />
            </button>
          )}
          {locked && (
            <span className="ac-step-locked"><Ic name="lock" size={12} />{T(lang, `After ${phaseTitle(num - 1, lang)}`, `${phaseTitle(num - 1, lang)} sonrası`)}</span>
          )}
        </div>
      </li>
    );
  };

  /* ── Detail panel of the selected phase ──────────────────── */
  const detailPanel = (st: PhaseState) => {
    const { num, att, isSector, locked, done, live, prevDone, pct, questions, canStartCore } = phaseInfo(st);
    const remaining = att ? Math.max(att.total_questions - (st.status === 'completed' ? att.total_questions : st.answered), 0) : null;
    return (
      <section ref={detailRef} className={`ac-card ac-detail is-${st.status}`} aria-labelledby="ac-detail-h" aria-live="polite">
        <div className="ac-detail-head">
          <span className="ac-detail-num" aria-hidden="true">{String(num).padStart(2, '0')}</span>
          <div className="ac-detail-title">
            <span className="ac-step-eyebrow">{focusNum === num ? T(lang, 'Active phase', 'Aktif aşama') : T(lang, 'Selected phase', 'Seçili aşama')} · {T(lang, 'Phase', 'Aşama')} {num} / {PHASES.length}</span>
            <h2 id="ac-detail-h" className="ac-h2">{phaseTitle(num, lang)}</h2>
          </div>
          <StatusChip status={st.status} lang={lang} />
        </div>
        <p className="ac-detail-desc">{lang === 'tr' ? PHASE_COPY[num].descTr : PHASE_COPY[num].descEn}</p>

        <dl className="ac-detail-facts">
          <div><dt>{T(lang, 'Questions', 'Soru')}</dt><dd>{questions ?? '—'}</dd></div>
          <div><dt>{T(lang, 'Answered', 'Cevaplanan')}</dt><dd>{att ? (st.status === 'completed' ? att.total_questions : st.answered) : 0}</dd></div>
          <div><dt>{T(lang, 'Remaining', 'Kalan')}</dt><dd>{remaining ?? questions ?? '—'}</dd></div>
          <div><dt>{T(lang, 'Completion', 'Tamamlanma')}</dt><dd>{pct}%</dd></div>
          {/* Score, grade and date only when a real result exists */}
          {done && <div><dt>{T(lang, 'Score', 'Skor')}</dt><dd>{(done.total_score ?? 0).toFixed(1)}%</dd></div>}
          {done && <div><dt>{T(lang, 'Grade', 'Not')}</dt><dd><GradeBadge grade={done.overall_grade} /></dd></div>}
          {done && <div><dt>{T(lang, 'Completed on', 'Tamamlanma tarihi')}</dt><dd className="is-text">{fmtDate(done.completed_at, lang)}</dd></div>}
          {live && <div><dt>{T(lang, 'Started', 'Başlangıç')}</dt><dd className="is-text">{fmtDate(live.started_at, lang)}</dd></div>}
        </dl>
        <div className="ac-bar ac-bar-lg" role="img" aria-label={`${pct}%`}><span style={{ width: `${pct}%` }} /></div>

        {st.superseded && !att && (
          <p className="ac-detail-note">{T(lang, 'This phase was completed earlier in this cycle; the result was replaced when the same assessment was completed again.', 'Bu aşama bu dönemde daha önce tamamlandı; aynı değerlendirme yeniden tamamlanınca sonuç yenilendi.')}</p>
        )}
        {startErr && <p className="ac-banner is-bad" role="alert"><Ic name="info" size={15} /><span>{startErr}</span></p>}

        <div className="ac-detail-actions">
          {locked && (
            <p className="ac-detail-locked"><Ic name="lock" size={14} />{T(lang, `Unlocks after ${phaseTitle(num - 1, lang)} is completed.`, `${phaseTitle(num - 1, lang)} tamamlanınca açılır.`)}</p>
          )}

          {live && (
            <button type="button" className="ac-btn ac-btn-primary" onClick={() => router.push(`/questionnaire/${live.id}`)} disabled={starting}>
              {T(lang, 'Continue', 'Devam Et')} <Ic name="arrow" size={14} />
            </button>
          )}
          {done && (
            <Link href={`/results/${done.id}`} className={`ac-btn${isSector ? '' : ' ac-btn-primary'}`}>{T(lang, 'View Results', 'Sonuçları Gör')} <Ic name="arrow" size={14} /></Link>
          )}
          {st.status === 'available' && !isSector && (
            <button type="button" className="ac-btn ac-btn-primary" onClick={() => handleStart(num)} disabled={starting || !canStartCore}>
              {startLabel} <Ic name="arrow" size={14} />
            </button>
          )}
          {st.status === 'available' && !isSector && !canStartCore && (
            <span className="ac-detail-hint">{T(lang, 'Survey data not loaded yet.', 'Anket verisi henüz yüklenmedi.')}</span>
          )}

          {/* Sector phase: choose the sector, then start (available whenever the phase is unlocked, as before) */}
          {!locked && isSector && (
            <>
              <label className="ac-sector">
                <span>{T(lang, 'Choose your sector', 'Sektörünüzü seçin')}</span>
                <select value={selectedSector ?? ''} onChange={(e) => { setSelectedSector(e.target.value || null); setStartErr(''); }}>
                  <option value="">{T(lang, 'Select a sector…', 'Sektör seçin…')}</option>
                  {SECTORS.map((sc) => <option key={sc.value} value={sc.value}>{lang === 'tr' ? sc.tr : sc.en}</option>)}
                </select>
              </label>
              <button type="button" className={`ac-btn${done || live ? '' : ' ac-btn-primary'}`} onClick={() => selectedSector && handleStart(num, selectedSector)} disabled={starting || selectedSector === null}>
                {done || live ? (starting ? startLabel : T(lang, 'Start selected sector', 'Seçili sektörü başlat')) : startLabel} <Ic name="arrow" size={14} />
              </button>
              {selectedSector === null && <span className="ac-detail-hint">{T(lang, 'Select a sector to continue.', 'Devam etmek için sektör seçin.')}</span>}
            </>
          )}

          {/* Completed core phase: a new attempt can be started alongside the results, as before */}
          {done && canStartCore && (
            <button type="button" className="ac-btn" onClick={() => handleStart(num)} disabled={starting}>
              <Ic name="plus" size={13} />{starting ? T(lang, 'Opening…', 'Açılıyor…') : T(lang, 'New attempt', 'Yeni deneme')}
            </button>
          )}
          {done && prevDone > 1 && <Link href="/history" className="ac-linkbtn">+{prevDone - 1} {T(lang, 'previous', 'önceki')} <Ic name="arrow" size={13} /></Link>}
        </div>
      </section>
    );
  };

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <AppNav />

      <main className="wrap ac-main">

        {/* ── Page header ─────────────────────────────────── */}
        <header className="ac-top">
          <div className="ac-top-main">
            <h1 className="ac-title">{T(lang, 'Assessment Centre', 'Değerlendirme Merkezi')}</h1>
            <p className="ac-subtitle">{T(lang, 'Manage your organization’s sustainability assessments.', 'Kuruluşunuzun sürdürülebilirlik değerlendirmelerini yönetin.')}</p>
          </div>
          <div className="ac-top-side">
            {cycleOptions.length > 0 && (
              <label className="ac-cycle">
                <Ic name="calendar" size={15} />
                <span>{T(lang, 'Assessment cycle', 'Değerlendirme dönemi')}</span>
                <select value={activeCycleName} onChange={(e) => { setViewCycle(e.target.value); setSelNum(null); }} aria-label={T(lang, 'Assessment cycle', 'Değerlendirme dönemi')}>
                  {cycleOptions.map((c) => (
                    <option key={c || '__none'} value={c}>
                      {cycleLabel(c, lang)}
                      {pendingIsNew && c === pendingDashCycle ? T(lang, ' (new)', ' (yeni)') : c === all.latestCycle && cycleOptions.length > 1 ? T(lang, ' (current)', ' (güncel)') : ''}
                    </option>
                  ))}
                </select>
                <Ic name="chevron" size={14} className="ac-cycle-chev" />
              </label>
            )}
            <Link href="/history" className="ac-btn"><Ic name="clock" size={14} />{T(lang, 'Assessment History', 'Değerlendirme Geçmişi')}</Link>
            <button type="button" className="ac-btn ac-btn-primary" onClick={handleNewCycle} disabled={starting}
              title={T(lang, 'Start a new independent assessment cycle for all phases', 'Tüm aşamalar için yeni bağımsız değerlendirme başlat')}>
              <Ic name="plus" size={14} />{T(lang, 'New Assessment', 'Yeni Değerlendirme')}
            </button>
          </div>
        </header>

        {/* Pending cycle banner — shown when arriving from a "New Assessment" form */}
        {viewingPendingNew && (
          <p className="ac-banner is-ok" role="status">
            <Ic name="check" size={15} />
            <span><b>{T(lang, 'New cycle ready', 'Yeni dönem hazır')}:</b> “{pendingDashCycle}” — {T(lang, 'select Start on Phase 1 to begin.', 'başlamak için Aşama 1’de Başla’yı seçin.')}</span>
          </p>
        )}
        {!viewingPendingNew && activeCycleName !== all.latestCycle && all.cycles.length > 1 && (
          <p className="ac-banner" role="status">
            <Ic name="info" size={15} />
            <span>{T(lang, `You are viewing the “${cycleLabel(activeCycleName, lang)}” cycle. Phases started here are added to this cycle.`, `“${cycleLabel(activeCycleName, lang)}” dönemini görüntülüyorsunuz. Burada başlatılan aşamalar bu döneme eklenir.`)}</span>
            <button type="button" className="ac-linkbtn" onClick={() => { setViewCycle(null); setSelNum(null); }}>{T(lang, 'Back to current cycle', 'Güncel döneme dön')}</button>
          </p>
        )}

        {loadErr && (
          <div className="ac-banner is-bad" role="alert">
            <Ic name="info" size={15} />
            <span>{T(lang, 'Failed to load.', 'Yüklenemedi.')}</span>
            <button type="button" className="ac-btn ac-btn-sm" onClick={() => window.location.reload()}>{T(lang, 'Retry', 'Tekrar Dene')}</button>
          </div>
        )}

        {/* ── GRI assessment journey: the connected five-phase process ── */}
        <section className="ac-card ac-journey" aria-labelledby="ac-journey-h">
          <div className="ac-journey-head">
            <div>
              <h2 id="ac-journey-h" className="ac-h2">{T(lang, 'GRI Assessment Journey', 'GRI Değerlendirme Yolculuğu')}</h2>
              <p className="ac-sub">{T(lang, 'Complete each phase in order. The next phase unlocks when you finish the previous one.', 'Her aşamayı sırayla tamamlayın. Bir sonraki aşama, bir öncekini bitirdikten sonra açılır.')}</p>
            </div>
            <span className="ac-journey-count"><b>{cyc.phasesCompleted} / {PHASES.length}</b> {T(lang, 'phases completed', 'aşama tamamlandı')}{activeCycleName ? ` · ${activeCycleName}` : ''}</span>
          </div>
          <ol className="ac-track">{cyc.phases.map(trackStep)}</ol>
        </section>

        {allPhasesDone && (
          <p className="ac-banner is-ok ac-banner-gap" role="status">
            <Ic name="check" size={15} />
            <span><b>{T(lang, 'All phases completed.', 'Tüm aşamalar tamamlandı.')}</b> {T(lang, 'You can view your results or start again.', 'Sonuçlarınızı görüntüleyebilir veya tekrar başlayabilirsiniz.')}</span>
            <Link href="/history" className="ac-btn ac-btn-sm">{T(lang, 'View History', 'Geçmişi Görüntüle')} <Ic name="arrow" size={13} /></Link>
          </p>
        )}

        {/* ── Selected phase details + latest results ─────── */}
        <div className="ac-mid">
          {detailPanel(selected)}
        <section className="ac-card ac-latest" aria-labelledby="ac-latest-h">
          <div className="ac-card-head">
            <div>
              <h2 id="ac-latest-h" className="ac-h2">{T(lang, 'Latest Results', 'Son Sonuçlar')}</h2>
              <p className="ac-sub">{T(lang, 'Most recent completed assessments.', 'En son tamamlanan değerlendirmeler.')}</p>
            </div>
          </div>
          {latest.length === 0 ? (
            <div className="ac-empty">
              <Ic name="chart" size={22} />
              <p>{T(lang, 'No results yet. Complete a phase to see its score, grade and report here.', 'Henüz sonuç yok. Skorunu, notunu ve raporunu burada görmek için bir aşamayı tamamlayın.')}</p>
            </div>
          ) : (
            <ul className="ac-results">
              {latest.map((r, i) => (
                <li key={r.id} className={i === 0 ? 'is-first' : ''}>
                  <GradeBadge grade={r.grade} />
                  <div className="ac-result-main">
                    <b>{phaseTitle(r.phase, lang)}</b>
                    <small>{T(lang, 'Completed', 'Tamamlandı')} {fmtDate(r.iso, lang)}{r.cycle ? ` · ${r.cycle}` : ''}</small>
                  </div>
                  <span className="ac-result-score">{r.score.toFixed(1)}<small>%</small></span>
                  <Link href={`/results/${r.id}`} className="ac-rowbtn">{T(lang, 'View Report', 'Raporu Gör')} <Ic name="arrow" size={13} /></Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>

        {/* ── Overview KPIs ───────────────────────────────── */}
        <section className="ac-kpis" aria-label={T(lang, 'Assessment overview', 'Değerlendirme özeti')}>
          <article className="ac-card ac-kpi">
            <div className="ac-kpi-head"><span className="ac-kpi-ic"><Ic name="layers" /></span><span>{T(lang, 'Total Assessments', 'Toplam Değerlendirme')}</span></div>
            <div className="ac-kpi-val">{total}</div>
            {total > 0 ? (
              <div className="ac-split" role="img" aria-label={T(lang, `${completed} completed, ${ongoing} in progress, ${replaced} replaced`, `${completed} tamamlandı, ${ongoing} devam ediyor, ${replaced} yenilendi`)}>
                {completed > 0 && <i className="s-done" style={{ flexGrow: completed }} />}
                {ongoing > 0 && <i className="s-live" style={{ flexGrow: ongoing }} />}
                {replaced > 0 && <i className="s-old" style={{ flexGrow: replaced }} />}
              </div>
            ) : <div className="ac-split" />}
            <p className="ac-kpi-note">
              {total === 0 ? T(lang, 'No assessments yet', 'Henüz değerlendirme yok')
                : replaced > 0 ? T(lang, `Includes ${replaced} replaced by newer results`, `${replaced} tanesi yeni sonuçlarla yenilendi`)
                : T(lang, `Across ${all.cycles.length} cycle${all.cycles.length === 1 ? '' : 's'}`, `${all.cycles.length} dönemde`)}
            </p>
          </article>

          <article className="ac-card ac-kpi">
            <div className="ac-kpi-head"><span className="ac-kpi-ic is-done"><Ic name="check" /></span><span>{T(lang, 'Completed', 'Tamamlanan')}</span></div>
            <div className="ac-kpi-val">{completed}</div>
            <p className="ac-kpi-note">
              {all.latestResult
                ? T(lang, `Latest: ${phaseTitle(all.latestResult.phase, lang)} · ${fmtDate(all.latestResult.iso, lang)}`, `Son: ${phaseTitle(all.latestResult.phase, lang)} · ${fmtDate(all.latestResult.iso, lang)}`)
                : T(lang, 'No completed assessment yet', 'Henüz tamamlanan değerlendirme yok')}
            </p>
          </article>

          <article className="ac-card ac-kpi">
            <div className="ac-kpi-head"><span className="ac-kpi-ic is-live"><Ic name="play" /></span><span>{T(lang, 'In Progress', 'Devam Eden')}</span></div>
            <div className="ac-kpi-val">{ongoing}</div>
            <p className="ac-kpi-note">
              {livePhase && livePhase.attempt
                ? T(lang, `${phaseTitle(livePhase.num, lang)} · ${livePhase.answered} of ${livePhase.attempt.total_questions} answered`, `${phaseTitle(livePhase.num, lang)} · ${livePhase.attempt.total_questions} sorudan ${livePhase.answered}`)
                : ongoing > 0 ? T(lang, 'In another cycle', 'Başka bir dönemde') : T(lang, 'Nothing in progress', 'Devam eden yok')}
            </p>
          </article>

          <article className="ac-card ac-kpi ac-kpi-ring">
            <div>
              <div className="ac-kpi-head"><span className="ac-kpi-ic"><Ic name="target" /></span><span>{T(lang, 'Overall Completion', 'Genel Tamamlanma')}</span></div>
              <div className="ac-kpi-val">{cyc.completionPct}<small>%</small></div>
              <p className="ac-kpi-note">{T(lang, `${cyc.phasesCompleted} of ${PHASES.length} phases`, `${PHASES.length} aşamadan ${cyc.phasesCompleted}`)}{activeCycleName ? ` · ${activeCycleName}` : ''}</p>
            </div>
            <svg className="ac-ring" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="27" fill="none" stroke="var(--cream-deep)" strokeWidth="7" />
              {cyc.completionPct > 0 && (
                <circle cx="32" cy="32" r="27" fill="none" stroke="var(--olive-deep)" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={`${(cyc.completionPct / 100) * 2 * Math.PI * 27} ${2 * Math.PI * 27}`} transform="rotate(-90 32 32)" />
              )}
            </svg>
          </article>
        </section>

        {/* ── Assessment history (full width) ─────────────── */}
        <section className="ac-card ac-history" aria-labelledby="ac-history-h">
          <div className="ac-card-head">
            <div>
              <h2 id="ac-history-h" className="ac-h2">{T(lang, 'Assessment History', 'Değerlendirme Geçmişi')}</h2>
              <p className="ac-sub">{T(lang, 'Every assessment record, newest first.', 'Tüm değerlendirme kayıtları, en yeni önce.')}</p>
            </div>
            <div className="ac-seg" role="tablist" aria-label={T(lang, 'Filter assessments', 'Değerlendirmeleri filtrele')}>
              {(['all', 'completed', 'in_progress'] as const).map((f) => (
                <button key={f} type="button" role="tab" aria-selected={filter === f} className={filter === f ? 'is-on' : ''} onClick={() => { setFilter(f); setShowAllRows(false); }}>
                  {f === 'all' ? T(lang, 'All', 'Tümü') : f === 'completed' ? T(lang, 'Completed', 'Tamamlanan') : T(lang, 'In Progress', 'Devam Eden')} <small>{counts[f]}</small>
                </button>
              ))}
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="ac-empty">
              <Ic name="clipboard" size={22} />
              <p>{T(lang, 'No assessments yet. Start Phase 1 to create your first record.', 'Henüz değerlendirme yok. İlk kaydınızı oluşturmak için Aşama 1’i başlatın.')}</p>
            </div>
          ) : (
            <div className="ac-tbl" role="table" aria-label={T(lang, 'Assessment history', 'Değerlendirme geçmişi')}>
              <div className="ac-tr is-head" role="row">
                <span role="columnheader">{T(lang, 'Assessment', 'Değerlendirme')}</span>
                <span role="columnheader">{T(lang, 'Cycle', 'Dönem')}</span>
                <span role="columnheader">{T(lang, 'Created', 'Oluşturulma')}</span>
                <span role="columnheader">{T(lang, 'Completed on', 'Tamamlanma')}</span>
                <span role="columnheader">{T(lang, 'Completion', 'İlerleme')}</span>
                <span role="columnheader">{T(lang, 'Status', 'Durum')}</span>
                <span role="columnheader" className="c-act">{T(lang, 'Actions', 'İşlemler')}</span>
              </div>
              {visibleRows.length === 0 && <p className="ac-empty-row">{T(lang, 'Nothing to show for this filter.', 'Bu filtre için gösterilecek bir şey yok.')}</p>}
              {visibleRows.map(({ a, phase, status, pct }) => (
                <div key={a.id} className="ac-tr" role="row">
                  <span role="cell" className="c-name">
                    <b>{phaseTitle(phase, lang)}</b>
                    <small>{a.survey_name}</small>
                  </span>
                  <span role="cell" className="c-cycle" data-label={T(lang, 'Cycle', 'Dönem')}>{cycleLabel(a.cycle_name, lang)}</span>
                  <span role="cell" className="c-created" data-label={T(lang, 'Created', 'Oluşturulma')}>{fmtDate(a.started_at, lang)}</span>
                  <span role="cell" className="c-done" data-label={T(lang, 'Completed on', 'Tamamlanma')}>{fmtDate(a.completed_at, lang)}</span>
                  <span role="cell" className="c-prog" data-label={T(lang, 'Completion', 'İlerleme')}>
                    <span className="ac-prog">
                      <span className={`ac-bar is-${status}`}><span style={{ width: `${pct}%` }} /></span>
                      <b>{pct}%</b>
                    </span>
                    <small>
                      {a.answered_count ?? 0}/{a.total_questions}
                      {status === 'completed' && typeof a.total_score === 'number' && <span title={T(lang, 'Score and grade', 'Skor ve not')}> · {a.total_score.toFixed(1)}%{a.overall_grade ? ` · ${a.overall_grade}` : ''}</span>}
                    </small>
                  </span>
                  <span role="cell" className="c-status"><StatusChip status={status} lang={lang} /></span>
                  <span role="cell" className="c-act">
                    {status === 'completed'
                      ? <Link href={`/results/${a.id}`} className="ac-rowbtn">{T(lang, 'View Results', 'Sonuçları Gör')} <Ic name="arrow" size={13} /></Link>
                      : <Link href={`/questionnaire/${a.id}`} className="ac-rowbtn">{status === 'in_progress' ? T(lang, 'Continue', 'Devam Et') : T(lang, 'Open', 'Aç')} <Ic name="arrow" size={13} /></Link>}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="ac-card-foot">
            {filtered.length > 8
              ? <button type="button" className="ac-linkbtn" onClick={() => setShowAllRows((v) => !v)}>{showAllRows ? T(lang, 'Show fewer', 'Daha az göster') : `${T(lang, 'Show all', 'Tümünü göster')} (${filtered.length})`}</button>
              : <span>{filtered.length} {T(lang, filtered.length === 1 ? 'record' : 'records', 'kayıt')}</span>}
            <Link href="/history" className="ac-linkbtn">{T(lang, 'Open full history', 'Tüm geçmişi aç')} <Ic name="arrow" size={13} /></Link>
          </div>
        </section>
      </main>

      {/* ── New assessment (new cycle) modal ── */}
      {showNewCycleModal && (
        <div className="ac-modal-back" onClick={() => setShowNewCycleModal(false)}>
          <div className="ac-modal" role="dialog" aria-modal="true" aria-labelledby="ac-modal-h" onClick={(e) => e.stopPropagation()}>
            <span className="ac-modal-eyebrow">{T(lang, 'New Assessment Cycle', 'Yeni Değerlendirme Dönemi')}</span>
            <h2 id="ac-modal-h">{T(lang, 'Start a new cycle', 'Yeni dönemi başlat')}</h2>
            <p>
              {T(lang,
                'Optional: give this cycle a name. Leave blank to use today’s date automatically. Phase 1 opens as soon as you start.',
                'İsteğe bağlı: Bu döneme bir isim verin. Boş bırakırsanız tarih otomatik atanır. Başlattığınızda Aşama 1 açılır.')}
            </p>
            <input
              type="text"
              autoFocus
              value={newCycleName}
              onChange={(e) => setNewCycleName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNewCycleConfirm(); if (e.key === 'Escape') setShowNewCycleModal(false); }}
              placeholder={T(lang, 'e.g. Q1 2026 (optional)', 'örn. Q1 2026 (isteğe bağlı)')}
              aria-label={T(lang, 'Cycle name', 'Dönem adı')}
            />
            <div className="ac-modal-actions">
              <button type="button" className="ac-btn" onClick={() => setShowNewCycleModal(false)}>{T(lang, 'Cancel', 'İptal')}</button>
              <button type="button" className="ac-btn ac-btn-primary" onClick={handleNewCycleConfirm} disabled={starting}>
                {starting ? T(lang, 'Starting…', 'Açılıyor…') : T(lang, 'Start', 'Başlat')} <Ic name="arrow" size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
