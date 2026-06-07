'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { attemptAPI } from '@/lib/api';
import { gradeColor } from '@/lib/utils';
import AppNav from '@/components/AppNav';
import { useLang } from '@/lib/i18n';
import { Icon } from '@/components/shared';
import { CategoryScore } from '@/lib/types';

interface Attempt {
  id: number;
  survey_name: string;
  completed_at: string | null;  // M3: nullable — not set until the attempt is completed
  started_at: string;
  is_completed: boolean;
  total_score: number;
  overall_grade: string;
  category_scores: CategoryScore[];
}

export default function HistoryPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  // Fix R13-04: use only `t` — all strings now go through t() for consistent
  // bilingual i18n. Raw lang === 'tr' ? … : … ternaries have been removed.
  const { t } = useLang();
  const [attempts,   setAttempts]   = useState<Attempt[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState(false);
  const [filter,     setFilter]     = useState<'all' | 'completed' | 'in-progress'>('all');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  // Fix B: wrap in useCallback so the effect dependency is stable
  const loadAttempts = useCallback(async () => {
    try {
      const data = await attemptAPI.getMyAttempts();
      if (Array.isArray(data)) setAttempts(data);
      else if (data && Array.isArray(data.results)) setAttempts(data.results);
      else setAttempts([]);
    } catch {
      setLoadError(true);
      setAttempts([]);
    } finally {
      setLoading(false);
    }
  }, []); // no external deps — setAttempts/setLoading are stable

  useEffect(() => {
    if (user) loadAttempts();
  }, [user, loadAttempts]); // Fix B: loadAttempts now in deps

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
          {t('t_loading_auth')}
        </span>
      </div>
    );
  }

  if (!user) return null;

  /* ── Load error ── */
  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
        <AppNav />
        <main className="wrap" style={{ padding: '64px 32px', textAlign: 'center' }}>
          <div style={{ background: '#FFF5F3', border: '1px solid var(--danger)', padding: '18px 24px', display: 'inline-block' }}>
            <p style={{ fontSize: 13, color: 'var(--danger)' }}>
              {t('hist_load_error')}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const completed  = attempts.filter((a) => a.is_completed);
  const inProgress = attempts.filter((a) => !a.is_completed);
  const avgScore   = completed.length > 0
    ? Math.round(completed.reduce((s, a) => s + a.total_score, 0) / completed.length)
    : 0;

  const visible = attempts.filter((a) => {
    if (filter === 'completed')   return a.is_completed;
    if (filter === 'in-progress') return !a.is_completed;
    return true;
  });

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <AppNav />

      <main className="wrap" style={{ padding: '36px 32px 80px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 40 }}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.08em',
              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            }}>
              ← {t('course_back_dash')}
            </span>
          </Link>
          <h1 style={{ fontSize: 36, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.05, marginTop: 14, marginBottom: 6 }}>
            {t('hist_title_1')}{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500 }}>
              {t('hist_title_2')}
            </em>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            {t('hist_desc')}
          </p>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: t('hist_stat_total'),       value: attempts.length },
            { label: t('hist_stat_completed'),   value: completed.length },
            { label: t('hist_stat_in_progress'), value: inProgress.length },
            { label: t('hist_stat_avg'),         value: avgScore > 0 ? `${avgScore}%` : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: 'var(--paper)', border: '1px solid var(--line)',
              padding: '18px 20px',
            }}>
              <div style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontWeight: 300, fontSize: 28,
                letterSpacing: '-0.03em',
                fontVariantNumeric: 'tabular-nums',
                marginBottom: 4,
              }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Filter chips */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--line)',
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {([
              ['all',         t('courses_filter_all'),      attempts.length],
              ['completed',   t('hist_filter_completed'),   completed.length],
              ['in-progress', t('hist_filter_progress'),    inProgress.length],
            ] as [string, string, number][]).map(([k, l, count]) => (
              <button key={k} onClick={() => setFilter(k as typeof filter)} style={{
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
            {visible.length} {t('courses_results')}
          </span>
        </div>

        {/* Empty state */}
        {visible.length === 0 ? (
          <div style={{
            background: 'var(--paper)', border: '1px solid var(--line)',
            padding: '60px 40px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.02em', marginBottom: 8 }}>0</p>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 24 }}>
              {filter === 'all'
                ? t('hist_empty_all')
                : filter === 'completed'
                  ? t('hist_empty_completed')
                  : t('hist_empty_progress')}
            </p>
            <Link href="/surveys" style={{ textDecoration: 'none' }}>
              <button className="btn btn-primary">
                {t('hist_new_assessment')} <Icon.arrow />
              </button>
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visible.map((attempt) => (
              <div key={attempt.id} style={{
                background: 'var(--paper)', border: '1px solid var(--line)',
                padding: 24, transition: 'border-color 0.15s',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ink-3)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>

                  {/* Left: info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.01em' }}>
                        {attempt.survey_name}
                      </h3>
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                        padding: '2px 8px',
                        border: `1px solid ${attempt.is_completed ? 'var(--olive)' : 'var(--amber)'}`,
                        color: attempt.is_completed ? 'var(--olive-deep)' : 'var(--amber)',
                        background: attempt.is_completed ? 'var(--olive-pale)' : 'rgba(217,148,68,0.08)',
                      }}>
                        {attempt.is_completed ? t('hist_status_done') : t('hist_status_ongoing')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 20, fontSize: 11.5, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                      <span>{t('hist_started')} {new Date(attempt.started_at).toLocaleDateString()}</span>
                      {attempt.is_completed && attempt.completed_at && (
                        <span>{t('hist_finished')} {new Date(attempt.completed_at).toLocaleDateString()}</span>
                      )}
                    </div>

                    {/* Category scores */}
                    {attempt.is_completed && (attempt.category_scores?.length ?? 0) > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                        {attempt.category_scores.map((cat) => (
                          <div key={cat.id} style={{ minWidth: 120 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                                {cat.name}
                              </span>
                              <span style={{ fontSize: 10.5, fontFamily: "'IBM Plex Mono', monospace", color: 'var(--ink-2)' }}>
                                {Math.round(cat.percentage)}%
                              </span>
                            </div>
                            <div className="bar bar-olive">
                              <span style={{ width: `${Math.min(cat.percentage, 100)}%` }}></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: grade + action */}
                  {attempt.is_completed ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontFamily: "'IBM Plex Sans', sans-serif",
                          fontWeight: 300, fontSize: 40,
                          letterSpacing: '-0.04em',
                          color: gradeColor(attempt.overall_grade),
                          lineHeight: 1,
                          marginBottom: 4,
                        }}>
                          {attempt.overall_grade}
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)' }}>
                          {Math.round(attempt.total_score)}%
                        </div>
                      </div>
                      <Link href={`/results/${attempt.id}`} style={{ textDecoration: 'none' }}>
                        <button className="btn btn-primary btn-sm">
                          {t('hist_view_results')} <Icon.arrow />
                        </button>
                      </Link>
                    </div>
                  ) : (
                    <Link href={`/questionnaire/${attempt.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                      <button className="btn btn-outline btn-sm">
                        {t('courses_resume')} <Icon.arrow />
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
