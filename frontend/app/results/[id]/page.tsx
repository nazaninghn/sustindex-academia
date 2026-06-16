'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppNav from '@/components/AppNav';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/shared';
import { attemptAPI, documentDownloadUrl, actionTaskAPI } from '@/lib/api';
// Fix M-04/M-05: import gradeColor and priorityColor from the single source of
// truth in utils.ts so colours are consistent across dashboard, history, and
// results pages, and so Turkish priority labels ('Yüksek' etc.) are handled.
import { sanitizeHtml, gradeColor, priorityColor } from '@/lib/utils';

/* ─── Colour helpers (page-specific — not in shared utils) ── */
function scoreColor(pct: number): string {
  if (pct >= 80) return 'var(--olive-deep)';
  if (pct >= 60) return '#4a7c6f';
  if (pct >= 40) return 'var(--amber)';
  if (pct >= 20) return '#e07b39';
  return 'var(--danger)';
}
function scoreLabel(pct: number, lang: string): string {
  if (pct >= 80) return lang === 'tr' ? 'Mükemmel' : 'Excellent';
  if (pct >= 60) return lang === 'tr' ? 'İyi' : 'Good';
  if (pct >= 40) return lang === 'tr' ? 'Gelişiyor' : 'Developing';
  if (pct >= 20) return lang === 'tr' ? 'Başlangıç' : 'Initial';
  return lang === 'tr' ? 'Kritik' : 'Critical';
}
function effortColor(e: string): string {
  if (e === 'Low')    return 'var(--olive-deep)';
  if (e === 'Medium') return 'var(--amber)';
  if (e === 'High')   return 'var(--danger)';
  // Fix R5-M-05: unknown/future effort values return neutral grey instead of
  // misleadingly rendering as danger-red.
  return 'var(--ink-3)';
}
// Fix M-05: removed local priorityColor — imported from utils.ts above.
// The local version only handled English labels; utils.ts also matches Turkish
// ('Yüksek', 'Orta') via case-insensitive substring matching.

/* ─── Types ─────────────────────────────────────────────── */
interface CategoryScore {
  id: number; key: string; name: string;
  score: number; max_score: number; percentage: number;
}
interface Recommendation {
  category: string; priority: string;
  gri_standard?: string; title?: string; description?: string;
  quick_win?: string; timeline_days?: number; effort?: string;
  score_pct?: number;
  /* legacy */
  suggestion?: string; text?: string; recommendation?: string;
}
interface AnswerDoc { id: number; title: string; file: string; file_size_display?: string }
interface AttemptAnswer {
  id: number; question: number; question_text: string;
  choice_text?: string; choices_display?: string;
  notes?: string; documents?: AnswerDoc[];
}
interface PillarScores { environmental: number; social: number; governance: number }
interface Maturity     { label: string; narrative: string }
interface Attempt {
  id: number; is_completed: boolean; completed_at: string | null;
  total_score: number; overall_grade: string;
  survey_name: string; user_name: string; session_name?: string;
  category_scores: CategoryScore[]; recommendations: Recommendation[];
  answers: AttemptAnswer[];
  pillar_scores?: PillarScores;
  maturity?: Maturity;
  answered_count?: number;
  total_questions?: number;
}

/* ─── Score Ring ─────────────────────────────────────────── */
function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 52, cx = 64, cy = 64, stroke = 6;
  const circ = 2 * Math.PI * r;
  const dash  = (score / 100) * circ;
  const color = gradeColor(grade);
  return (
    <svg width={136} height={136} viewBox="0 0 128 128">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round" transform="rotate(-90 64 64)"
        style={{ transition: 'stroke-dasharray 1.2s ease' }}
      />
      <text x={cx} y={cy - 4} textAnchor="middle"
        fontFamily="'IBM Plex Sans', sans-serif" fontWeight="300" fontSize="30"
        letterSpacing="-2" fill="var(--ink)">{score}</text>
      {/* Fix L-4: IBM Plex Mono should fall back to monospace, not sans-serif */}
      <text x={cx} y={cy + 16} textAnchor="middle"
        fontFamily="'IBM Plex Mono', monospace" fontWeight="700" fontSize="14"
        fill={color}>{grade}</text>
    </svg>
  );
}

/* ─── Mini gauge bar ─────────────────────────────────────── */
function MiniGauge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
        {/* Fix L-19: cap displayed value at 100 to match the bar cap — prevents "102" label with a maxed-out bar */}
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 12, color }}>{Math.min(Math.round(value), 100)}</span>
      </div>
      <div style={{ height: 4, background: 'var(--line)', borderRadius: 2 }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 1s ease' }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Results Page
   ═══════════════════════════════════════════════════════════ */
export default function ResultsPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { lang, t } = useLang();
  const { user, isLoading: authLoading } = useAuth();

  // Fix #27: keep a ref so async callbacks always read the latest lang
  // without re-running the fetch effect on every language change.
  const langRef = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);

  const [attempt,    setAttempt]    = useState<Attempt | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [tab,        setTab]        = useState<'overview' | 'actions' | 'evidence'>('overview');
  /** When true, all tab panels render simultaneously so window.print() captures everything */
  const [isPrinting, setIsPrinting] = useState(false);
  /** Set of recommendation indices that have been added to the action plan */
  const [trackedRecs, setTrackedRecs] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !id) return;
    const controller = new AbortController();
    // Fix HIGH-06: pass controller.signal so the request is cancelled when the
    // component unmounts, preventing setState calls on an already-unmounted component.
    attemptAPI.getAttempt(Number(id), controller.signal)
      .then((data: Attempt) => {
        if (!controller.signal.aborted) setAttempt(data);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // Fix EH-4: differentiate HTTP error codes so the user knows what went wrong.
        const httpStatus = (err as { response?: { status?: number } })?.response?.status;
        if (httpStatus === 403) {
          setFetchError(langRef.current === 'tr'
            ? 'Bu değerlendirmeye erişim yetkiniz yok.'
            : "You don't have access to this assessment.");
        } else if (httpStatus === 404) {
          setFetchError(langRef.current === 'tr'
            ? 'Değerlendirme bulunamadı.'
            : 'Assessment not found.');
        } else {
          setFetchError(langRef.current === 'tr'
            ? 'Sonuçlar yüklenemedi. Bağlantınızı kontrol edin.'
            : 'Failed to load results. Check your connection.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  useEffect(() => {
    if (!loading && attempt && !attempt.is_completed) {
      router.replace(`/questionnaire/${id}`);
    }
  }, [loading, attempt, id, router]);

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>
          {/* Fix R9-06: use shared i18n key — consistent with all other app pages */}
          {t('t_loading_auth')}
        </span>
      </div>
    );
  }
  if (!attempt) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 13, color: fetchError ? 'var(--danger)' : 'var(--ink-3)' }}>
          {fetchError || (lang === 'tr' ? 'Değerlendirme bulunamadı.' : 'Assessment not found.')}
        </p>
        <Link href="/history" style={{ textDecoration: 'none' }}>
          <button className="btn btn-outline">{lang === 'tr' ? '← Geçmişe Dön' : '← Back to History'}</button>
        </Link>
      </div>
    );
  }
  if (!attempt.is_completed) return null;

  const score       = Math.round(attempt.total_score ?? 0);
  const grade       = attempt.overall_grade ?? '—';
  const categories  = attempt.category_scores ?? [];
  const recs        = attempt.recommendations ?? [];
  const answersArr  = attempt.answers ?? [];
  const pillars     = attempt.pillar_scores;
  const maturity    = attempt.maturity;
  const answeredCnt = attempt.answered_count ?? answersArr.length;
  const totalQ      = attempt.total_questions ?? 0;
  const companyName = (user as { company_name?: string; username?: string })?.company_name || user?.username || '';
  const surveyName  = attempt.survey_name || (lang === 'tr' ? 'ESG Değerlendirmesi' : 'ESG Assessment');
  const completedAt = attempt.completed_at
    ? new Date(attempt.completed_at).toLocaleDateString(
        lang === 'tr' ? 'tr-TR' : 'en-GB',
        { day: 'numeric', month: 'long', year: 'numeric' }
      )
    : '—';

  const evidenceAnswers = answersArr.filter((a) => a.notes || (a.documents?.length ?? 0) > 0);
  // Normalise to lowercase for comparison so the filter works regardless of
  // whether the API returns 'High', 'HIGH', or localised 'Yüksek' etc.
  const highPriorityRecs = recs.filter((r) => r.priority?.toLowerCase() === 'high');
  const mediumRecs       = recs.filter((r) => r.priority?.toLowerCase() === 'medium');
  const lowRecs          = recs.filter((r) => r.priority?.toLowerCase() === 'low');

  /* ── Pillar label helper ── */
  const pillarLabel = (key: string) => {
    const labels: Record<string, Record<string, string>> = {
      environmental: { en: 'Environmental', tr: 'Çevre' },
      social:        { en: 'Social',        tr: 'Sosyal' },
      governance:    { en: 'Governance',    tr: 'Yönetişim' },
    };
    return labels[key]?.[lang] ?? key;
  };
  // Fix M-04: use CSS variables instead of hardcoded hex so pillar colours
  // stay in sync with the design token system and respect theme overrides.
  const pillarColor = (key: string) => {
    if (key === 'environmental') return 'var(--olive-deep)';
    if (key === 'social')        return 'var(--olive)';
    return 'var(--ink-2)';
  };

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="no-print"><AppNav /></div>

      <main className="wrap" style={{ padding: '32px 32px 80px', maxWidth: 900 }}>

        {/* ── Toolbar ── */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <Link href="/dashboard" style={{ textDecoration: 'none', fontSize: 11, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            ← {lang === 'tr' ? 'Panele Dön' : 'Back to Dashboard'}
          </Link>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/action-plan" style={{ textDecoration: 'none' }}>
              <button className="btn btn-outline btn-sm">
                📋 {lang === 'tr' ? 'Aksiyon Planı' : 'Action Plan'}
              </button>
            </Link>
            <Link href="/surveys" style={{ textDecoration: 'none' }}>
              <button className="btn btn-outline btn-sm">
                {lang === 'tr' ? 'Yeni Değerlendirme' : 'New Assessment'} <Icon.plus />
              </button>
            </Link>
            {/* Email report link — opens default mail client with pre-filled subject/body */}
            {attempt && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  const subject = encodeURIComponent(
                    lang === 'tr'
                      ? `GRI Sürdürülebilirlik Raporu — ${attempt.survey_name} — ${Math.round(attempt.total_score || 0)}%`
                      : `GRI Sustainability Report — ${attempt.survey_name} — ${Math.round(attempt.total_score || 0)}%`
                  );
                  const url    = `${window.location.origin}/results/${id}`;
                  const body   = encodeURIComponent(
                    lang === 'tr'
                      ? `Merhaba,\n\nSürdürülebilirlik değerlendirme raporum ile paylaşmak istedim.\n\nAnket: ${attempt.survey_name}\nPuan: ${Math.round(attempt.total_score || 0)}%  |  Not: ${attempt.overall_grade}\n\nRaporu görüntülemek için:\n${url}\n\nİyi çalışmalar.`
                      : `Hello,\n\nI wanted to share my sustainability assessment report with you.\n\nSurvey: ${attempt.survey_name}\nScore: ${Math.round(attempt.total_score || 0)}%  |  Grade: ${attempt.overall_grade}\n\nView the full report:\n${url}\n\nBest regards.`
                  );
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                }}
              >
                ✉ {lang === 'tr' ? 'E-posta ile Paylaş' : 'Share via Email'}
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                // Set isPrinting so React renders all tab panels into the DOM,
                // then wait two animation frames for the paint to complete before
                // opening the print dialog.  afterprint restores the single-tab view.
                setIsPrinting(true);
                const cleanup = () => {
                  setIsPrinting(false);
                  window.removeEventListener('afterprint', cleanup);
                };
                window.addEventListener('afterprint', cleanup);
                requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
              }}
            >
              <Icon.download /> {lang === 'tr' ? 'Yazdır / PDF Kaydet' : 'Print / Save as PDF'}
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════
            REPORT HEADER
            ══════════════════════════════════════ */}
        <div className="print-section" style={{
          borderTop: '3px solid var(--ink)', paddingTop: 28, paddingBottom: 32,
          marginBottom: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>
            {/* Left: metadata */}
            <div style={{ flex: 1 }}>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)',
                letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 14,
              }}>
                REF-{String(attempt.id).padStart(4, '0')} · {completedAt} · SustIndex GRI Framework
              </span>
              <h1 style={{ fontSize: 26, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 10 }}>
                {lang === 'tr' ? 'ESG Yetkinlik Değerlendirme Raporu' : 'ESG Competency Assessment Report'}
                {companyName && (
                  <>
                    <br />
                    <em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500, fontSize: 18 }}>
                      {companyName}
                    </em>
                  </>
                )}
              </h1>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                  <strong style={{ color: 'var(--ink)' }}>{lang === 'tr' ? 'Anket:' : 'Survey:'}</strong>
                  {' '}{surveyName}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                  <strong style={{ color: 'var(--ink)' }}>{lang === 'tr' ? 'Çerçeve:' : 'Framework:'}</strong>
                  {' '}GRI Universal · SASB · TCFD
                </span>
              </div>
              {/* Fix R4-M-05: guard totalQ > 0 so division never produces NaN% */}
              {totalQ > 0 && (
                <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {answeredCnt}/{totalQ} {lang === 'tr' ? 'soru yanıtlandı' : 'questions answered'} ·{' '}
                  {Math.round((answeredCnt / totalQ) * 100)}% {lang === 'tr' ? 'tamamlandı' : 'completion'}
                </span>
              )}
            </div>

            {/* Right: score ring */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <ScoreRing score={score} grade={grade} />
              <div style={{ marginTop: 4 }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: 'var(--ink-4)', letterSpacing: '0.08em', display: 'block' }}>
                  {lang === 'tr' ? 'GENEL SKOR' : 'OVERALL SCORE'}
                </span>
                {maturity && (
                  <span style={{
                    display: 'inline-block', marginTop: 4,
                    fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 10,
                    color: gradeColor(grade), letterSpacing: '0.06em', textTransform: 'uppercase',
                    background: 'var(--olive-wash)', padding: '2px 8px',
                  }}>
                    {maturity.label}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Maturity narrative */}
          {maturity?.narrative && (
            <div style={{
              marginTop: 20, padding: '16px 20px',
              background: 'var(--paper)', borderLeft: '3px solid var(--olive-deep)',
              fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.7,
            }}>
              {maturity.narrative}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════
            E / S / G PILLAR SCORES
            ══════════════════════════════════════ */}
        {/* Fix H-08: show pillar section whenever pillar data exists — the old condition
            hid the whole section when all three pillars scored 0, which is confusing
            (user doesn't know if it's missing data or genuinely zero score). */}
        {pillars && (
          <div className="print-section" style={{
            marginTop: 24, padding: '20px 24px',
            background: 'var(--paper)', border: '1px solid var(--line)',
          }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: 'var(--ink-4)',
              letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 16,
            }}>
              {lang === 'tr' ? 'ESG Boyut Puanları' : 'ESG Pillar Scores'}
            </span>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              {(['environmental', 'social', 'governance'] as const).map((key) => (
                <MiniGauge
                  key={key}
                  label={pillarLabel(key)}
                  value={pillars[key]}
                  color={pillarColor(key)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            TABS
            ══════════════════════════════════════ */}
        {/* Fix A-3: full ARIA tab pattern — role="tablist" on container,
            role="tab" + aria-selected on each button, tabpanels below */}
        <div role="tablist" aria-label={lang === 'tr' ? 'Sonuç sekmeleri' : 'Result tabs'}
          className="no-print" style={{
            display: 'flex', gap: 0, marginTop: 28, marginBottom: 0,
            borderBottom: '1px solid var(--line)',
          }}>
          {([
            ['overview', lang === 'tr' ? 'Performans Özeti' : 'Performance Summary'],
            ['actions',  lang === 'tr' ? `Aksiyon Planı${recs.length > 0 ? ` (${recs.length})` : ''}` : `Action Plan${recs.length > 0 ? ` (${recs.length})` : ''}`],
            ['evidence', lang === 'tr' ? `Notlar & Kanıtlar${evidenceAnswers.length > 0 ? ` (${evidenceAnswers.length})` : ''}` : `Notes & Evidence${evidenceAnswers.length > 0 ? ` (${evidenceAnswers.length})` : ''}`],
          ] as [typeof tab, string][]).map(([key, label]) => (
            <button
              key={key}
              id={`tab-${key}`}
              role="tab"
              aria-selected={tab === key}
              aria-controls={`tabpanel-${key}`}
              onClick={() => setTab(key)}
              style={{
                padding: '11px 22px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: tab === key ? '2px solid var(--ink)' : '2px solid transparent',
                fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: tab === key ? 600 : 400,
                fontSize: 12, color: tab === key ? 'var(--ink)' : 'var(--ink-3)',
                marginBottom: -1, transition: 'color 0.15s', letterSpacing: '0.02em',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════
            TAB: OVERVIEW — Category breakdown
            ══════════════════════════════════════ */}
        {(tab === 'overview' || isPrinting) && (
          <div role="tabpanel" id="tabpanel-overview" aria-labelledby="tab-overview"
            className="print-section" style={{ marginTop: 24 }}>

            {categories.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
                {lang === 'tr' ? 'Kategori verisi bulunamadı.' : 'No category data available.'}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
                    {lang === 'tr' ? 'Kategori Performans Analizi' : 'Category Performance Analysis'}
                  </h2>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)' }}>
                    {categories.length} {lang === 'tr' ? 'kategori' : 'categories'}
                  </span>
                </div>

                {/* Category rows */}
                <div style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}>
                  {categories.map((cat, i) => {
                    const pct   = Math.round(cat.percentage ?? 0);
                    const color = scoreColor(pct);
                    const label = scoreLabel(pct, lang);
                    return (
                      <div key={cat.id} style={{
                        padding: '18px 24px',
                        borderBottom: i < categories.length - 1 ? '1px solid var(--line)' : 'none',
                        display: 'grid', gridTemplateColumns: '1fr 80px 64px 80px',
                        gap: 16, alignItems: 'center',
                      }}>
                        {/* Category name + bar */}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 8, color: 'var(--ink)' }}>
                            {cat.name}
                          </div>
                          <div style={{ height: 5, background: 'var(--line)', borderRadius: 3 }}>
                            <div style={{
                              width: `${pct}%`, height: '100%',
                              background: color, borderRadius: 3,
                              transition: 'width 1s ease',
                            }} />
                          </div>
                        </div>
                        {/* Score / max */}
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: 'var(--ink-3)', textAlign: 'right' }}>
                          {cat.score}/{cat.max_score} {lang === 'tr' ? 'puan' : 'pts'}
                        </span>
                        {/* Percentage */}
                        <span style={{
                          fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 18,
                          color, textAlign: 'right', letterSpacing: '-0.02em',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {pct}%
                        </span>
                        {/* Label badge */}
                        <span style={{
                          display: 'inline-block', padding: '3px 8px', textAlign: 'center',
                          fontSize: 9.5, fontFamily: "'IBM Plex Mono', monospace",
                          fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                          color, border: `1px solid ${color}`, borderRadius: 2,
                        }}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Score legend */}
                <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {[
                    { color: '#c1121f', label: lang === 'tr' ? '0–19%  Kritik'    : '0–19%  Critical'    },
                    { color: '#e07b39', label: lang === 'tr' ? '20–39% Başlangıç' : '20–39% Initial'     },
                    { color: '#b5835a', label: lang === 'tr' ? '40–59% Gelişiyor' : '40–59% Developing'  },
                    { color: '#52796f', label: lang === 'tr' ? '60–79% İyi'       : '60–79% Good'        },
                    { color: '#2d6a4f', label: lang === 'tr' ? '80–100% Mükemmel' : '80–100% Excellent'  },
                  ].map(({ color, label: lbl }) => (
                    <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>{lbl}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Export CTA */}
            <div className="no-print" style={{
              marginTop: 32, padding: '20px 24px',
              background: 'var(--paper)', border: '1px solid var(--line)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24,
            }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>
                  {lang === 'tr' ? 'Tam raporu PDF olarak indirin' : 'Export the full report as PDF'}
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  {lang === 'tr'
                    ? 'Tüm bölümler dahil — yönetim kurulu ve yatırımcı sunumuna hazır format.'
                    : 'All sections included — board-ready and investor-ready format.'}
                </p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => window.print()} style={{ flexShrink: 0 }}>
                {/* Fix L-11: window.print() opens the browser print dialog, not a real PDF.
    Relabel honestly — jspdf/html2canvas are in package.json for a future upgrade. */}
<Icon.download /> {lang === 'tr' ? 'Yazdır / PDF Kaydet' : 'Print / Save as PDF'}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            TAB: ACTION PLAN
            ══════════════════════════════════════ */}
        {(tab === 'actions' || isPrinting) && (
          <div role="tabpanel" id="tabpanel-actions" aria-labelledby="tab-actions"
            className="print-section print-break-before" style={{ marginTop: 24 }}>
            {isPrinting && <div className="print-section-header">{lang === 'tr' ? 'Aksiyon Planı' : 'Action Plan'}</div>}
            {recs.length === 0 ? (
              <div style={{
                background: 'var(--paper)', border: '1px solid var(--line)',
                padding: '56px 40px', textAlign: 'center',
              }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>
                  {lang === 'tr' ? 'Tebrikler — İyileştirme Önerisi Yok!' : 'Congratulations — No Improvement Actions Needed!'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {lang === 'tr'
                    ? 'Tüm kategorilerde mükemmel performans sergiliyorsunuz.'
                    : 'You are performing at excellent level across all categories.'}
                </p>
              </div>
            ) : (
              <>
                {/* Summary counts */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                  {[
                    { count: highPriorityRecs.length, label: lang === 'tr' ? 'Yüksek Öncelik' : 'High Priority', color: '#c1121f' },
                    { count: mediumRecs.length,        label: lang === 'tr' ? 'Orta Öncelik'  : 'Medium Priority', color: '#b5835a' },
                    { count: lowRecs.length,           label: lang === 'tr' ? 'Düşük Öncelik' : 'Low Priority',   color: '#52796f' },
                  ].map(({ count, label: lbl, color }) => count > 0 && (
                    <div key={lbl} style={{
                      padding: '10px 20px', background: 'var(--paper)',
                      border: `1px solid ${color}`, display: 'flex', gap: 10, alignItems: 'center',
                    }}>
                      <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: 28, color, letterSpacing: '-0.03em' }}>{count}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{lbl}</span>
                    </div>
                  ))}
                </div>

                {/* Recommendation cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {recs.map((r, i) => {
                    const pColor = priorityColor(r.priority);
                    const title  = r.title || r.text || r.recommendation || r.category;
                    const desc   = r.description || r.suggestion;
                    return (
                      <div key={i} style={{
                        background: 'var(--paper)', border: '1px solid var(--line)',
                        borderLeft: `4px solid ${pColor}`,
                        padding: '20px 24px',
                      }}>
                        {/* Header row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{
                              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 700,
                              color: pColor, letterSpacing: '0.1em', textTransform: 'uppercase',
                              border: `1px solid ${pColor}`, padding: '2px 7px',
                            }}>
                              {r.priority === 'High' ? (lang === 'tr' ? 'Yüksek' : 'High') :
                               r.priority === 'Medium' ? (lang === 'tr' ? 'Orta' : 'Medium') :
                               (lang === 'tr' ? 'Düşük' : 'Low')}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: "'IBM Plex Mono', monospace" }}>
                              {r.category}
                            </span>
                            {r.gri_standard && (
                              <span style={{
                                fontSize: 9.5, color: 'var(--olive-deep)',
                                fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.04em',
                                background: 'var(--olive-wash)', padding: '2px 7px',
                              }}>
                                {r.gri_standard}
                              </span>
                            )}
                          </div>
                          {/* Score + effort badges */}
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                            {r.score_pct !== undefined && (
                              <span style={{
                                fontSize: 9.5, fontFamily: "'IBM Plex Mono', monospace",
                                color: scoreColor(r.score_pct), letterSpacing: '0.04em',
                              }}>
                                {r.score_pct}% {lang === 'tr' ? 'mevcut' : 'current'}
                              </span>
                            )}
                            {r.effort && (
                              <span style={{
                                fontSize: 9, fontFamily: "'IBM Plex Mono', monospace",
                                color: effortColor(r.effort), letterSpacing: '0.06em',
                                textTransform: 'uppercase', border: `1px solid ${effortColor(r.effort)}`,
                                padding: '1px 6px',
                              }}>
                                {r.effort === 'High' ? (lang === 'tr' ? 'Yüksek Efor' : 'High Effort') :
                                 r.effort === 'Medium' ? (lang === 'tr' ? 'Orta Efor' : 'Medium Effort') :
                                 (lang === 'tr' ? 'Düşük Efor' : 'Low Effort')}
                              </span>
                            )}
                            {r.timeline_days && (
                              <span style={{
                                fontSize: 9, fontFamily: "'IBM Plex Mono', monospace",
                                color: 'var(--ink-4)', letterSpacing: '0.06em',
                                background: 'var(--cream-deep)', padding: '2px 7px',
                              }}>
                                {r.timeline_days}{lang === 'tr' ? ' gün' : ' days'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title */}
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.4 }}>
                          {title}
                        </div>

                        {/* Description */}
                        {desc && (
                          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.65, marginBottom: r.quick_win ? 12 : 0 }}>
                            {desc}
                          </p>
                        )}

                        {/* Quick win */}
                        {r.quick_win && (
                          <div style={{
                            marginTop: 10, padding: '10px 14px',
                            background: 'var(--olive-wash)', borderRadius: 2,
                            display: 'flex', gap: 10, alignItems: 'flex-start',
                          }}>
                            <span style={{
                              fontFamily: "'IBM Plex Mono', monospace", fontSize: 8.5,
                              color: 'var(--olive-deep)', letterSpacing: '0.1em', textTransform: 'uppercase',
                              fontWeight: 700, flexShrink: 0, paddingTop: 1,
                            }}>
                              {lang === 'tr' ? 'Hızlı Kazanım' : 'Quick Win'}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                              {r.quick_win}
                            </span>
                          </div>
                        )}

                        {/* Track button — adds this recommendation to the action plan */}
                        <div className="no-print" style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          {trackedRecs.has(i) ? (
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--olive-deep)', letterSpacing: '0.06em' }}>
                              ✓ {lang === 'tr' ? 'Aksiyon planına eklendi' : 'Added to action plan'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={async () => {
                                try {
                                  await actionTaskAPI.createTask({
                                    attempt:     attempt ? attempt.id : undefined,
                                    title:       title ?? r.category,
                                    description: desc ?? '',
                                    category:    r.category ?? '',
                                    priority:    r.priority ?? '',
                                    status:      'todo',
                                  });
                                  setTrackedRecs(prev => new Set([...prev, i]));
                                } catch { /* ignore */ }
                              }}
                            >
                              📋 {lang === 'tr' ? 'Takip Et' : 'Track'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Action timeline summary */}
                <div style={{ marginTop: 24, padding: '20px 24px', background: 'var(--paper)', border: '1px solid var(--line)' }}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: 'var(--ink-4)',
                    letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 14,
                  }}>
                    {lang === 'tr' ? 'Uygulama Zaman Çizelgesi' : 'Implementation Timeline'}
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {[
                      { days: 90,  label: lang === 'tr' ? '90 Gün'  : '90 Days'  },
                      { days: 180, label: lang === 'tr' ? '180 Gün' : '180 Days' },
                      { days: 365, label: lang === 'tr' ? '12 Ay'   : '12 Months'},
                    ].map(({ days, label: lbl }) => {
                      // Fix #26: use explicit lower bounds so items at exactly
                      // the bucket boundary (e.g. 180 days) don't fall through.
                      // Old logic used days/2 which excluded td=180 from the 365 bucket.
                      const lowerBound: Record<number, number> = { 90: 0, 180: 90, 365: 180 };
                      const bucket = recs.filter((r) => {
                        const td = r.timeline_days ?? 90;
                        return td <= days && td > (lowerBound[days] ?? 0);
                      });
                      return (
                        <div key={days} style={{ borderTop: '2px solid var(--line)', paddingTop: 12 }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)', marginBottom: 8, letterSpacing: '0.06em' }}>
                            {lbl} ({bucket.length} {lang === 'tr' ? 'aksiyon' : 'actions'})
                          </div>
                          {bucket.slice(0, 3).map((r, j) => (
                            <div key={j} style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 4, lineHeight: 1.4 }}>
                              · {r.title || r.category}
                            </div>
                          ))}
                          {bucket.length > 3 && (
                            <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                              +{bucket.length - 3} {lang === 'tr' ? 'daha' : 'more'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            TAB: EVIDENCE & NOTES
            ══════════════════════════════════════ */}
        {(tab === 'evidence' || isPrinting) && (
          <div role="tabpanel" id="tabpanel-evidence" aria-labelledby="tab-evidence"
            className="print-break-before" style={{ marginTop: 24 }}>
            {isPrinting && <div className="print-section-header">{lang === 'tr' ? 'Notlar & Kanıtlar' : 'Notes & Evidence'}</div>}
            {evidenceAnswers.length === 0 ? (
              <div style={{
                background: 'var(--paper)', border: '1px solid var(--line)',
                padding: '56px 40px', textAlign: 'center',
              }}>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 8 }}>
                  {lang === 'tr' ? 'Bu değerlendirmede not veya belge eklenmemiş.' : 'No notes or documents were added to this assessment.'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {lang === 'tr' ? 'Bir sonraki değerlendirmede per-soru not ve kanıt dosyası ekleyin.' : 'Add per-question notes and evidence files in your next assessment.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {evidenceAnswers.map((ans, i) => (
                  <div key={ans.id} style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: 'var(--ink-4)', letterSpacing: '0.06em', flexShrink: 0, paddingTop: 2 }}>
                        Q{String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="prose" style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1 }}
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(ans.question_text || '') }} />
                    </div>
                    {ans.choices_display && ans.choices_display !== 'No answer provided' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.08em' }}>
                          {lang === 'tr' ? 'YANIT:' : 'ANSWER:'}
                        </span>
                        <span style={{ background: 'var(--olive-wash)', padding: '3px 10px', fontSize: 12, color: 'var(--olive-deep)', fontWeight: 500 }}>
                          {ans.choices_display}
                        </span>
                      </div>
                    )}
                    {ans.notes && (
                      <div style={{ background: 'var(--cream-deep)', padding: '12px 16px', borderLeft: '3px solid var(--olive-deep)', marginBottom: 10 }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                          {lang === 'tr' ? 'Not' : 'Note'}
                        </span>
                        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>{ans.notes}</p>
                      </div>
                    )}
                    {(ans.documents?.length ?? 0) > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          {lang === 'tr' ? 'Belgeler' : 'Documents'} ({ans.documents!.length})
                        </span>
                        {/* Fix R5-H-03: use authenticated download URL so the file is served
                            through ownership verification instead of the public /media/ path.
                            Fix R6-18: moved comment outside map() to fix invalid JSX syntax. */}
                        {ans.documents?.map((doc) => (
                          <a key={doc.id} href={documentDownloadUrl(doc.id)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                              background: 'var(--cream)', border: '1px solid var(--line)', transition: 'border-color 0.15s',
                            }}
                              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ink-3)')}
                              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                            >
                              <span style={{ fontSize: 16 }}>📎</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>{doc.title}</div>
                                {doc.file_size_display && (
                                  <div style={{ fontSize: 10.5, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                                    {doc.file_size_display}
                                  </div>
                                )}
                              </div>
                              <span style={{ fontSize: 10, color: 'var(--olive-deep)' }}>
                                {lang === 'tr' ? 'İndir' : 'Download'} ↓
                              </span>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
