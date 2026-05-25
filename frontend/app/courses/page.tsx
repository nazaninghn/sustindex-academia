'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/AppNav';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/shared';
import { elearningAPI } from '@/lib/api';

/* ─── Types ────────────────────────────────────────────────────── */
interface ApiCourse {
  id: number;
  title_display: string;
  description_display: string;
  tag: string;
  level: string;
  level_display: string;
  icon_emoji: string;
  duration_hours: string;
  total_lessons: number;
  progress_percentage: number;
  order: number;
}

/* ─── Helpers ──────────────────────────────────────────────────── */
function getStatus(c: ApiCourse): 'done' | 'active' | 'new' {
  if (c.progress_percentage >= 100) return 'done';
  if (c.progress_percentage > 0)    return 'active';
  return 'new';
}

/* ─── Skeleton card ────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--paper)', border: '1px solid var(--line)',
      padding: 26, minHeight: 260,
    }}>
      {[44, 18, 12, 12, 8].map((h, i) => (
        <div key={i} style={{
          height: h, marginBottom: i < 2 ? 22 : 10,
          background: 'var(--cream-deep)', borderRadius: 2,
          width: i === 0 ? 44 : i === 1 ? '70%' : '90%',
          animation: 'pulse 1.4s ease-in-out infinite',
        }} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Courses Page
   ═══════════════════════════════════════════════════════════════ */
export default function CoursesPage() {
  const { t, lang } = useLang();
  const { user, isLoading: authLoading } = useAuth();  // Fix C
  const router = useRouter();
  const [filter, setFilter] = useState('all');
  const [courses, setCourses] = useState<ApiCourse[]>([]);
  const [loading, setLoading] = useState(true);

  // Fix C: redirect unauthenticated users instead of showing empty page
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;   // wait for auth before fetching
    elearningAPI
      .getCourses()
      .then((data: any) => {
        const list: ApiCourse[] = Array.isArray(data) ? data : (data?.results ?? []);
        setCourses(list);
      })
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading) return null;

  const levelLabel = (l: string) =>
    l === 'beg'
      ? t('courses_level_beg')
      : l === 'int'
        ? t('courses_level_int')
        : t('courses_level_adv');

  const filters = [
    ['all',    t('courses_filter_all'),    courses.length],
    ['active', t('courses_filter_active'), courses.filter((c) => getStatus(c) === 'active').length],
    ['done',   t('courses_filter_done'),   courses.filter((c) => getStatus(c) === 'done').length],
    ['new',    t('courses_filter_new'),    courses.filter((c) => getStatus(c) === 'new').length],
  ] as [string, string, number][];

  const visible  = courses.filter((c) => filter === 'all' || getStatus(c) === filter);
  const activeCourse = courses.find((c) => getStatus(c) === 'active') ?? null;

  const num = (n: number) => String(n).padStart(2, '0');

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <AppNav />

      <main className="wrap" style={{ padding: '36px 32px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
          <div>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11, color: 'var(--ink-4)',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              display: 'block', marginBottom: 10,
            }}>
              {t('courses_eyebrow')}
            </span>
            <h1 style={{ fontSize: 36, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.05, marginBottom: 8 }}>
              {t('courses_h_1')}{' '}
              <em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500 }}>{t('courses_h_2')}</em>{' '}
              {t('courses_h_3')}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 560, lineHeight: 1.6 }}>{t('courses_desc')}</p>
          </div>
        </div>

        {/* Continue learning highlight — shown if an active course exists */}
        {!loading && activeCourse && (
          <div style={{
            background: 'var(--ink)', color: 'var(--cream)',
            padding: 28, marginBottom: 32,
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 32, alignItems: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            <Image src="/assets/logo-leaf.png" alt="" width={200} height={200} style={{
              position: 'absolute', right: -60, top: -40,
              width: 200, opacity: 0.06, pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative' }}>
              <span className="eyebrow" style={{ color: 'rgba(249,239,229,0.55)', display: 'block', marginBottom: 6 }}>
                {lang === 'tr' ? 'Öğrenmeye Devam Et' : 'Continue Learning'}
              </span>
              <h3 style={{ fontSize: 20, fontWeight: 500, marginBottom: 8, color: 'var(--cream)', letterSpacing: '-0.01em' }}>
                {activeCourse.title_display}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 11.5, color: 'rgba(249,239,229,0.65)', marginBottom: 14 }}>
                <span>
                  {Math.round(activeCourse.total_lessons * activeCourse.progress_percentage / 100)} / {activeCourse.total_lessons}{' '}
                  {lang === 'tr' ? 'modül' : 'modules'}
                </span>
                <span>·</span>
                <span>{activeCourse.duration_hours}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, maxWidth: 480 }}>
                <div style={{ flex: 1, height: 3, background: 'rgba(249,239,229,0.15)' }}>
                  <div style={{ width: `${activeCourse.progress_percentage}%`, height: '100%', background: 'var(--olive)' }} />
                </div>
                <span style={{
                  fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
                  fontSize: 22, color: 'var(--cream)', letterSpacing: '-0.03em',
                }}>
                  {activeCourse.progress_percentage}<span style={{ fontSize: 11, color: 'rgba(249,239,229,0.5)' }}>%</span>
                </span>
              </div>
            </div>
            {/* Fix U: resume button now navigates to the course */}
            <button
              onClick={() => router.push(`/courses/${activeCourse.id}`)}
              style={{
                padding: '12px 22px', borderRadius: 999,
                background: 'var(--cream)', color: 'var(--ink)',
                border: 'none', cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, position: 'relative',
              }}>
              {t('courses_resume')} <Icon.arrow />
            </button>
          </div>
        )}

        {/* Filter chips */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--line)',
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {filters.map(([k, l, count]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                padding: '6px 14px', borderRadius: 999,
                background: filter === k ? 'var(--ink)' : 'transparent',
                color: filter === k ? 'var(--cream)' : 'var(--ink-3)',
                border: 'none', cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 11.5,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                {l}
                <span style={{ fontSize: 10, opacity: 0.6, fontFamily: "'IBM Plex Mono', monospace" }}>{count}</span>
              </button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
            {loading ? '…' : `${visible.length} ${lang === 'tr' ? 'sonuç' : 'results'}`}
          </span>
        </div>

        {/* Course grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : visible.length === 0 ? (
          <div style={{
            background: 'var(--paper)', border: '1px solid var(--line)',
            padding: '64px 40px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              {lang === 'tr' ? 'Bu kategoride kurs bulunamadı.' : 'No courses found in this category.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {visible.map((c, idx) => {
              const status = getStatus(c);
              return (
                <div
                  key={c.id}
                  onClick={() => router.push(`/courses/${c.id}`)}  // Fix U: was not navigating
                  style={{
                    background: 'var(--paper)', border: '1px solid var(--line)',
                    padding: 26, display: 'flex', flexDirection: 'column',
                    cursor: 'pointer', transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ink-3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                >
                  {/* Top row: icon + number + status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 44, height: 44,
                        background: 'var(--cream-deep)', border: '1px solid var(--line)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20,
                      }}>{c.icon_emoji || '📚'}</div>
                      <div>
                        <span style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                          color: 'var(--ink-4)', letterSpacing: '0.08em', display: 'block', marginBottom: 2,
                        }}>
                          SX-EDU · {num(c.order || idx + 1)}
                        </span>
                        <span style={{
                          fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500,
                          fontSize: 11, color: 'var(--olive-deep)', letterSpacing: '0.04em',
                        }}>
                          {c.tag} · {levelLabel(c.level)}
                        </span>
                      </div>
                    </div>

                    {status === 'done' && (
                      <span style={{
                        fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10,
                        fontWeight: 600, color: 'var(--olive-deep)', letterSpacing: '0.1em',
                        textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}>
                        <Icon.check /> {t('courses_certificate')}
                      </span>
                    )}
                    {status === 'new' && (
                      <span style={{
                        fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10,
                        fontWeight: 600, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase',
                      }}>
                        {lang === 'tr' ? 'YENİ' : 'NEW'}
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: 18, marginBottom: 10, fontWeight: 500, letterSpacing: '-0.01em' }}>
                    {c.title_display}
                  </h3>
                  <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 22, lineHeight: 1.65 }}>
                    {c.description_display}
                  </p>

                  {/* Progress bar — active courses only */}
                  {c.progress_percentage > 0 && c.progress_percentage < 100 && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'baseline', marginBottom: 6,
                      }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)' }}>
                          {Math.round(c.total_lessons * c.progress_percentage / 100)} / {c.total_lessons}
                        </span>
                        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 11, color: 'var(--olive-deep)' }}>
                          {c.progress_percentage}%
                        </span>
                      </div>
                      <div className="bar bar-olive">
                        <span style={{ width: `${c.progress_percentage}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div style={{
                    marginTop: 'auto',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingTop: 18, borderTop: '1px solid var(--line)',
                  }}>
                    <div style={{ display: 'flex', gap: 22, alignItems: 'baseline' }}>
                      <div>
                        <span style={{
                          fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
                          fontSize: 20, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
                        }}>{c.total_lessons}</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>{t('courses_modules')}</span>
                      </div>
                      <span style={{
                        fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
                        fontSize: 20, letterSpacing: '-0.03em',
                      }}>{c.duration_hours}</span>
                    </div>
                    <button className={status === 'done' ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'}>
                      {status === 'done'
                        ? t('courses_review')
                        : status === 'active'
                          ? t('courses_resume')
                          : t('courses_start')}
                      <Icon.arrow />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
