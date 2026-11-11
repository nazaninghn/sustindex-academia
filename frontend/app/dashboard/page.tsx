'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/AppNav';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { attemptAPI, elearningAPI, surveyAPI, actionTaskAPI } from '@/lib/api';
import type { ActionTask } from '@/lib/api';
import { onDataChange } from '@/lib/events';
import { PHASES, buildModel, rankCategories } from '@/lib/dashboard-data';
import type { DashAttempt, SurveyLite } from '@/lib/dashboard-data';
import { Reveal, useInView } from '@/components/dashboard/motion';
import { Ic } from '@/components/dashboard/icons';
import {
  KpiRow, PerformanceCard, EsgCard, PhaseProgress, InsightsCard, LatestCard,
  RecommendationsCard, RecentCard, QuickCard, FirstTime, DashSkeleton, T, cycleLabel, fmtDate, nextAction,
} from '@/components/dashboard/sections';
import type { Detail, LoadState, NameMap, Rec, RecWithPhase } from '@/components/dashboard/sections';
import './dashboard.css';

/* ─── Types ─────────────────────────────────────────────────── */
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

function courseStatus(c: StripCourse): 'done' | 'active' | 'new' {
  if (c.progress_percentage >= 100) return 'done';
  if (c.progress_percentage > 0)    return 'active';
  return 'new';
}

/* ─── E-learning courses (same data, links, progress values and completion states; dashboard visual language) ─── */
function CoursesStrip() {
  const { lang, t } = useLang();
  const { user } = useAuth();
  const [courses, setCourses]           = useState<StripCourse[]>([]);
  const [stripLoading, setStripLoading] = useState(true);
  const [stripError, setStripError]     = useState(false);
  const [ref, shown] = useInView<HTMLElement>(0.1);

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
    <section ref={ref} className="da-card">
      <div className="da-head">
        <div className="da-head-t">
          <div className="da-h2row"><h2 className="da-h2">{t('dash_sust_courses')}</h2></div>
          <p className="da-sub">{t('courses_eyebrow')}</p>
        </div>
        <Link href="/courses" className="da-link">{t('dash_all_courses')} <Ic name="arrow" size={13} /></Link>
      </div>

      {stripError && !stripLoading && <p className="da-err da-courses-err">{t('courses_load_error')}</p>}

      <div className="da-courses-grid">
        {stripLoading
          ? [1, 2, 3, 4].map((i) => <div key={i} className="da-course da-sk" style={{ minHeight: 168 }} />)
          : courses.map((c, idx) => {
              const status = courseStatus(c);
              const pct = Math.min(100, Math.max(0, c.progress_percentage));
              return (
                <Link key={c.id} href={`/courses/${c.id}`} className={`da-course is-${status}`}>
                  <div className="da-course-top">
                    <span className="da-course-ic" aria-hidden="true">{c.icon_emoji || <Ic name="book" size={17} />}</span>
                    <div>
                      <small>SX·{String(c.order || idx + 1).padStart(2, '0')}</small>
                      <b>{c.tag}</b>
                    </div>
                    <span className={`da-chip c-course-${status}`}>
                      {status === 'done' ? T(lang, 'Completed', 'Tamamlandı') : status === 'active' ? T(lang, 'In progress', 'Devam ediyor') : T(lang, 'New', 'Yeni')}
                    </span>
                  </div>
                  <h3>{c.title_display}</h3>
                  <div className="da-course-prog">
                    <div className="da-bar"><div className="da-anim-w" style={{ width: shown ? `${pct}%` : '0%' }} /></div>
                    <span>{pct}%</span>
                  </div>
                  <div className="da-course-foot">
                    <span>{c.total_lessons} {T(lang, 'modules', 'modül')} · {c.duration_hours}</span>
                    <span className="da-course-cta">
                      {status === 'done' ? T(lang, 'Review', 'Tekrar') : status === 'active' ? T(lang, 'Resume', 'Devam') : T(lang, 'Start', 'Başla')} <Ic name="arrow" size={12} />
                    </span>
                  </div>
                </Link>
              );
            })}
      </div>

      <div className="da-courses-foot">
        <span><Ic name="lock" size={13} />{t('dash_coming_soon').replace(/^\s*🔒\s*/u, '')}</span>
        <Link href="/courses" className="da-btn da-btn-sm">{T(lang, 'View all courses', 'Tüm kursları gör')} <Ic name="arrow" size={12} /></Link>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   Dashboard Page
   ═══════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { lang, t }                      = useLang();
  const { user, isLoading: authLoading } = useAuth();
  const router                           = useRouter();
  const go = useCallback((href: string) => router.push(href), [router]);

  const [attempts,   setAttempts]   = useState<DashAttempt[]>([]);
  const [surveys,    setSurveys]    = useState<SurveyLite[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [hasLoadErr, setHasLoadErr] = useState(false);

  // Detail records (localised category names, recommendations, maturity) of each phase's latest completed attempt
  const [details,      setDetails]      = useState<Record<number, Detail>>({});
  const [detailsState, setDetailsState] = useState<LoadState>('idle');

  // Existing action-plan tasks (read-only here, plus "Add to plan" which uses the same API as the Results page)
  const [tasks,      setTasks]      = useState<ActionTask[]>([]);
  const [tasksState, setTasksState] = useState<LoadState>('idle');

  // Assessment cycle shown by the progress figures. null = the cycle of the most recent attempt (the default).
  const [cycle, setCycle] = useState<string | null>(null);

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

  const refreshTasks = useCallback(() => {
    if (!user) return;
    actionTaskAPI.getMyTasks()
      .then((list) => { if (mountedRef.current) { setTasks(list); setTasksState('done'); } })
      .catch(() => { if (mountedRef.current) setTasksState('error'); });
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

  useEffect(() => { return onDataChange(() => { refreshAttempts(); refreshTasks(); }); }, [refreshAttempts, refreshTasks]);

  useEffect(() => { if (user) { setTasksState('loading'); refreshTasks(); } }, [user, refreshTasks]);

  // Question counts for phases that have not been started (used for "remaining questions"). Optional data.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    surveyAPI.getSurveys()
      .then((d: SurveyLite[] | { results: SurveyLite[] }) => { if (!cancelled) setSurveys(Array.isArray(d) ? d : (d?.results ?? [])); })
      .catch(() => { /* totals for unstarted phases simply stay unknown */ });
    return () => { cancelled = true; };
  }, [user]);

  /* ── Analytics model (pure derivation from the API data above) ── */
  const model = useMemo(() => buildModel(attempts, surveys, cycle), [attempts, surveys, cycle]);

  const latestIds = PHASES.map((p) => model.latest[p.num]?.id).filter((x): x is number => typeof x === 'number');
  const latestKey = latestIds.join(',');
  useEffect(() => {
    if (!latestKey) { setDetails({}); setDetailsState('idle'); return; }
    let cancelled = false;
    const ids = latestKey.split(',').map(Number);
    setDetailsState('loading');
    Promise.allSettled(ids.map((id) => attemptAPI.getAttempt(id))).then((rs) => {
      if (cancelled) return;
      const map: Record<number, Detail> = {};
      let ok = 0;
      rs.forEach((r, i) => { if (r.status === 'fulfilled') { map[ids[i]] = r.value as Detail; ok += 1; } });
      setDetails(map);
      setDetailsState(ok === rs.length ? 'done' : ok > 0 ? 'partial' : 'error');
    });
    return () => { cancelled = true; };
  }, [latestKey]);

  const names = useMemo<NameMap>(() => {
    const out: NameMap = {};
    for (const [aid, d] of Object.entries(details)) {
      out[Number(aid)] = {};
      for (const c of d.category_scores ?? []) out[Number(aid)][c.id] = c.name;
    }
    return out;
  }, [details]);
  const cats = useMemo(() => rankCategories(model, names), [model, names]);

  // Recommendations come from the backend's existing rules (categories below 80%), highest priority first
  const recs = useMemo(() => {
    const prio = { High: 0, Medium: 1, Low: 2 } as const;
    const all: RecWithPhase[] = [];
    for (const p of PHASES) {
      const r = model.latest[p.num];
      if (!r) continue;
      for (const rec of (details[r.id]?.recommendations ?? []) as Rec[]) all.push({ ...rec, phase: p.num, attemptId: r.id });
    }
    all.sort((a, b) => (prio[a.priority] ?? 3) - (prio[b.priority] ?? 3) || a.score_pct - b.score_pct);
    const seen = new Set<string>();
    return all.filter((r) => { if (seen.has(r.title)) return false; seen.add(r.title); return true; });
  }, [model, details]);

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
        <AppNav />
        <main className="wrap da-main"><DashSkeleton /></main>
      </div>
    );
  }

  if (hasLoadErr) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
        <AppNav />
        <main className="wrap da-main">
          <div className="da-card da-loaderr" role="alert">
            <p>{lang === 'tr' ? 'Değerlendirmeler yüklenemedi.' : 'Failed to load assessments.'}</p>
            <button type="button" className="da-btn" onClick={() => { setLoading(true); refreshAttempts(); }}>{lang === 'tr' ? 'Tekrar dene' : 'Try again'}</button>
          </div>
        </main>
      </div>
    );
  }

  const firstName = user?.first_name || user?.username || '';
  const company   = user?.company_name?.trim() || '';
  const dateStr = new Date().toLocaleDateString(
    lang === 'tr' ? 'tr-TR' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  );
  // Most recent real activity = newest start / completion timestamp among the loaded attempts
  const lastActivity = attempts.reduce<string | null>((best, a) => {
    for (const iso of [a.completed_at, a.started_at]) if (iso && (!best || iso > best)) best = iso;
    return best;
  }, null);
  const na = nextAction(model, lang);
  const live = na.kind === 'continue' ? na.phase : undefined;

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <AppNav />

      <main className="wrap da-main">

        {/* ── Executive overview: organisation, welcome, cycle selector, assessment context ── */}
        <header className="da-top">
          <div className="da-top-main">
            <span className="da-eyebrow">{T(lang, 'Sustainability performance dashboard', 'Sürdürülebilirlik performans panosu')}</span>
            <h1 className="da-title">{company || <>{T(lang, 'Welcome back, ', 'Hoş geldiniz, ')}{firstName}</>}</h1>
            <p className="da-welcome">
              {company && <>{T(lang, 'Welcome back, ', 'Hoş geldiniz, ')}<b>{firstName}</b>. </>}
              {T(lang, 'Track your ESG performance, assessment progress and key improvement areas.', 'ESG performansınızı, değerlendirme ilerlemenizi ve öncelikli gelişim alanlarınızı izleyin.')}
            </p>
            <ul className="da-meta">
              <li><Ic name="calendar" size={13} />{dateStr}</li>
              {model.cycles.length > 0 && (
                <li><Ic name="target" size={13} />{T(lang, `${model.phasesCompleted} of ${PHASES.length} phases completed`, `${PHASES.length} aşamadan ${model.phasesCompleted} tanesi tamamlandı`)}</li>
              )}
              {live && <li><Ic name="play" size={13} />{T(lang, 'In progress', 'Devam eden')}: {na.sub}</li>}
              {lastActivity && <li><Ic name="clock" size={13} />{T(lang, 'Last activity', 'Son etkinlik')} {fmtDate(lastActivity, lang)}</li>}
            </ul>
          </div>
          <div className="da-top-side">
            {model.cycles.length > 0 && (
              <label className="da-cycle">
                <Ic name="calendar" size={15} />
                <span>{T(lang, 'Assessment cycle', 'Değerlendirme dönemi')}</span>
                <select value={model.activeCycle} onChange={(e) => setCycle(e.target.value)} aria-label={T(lang, 'Assessment cycle', 'Değerlendirme dönemi')}>
                  {model.cycles.map((c) => (
                    <option key={c || '__none'} value={c}>{cycleLabel(c, lang)}{c === model.latestCycle && model.cycles.length > 1 ? T(lang, ' (current)', ' (güncel)') : ''}</option>
                  ))}
                </select>
                <Ic name="chevron" size={14} className="da-cycle-chev" />
              </label>
            )}
            <div className="da-actions">
              <Link href="/history" className="da-btn">{lang === 'tr' ? 'Geçmiş' : 'History'}</Link>
              <button type="button" className={`da-btn${model.hasResults ? '' : ' da-btn-primary'}`} onClick={handleNewAssessmentClick}>
                <Ic name="plus" size={13} /> {lang === 'tr' ? 'Yeni Değerlendirme' : 'New Assessment'}
              </button>
              {model.hasResults && na.kind !== 'none' && (
                <Link href={na.href} className="da-btn da-btn-primary" title={na.sub}>{na.label} <Ic name="arrow" size={13} /></Link>
              )}
            </div>
          </div>
        </header>

        {model.activeCycle !== model.latestCycle && (
          <p className="da-cycle-note" role="status">
            <Ic name="info" size={14} />
            <span>
              {T(lang,
                `Progress, completion and question counts show the “${cycleLabel(model.activeCycle, lang)}” cycle. Scores always show the latest completed result of each phase, because one scored result is kept per assessment.`,
                `İlerleme, tamamlanma ve soru sayıları “${cycleLabel(model.activeCycle, lang)}” dönemini gösterir. Skorlar her zaman her aşamanın son tamamlanan sonucunu gösterir; çünkü her değerlendirme için tek puanlı sonuç tutulur.`)}
            </span>
            <button type="button" className="da-link da-linkbtn" onClick={() => setCycle(null)}>{T(lang, 'Back to current cycle', 'Güncel döneme dön')}</button>
          </p>
        )}

        {!model.hasResults ? (
          <>
            {/* First-time dashboard: no completed phase yet, so no charts */}
            <FirstTime m={model} lang={lang} />
            <Reveal delay={120}><CoursesStrip /></Reveal>
          </>
        ) : (
          <>
            <Reveal><KpiRow m={model} lang={lang} /></Reveal>

            <Reveal className="da-row da-row-analytics">
              <PerformanceCard m={model} names={names} go={go} lang={lang} />
              <EsgCard m={model} names={names} go={go} lang={lang} />
            </Reveal>

            <Reveal className="da-row da-row-progress">
              <PhaseProgress m={model} lang={lang} />
              <InsightsCard m={model} cats={cats} go={go} lang={lang} />
            </Reveal>

            <Reveal><QuickCard m={model} lang={lang} /></Reveal>

            <Reveal className="da-row da-row-latest">
              <LatestCard m={model} details={details} names={names} go={go} lang={lang} />
              <RecommendationsCard m={model} recs={recs} state={detailsState} tasks={tasks} tasksState={tasksState} onAdded={refreshTasks} lang={lang} />
            </Reveal>

            <Reveal><RecentCard m={model} lang={lang} /></Reveal>

            <Reveal><CoursesStrip /></Reveal>
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
