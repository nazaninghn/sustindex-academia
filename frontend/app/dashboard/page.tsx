'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/AppNav';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/shared';
import { attemptAPI, elearningAPI } from '@/lib/api';
import { gradeColor } from '@/lib/utils';
import { onDataChange } from '@/lib/events';

/* ─── Types ─────────────────────────────────────────────────── */
interface DashAttempt {
  id: number;
  survey_name: string;
  is_completed: boolean;
  completed_at: string | null;
  total_score: number | null;
  overall_grade: string;
  category_scores?: { id: number; key: string; name: string; percentage: number }[];
  answered_count: number;
  total_questions: number;
  started_at: string;
  cycle_name: string;
}

interface StripCourse {
  id: number;
  title_display: string;
  tag: string;
  level: string;
  icon_emoji: string;
  // Fix R4-H-03: Django serializes DecimalField / CharField as string — was typed
  // as number which caused TypeScript to accept .toFixed() calls that fail at runtime.
  duration_hours: string;
  total_lessons: number;
  progress_percentage: number;
  order: number;
}

function timeAgo(isoDate: string | null, lang: string): string {
  if (!isoDate) return '';
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 60) return lang === 'tr' ? 'Az önce' : 'Just now';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return lang === 'tr' ? `${m} dk önce` : `${m}m ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return lang === 'tr' ? `${h} sa önce` : `${h}h ago`;
  }
  const d = Math.floor(diff / 86400);
  return lang === 'tr' ? `${d} gün önce` : `${d}d ago`;
}

const V5_PHASES = [
  { key: 'Strateji', labelEn: 'Governance', labelTr: 'Yönetişim' },
  { key: 'Cevre',    labelEn: 'Environment', labelTr: 'Çevre' },
  { key: 'Sosyal',   labelEn: 'Social',      labelTr: 'Sosyal' },
  { key: 'Ekonomik', labelEn: 'Economic',    labelTr: 'Ekonomik' },
  { key: 'GRI Sector:', labelEn: 'Sector',   labelTr: 'Sektör' },
];

/* ─── Phase Journey (professional 5-card progress) ───────────── */
function PhaseJourney({ attempts, lang }: { attempts: DashAttempt[]; lang: string }) {
  const PHASES = [
    { key: 'Strateji',    labelEn: 'Governance',   labelTr: 'Yönetişim'  },
    { key: 'Cevre',       labelEn: 'Environment',  labelTr: 'Çevre'      },
    { key: 'Sosyal',      labelEn: 'Social',       labelTr: 'Sosyal'     },
    { key: 'Ekonomik',    labelEn: 'Economic',     labelTr: 'Ekonomik'   },
    { key: 'GRI Sector:', labelEn: 'Sector',       labelTr: 'Sektör'     },
  ];

  const phasesData = PHASES.map((phase, i) => {
    const all        = attempts.filter(a => (a.survey_name || '').includes(phase.key));
    const completed  = all.find(a => a.is_completed) ?? null;
    const inProgress = !completed ? (all.find(a => !a.is_completed) ?? null) : null;
    return { ...phase, num: i + 1, completed, inProgress };
  });

  const completedCount = phasesData.filter(p => p.completed).length;
  const overallPct     = Math.round((completedCount / PHASES.length) * 100);

  return (
    <div style={{
      background: 'var(--paper)', border: '1px solid var(--line)',
      padding: '24px 28px', marginBottom: 24,
    }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.13em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            {lang === 'tr' ? 'DEĞERLENDİRME YOLCULUĞU' : 'ASSESSMENT JOURNEY'}
          </span>
          <h2 style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
            {lang === 'tr' ? 'GRI Sürdürülebilirlik Değerlendirmesi' : 'GRI Sustainability Assessment'}
          </h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: 30, letterSpacing: '-0.04em', lineHeight: 1 }}>
            {completedCount}
            <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 400 }}>/{PHASES.length}</span>
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em', display: 'block', marginTop: 2 }}>
            {lang === 'tr' ? 'AŞAMA TAMAMLANDI' : 'PHASES DONE'}
          </span>
        </div>
      </div>

      {/* ── Overall bar ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {lang === 'tr' ? 'Genel İlerleme' : 'Overall Progress'}
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: 'var(--olive-deep)', letterSpacing: '0.08em' }}>
            {overallPct}%
          </span>
        </div>
        <div style={{ height: 3, background: 'var(--line)', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${overallPct}%`, background: 'var(--olive-deep)', borderRadius: 2, transition: 'width 0.7s ease' }} />
        </div>
      </div>

      {/* ── Phase cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {phasesData.map((phase) => {
          const isDone       = !!phase.completed;
          const isActive     = !!phase.inProgress;
          const score        = isDone ? Math.round(phase.completed!.total_score ?? 0) : null;
          const grade        = phase.completed?.overall_grade ?? null;
          const answered     = phase.inProgress?.answered_count ?? 0;
          const totalQ       = phase.inProgress?.total_questions ?? 0;
          const pct          = totalQ > 0 ? Math.round((answered / totalQ) * 100) : 0;

          const borderColor  = isDone ? 'var(--olive-deep)' : isActive ? 'var(--amber)' : 'var(--line)';
          const bgColor      = isDone ? 'var(--olive-wash)' : isActive ? 'rgba(194,153,62,0.07)' : 'var(--cream-deep)';
          const statusColor  = isDone ? 'var(--olive-deep)' : isActive ? 'var(--amber)' : 'var(--ink-4)';

          return (
            <div key={phase.key} style={{
              background: bgColor, border: `1px solid ${borderColor}`,
              padding: '14px 12px', display: 'flex', flexDirection: 'column',
              opacity: !isDone && !isActive ? 0.55 : 1,
              transition: 'opacity 0.2s',
            }}>
              {/* Phase label */}
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7.5, color: statusColor, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                {lang === 'tr' ? `AŞAMA ${phase.num}` : `PHASE ${phase.num}`}
              </span>

              {/* Phase name */}
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 10, display: 'block', flex: 1 }}>
                {lang === 'tr' ? phase.labelTr : phase.labelEn}
              </span>

              {/* Status body */}
              {isDone && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: 26, letterSpacing: '-0.04em', color: statusColor, lineHeight: 1 }}>
                      {score}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>%</span>
                    {grade && (
                      <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 13, color: gradeColor(grade), marginLeft: 2 }}>
                        {grade}
                      </span>
                    )}
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: statusColor, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    ✓ {lang === 'tr' ? 'Tamamlandı' : 'Complete'}
                  </span>
                </div>
              )}

              {isActive && (
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: 'var(--amber)', marginBottom: 6 }}>
                    {answered}/{totalQ > 0 ? totalQ : '?'} {lang === 'tr' ? 'soru' : 'q'} · {pct}%
                  </div>
                  <div style={{ height: 3, background: 'rgba(194,153,62,0.2)', borderRadius: 2, marginBottom: 5 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--amber)', borderRadius: 2, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: 'var(--amber)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    ⏳ {lang === 'tr' ? 'Devam ediyor' : 'In progress'}
                  </span>
                </div>
              )}

              {!isDone && !isActive && (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  ○ {lang === 'tr' ? 'Başlanmadı' : 'Not started'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function courseStatus(c: StripCourse): 'done' | 'active' | 'new' {
  if (c.progress_percentage >= 100) return 'done';
  if (c.progress_percentage > 0)    return 'active';
  return 'new';
}

/* ─── Mini Spark Line ─────────────────────────────────────────── */
function SparkLine({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 180, h = 48;
  const mn = Math.min(...data), mx = Math.max(...data);
  const range = mx - mn || 1;
  const px = (i: number) => (i / (data.length - 1)) * w;
  const py = (v: number) => h - ((v - mn) / range) * h;
  const path = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(v)}`).join(' ');
  const trend = data[data.length - 1] >= data[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      <path d={path} stroke={trend ? 'var(--olive-deep)' : 'var(--amber)'} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={px(data.length - 1)} cy={py(data[data.length - 1])} r="3" fill={trend ? 'var(--olive-deep)' : 'var(--amber)'} />
    </svg>
  );
}

/* ─── Courses Strip ──────────────────────────────────────────── */
function CoursesStrip() {
  const { lang, t } = useLang();
  // Fix #33: gate the API call on user being authenticated to avoid 401s on mount
  const { user } = useAuth();
  const [courses, setCourses]           = useState<StripCourse[]>([]);
  const [stripLoading, setStripLoading] = useState(true);
  // Fix R4-H-02: track load failure distinctly so we can show an error message
  // instead of silently rendering an empty section.
  const [stripError, setStripError]     = useState(false);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    elearningAPI
      .getCourses()
      .then((data: StripCourse[] | { results: StripCourse[] }) => {
        if (controller.signal.aborted) return;
        const list: StripCourse[] = Array.isArray(data) ? data : (data?.results ?? []);
        setCourses(list.slice(0, 4));
      })
      .catch(() => {
        if (!controller.signal.aborted) { setStripError(true); setCourses([]); }
      })
      .finally(() => {
        if (!controller.signal.aborted) setStripLoading(false);
      });
    return () => controller.abort();
  }, [user]);

  return (
    <section style={{ marginTop: 48 }}>
      {/* Section header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--line)',
      }}>
        {/* Fix R5-L-05: use t() instead of inline ternaries so translations stay DRY */}
        <div>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>
            {t('courses_eyebrow')}
          </span>
          <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
            {t('dash_sust_courses')}
          </h2>
        </div>
        <Link href="/courses" style={{ textDecoration: 'none', fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {/* Fix R7-11: use t() so this string stays in the central i18n catalogue */}
          {t('dash_all_courses')} <Icon.arrow />
        </Link>
      </div>

      {/* Fix R4-H-02: show error banner instead of empty grid on fetch failure */}
      {stripError && !stripLoading && (
        <div style={{
          padding: '14px 18px', background: 'var(--paper)', border: '1px solid var(--line)',
          fontSize: 12, color: 'var(--danger)', marginBottom: 12,
        }}>
          {t('courses_load_error')}
        </div>
      )}

      <div className="courses-strip-grid">
        {stripLoading
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                background: 'var(--paper)', border: '1px solid var(--line)',
                padding: 20, minHeight: 160,
              }}>
                {[36, 14, 10, 8].map((h, j) => (
                  <div key={j} style={{
                    height: h, marginBottom: 12,
                    background: 'var(--cream-deep)', borderRadius: 2,
                    width: j === 0 ? 36 : j === 1 ? '75%' : '90%',
                  }} />
                ))}
              </div>
            ))
          : courses.map((c, idx) => {
              const status = courseStatus(c);
              return (
                <Link key={c.id} href={`/courses/${c.id}`} style={{ textDecoration: 'none' }}>
                  <div
                    style={{
                      background: 'var(--paper)', border: '1px solid var(--line)',
                      padding: 20, height: '100%',
                      display: 'flex', flexDirection: 'column',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ink-3)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34,
                          background: 'var(--cream-deep)', border: '1px solid var(--line)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                        }}>{c.icon_emoji || '📚'}</div>
                        <div>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.08em', display: 'block' }}>
                            SX·{String(c.order || idx + 1).padStart(2, '0')}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--olive-deep)', letterSpacing: '0.03em' }}>{c.tag}</span>
                        </div>
                      </div>
                      {status === 'done' && <span style={{ color: 'var(--olive-deep)' }}><Icon.check /></span>}
                      {status === 'new' && (
                        <span style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: 8,
                          color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em',
                          padding: '2px 5px', border: '1px solid var(--line)',
                        }}>{lang === 'tr' ? 'YENİ' : 'NEW'}</span>
                      )}
                    </div>

                    <h3 style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.35, marginBottom: 10, flex: 1 }}>
                      {c.title_display}
                    </h3>

                    {c.progress_percentage > 0 && c.progress_percentage < 100 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)' }}>
                            {Math.round(c.total_lessons * c.progress_percentage / 100)}/{c.total_lessons}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--olive-deep)' }}>{c.progress_percentage}%</span>
                        </div>
                        <div className="bar bar-olive"><span style={{ width: `${c.progress_percentage}%` }} /></div>
                      </div>
                    )}

                    <div style={{
                      marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--line)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                        {/* Fix L-08: append unit to duration_hours — without it the
                            number appeared bare with no context (e.g. "4" instead of "4 hr") */}
                        {c.total_lessons} {lang === 'tr' ? 'modül' : 'mod'} · {c.duration_hours} {lang === 'tr' ? 'sa' : 'hr'}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 500, color: status === 'done' ? 'var(--ink-4)' : 'var(--ink)' }}>
                        {status === 'done' ? (lang === 'tr' ? 'Tekrar' : 'Review') : status === 'active' ? (lang === 'tr' ? 'Devam →' : 'Resume →') : (lang === 'tr' ? 'Başla →' : 'Start →')}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
        }
      </div>

      <div style={{
        marginTop: 10, padding: '11px 18px',
        background: 'var(--cream-deep)', border: '1px solid var(--line)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
          {/* Fix R9-07: use t() — dash_coming_soon exists in i18n catalogue,
              hardcoded ternary was inconsistent with every other string on this page */}
          {t('dash_coming_soon')}
        </span>
        <Link href="/courses" style={{ textDecoration: 'none' }}>
          <button className="btn btn-outline btn-sm">
            {lang === 'tr' ? 'Tüm Kurslar' : 'View All'} <Icon.arrow />
          </button>
        </Link>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Dashboard Page
   ═══════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  // Fix R6-17: destructure t() so DashboardPage uses the i18n system
  // consistently instead of mixing lang ternaries and t() calls.
  const { lang, t }                 = useLang();
  const { user, isLoading: authLoading } = useAuth();
  const router                      = useRouter();

  const [attempts,    setAttempts]    = useState<DashAttempt[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [hasLoadErr,  setHasLoadErr]  = useState(false);

  /* ── New Assessment modal state ── */
  const [showNewModal,       setShowNewModal]       = useState(false);
  const [newAssessmentName,  setNewAssessmentName]  = useState('');
  const [newAssessmentDesc,  setNewAssessmentDesc]  = useState('');

  // Fix MED-05: track mounted state so async callbacks don't call setState
  // on an unmounted component (avoids React "can't perform state update" warnings).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  /** Fetch attempts — extracted so it can be called on refresh events too */
  const refreshAttempts = useCallback(() => {
    if (!user) return;
    setHasLoadErr(false);
    attemptAPI.getMyAttempts()
      .then((data: DashAttempt[] | { results: DashAttempt[] }) => {
        if (!mountedRef.current) return;
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        // Filter to v5 surveys only — old v4 surveys (GRI 1: Foundation, etc.)
        // have different name patterns and should not appear on the dashboard.
        const V5_PATTERNS = ['Strateji', 'Cevre', 'Sosyal', 'Ekonomik', 'GRI Sector:'];
        setAttempts(list.filter((a) => V5_PATTERNS.some((p) => (a.survey_name || '').includes(p))));
      })
      .catch(() => {
        // Fix #14: surface the error so users know a load failure happened.
        // Use a boolean flag so lang is not a dependency (avoids refetch on toggle).
        if (mountedRef.current) setHasLoadErr(true);
      })
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, [user]);

  /** Open new-assessment modal */
  const handleNewAssessmentClick = useCallback(() => {
    setNewAssessmentName('');
    setNewAssessmentDesc('');
    setShowNewModal(true);
  }, []);

  /** Save name to localStorage so surveys page can pre-fill it, then navigate */
  const handleNewAssessmentStart = useCallback(() => {
    const name = newAssessmentName.trim() ||
      new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB',
        { day: '2-digit', month: 'short', year: 'numeric' });
    try { localStorage.setItem('sx_pending_cycle', name); } catch { /* ignore */ }
    setShowNewModal(false);
    // Small delay so modal closes before navigation
    setTimeout(() => router.push('/surveys'), 80);
  }, [newAssessmentName, lang, router]);

  /* Initial load */
  useEffect(() => {
    if (user) {
      refreshAttempts();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading, refreshAttempts]);

  /* Live refresh — triggered by questionnaire complete, profile save, lesson complete */
  useEffect(() => {
    return onDataChange(() => { refreshAttempts(); });
  }, [refreshAttempts]);

  /* ── Loading ── */
  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>
          {t('t_loading_auth')}
        </span>
      </div>
    );
  }

  /* ── Load error (#14) ── */
  if (hasLoadErr) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
        <AppNav />
        <main className="wrap" style={{ padding: '64px 32px', textAlign: 'center' }}>
          <div style={{ background: '#FFF5F3', border: '1px solid var(--danger)', padding: '18px 24px', display: 'inline-block' }}>
            <p style={{ fontSize: 13, color: 'var(--danger)' }}>
              {lang === 'tr' ? 'Değerlendirmeler yüklenemedi.' : 'Failed to load assessments.'}
            </p>
          </div>
        </main>
      </div>
    );
  }

  /* ── Derived data ── */
  const firstName    = user?.first_name || user?.username || '';
  const completed    = attempts.filter((a) => a.is_completed);
  const inProgress   = attempts.filter((a) => !a.is_completed);
  // Fix M-10: API returns attempts ordered newest-first (-started_at).
  // completed[0] is the most recent; the old completed[length-1] was the oldest.
  const latest       = completed.length > 0 ? completed[0] : null;
  const activeAttempt = inProgress[0] ?? null;
  const avgScore     = completed.length > 0
    ? Math.round(completed.reduce((s, a) => s + (a.total_score ?? 0), 0) / completed.length) : 0;
  // Fix M-11: sparkline should go old→new; take 6 newest then reverse so the
  // chart reads left (oldest) to right (newest) — the old slice(-6) was correct
  // directionally but took the 6 oldest items from an already-newest-first list.
  const trendVals    = completed.slice(0, 6).reverse().map((a) => Math.round(a.total_score ?? 0));
  // Fix M-11: recentRows should show the 6 most recent — API already sorts
  // newest-first so we just take the first 6; the old [...completed].reverse()
  // was reversing to oldest-first and showing the 6 oldest attempts.
  const recentRows   = completed.slice(0, 6);
  const hasData      = completed.length > 0 || inProgress.length > 0;

  const dateStr = new Date().toLocaleDateString(
    lang === 'tr' ? 'tr-TR' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  );

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <AppNav />

      <main className="wrap" style={{ padding: '36px 32px 80px' }}>

        {/* ════════════════════════════════════════
            HEADER
            ════════════════════════════════════════ */}
        <div className="dash-header">
          <div>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
              color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'block', marginBottom: 10,
            }}>{dateStr}</span>
            <h1 style={{ fontSize: 34, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.05, marginBottom: 6 }}>
              {lang === 'tr' ? 'Hoşgeldin, ' : 'Welcome back, '}
              <em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500 }}>{firstName}</em>.
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              {!hasData
                ? (lang === 'tr' ? 'İlk ESG değerlendirmenizi başlatmak için bir anket seçin.' : 'Choose a survey to start your first ESG assessment.')
                : activeAttempt
                  ? (lang === 'tr' ? `${inProgress.length} değerlendirme devam ediyor.` : `${inProgress.length} assessment${inProgress.length !== 1 ? 's' : ''} in progress.`)
                  : (lang === 'tr' ? `${completed.length} değerlendirme tamamlandı.` : `${completed.length} assessment${completed.length !== 1 ? 's' : ''} completed.`)}
            </p>
            {activeAttempt && (
              <p style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.04em' }}>
                {lang === 'tr' ? 'Son aktivite:' : 'Last activity:'} {timeAgo(activeAttempt.started_at, lang)}
              </p>
            )}
          </div>
          <div className="dash-header-actions">
            <Link href="/history"  style={{ textDecoration: 'none' }}>
              <button className="btn btn-outline btn-sm">{lang === 'tr' ? 'Geçmiş' : 'History'}</button>
            </Link>
            <button className="btn btn-primary btn-sm" onClick={handleNewAssessmentClick}>
              {lang === 'tr' ? 'Yeni Değerlendirme' : 'New Assessment'} <Icon.plus />
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════
            EMPTY STATE
            ════════════════════════════════════════ */}
        {!hasData ? (
          <>
            {/* Hero empty card */}
            <div className="empty-card" style={{
              background: 'var(--paper)', border: '1px solid var(--line)',
              display: 'grid', gridTemplateColumns: '1fr 1px 1fr',
              marginBottom: 24, overflow: 'hidden',
            }}>
              {/* Left: start CTA */}
              <div style={{ padding: '52px 48px' }}>
                <div style={{
                  fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
                  fontSize: 80, letterSpacing: '-0.05em', lineHeight: 0.9,
                  color: 'var(--cream-deep)', userSelect: 'none', marginBottom: 28,
                }}>ESG</div>
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.01em' }}>
                  {lang === 'tr' ? 'İlk değerlendirmenizi yapın' : 'Run your first assessment'}
                </h2>
                <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 28, lineHeight: 1.65, maxWidth: 340 }}>
                  {lang === 'tr'
                    ? 'ESG performansınızı ölçün, zayıf noktalarınızı keşfedin ve sürdürülebilirlik yolculuğunuza başlayın.'
                    : 'Measure your ESG performance, discover your gaps, and begin your sustainability journey.'}
                </p>
                <Link href="/surveys" style={{ textDecoration: 'none' }}>
                  <button className="btn btn-primary">
                    {lang === 'tr' ? 'Anket Seç' : 'Choose a Survey'} <Icon.arrow />
                  </button>
                </Link>
              </div>

              {/* Divider */}
              <div className="empty-card-divider" style={{ background: 'var(--line)' }} />

              {/* Right: what to expect */}
              <div style={{ padding: '52px 48px' }}>
                <span className="eyebrow" style={{ display: 'block', marginBottom: 20 }}>
                  {lang === 'tr' ? 'Neler içeriyor?' : 'What to expect'}
                </span>
                {[
                  [lang === 'tr' ? 'Kapsamlı ESG analizi' : 'Comprehensive ESG analysis', lang === 'tr' ? 'Çevre, sosyal ve yönetişim boyutlarını değerlendirin.' : 'Evaluate environmental, social and governance dimensions.'],
                  [lang === 'tr' ? 'Anlık sonuçlar' : 'Instant results', lang === 'tr' ? 'Tamamlar tamamlamaz puanınızı ve notunuzu görün.' : 'See your score and grade as soon as you finish.'],
                  [lang === 'tr' ? 'Öneriler' : 'Actionable recommendations', lang === 'tr' ? 'Öncelikli iyileştirme tavsiyeleri alın.' : 'Receive prioritized improvement recommendations.'],
                ].map(([title, body], i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', background: 'var(--olive-deep)',
                      flexShrink: 0, marginTop: 5,
                    }} />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>{title}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.55 }}>{body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <CoursesStrip />
          </>
        ) : (

          /* ════════════════════════════════════════
             MAIN CONTENT — HAS DATA
             ════════════════════════════════════════ */
          <>
            {/* ── Stat Row ── */}
            {(() => {
              const completedPhases = V5_PHASES.filter(ph =>
                attempts.some(a => (a.survey_name || '').includes(ph.key) && a.is_completed)
              ).length;
              const totalAnswered = attempts.reduce((sum, a) => sum + (a.answered_count ?? 0), 0);
              return (
                <div className="stat-grid">
                  {[
                    {
                      l: lang === 'tr' ? 'TAMAMLANAN AŞAMA' : 'PHASES DONE',
                      v: `${completedPhases}/5`,
                      d: lang === 'tr' ? 'GRI aşaması' : 'GRI phases',
                      highlight: false,
                    },
                    {
                      l: lang === 'tr' ? 'CEVAPLANAN SORU' : 'QUESTIONS ANS.',
                      v: totalAnswered > 0 ? totalAnswered : '—',
                      d: lang === 'tr' ? 'toplam soru' : 'total answered',
                      highlight: false,
                    },
                    {
                      l: lang === 'tr' ? 'ORT. SKOR' : 'AVG. SCORE',
                      v: avgScore > 0 ? avgScore : '—',
                      d: lang === 'tr' ? 'genel ortalama' : 'overall avg.',
                      highlight: false,
                    },
                    {
                      l: lang === 'tr' ? 'SON NOT' : 'LATEST GRADE',
                      v: latest?.overall_grade ?? '—',
                      d: latest ? `${Math.round(latest.total_score ?? 0)}%` : '—',
                      highlight: true,
                    },
                  ].map((s, i) => (
                    <div key={i} className="stat-cell">
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                        color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase',
                        display: 'block', marginBottom: 10,
                      }}>{s.l}</span>
                      <div style={{
                        fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
                        fontSize: 40, letterSpacing: '-0.04em', lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums', marginBottom: 6,
                        color: s.highlight && latest?.overall_grade ? gradeColor(latest.overall_grade) : 'var(--ink)',
                      }}>{s.v}</div>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{s.d}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            <PhaseJourney attempts={attempts} lang={lang} />

            {/* ── 2-col: performance + sidebar ── */}
            <div className="content-grid-main">

              {/* ── Performance card ── */}
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}>

                {/* Card header */}
                <div style={{
                  padding: '20px 28px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <span className="eyebrow" style={{ display: 'block', marginBottom: 2 }}>
                      {lang === 'tr' ? 'Son Değerlendirme' : 'Latest Assessment'}
                    </span>
                    <h2 style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
                      {latest?.survey_name || (lang === 'tr' ? 'ESG Değerlendirmesi' : 'ESG Assessment')}
                    </h2>
                  </div>
                  {latest && (
                    <Link href={`/results/${latest.id}`} style={{ textDecoration: 'none' }}>
                      <button className="btn btn-outline btn-sm">
                        {lang === 'tr' ? 'Tam rapor' : 'Full report'} <Icon.arrow />
                      </button>
                    </Link>
                  )}
                </div>

                {latest ? (
                  <div style={{ padding: '28px 28px 32px' }}>
                    {/* Score hero */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 32, paddingBottom: 28, borderBottom: '1px solid var(--line)' }}>
                      <div>
                        <span style={{
                          fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
                          fontSize: 88, letterSpacing: '-0.055em', lineHeight: 0.85,
                          fontVariantNumeric: 'tabular-nums', color: 'var(--ink)',
                        }}>{Math.round(latest.total_score ?? 0)}</span>
                      </div>
                      <div style={{ paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                          / 100 · {lang === 'tr' ? 'genel' : 'overall'}
                        </span>
                        <span style={{
                          fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600,
                          fontSize: 28, letterSpacing: '-0.03em',
                          color: gradeColor(latest.overall_grade),
                        }}>{latest.overall_grade || '—'}</span>
                      </div>

                      {/* Trend spark */}
                      {trendVals.length >= 2 && (
                        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                          <span style={{
                            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                            color: trendVals[trendVals.length - 1] >= trendVals[0] ? 'var(--olive-deep)' : 'var(--amber)',
                            display: 'block', marginBottom: 6, letterSpacing: '0.06em',
                          }}>
                            {trendVals[trendVals.length - 1] >= trendVals[0] ? '↑' : '↓'}
                            {' '}{Math.abs(trendVals[trendVals.length - 1] - trendVals[0])} pts
                          </span>
                          <SparkLine data={trendVals} />
                        </div>
                      )}
                    </div>

                    {/* Category breakdown */}
                    {(latest.category_scores?.length ?? 0) > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {latest.category_scores!.map((cat) => (
                          <div key={cat.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 44px', alignItems: 'center', gap: 14 }}>
                            <span style={{
                              fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700,
                              fontSize: 11, color: 'var(--olive-deep)', letterSpacing: '0.02em',
                            }}>
                              {cat.name?.[0]?.toUpperCase() || '·'}
                            </span>
                            <div>
                              <div style={{ fontSize: 11.5, marginBottom: 5, color: 'var(--ink-2)', fontWeight: 500 }}>
                                {cat.name}
                              </div>
                              <div className="bar bar-olive">
                                <span style={{ width: `${cat.percentage ?? 0}%` }} />
                              </div>
                            </div>
                            <span style={{
                              fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 400,
                              fontSize: 16, textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                            }}>
                              {Math.round(cat.percentage ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* No completed assessments but has in-progress */
                  <div style={{ padding: '40px 28px', textAlign: 'center' }}>
                    <p style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>
                      {lang === 'tr' ? 'Henüz tamamlanan değerlendirme yok.' : 'No completed assessments yet.'}
                    </p>
                  </div>
                )}
              </div>

              {/* ── Sidebar ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Dark action card */}
                <div style={{ background: 'var(--ink)', color: 'var(--cream)', padding: 26, position: 'relative', overflow: 'hidden' }}>
                  <Image
                    src="/assets/logo-leaf.png" alt="" width={120} height={120}
                    style={{ position: 'absolute', right: -36, top: -28, width: 120, opacity: 0.07, pointerEvents: 'none' }}
                  />
                  <span className="eyebrow" style={{ color: 'rgba(249,239,229,0.5)', position: 'relative', marginBottom: 10, display: 'block' }}>
                    {activeAttempt ? (lang === 'tr' ? 'Devam Et' : 'Continue') : (lang === 'tr' ? 'Yeni' : 'New')}
                  </span>
                  {activeAttempt?.cycle_name && (
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                      color: 'rgba(249,239,229,0.6)', letterSpacing: '0.12em',
                      textTransform: 'uppercase', position: 'relative', marginBottom: 4,
                    }}>
                      {activeAttempt.cycle_name}
                    </div>
                  )}
                  <h3 style={{
                    fontSize: 16, fontWeight: 500, marginBottom: 8,
                    color: 'var(--cream)', letterSpacing: '-0.01em', position: 'relative',
                    lineHeight: 1.3,
                  }}>
                    {activeAttempt
                      ? activeAttempt.survey_name
                      : (lang === 'tr' ? 'Yeni değerlendirme başlat' : 'Start a new assessment')}
                  </h3>
                  <p style={{ fontSize: 11.5, color: 'rgba(249,239,229,0.55)', marginBottom: 22, lineHeight: 1.55, position: 'relative' }}>
                    {activeAttempt
                      ? (lang === 'tr' ? 'Kaldığınız yerden devam edin.' : 'Pick up where you left off.')
                      : (lang === 'tr' ? 'ESG performansınızı ölçün.' : 'Measure your ESG performance now.')}
                  </p>
                  {activeAttempt && (() => {
                    const phaseIdx = V5_PHASES.findIndex(p => (activeAttempt.survey_name || '').includes(p.key));
                    const phaseNum = phaseIdx >= 0 ? phaseIdx + 1 : null;
                    const answered = activeAttempt.answered_count ?? 0;
                    const total    = activeAttempt.total_questions ?? 0;
                    const pct      = total > 0 ? Math.round((answered / total) * 100) : 0;
                    const savedTime = activeAttempt.started_at
                      ? new Date(activeAttempt.started_at).toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
                      : null;
                    return phaseNum ? (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em' }}>
                            {lang === 'tr' ? `AŞAMA ${phaseNum} / 5` : `PHASE ${phaseNum} OF 5`}
                          </span>
                          {savedTime && (
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                              {lang === 'tr' ? `Kaydedildi: ${savedTime}` : `Saved: ${savedTime}`}
                            </span>
                          )}
                        </div>
                        {total > 0 && (
                          <>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
                              {lang === 'tr' ? `Soru ${answered} / ${total}` : `Question ${answered} / ${total}`}
                              {' · '}{pct}% {lang === 'tr' ? 'tamamlandı' : 'complete'}
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.15)', height: 3, borderRadius: 2 }}>
                              <div style={{ background: 'var(--olive)', width: `${pct}%`, height: '100%', borderRadius: 2, transition: 'width 0.3s' }} />
                            </div>
                          </>
                        )}
                      </div>
                    ) : null;
                  })()}
                  <Link
                    href={activeAttempt ? `/questionnaire/${activeAttempt.id}` : '/surveys'}
                    style={{ textDecoration: 'none', position: 'relative', display: 'block' }}
                  >
                    <button style={{
                      width: '100%', padding: '11px 16px', borderRadius: 999,
                      background: 'var(--cream)', color: 'var(--ink)',
                      border: 'none', cursor: 'pointer',
                      fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      {activeAttempt
                        ? (lang === 'tr' ? 'Devam Et' : 'Continue')
                        : (lang === 'tr' ? 'Anket Seç' : 'Choose Survey')}
                      <Icon.arrow />
                    </button>
                  </Link>
                </div>

                {/* Quick links */}
                <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '18px 22px' }}>
                  <span className="eyebrow" style={{ display: 'block', marginBottom: 12 }}>
                    {lang === 'tr' ? 'Hızlı Erişim' : 'Quick Access'}
                  </span>
                  {([
                    [lang === 'tr' ? 'Anketler'   : 'Surveys',  '/surveys'],
                    [lang === 'tr' ? 'Geçmiş'     : 'History',  '/history'],
                    [lang === 'tr' ? 'Profilim'   : 'Profile',  '/profile'],
                    [lang === 'tr' ? 'Kurslar'    : 'Courses',  '/courses'],
                  ] as [string, string][]).map(([label, href], i, arr) => (
                    <Link key={label} href={href} style={{ textDecoration: 'none' }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 0',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
                        fontSize: 12, color: 'var(--ink)', cursor: 'pointer',
                        transition: 'color 0.1s',
                      }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--olive-deep)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink)')}
                      >
                        {label}
                        <span style={{ color: 'var(--ink-4)', fontSize: 10 }}><Icon.arrow /></span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Recent Activity ── */}
            <div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'baseline', marginBottom: 14,
              }}>
                <div>
                  <span className="eyebrow" style={{ display: 'block', marginBottom: 3 }}>
                    {lang === 'tr' ? 'Son Etkinlik' : 'Recent Activity'}
                  </span>
                  <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
                    {lang === 'tr' ? 'Değerlendirme zaman çizelgesi' : 'Assessment timeline'}
                  </h2>
                </div>
                {recentRows.length > 0 && (
                  <Link href="/history" style={{ textDecoration: 'none', fontSize: 11, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {lang === 'tr' ? 'Tümünü görüntüle' : 'View all'} <Icon.arrow />
                  </Link>
                )}
              </div>

              {recentRows.length === 0 ? (
                <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '28px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                    {lang === 'tr' ? 'Henüz tamamlanan değerlendirme yok.' : 'No completed assessments yet.'}
                  </p>
                </div>
              ) : (
                <div style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}>
                  {/* Table header */}
                  <div className="activity-header" style={{
                    display: 'grid', gridTemplateColumns: '1fr 140px 60px 52px 22px',
                    gap: 16, padding: '10px 24px',
                    borderBottom: '1px solid var(--line)',
                  }}>
                    {[
                      lang === 'tr' ? 'ANKETİN ADI' : 'SURVEY',
                      lang === 'tr' ? 'TARİH'       : 'DATE',
                      lang === 'tr' ? 'SKOR'        : 'SCORE',
                      lang === 'tr' ? 'NOT'         : 'GRADE',
                      '',
                    ].map((h, i) => (
                      <span key={i} style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                        color: 'var(--ink-4)', letterSpacing: '0.12em',
                        textAlign: i >= 2 ? 'right' : 'left',
                      }}>{h}</span>
                    ))}
                  </div>

                  {recentRows.map((row, i) => (
                    <Link key={row.id} href={`/results/${row.id}`} style={{ textDecoration: 'none' }}>
                      <div
                        className="activity-row"
                        style={{
                          display: 'grid', gridTemplateColumns: '1fr 140px 60px 52px 22px',
                          gap: 16, alignItems: 'center',
                          padding: '16px 24px',
                          borderBottom: i < recentRows.length - 1 ? '1px solid var(--line)' : 'none',
                          cursor: 'pointer', transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cream-deep)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div>
                          {row.cycle_name && (
                            <div style={{
                              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                              color: 'var(--olive-deep)', letterSpacing: '0.1em',
                              textTransform: 'uppercase', marginBottom: 2,
                            }}>
                              {row.cycle_name}
                            </div>
                          )}
                          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 13 }}>
                            {row.survey_name}
                          </span>
                        </div>
                        <span className="activity-date" style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: "'IBM Plex Mono', monospace" }}>
                          {row.completed_at ? new Date(row.completed_at).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB') : '—'}
                        </span>
                        <span style={{
                          fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
                          fontSize: 18, letterSpacing: '-0.02em',
                          fontVariantNumeric: 'tabular-nums', textAlign: 'right',
                        }}>
                          {Math.round(row.total_score ?? 0)}
                        </span>
                        <span style={{
                          fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600,
                          fontSize: 13, textAlign: 'right', color: gradeColor(row.overall_grade),
                        }}>
                          {row.overall_grade}
                        </span>
                        <span style={{ color: 'var(--ink-4)', textAlign: 'right' }}><Icon.arrow /></span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* ── Courses strip ── */}
            <CoursesStrip />
          </>
        )}
      </main>

      {/* ════════════════════════════════════════
          NEW ASSESSMENT MODAL
          ════════════════════════════════════════ */}
      {showNewModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
          /* No backdrop click-to-close — user must use Cancel or × button */
        >
          <div
            style={{
              background: 'var(--paper)', border: '1px solid var(--line)',
              padding: '40px 44px', maxWidth: 480, width: '100%',
              boxShadow: '0 12px 48px rgba(0,0,0,0.15)',
              position: 'relative',
            }}
          >
            {/* × close button */}
            <button
              onClick={() => setShowNewModal(false)}
              style={{
                position: 'absolute', top: 14, right: 16,
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 20, color: 'var(--ink-4)', lineHeight: 1,
                padding: '2px 6px',
              }}
              aria-label="Close"
            >×</button>

            {/* Modal header */}
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--ink-4)', display: 'block', marginBottom: 12,
            }}>
              {lang === 'tr' ? 'Yeni Değerlendirme' : 'New Assessment'}
            </span>
            <h2 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 6 }}>
              {lang === 'tr' ? 'Değerlendirmeyi başlat' : 'Start your assessment'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 28, lineHeight: 1.65 }}>
              {lang === 'tr'
                ? 'GRI v5 standartlarına göre 5 aşamalı ESG değerlendirmesi. İsteğe bağlı olarak bir isim ve açıklama ekleyebilirsiniz.'
                : '5-phase ESG assessment based on GRI v5 standards. Optionally add a name and description to identify this cycle.'}
            </p>

            {/* Today's date info */}
            <div style={{
              padding: '10px 14px', background: 'var(--cream-deep)',
              border: '1px solid var(--line)', marginBottom: 22,
              display: 'flex', gap: 20, alignItems: 'center',
            }}>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>
                  {lang === 'tr' ? 'BUGÜN' : 'TODAY'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>
                  {lang === 'tr' ? 'TOPLAM SORU' : 'TOTAL Q'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>330</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>
                  {lang === 'tr' ? 'AŞAMA' : 'PHASES'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>5</div>
              </div>
            </div>

            {/* Assessment name */}
            <label style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
              color: 'var(--ink-4)', letterSpacing: '0.12em',
              textTransform: 'uppercase', display: 'block', marginBottom: 6,
            }}>
              {lang === 'tr' ? 'Değerlendirme Adı' : 'Assessment Name'}
              <span style={{ color: 'var(--ink-4)', fontWeight: 400, marginLeft: 6 }}>
                ({lang === 'tr' ? 'isteğe bağlı' : 'optional'})
              </span>
            </label>
            <input
              type="text"
              autoFocus
              value={newAssessmentName}
              onChange={(e) => setNewAssessmentName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNewAssessmentStart()}
              placeholder={lang === 'tr' ? 'örn. Q1 2026, Yıllık Rapor…' : 'e.g. Q1 2026, Annual Report…'}
              style={{
                width: '100%', padding: '11px 14px',
                border: '1px solid var(--line)', background: 'var(--cream)',
                fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13,
                outline: 'none', marginBottom: 16, boxSizing: 'border-box',
              }}
            />

            {/* Description */}
            <label style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
              color: 'var(--ink-4)', letterSpacing: '0.12em',
              textTransform: 'uppercase', display: 'block', marginBottom: 6,
            }}>
              {lang === 'tr' ? 'Açıklama' : 'Description'}
              <span style={{ color: 'var(--ink-4)', fontWeight: 400, marginLeft: 6 }}>
                ({lang === 'tr' ? 'isteğe bağlı' : 'optional'})
              </span>
            </label>
            <textarea
              value={newAssessmentDesc}
              onChange={(e) => setNewAssessmentDesc(e.target.value)}
              placeholder={lang === 'tr' ? 'Bu değerlendirme hakkında notlar…' : 'Notes about this assessment…'}
              rows={3}
              style={{
                width: '100%', padding: '11px 14px',
                border: '1px solid var(--line)', background: 'var(--cream)',
                fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13,
                outline: 'none', marginBottom: 24, boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowNewModal(false)}
              >
                {lang === 'tr' ? 'İptal' : 'Cancel'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleNewAssessmentStart}
              >
                {lang === 'tr' ? 'Başlat' : 'Start Assessment'} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
