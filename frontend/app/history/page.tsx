'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { attemptAPI } from '@/lib/api';
import { gradeColor } from '@/lib/utils';
import AppNav from '@/components/AppNav';
import { useLang } from '@/lib/i18n';
import { Icon } from '@/components/shared';
import { CategoryScore } from '@/lib/types';
import ScoreTrendChart from '@/components/ScoreTrendChart';

interface BookmarkedQuestion {
  id: number;
  text: string;
  text_tr: string;
  text_en: string;
  criterion_code: string;
  order: number;
}

interface Attempt {
  id: number;
  survey_name: string;
  completed_at: string | null;  // M3: nullable — not set until the attempt is completed
  started_at: string;
  is_completed: boolean;
  total_score: number;
  overall_grade: string;
  category_scores: CategoryScore[];
  cycle_name: string;
  bookmarked_count: number;
  bookmarked_question_details: BookmarkedQuestion[];
}

export default function HistoryPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  // Fix R13-04: use only `t` — all strings now go through t() for consistent
  // bilingual i18n. Raw lang === 'tr' ? … : … ternaries have been removed.
  const { t, lang } = useLang();
  const [attempts,   setAttempts]   = useState<Attempt[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState(false);
  const [filter,     setFilter]     = useState<'all' | 'completed' | 'in-progress'>('all');
  const [surveyFilter, setSurveyFilter] = useState<string>('all');
  const [cycleSearch,  setCycleSearch]  = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  // Which attempt's bookmark list is currently expanded (attempt.id → true)
  const [expandedBookmarks, setExpandedBookmarks] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const data = await attemptAPI.getMyAttempts();
        if (!active) return;
        if (Array.isArray(data)) setAttempts(data);
        else if (data && Array.isArray(data.results)) setAttempts(data.results);
        else setAttempts([]);
      } catch {
        if (!active) return;
        setLoadError(true);
        setAttempts([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

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

  // All unique survey names for the survey filter dropdown
  const surveyNames = Array.from(new Set(attempts.map((a) => a.survey_name))).sort();
  // All unique, non-empty cycle names — sorted alphabetically for the search dropdown
  const cycleNames  = Array.from(new Set(
    attempts.map((a) => a.cycle_name || '').filter(Boolean)
  )).sort();

  const visible = attempts.filter((a) => {
    if (filter === 'completed')   { if (!a.is_completed)  return false; }
    if (filter === 'in-progress') { if (a.is_completed)   return false; }
    if (surveyFilter !== 'all' && a.survey_name !== surveyFilter) return false;
    // Cycle name search: substring match, case-insensitive
    if (cycleSearch.trim()) {
      const hay    = (a.cycle_name || '').toLowerCase();
      const needle = cycleSearch.trim().toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if (dateFrom) {
      const from = new Date(dateFrom).setHours(0, 0, 0, 0);
      const date = new Date(a.started_at).setHours(0, 0, 0, 0);
      if (date < from) return false;
    }
    if (dateTo) {
      const to   = new Date(dateTo).setHours(23, 59, 59, 999);
      const date = new Date(a.started_at).getTime();
      if (date > to) return false;
    }
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

        {/* Score trend chart — shown when 2+ completed attempts exist */}
        {completed.length >= 2 && (
          <div style={{
            background: 'var(--paper)', border: '1px solid var(--line)',
            padding: '20px 24px', marginBottom: 20,
          }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10, color: 'var(--ink-4)',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              marginBottom: 16,
            }}>
              {lang === 'tr' ? 'Skor Trendi' : 'Score Trend'}
            </div>
            <ScoreTrendChart attempts={completed} lang={lang} height={140} />
          </div>
        )}

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
              {visible.length} {t('courses_results')}
            </span>
            {completed.length > 0 && (
              <Link href="/results/combined" style={{ textDecoration: 'none' }}>
                <button style={{
                  padding: '7px 16px',
                  background: 'var(--olive-deep)', color: '#fff',
                  border: 'none', cursor: 'pointer',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontWeight: 600, fontSize: 11.5,
                  letterSpacing: '0.02em',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  📊 {lang === 'tr' ? 'Birleşik GRI Raporu' : 'Combined GRI Report'}
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* Advanced filters row — cycle search + survey dropdown + date range */}
        {(surveyNames.length > 1 || cycleNames.length > 0) && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
            marginBottom: 18, padding: '10px 14px',
            background: 'var(--paper)', border: '1px solid var(--line)',
          }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>
              {lang === 'tr' ? 'Filtre' : 'Filter'}
            </span>

            {/* Cycle name search input */}
            {cycleNames.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 10.5, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0 }}>
                  {lang === 'tr' ? 'Değerlendirme adı' : 'Assessment name'}
                </label>
                <input
                  type="search"
                  placeholder={lang === 'tr' ? 'Ara…' : 'Search…'}
                  value={cycleSearch}
                  onChange={(e) => setCycleSearch(e.target.value)}
                  style={{
                    padding: '4px 8px', fontSize: 11.5, border: '1px solid var(--line)',
                    background: 'var(--cream)', color: 'var(--ink)',
                    fontFamily: "'IBM Plex Sans', sans-serif", outline: 'none',
                    width: 160,
                  }}
                />
              </div>
            )}

            {/* Survey dropdown — only when multiple surveys exist */}
            {surveyNames.length > 1 && (
              <select
                value={surveyFilter}
                onChange={(e) => setSurveyFilter(e.target.value)}
                style={{
                  padding: '5px 10px', fontSize: 11.5, border: '1px solid var(--line)',
                  background: 'var(--cream)', color: 'var(--ink)',
                  fontFamily: "'IBM Plex Sans', sans-serif", cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="all">{lang === 'tr' ? 'Tüm anketler' : 'All surveys'}</option>
                {surveyNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            )}

            {/* Date from */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 10.5, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                {lang === 'tr' ? 'Başlangıç' : 'From'}
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  padding: '4px 8px', fontSize: 11.5, border: '1px solid var(--line)',
                  background: 'var(--cream)', color: 'var(--ink)',
                  fontFamily: "'IBM Plex Sans', sans-serif", outline: 'none',
                }}
              />
            </div>

            {/* Date to */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 10.5, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                {lang === 'tr' ? 'Bitiş' : 'To'}
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  padding: '4px 8px', fontSize: 11.5, border: '1px solid var(--line)',
                  background: 'var(--cream)', color: 'var(--ink)',
                  fontFamily: "'IBM Plex Sans', sans-serif", outline: 'none',
                }}
              />
            </div>

            {/* Clear filters */}
            {(surveyFilter !== 'all' || cycleSearch.trim() || dateFrom || dateTo) && (
              <button
                onClick={() => { setSurveyFilter('all'); setCycleSearch(''); setDateFrom(''); setDateTo(''); }}
                style={{
                  padding: '4px 10px', background: 'transparent',
                  border: '1px solid var(--line)', cursor: 'pointer',
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                  color: 'var(--ink-3)', letterSpacing: '0.06em',
                }}
              >
                {lang === 'tr' ? '× Temizle' : '× Clear'}
              </button>
            )}

            <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)' }}>
              {visible.length} {lang === 'tr' ? 'sonuç' : 'results'}
            </span>
          </div>
        )}

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
        ) : (() => {
          // Group attempts by cycle_name preserving order of first appearance (most recent first)
          const cycleGroups: { name: string; attempts: Attempt[] }[] = [];
          const seen = new Set<string>();
          for (const a of visible) {
            const key = a.cycle_name || '';
            if (!seen.has(key)) {
              seen.add(key);
              cycleGroups.push({ name: key, attempts: [] });
            }
            cycleGroups.find(g => g.name === key)!.attempts.push(a);
          }

          return (
            <div>
              {cycleGroups.map((group) => (
                <div key={group.name} style={{ marginBottom: 32 }}>
                  {/* Cycle header */}
                  <div style={{
                    padding: '8px 0', marginBottom: 12,
                    borderBottom: '1px solid var(--line)',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                      letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-4)',
                    }}>
                      {lang === 'tr' ? 'DÖNGÜ' : 'CYCLE'}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                      {group.name || (lang === 'tr' ? 'Etiketlenmemiş' : 'Unlabeled')}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                      · {group.attempts.length} {lang === 'tr' ? 'değerlendirme' : 'assessment(s)'}
                    </span>
                  </div>
                  {/* Attempts in this cycle */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {group.attempts.map((attempt) => (
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
                              <div>
                                {attempt.cycle_name && (
                                  <div style={{
                                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                                    color: 'var(--olive-deep)', letterSpacing: '0.12em',
                                    textTransform: 'uppercase', marginBottom: 3,
                                  }}>
                                    {attempt.cycle_name}
                                  </div>
                                )}
                                <h3 style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.01em' }}>
                                  {attempt.survey_name}
                                </h3>
                              </div>
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
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: 11.5, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace", alignItems: 'center' }}>
                              <span>{t('hist_started')} {new Date(attempt.started_at).toLocaleDateString()}</span>
                              {attempt.is_completed && attempt.completed_at && (
                                <span>{t('hist_finished')} {new Date(attempt.completed_at).toLocaleDateString()}</span>
                              )}
                              {/* Bookmark toggle button */}
                              {(attempt.bookmarked_count ?? 0) > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setExpandedBookmarks((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(attempt.id)) next.delete(attempt.id);
                                      else next.add(attempt.id);
                                      return next;
                                    });
                                  }}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    padding: '3px 10px',
                                    background: expandedBookmarks.has(attempt.id)
                                      ? 'rgba(194,153,62,0.15)'
                                      : 'transparent',
                                    border: '1px solid var(--amber)',
                                    color: 'var(--amber)',
                                    fontSize: 10, letterSpacing: '0.06em',
                                    cursor: 'pointer', fontFamily: 'inherit',
                                  }}
                                >
                                  🔖 {attempt.bookmarked_count} {lang === 'tr' ? 'işaretli' : 'flagged'}
                                  <span style={{ fontSize: 8, opacity: 0.7 }}>
                                    {expandedBookmarks.has(attempt.id) ? '▲' : '▼'}
                                  </span>
                                </button>
                              )}
                            </div>

                            {/* Expandable flagged questions list */}
                            {expandedBookmarks.has(attempt.id) &&
                              (attempt.bookmarked_question_details ?? []).length > 0 && (
                              <div style={{
                                marginTop: 12, padding: '12px 14px',
                                background: 'rgba(194,153,62,0.06)',
                                border: '1px solid rgba(194,153,62,0.3)',
                                borderLeft: '3px solid var(--amber)',
                              }}>
                                <div style={{
                                  fontFamily: "'IBM Plex Mono', monospace",
                                  fontSize: 9, letterSpacing: '0.12em',
                                  textTransform: 'uppercase', color: 'var(--amber)',
                                  marginBottom: 10,
                                }}>
                                  🔖 {lang === 'tr' ? 'İnceleme için işaretlenen sorular' : 'Questions flagged for review'}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {(attempt.bookmarked_question_details ?? []).map((bq) => {
                                    const qText = lang === 'tr'
                                      ? (bq.text_tr || bq.text)
                                      : (bq.text_en || bq.text);
                                    const truncated = qText.length > 100
                                      ? qText.slice(0, 100) + '…'
                                      : qText;
                                    return (
                                      <div key={bq.id} style={{
                                        display: 'flex', gap: 10, alignItems: 'flex-start',
                                      }}>
                                        {bq.criterion_code && (
                                          <span style={{
                                            fontFamily: "'IBM Plex Mono', monospace",
                                            fontSize: 9, color: 'var(--amber)',
                                            letterSpacing: '0.08em', whiteSpace: 'nowrap',
                                            marginTop: 1, minWidth: 36,
                                          }}>
                                            {bq.criterion_code}
                                          </span>
                                        )}
                                        <span style={{
                                          fontSize: 12, color: 'var(--ink-2)',
                                          lineHeight: 1.45,
                                        }}>
                                          {truncated}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

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
                </div>
              ))}
            </div>
          );
        })()}
      </main>
    </div>
  );
}
