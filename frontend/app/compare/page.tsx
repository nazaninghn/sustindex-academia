'use client';
/* Compare page — side-by-side score comparison between two assessment cycles.
   Fetches all completed attempts, groups by cycle_name, lets the user pick
   two cycles from dropdowns, then renders a category-level diff table.       */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppNav from '@/components/AppNav';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { attemptAPI } from '@/lib/api';
import { gradeColor } from '@/lib/utils';
import type { CategoryScore } from '@/lib/types';

/* ─── Types ─────────────────────────────────────────────── */
interface AttemptSummary {
  id: number;
  cycle_name: string;
  survey_name: string;
  total_score: number;
  overall_grade: string;
  category_scores: CategoryScore[];
  completed_at: string | null;
  is_completed: boolean;
}

/* ─── Helpers ────────────────────────────────────────────── */
function diffColor(d: number): string {
  if (d > 0) return 'var(--olive-deep)';
  if (d < 0) return 'var(--danger)';
  return 'var(--ink-3)';
}
function diffArrow(d: number): string {
  if (d > 0) return '↑';
  if (d < 0) return '↓';
  return '—';
}

/* ═══════════════════════════════════════════════════════════
   Compare Page
   ═══════════════════════════════════════════════════════════ */
export default function ComparePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { lang } = useLang();

  const [attempts,  setAttempts]  = useState<AttemptSummary[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [cycleA,    setCycleA]    = useState('');
  const [cycleB,    setCycleB]    = useState('');

  const tr = (en: string, tr: string) => lang === 'tr' ? tr : en;

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
        const list: AttemptSummary[] = Array.isArray(data) ? data
          : Array.isArray(data?.results) ? data.results : [];
        setAttempts(list.filter(a => a.is_completed));
      } catch { /* ignore */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [user]);

  /* Build unique, sorted cycle name list from completed attempts */
  const cycleNames = useMemo(() => {
    const names = Array.from(new Set(
      attempts.map(a => a.cycle_name || tr('(unnamed)', '(isimsiz)')).filter(Boolean)
    )).sort();
    return names;
  }, [attempts, lang]);

  /* Aggregate scores for a given cycle name (sum across surveys if multiple) */
  const cycleSnapshot = useMemo(() => {
    const snap: Record<string, {
      total_score: number; overall_grade: string;
      categories: CategoryScore[];
    }> = {};
    for (const name of cycleNames) {
      const cycleAttempts = attempts.filter(
        a => (a.cycle_name || tr('(unnamed)', '(isimsiz)')) === name
      );
      if (!cycleAttempts.length) continue;
      // Use the most recent attempt's grade; average total scores
      const sorted = cycleAttempts.slice().sort((a, b) =>
        (b.completed_at ?? '').localeCompare(a.completed_at ?? '')
      );
      const avgScore = Math.round(
        cycleAttempts.reduce((s, a) => s + a.total_score, 0) / cycleAttempts.length
      );
      // Merge category scores across surveys
      const catMap: Record<string, CategoryScore & { count: number }> = {};
      for (const at of cycleAttempts) {
        for (const cs of (at.category_scores ?? [])) {
          if (!catMap[cs.key]) {
            catMap[cs.key] = { ...cs, count: 1 };
          } else {
            catMap[cs.key].score     += cs.score;
            catMap[cs.key].max_score += cs.max_score;
            catMap[cs.key].percentage = catMap[cs.key].max_score > 0
              ? Math.round((catMap[cs.key].score / catMap[cs.key].max_score) * 100)
              : 0;
            catMap[cs.key].count++;
          }
        }
      }
      snap[name] = {
        total_score:   avgScore,
        overall_grade: sorted[0].overall_grade,
        categories:    Object.values(catMap),
      };
    }
    return snap;
  }, [attempts, cycleNames, lang]);

  const snapA = cycleA ? cycleSnapshot[cycleA] : null;
  const snapB = cycleB ? cycleSnapshot[cycleB] : null;

  /* Build merged category list from both snapshots */
  const mergedCategories = useMemo(() => {
    if (!snapA && !snapB) return [];
    const keys = Array.from(new Set([
      ...(snapA?.categories ?? []).map(c => c.key),
      ...(snapB?.categories ?? []).map(c => c.key),
    ]));
    return keys.map(key => {
      const a = snapA?.categories.find(c => c.key === key);
      const b = snapB?.categories.find(c => c.key === key);
      return {
        key,
        name:   b?.name ?? a?.name ?? key,
        pctA:   a?.percentage ?? null,
        pctB:   b?.percentage ?? null,
        diff:   a != null && b != null ? b.percentage - a.percentage : null,
      };
    });
  }, [snapA, snapB]);

  /* ── Loading / auth guard ── */
  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>
          {tr('Loading…', 'Yükleniyor…')}
        </span>
      </div>
    );
  }

  const selectStyle: React.CSSProperties = {
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: 13, padding: '8px 12px',
    border: '1px solid var(--line)', borderRadius: 4,
    background: 'var(--cream)', color: 'var(--ink)',
    minWidth: 200, cursor: 'pointer', outline: 'none',
  };

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <AppNav />

      <main className="wrap" style={{ paddingTop: 40, paddingBottom: 80, maxWidth: 900 }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Link href="/history" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>
              ← {tr('Back to History', 'Geçmişe Dön')}
            </span>
          </Link>
          <h1 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 22, color: 'var(--ink)', marginTop: 12, marginBottom: 4 }}>
            {tr('Cycle Comparison', 'Dönem Karşılaştırma')}
          </h1>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: 'var(--ink-3)' }}>
            {tr(
              'Select two completed assessment cycles to compare scores side-by-side.',
              'Puanları karşılaştırmak için iki tamamlanmış değerlendirme dönemi seçin.',
            )}
          </p>
        </div>

        {cycleNames.length < 2 && (
          <div style={{ padding: '32px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8 }}>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, color: 'var(--ink-3)' }}>
              {tr(
                'You need at least two completed assessment cycles to compare. Complete more assessments to unlock this feature.',
                'Karşılaştırma yapabilmek için en az iki tamamlanmış değerlendirme dönemine ihtiyacınız var.',
              )}
            </p>
            <Link href="/surveys" style={{ textDecoration: 'none' }}>
              <button className="btn btn-primary" style={{ marginTop: 16 }}>
                {tr('Start an Assessment', 'Değerlendirme Başlat')}
              </button>
            </Link>
          </div>
        )}

        {cycleNames.length >= 2 && (
          <>
            {/* Cycle selectors */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {tr('Cycle A (baseline)', 'Dönem A (baz)')}
                </label>
                <select
                  value={cycleA}
                  onChange={e => setCycleA(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">{tr('— Select cycle —', '— Dönem seçin —')}</option>
                  {cycleNames.map(n => (
                    <option key={n} value={n} disabled={n === cycleB}>{n}</option>
                  ))}
                </select>
              </div>

              <div style={{ paddingTop: 22, fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: 'var(--ink-3)' }}>vs</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {tr('Cycle B (comparison)', 'Dönem B (karşılaştırma)')}
                </label>
                <select
                  value={cycleB}
                  onChange={e => setCycleB(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">{tr('— Select cycle —', '— Dönem seçin —')}</option>
                  {cycleNames.map(n => (
                    <option key={n} value={n} disabled={n === cycleA}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Results */}
            {snapA && snapB && (
              <>
                {/* Overall score card */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                  gap: 0, marginBottom: 32,
                  border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden',
                }}>
                  {/* Cycle A */}
                  <div style={{ padding: '28px 24px', textAlign: 'center', background: 'var(--surface)' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                      {cycleA}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: 52, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-2px' }}>
                      {snapA.total_score}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 18, color: gradeColor(snapA.overall_grade), marginTop: 6 }}>
                      {snapA.overall_grade || '—'}
                    </div>
                  </div>

                  {/* Delta */}
                  <div style={{ padding: '28px 20px', textAlign: 'center', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 90 }}>
                    <div style={{
                      fontFamily: "'IBM Plex Sans', sans-serif",
                      fontWeight: 600, fontSize: 28,
                      color: diffColor(snapB.total_score - snapA.total_score),
                    }}>
                      {snapB.total_score - snapA.total_score > 0 ? '+' : ''}{snapB.total_score - snapA.total_score}
                    </div>
                    <div style={{ fontSize: 22, color: diffColor(snapB.total_score - snapA.total_score), marginTop: 2 }}>
                      {diffArrow(snapB.total_score - snapA.total_score)}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.1em', marginTop: 6, textTransform: 'uppercase' }}>
                      {tr('overall', 'toplam')}
                    </div>
                  </div>

                  {/* Cycle B */}
                  <div style={{ padding: '28px 24px', textAlign: 'center', background: 'var(--surface)' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                      {cycleB}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: 52, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-2px' }}>
                      {snapB.total_score}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 18, color: gradeColor(snapB.overall_grade), marginTop: 6 }}>
                      {snapB.overall_grade || '—'}
                    </div>
                  </div>
                </div>

                {/* Category breakdown table */}
                {mergedCategories.length > 0 && (
                  <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                    {/* Table header */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
                      padding: '10px 20px', borderBottom: '1px solid var(--line)',
                      background: 'var(--surface)',
                    }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                        {tr('Category', 'Kategori')}
                      </span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.12em', textAlign: 'right' }}>A %</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.12em', textAlign: 'center' }}>Δ</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.12em', textAlign: 'right' }}>B %</span>
                    </div>

                    {/* Rows */}
                    {mergedCategories.map((cat, idx) => {
                      const d = cat.diff ?? 0;
                      const isLast = idx === mergedCategories.length - 1;
                      return (
                        <div
                          key={cat.key}
                          style={{
                            display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
                            padding: '14px 20px',
                            borderBottom: isLast ? 'none' : '1px solid var(--line-soft)',
                            alignItems: 'center',
                            background: idx % 2 === 0 ? 'var(--cream)' : 'var(--surface)',
                          }}
                        >
                          {/* Category name */}
                          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: 'var(--ink-2)' }}>
                            {cat.name}
                          </span>

                          {/* Score A */}
                          <div style={{ textAlign: 'right' }}>
                            {cat.pctA != null ? (
                              <>
                                <div style={{ height: 3, background: 'var(--line)', borderRadius: 2, marginBottom: 4 }}>
                                  <div style={{ width: `${Math.min(cat.pctA, 100)}%`, height: '100%', background: 'var(--ink-3)', borderRadius: 2 }} />
                                </div>
                                <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--ink-2)' }}>
                                  {cat.pctA}
                                </span>
                              </>
                            ) : <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>—</span>}
                          </div>

                          {/* Diff */}
                          <div style={{ textAlign: 'center' }}>
                            {cat.diff != null ? (
                              <span style={{
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontSize: 12, fontWeight: 600,
                                color: diffColor(d),
                              }}>
                                {d > 0 ? '+' : ''}{d} {diffArrow(d)}
                              </span>
                            ) : <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>—</span>}
                          </div>

                          {/* Score B */}
                          <div style={{ textAlign: 'right' }}>
                            {cat.pctB != null ? (
                              <>
                                <div style={{ height: 3, background: 'var(--line)', borderRadius: 2, marginBottom: 4 }}>
                                  <div style={{ width: `${Math.min(cat.pctB, 100)}%`, height: '100%', background: gradeColor(snapB.overall_grade), borderRadius: 2 }} />
                                </div>
                                <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--ink-2)' }}>
                                  {cat.pctB}
                                </span>
                              </>
                            ) : <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>—</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Legend */}
                <div style={{ display: 'flex', gap: 20, marginTop: 20, flexWrap: 'wrap' }}>
                  {[
                    { color: 'var(--olive-deep)', label: tr('Improvement', 'İyileşme') },
                    { color: 'var(--danger)',     label: tr('Regression',  'Gerileme') },
                    { color: 'var(--ink-3)',      label: tr('No change',   'Değişim yok') },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                      <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: 'var(--ink-3)' }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Prompt to select both */}
            {(!snapA || !snapB) && (cycleA || cycleB) && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-4)', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13 }}>
                {tr('Select both cycles to see the comparison.', 'Karşılaştırmayı görmek için her iki dönemi de seçin.')}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
