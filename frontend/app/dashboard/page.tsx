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
  duration_hours: string;
  total_lessons: number;
  progress_percentage: number;
  order: number;
}

function timeAgo(isoDate: string | null, lang: string): string {
  if (!isoDate) return '';
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 60) return lang === 'tr' ? 'Az önce' : 'Just now';
  if (diff < 3600) { const m = Math.floor(diff / 60); return lang === 'tr' ? `${m} dk önce` : `${m}m ago`; }
  if (diff < 86400) { const h = Math.floor(diff / 3600); return lang === 'tr' ? `${h} sa önce` : `${h}h ago`; }
  const d = Math.floor(diff / 86400);
  return lang === 'tr' ? `${d} gün önce` : `${d}d ago`;
}

const V5_PHASES = [
  { key: 'Strateji',    labelEn: 'Governance',   labelTr: 'Yönetişim',  icon: '⚖' },
  { key: 'Cevre',       labelEn: 'Environment',  labelTr: 'Çevre',      icon: '🌿' },
  { key: 'Sosyal',      labelEn: 'Social',       labelTr: 'Sosyal',     icon: '👥' },
  { key: 'Ekonomik',    labelEn: 'Economic',     labelTr: 'Ekonomik',   icon: '📊' },
  { key: 'GRI Sector:', labelEn: 'Sector',       labelTr: 'Sektör',     icon: '🏭' },
];

/* ── Circular SVG Progress Ring ──────────────────────────────── */
function RingProgress({
  pct, size = 100, strokeWidth = 7,
  color = 'var(--olive-deep)', trackColor = 'var(--line)',
}: {
  pct: number; size?: number; strokeWidth?: number; color?: string; trackColor?: string;
}) {
  const r    = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(Math.max(pct, 0), 100) / 100 * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)', display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={trackColor} strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }} />
    </svg>
  );
}

/* ── Mini Spark Line ─────────────────────────────────────────── */
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
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ display: 'block', overflow: 'visible' }}>
      <path d={path} stroke={trend ? 'var(--olive-deep)' : 'var(--amber)'}
        strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={px(data.length - 1)} cy={py(data[data.length - 1])} r="3"
        fill={trend ? 'var(--olive-deep)' : 'var(--amber)'} />
    </svg>
  );
}

/* ── REDESIGNED Phase Journey ────────────────────────────────── */
function PhaseJourney({ attempts, lang }: { attempts: DashAttempt[]; lang: string }) {
  const phasesData = V5_PHASES.map((phase, i) => {
    const all        = attempts.filter(a => (a.survey_name || '').includes(phase.key));
    const completed  = all.find(a => a.is_completed) ?? null;
    const inProgress = !completed ? (all.find(a => !a.is_completed) ?? null) : null;
    return { ...phase, num: i + 1, completed, inProgress };
  });

  const completedCount = phasesData.filter(p => p.completed).length;
  const overallPct     = Math.round((completedCount / V5_PHASES.length) * 100);

  return (
    <div style={{
      background: 'var(--paper)', border: '1px solid var(--line)',
      padding: '28px 32px', marginBottom: 24,
    }}>
      {/* ── Top row: ring + title + overall bar ── */}
      <div style={{ display: 'flex', gap: 28, alignItems: 'center', marginBottom: 28 }}>

        {/* Completion ring */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <RingProgress pct={overallPct} size={90} strokeWidth={7}
            color={completedCount === 5 ? 'var(--olive-deep)' : completedCount > 0 ? 'var(--amber)' : 'var(--line)'}
            trackColor="var(--cream-deep)" />
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
              fontSize: 22, letterSpacing: '-0.04em', lineHeight: 1,
              color: 'var(--ink)',
            }}>{completedCount}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
              / 5
            </span>
          </div>
        </div>

        {/* Title + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)',
            letterSpacing: '0.13em', textTransform: 'uppercase', display: 'block', marginBottom: 5,
          }}>
            {lang === 'tr' ? 'DEĞERLENDİRME YOLCULUĞU' : 'ASSESSMENT JOURNEY'}
          </span>
          <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 6 }}>
            {lang === 'tr' ? 'GRI Sürdürülebilirlik Değerlendirmesi' : 'GRI Sustainability Assessment'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--cream-deep)', borderRadius: 2 }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${overallPct}%`,
                background: completedCount === 5 ? 'var(--olive-deep)'
                          : completedCount > 0 ? 'var(--amber)' : 'var(--line)',
                transition: 'width 0.8s ease',
              }} />
            </div>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
              color: 'var(--olive-deep)', letterSpacing: '0.06em', flexShrink: 0,
            }}>
              {overallPct}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Phase timeline ── */}
      <div style={{ position: 'relative' }}>
        {/* Connecting track line */}
        <div style={{
          position: 'absolute',
          top: 18, left: '10%', right: '10%', height: 2,
          background: 'var(--cream-deep)', zIndex: 0,
        }}>
          <div style={{
            height: '100%',
            width: completedCount > 0 ? `${((completedCount - (phasesData[completedCount - 1]?.inProgress ? 0 : 0)) / (V5_PHASES.length - 1)) * 100}%` : '0%',
            background: 'var(--olive-deep)',
            transition: 'width 0.8s ease',
          }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, position: 'relative', zIndex: 1 }}>
          {phasesData.map((phase) => {
            const isDone   = !!phase.completed;
            const isActive = !!phase.inProgress;
            const score    = isDone ? Math.round(phase.completed!.total_score ?? 0) : null;
            const grade    = phase.completed?.overall_grade ?? null;
            const answered = phase.inProgress?.answered_count ?? 0;
            const totalQ   = phase.inProgress?.total_questions ?? 0;
            const pct      = totalQ > 0 ? Math.round((answered / totalQ) * 100) : 0;

            const nodeColor  = isDone ? 'var(--olive-deep)' : isActive ? 'var(--amber)' : 'var(--cream-deep)';
            const nodeBorder = isDone ? 'var(--olive-deep)' : isActive ? 'var(--amber)' : 'var(--line)';
            const cardBg     = isDone ? 'var(--olive-wash)' : isActive ? 'rgba(194,153,62,0.06)' : 'var(--cream)';

            return (
              <div key={phase.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                {/* Phase node */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: nodeColor, border: `2px solid ${nodeBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, boxShadow: isDone ? '0 0 0 4px var(--olive-wash)' : isActive ? '0 0 0 4px rgba(194,153,62,0.12)' : 'none',
                  transition: 'all 0.3s',
                }}>
                  {isDone ? (
                    <span style={{ color: '#fff', fontSize: 14, lineHeight: 1 }}>✓</span>
                  ) : isActive ? (
                    <span style={{ color: '#fff', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{phase.num}</span>
                  ) : (
                    <span style={{ color: 'var(--ink-4)', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>{phase.num}</span>
                  )}
                </div>

                {/* Phase card */}
                <div style={{
                  width: '100%', background: cardBg,
                  border: `1px solid ${isDone ? 'rgba(76,110,75,0.2)' : isActive ? 'rgba(194,153,62,0.25)' : 'var(--line)'}`,
                  padding: '12px 10px',
                  opacity: !isDone && !isActive ? 0.55 : 1,
                  transition: 'opacity 0.2s',
                }}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 7.5,
                    color: isDone ? 'var(--olive-deep)' : isActive ? 'var(--amber)' : 'var(--ink-4)',
                    letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4,
                  }}>
                    {lang === 'tr' ? `AŞAMA ${phase.num}` : `PHASE ${phase.num}`}
                  </span>

                  <span style={{
                    fontSize: 11.5, fontWeight: 600, color: 'var(--ink)',
                    lineHeight: 1.3, marginBottom: 8, display: 'block',
                  }}>
                    {lang === 'tr' ? phase.labelTr : phase.labelEn}
                  </span>

                  {isDone && score !== null && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{
                        fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
                        fontSize: 28, letterSpacing: '-0.04em', color: 'var(--olive-deep)', lineHeight: 1,
                      }}>{score}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>%</span>
                      {grade && (
                        <span style={{
                          fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700,
                          fontSize: 14, color: gradeColor(grade), marginLeft: 2,
                        }}>{grade}</span>
                      )}
                    </div>
                  )}

                  {isActive && (
                    <div>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--amber)',
                        marginBottom: 5,
                      }}>
                        <span>{answered}/{totalQ > 0 ? totalQ : '?'} q</span>
                        <span>{pct}%</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(194,153,62,0.2)', borderRadius: 2 }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: 'var(--amber)', borderRadius: 2, transition: 'width 0.5s',
                        }} />
                      </div>
                    </div>
                  )}

                  {!isDone && !isActive && (
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 8,
                      color: 'var(--ink-4)', letterSpacing: '0.08em',
                    }}>
                      {lang === 'tr' ? '○ Başlanmadı' : '○ Not started'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function courseStatus(c: StripCourse): 'done' | 'active' | 'new' {
  if (c.progress_percentage >= 100) return 'done';
  if (c.progress_percentage > 0)    return 'active';
  return 'new';
}

/* ─── Courses Strip ──────────────────────────────────────────── */
function CoursesStrip() {
  const { lang, t } = useLang();
  const { user } = useAuth();
  const [courses, setCourses]           = useState<StripCourse[]>([]);
  const [stripLoading, setStripLoading] = useState(true);
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
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--line)',
      }}>
        <div>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>{t('courses_eyebrow')}</span>
          <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{t('dash_sust_courses')}</h2>
        </div>
        <Link href="/courses" style={{ textDecoration: 'none', fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {t('dash_all_courses')} <Icon.arrow />
        </Link>
      </div>

      {stripError && !stripLoading && (
        <div style={{ padding: '14px 18px', background: 'var(--paper)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>
          {t('courses_load_error')}
        </div>
      )}

      <div className="courses-strip-grid">
        {stripLoading
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: 20, minHeight: 160 }}>
                {[36, 14, 10, 8].map((h, j) => (
                  <div key={j} style={{ height: h, marginBottom: 12, background: 'var(--cream-deep)', borderRadius: 2, width: j === 0 ? 36 : j === 1 ? '75%' : '90%' }} />
                ))}
              </div>
            ))
          : courses.map((c, idx) => {
              const status = courseStatus(c);
              return (
                <Link key={c.id} href={`/courses/${c.id}`} style={{ textDecoration: 'none' }}>
                  <div
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: 20, height: '100%', display: 'flex', flexDirection: 'column', transition: 'border-color 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ink-3)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, background: 'var(--cream-deep)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                          {c.icon_emoji || '📚'}
                        </div>
                        <div>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.08em', display: 'block' }}>
                            SX·{String(c.order || idx + 1).padStart(2, '0')}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--olive-deep)', letterSpacing: '0.03em' }}>{c.tag}</span>
                        </div>
                      </div>
                      {status === 'done' && <span style={{ color: 'var(--olive-deep)' }}><Icon.check /></span>}
                      {status === 'new' && (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '2px 5px', border: '1px solid var(--line)' }}>
                          {lang === 'tr' ? 'YENİ' : 'NEW'}
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.35, marginBottom: 10, flex: 1 }}>{c.title_display}</h3>
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
                    <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>
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

      <div style={{ marginTop: 10, padding: '11px 18px', background: 'var(--cream-deep)', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{t('dash_coming_soon')}</span>
        <Link href="/courses" style={{ textDecoration: 'none' }}>
          <button className="btn btn-outline btn-sm">{lang === 'tr' ? 'Tüm Kurslar' : 'View All'} <Icon.arrow /></button>
        </Link>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Dashboard Page
   ═══════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { lang, t }                      = useLang();
  const { user, isLoading: authLoading } = useAuth();
  const router                           = useRouter();

  const [attempts,   setAttempts]   = useState<DashAttempt[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [hasLoadErr, setHasLoadErr] = useState(false);

  const [showNewModal,      setShowNewModal]      = useState(false);
  const [newAssessmentName, setNewAssessmentName] = useState('');
  const [newAssessmentDesc, setNewAssessmentDesc] = useState('');

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const refreshAttempts = useCallback(() => {
    if (!user) return;
    setHasLoadErr(false);
    attemptAPI.getMyAttempts()
      .then((data: DashAttempt[] | { results: DashAttempt[] }) => {
        if (!mountedRef.current) return;
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        const V5_PATTERNS = ['Strateji', 'Cevre', 'Sosyal', 'Ekonomik', 'GRI Sector:'];
        setAttempts(list.filter((a) => V5_PATTERNS.some((p) => (a.survey_name || '').includes(p))));
      })
      .catch(() => { if (mountedRef.current) setHasLoadErr(true); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, [user]);

  const handleNewAssessmentClick = useCallback(() => {
    setNewAssessmentName(''); setNewAssessmentDesc(''); setShowNewModal(true);
  }, []);

  const handleNewAssessmentStart = useCallback(() => {
    const name = newAssessmentName.trim() ||
      new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    try { localStorage.setItem('sx_pending_cycle', name); } catch { /* ignore */ }
    setShowNewModal(false);
    setTimeout(() => router.push('/surveys'), 80);
  }, [newAssessmentName, lang, router]);

  useEffect(() => {
    if (user) refreshAttempts();
    else if (!authLoading) setLoading(false);
  }, [user, authLoading, refreshAttempts]);

  useEffect(() => { return onDataChange(() => { refreshAttempts(); }); }, [refreshAttempts]);

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>
          {t('t_loading_auth')}
        </span>
      </div>
    );
  }

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
  const firstName     = user?.first_name || user?.username || '';
  const completed     = attempts.filter((a) => a.is_completed);
  const inProgress    = attempts.filter((a) => !a.is_completed);
  const latest        = completed.length > 0 ? completed[0] : null;
  const activeAttempt = inProgress[0] ?? null;
  const avgScore      = completed.length > 0
    ? Math.round(completed.reduce((s, a) => s + (a.total_score ?? 0), 0) / completed.length) : 0;
  const trendVals     = completed.slice(0, 6).reverse().map((a) => Math.round(a.total_score ?? 0));
  const recentRows    = completed.slice(0, 6);
  const hasData       = completed.length > 0 || inProgress.length > 0;

  const completedPhases = V5_PHASES.filter(ph =>
    attempts.some(a => (a.survey_name || '').includes(ph.key) && a.is_completed)
  ).length;
  const totalAnswered = attempts.reduce((sum, a) => sum + (a.answered_count ?? 0), 0);

  const dateStr = new Date().toLocaleDateString(
    lang === 'tr' ? 'tr-TR' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  );

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <AppNav />

      <main className="wrap" style={{ padding: '36px 32px 80px' }}>

        {/* ════════════════════════════════════════
            HERO HEADER
            ════════════════════════════════════════ */}
        <div style={{
          background: 'var(--paper)', border: '1px solid var(--line)',
          borderLeft: '4px solid var(--olive-deep)',
          padding: '28px 36px 30px', marginBottom: 24,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Faint background GRI text */}
          <div style={{
            position: 'absolute', right: -20, top: -10,
            fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700,
            fontSize: 140, letterSpacing: '-0.06em', lineHeight: 1,
            color: 'rgba(0,0,0,0.03)', userSelect: 'none', pointerEvents: 'none',
          }}>GRI</div>

          {/* Leaf watermark */}
          <div style={{ position: 'absolute', right: 40, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
            <Image src="/assets/logo-leaf.png" alt="" width={140} height={140}
              style={{ opacity: 0.05, width: 140 }} />
          </div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Date label */}
            <span style={{
              display: 'inline-block',
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
              color: 'var(--ink-4)', letterSpacing: '0.1em',
              textTransform: 'uppercase', marginBottom: 12,
            }}>{dateStr}</span>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h1 style={{
                  fontSize: 36, fontWeight: 400, letterSpacing: '-0.03em',
                  lineHeight: 1.05, marginBottom: 7, color: 'var(--ink)',
                }}>
                  {lang === 'tr' ? 'Hoşgeldin, ' : 'Welcome back, '}
                  <em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500 }}>{firstName}</em>.
                </h1>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 0 }}>
                  {!hasData
                    ? (lang === 'tr' ? 'İlk ESG değerlendirmenizi başlatmak için bir anket seçin.' : 'Choose a survey to start your first ESG assessment.')
                    : activeAttempt
                      ? (lang === 'tr' ? `${inProgress.length} değerlendirme devam ediyor.` : `${inProgress.length} assessment${inProgress.length !== 1 ? 's' : ''} in progress.`)
                      : (lang === 'tr' ? `${completed.length} değerlendirme tamamlandı.` : `${completed.length} assessment${completed.length !== 1 ? 's' : ''} completed.`)}
                </p>
                {activeAttempt && (
                  <p style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 5, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {lang === 'tr' ? 'Son aktivite:' : 'Last activity:'} {timeAgo(activeAttempt.started_at, lang)}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Link href="/history" style={{ textDecoration: 'none' }}>
                  <button style={{
                    padding: '9px 18px', background: 'transparent',
                    border: '1px solid var(--line)', color: 'var(--ink-3)',
                    cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif",
                    fontSize: 12, fontWeight: 500, transition: 'border-color 0.15s, color 0.15s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ink-3)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-3)'; }}
                  >
                    {lang === 'tr' ? 'Geçmiş' : 'History'}
                  </button>
                </Link>
                <button
                  onClick={handleNewAssessmentClick}
                  style={{
                    padding: '9px 18px', background: 'var(--olive)',
                    border: 'none', color: 'var(--ink)',
                    cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif",
                    fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--olive-deep)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--olive)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)'; }}
                >
                  {lang === 'tr' ? 'Yeni Değerlendirme' : 'New Assessment'} <Icon.plus />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════
            EMPTY STATE
            ════════════════════════════════════════ */}
        {!hasData ? (
          <>
            <div className="empty-card" style={{
              background: 'var(--paper)', border: '1px solid var(--line)',
              display: 'grid', gridTemplateColumns: '1fr 1px 1fr',
              marginBottom: 24, overflow: 'hidden',
            }}>
              <div style={{ padding: '52px 48px' }}>
                <div style={{
                  fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700,
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
              <div className="empty-card-divider" style={{ background: 'var(--line)' }} />
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
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--olive-deep)', flexShrink: 0, marginTop: 5 }} />
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
            {/* ── KPI Strip ── */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 0, marginBottom: 24,
              border: '1px solid var(--line)', background: 'var(--paper)',
            }}>
              {[
                {
                  label: lang === 'tr' ? 'TAMAMLANAN AŞAMA' : 'PHASES DONE',
                  value: completedPhases,
                  sub: `/ 5 ${lang === 'tr' ? 'GRI aşama' : 'GRI phases'}`,
                  ring: Math.round((completedPhases / 5) * 100),
                  ringColor: 'var(--olive-deep)',
                },
                {
                  label: lang === 'tr' ? 'CEVAPLANAN SORU' : 'QUESTIONS ANS.',
                  value: totalAnswered > 0 ? totalAnswered : '—',
                  sub: lang === 'tr' ? 'toplam cevaplanan' : 'total answered',
                  ring: null, ringColor: '',
                },
                {
                  label: lang === 'tr' ? 'ORT. SKOR' : 'AVG. SCORE',
                  value: avgScore > 0 ? avgScore : '—',
                  sub: lang === 'tr' ? 'genel ortalama' : 'overall average',
                  ring: avgScore > 0 ? avgScore : null, ringColor: 'var(--amber)',
                },
                {
                  label: lang === 'tr' ? 'SON NOT' : 'LATEST GRADE',
                  value: latest?.overall_grade ?? '—',
                  sub: latest ? `${Math.round(latest.total_score ?? 0)} pts` : '—',
                  ring: null, ringColor: '', gradeVal: latest?.overall_grade,
                },
              ].map((s, i) => (
                <div key={i} style={{
                  padding: '22px 24px',
                  borderRight: i < 3 ? '1px solid var(--line)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  {/* Mini ring for phases / score */}
                  {s.ring !== null && (
                    <div style={{ flexShrink: 0, position: 'relative' }}>
                      <RingProgress pct={s.ring} size={52} strokeWidth={5} color={s.ringColor} trackColor="var(--cream-deep)" />
                      <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)' }}>
                          {s.ring}%
                        </span>
                      </div>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 8.5,
                      color: 'var(--ink-4)', letterSpacing: '0.13em', textTransform: 'uppercase',
                      display: 'block', marginBottom: 6,
                    }}>{s.label}</span>
                    <div style={{
                      fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
                      fontSize: 36, letterSpacing: '-0.04em', lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums', marginBottom: 4,
                      color: s.gradeVal ? gradeColor(s.gradeVal) : 'var(--ink)',
                    }}>{s.value}</div>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>{s.sub}</span>
                  </div>
                </div>
              ))}
            </div>

            <PhaseJourney attempts={attempts} lang={lang} />

            {/* ── 2-col: performance + sidebar ── */}
            <div className="content-grid-main">

              {/* ── Performance card ── */}
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}>
                <div style={{
                  padding: '20px 28px', borderBottom: '1px solid var(--line)',
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
                    {/* Score hero with ring */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32, paddingBottom: 28, borderBottom: '1px solid var(--line)' }}>
                      {/* Score ring */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <RingProgress
                          pct={Math.round(latest.total_score ?? 0)}
                          size={110} strokeWidth={8}
                          color={gradeColor(latest.overall_grade)}
                          trackColor="var(--cream-deep)"
                        />
                        <div style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{
                            fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
                            fontSize: 30, letterSpacing: '-0.04em', lineHeight: 1,
                            color: 'var(--ink)',
                          }}>{Math.round(latest.total_score ?? 0)}</span>
                          <span style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 2 }}>/ 100</span>
                        </div>
                      </div>

                      <div>
                        <div style={{
                          fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700,
                          fontSize: 52, letterSpacing: '-0.03em', lineHeight: 1,
                          color: gradeColor(latest.overall_grade), marginBottom: 4,
                        }}>{latest.overall_grade || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                          {lang === 'tr' ? 'Genel not' : 'Overall grade'}
                        </div>
                      </div>

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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {latest.category_scores!.map((cat) => (
                          <div key={cat.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>{cat.name}</span>
                              <span style={{
                                fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 400,
                                fontSize: 15, letterSpacing: '-0.02em',
                                color: cat.percentage >= 60 ? 'var(--olive-deep)' : cat.percentage >= 35 ? 'var(--amber)' : 'var(--danger)',
                              }}>
                                {Math.round(cat.percentage ?? 0)}%
                              </span>
                            </div>
                            <div style={{ height: 6, background: 'var(--cream-deep)', borderRadius: 3 }}>
                              <div style={{
                                height: '100%', borderRadius: 3,
                                width: `${cat.percentage ?? 0}%`,
                                background: cat.percentage >= 60 ? 'var(--olive-deep)' : cat.percentage >= 35 ? 'var(--amber)' : 'var(--danger)',
                                transition: 'width 0.8s ease',
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '40px 28px', textAlign: 'center' }}>
                    <p style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>
                      {lang === 'tr' ? 'Henüz tamamlanan değerlendirme yok.' : 'No completed assessments yet.'}
                    </p>
                  </div>
                )}
              </div>

              {/* ── Sidebar ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Action card */}
                <div style={{
                  background: 'var(--paper)', border: '1px solid var(--line)',
                  borderLeft: '4px solid var(--olive-deep)',
                  padding: 26, position: 'relative', overflow: 'hidden',
                }}>
                  <Image
                    src="/assets/logo-leaf.png" alt="" width={120} height={120}
                    style={{ position: 'absolute', right: -36, top: -28, width: 120, opacity: 0.04, pointerEvents: 'none' }}
                  />
                  <span className="eyebrow" style={{ color: 'var(--ink-4)', position: 'relative', marginBottom: 10, display: 'block' }}>
                    {activeAttempt ? (lang === 'tr' ? 'Devam Et' : 'Continue') : (lang === 'tr' ? 'Yeni' : 'New')}
                  </span>
                  {activeAttempt?.cycle_name && (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--olive-deep)', letterSpacing: '0.12em', textTransform: 'uppercase', position: 'relative', marginBottom: 4 }}>
                      {activeAttempt.cycle_name}
                    </div>
                  )}
                  <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, color: 'var(--ink)', letterSpacing: '-0.01em', position: 'relative', lineHeight: 1.3 }}>
                    {activeAttempt ? activeAttempt.survey_name : (lang === 'tr' ? 'Yeni değerlendirme başlat' : 'Start a new assessment')}
                  </h3>
                  <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 22, lineHeight: 1.55, position: 'relative' }}>
                    {activeAttempt ? (lang === 'tr' ? 'Kaldığınız yerden devam edin.' : 'Pick up where you left off.') : (lang === 'tr' ? 'ESG performansınızı ölçün.' : 'Measure your ESG performance now.')}
                  </p>
                  {activeAttempt && (() => {
                    const phaseIdx = V5_PHASES.findIndex(p => (activeAttempt.survey_name || '').includes(p.key));
                    const phaseNum = phaseIdx >= 0 ? phaseIdx + 1 : null;
                    const answered = activeAttempt.answered_count ?? 0;
                    const total    = activeAttempt.total_questions ?? 0;
                    const pct      = total > 0 ? Math.round((answered / total) * 100) : 0;
                    return phaseNum ? (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em' }}>
                            {lang === 'tr' ? `AŞAMA ${phaseNum} / 5` : `PHASE ${phaseNum} OF 5`}
                          </span>
                        </div>
                        {total > 0 && (
                          <>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-3)', marginBottom: 6 }}>
                              {lang === 'tr' ? `Soru ${answered} / ${total}` : `Question ${answered} / ${total}`} · {pct}% {lang === 'tr' ? 'tamamlandı' : 'complete'}
                            </div>
                            <div style={{ background: 'var(--cream-deep)', height: 4, borderRadius: 2 }}>
                              <div style={{ background: 'var(--olive-deep)', width: `${pct}%`, height: '100%', borderRadius: 2, transition: 'width 0.3s' }} />
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
                      width: '100%', padding: '11px 16px',
                      background: 'var(--olive-deep)', color: '#fff',
                      border: 'none', cursor: 'pointer',
                      fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      {activeAttempt ? (lang === 'tr' ? 'Devam Et' : 'Continue') : (lang === 'tr' ? 'Anket Seç' : 'Choose Survey')}
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
                    [lang === 'tr' ? 'Anketler'     : 'Surveys',     '/surveys'],
                    [lang === 'tr' ? 'Geçmiş'       : 'History',     '/history'],
                    [lang === 'tr' ? 'Eylem Planı'  : 'Action Plan', '/action-plan'],
                    [lang === 'tr' ? 'Belgeler'     : 'Documents',   '/documents'],
                    [lang === 'tr' ? 'Profilim'     : 'Profile',     '/profile'],
                  ] as [string, string][]).map(([label, href], i, arr) => (
                    <Link key={label} href={href} style={{ textDecoration: 'none' }}>
                      <div
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 0',
                          borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
                          fontSize: 12, color: 'var(--ink)', cursor: 'pointer', transition: 'color 0.1s',
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
            <div style={{ marginTop: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
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
                  <div className="activity-header" style={{
                    display: 'grid', gridTemplateColumns: '1fr 140px 60px 52px 22px',
                    gap: 16, padding: '10px 24px', borderBottom: '1px solid var(--line)',
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
                          gap: 16, alignItems: 'center', padding: '16px 24px',
                          borderBottom: i < recentRows.length - 1 ? '1px solid var(--line)' : 'none',
                          cursor: 'pointer', transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cream-deep)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div>
                          {row.cycle_name && (
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--olive-deep)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
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

            <CoursesStrip />
          </>
        )}
      </main>

      {/* ════════════════════════════════════════
          NEW ASSESSMENT MODAL
          ════════════════════════════════════════ */}
      {showNewModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--paper)', border: '1px solid var(--line)',
            padding: '40px 44px', maxWidth: 480, width: '100%',
            boxShadow: '0 12px 48px rgba(0,0,0,0.15)', position: 'relative',
          }}>
            <button onClick={() => setShowNewModal(false)} style={{
              position: 'absolute', top: 14, right: 16,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, color: 'var(--ink-4)', lineHeight: 1, padding: '2px 6px',
            }} aria-label="Close">×</button>

            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-4)', display: 'block', marginBottom: 12 }}>
              {lang === 'tr' ? 'Yeni Değerlendirme' : 'New Assessment'}
            </span>
            <h2 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 6 }}>
              {lang === 'tr' ? 'Değerlendirmeyi başlat' : 'Start your assessment'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 28, lineHeight: 1.65 }}>
              {lang === 'tr'
                ? 'GRI v5 standartlarına göre 5 aşamalı ESG değerlendirmesi.'
                : '5-phase ESG assessment based on GRI v5 standards.'}
            </p>

            <div style={{ padding: '10px 14px', background: 'var(--cream-deep)', border: '1px solid var(--line)', marginBottom: 22, display: 'flex', gap: 20, alignItems: 'center' }}>
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

            <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              {lang === 'tr' ? 'Değerlendirme Adı' : 'Assessment Name'}
              <span style={{ color: 'var(--ink-4)', fontWeight: 400, marginLeft: 6 }}>({lang === 'tr' ? 'isteğe bağlı' : 'optional'})</span>
            </label>
            <input
              type="text" autoFocus
              value={newAssessmentName}
              onChange={(e) => setNewAssessmentName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNewAssessmentStart()}
              placeholder={lang === 'tr' ? 'örn. Q1 2026, Yıllık Rapor…' : 'e.g. Q1 2026, Annual Report…'}
              style={{ width: '100%', padding: '11px 14px', border: '1px solid var(--line)', background: 'var(--cream)', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
            />

            <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              {lang === 'tr' ? 'Açıklama' : 'Description'}
              <span style={{ color: 'var(--ink-4)', fontWeight: 400, marginLeft: 6 }}>({lang === 'tr' ? 'isteğe bağlı' : 'optional'})</span>
            </label>
            <textarea
              value={newAssessmentDesc}
              onChange={(e) => setNewAssessmentDesc(e.target.value)}
              placeholder={lang === 'tr' ? 'Bu değerlendirme hakkında notlar…' : 'Notes about this assessment…'}
              rows={3}
              style={{ width: '100%', padding: '11px 14px', border: '1px solid var(--line)', background: 'var(--cream)', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, outline: 'none', marginBottom: 24, boxSizing: 'border-box', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setShowNewModal(false)}>
                {lang === 'tr' ? 'İptal' : 'Cancel'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleNewAssessmentStart}>
                {lang === 'tr' ? 'Başlat' : 'Start Assessment'} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
