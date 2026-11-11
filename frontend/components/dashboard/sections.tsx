'use client';
/* Dashboard sections. Every figure comes from lib/dashboard-data.ts (derived from the API);
   every control (tabs, chips, expanders, filters, buttons) performs a real action. */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { actionTaskAPI } from '@/lib/api';
import type { ActionTask } from '@/lib/api';
import {
  PHASES, bandCounts, bandOf, categoriesOf, hasTrend, rankCategories, strongest, weakest,
} from '@/lib/dashboard-data';
import type { Band, DashModel, PhaseState, RankedCategory, ResultPoint } from '@/lib/dashboard-data';
import {
  HBars, Hint, Legend, PHASE_COLORS, PhaseColumns, Radar, RingStat, StackBar, TipRows, TrendChart, fmtFull, fmtShort, phaseLabel, useTooltip,
} from './charts';
import type { BarRow } from './charts';
import { Ic, PHASE_ICON } from './icons';
import type { IconName } from './icons';
import { Reveal, useInView } from './motion';

/* ─── Shared types / helpers ─────────────────────────────────── */
export interface Rec {
  category: string; priority: 'High' | 'Medium' | 'Low'; gri_standard?: string; title: string;
  description?: string; quick_win?: string; timeline_days?: number; effort?: string; score_pct: number;
}
export interface Detail {
  category_scores?: { id: number; name: string; percentage: number }[];
  recommendations?: Rec[];
  maturity?: { label: string; narrative: string } | null;
}
export type NameMap = Record<number, Record<number, string>>;
export type RecWithPhase = Rec & { phase: number; attemptId: number };
export type LoadState = 'idle' | 'loading' | 'done' | 'partial' | 'error';

export const T = (lang: string, en: string, tr: string) => (lang === 'tr' ? tr : en);
export const BAND_COLOR: Record<Band, string> = { strong: 'var(--olive-deep)', developing: 'var(--amber)', gap: 'var(--danger)' };
export const scoreColor = (pct: number) => BAND_COLOR[bandOf(pct)];
export const fmtDate = (iso: string | null, lang: string) => (iso ? fmtFull(iso, lang) : '—');
export const cycleLabel = (c: string | null | undefined, lang: string) => (c ? c : T(lang, 'Unnamed cycle', 'Adsız dönem'));
const bandLabel = (b: Band, lang: string) => ({ strong: T(lang, 'Strong', 'Güçlü'), developing: T(lang, 'Developing', 'Gelişen'), gap: T(lang, 'Gap', 'Açık') }[b]);
const prioLabel = (p: string, lang: string) => ({ High: T(lang, 'High', 'Yüksek'), Medium: T(lang, 'Medium', 'Orta'), Low: T(lang, 'Low', 'Düşük') }[p] ?? p);

export function timeAgo(isoDate: string | null, lang: string): string {
  if (!isoDate) return '';
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 60) return lang === 'tr' ? 'Az önce' : 'Just now';
  if (diff < 3600) { const m = Math.floor(diff / 60); return lang === 'tr' ? `${m} dk önce` : `${m}m ago`; }
  if (diff < 86400) { const h = Math.floor(diff / 3600); return lang === 'tr' ? `${h} sa önce` : `${h}h ago`; }
  const d = Math.floor(diff / 86400);
  return lang === 'tr' ? `${d} gün önce` : `${d}d ago`;
}

type Go = (href: string) => void;
interface P { m: DashModel; lang: string }

/** Grade badge: the grade letter exactly as the backend returned it; colour family follows the shared gradeColor() rule. */
export function GradeBadge({ grade, size = 'md' }: { grade: string | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const tone = !grade ? 'none' : grade.startsWith('A') ? 'a' : grade.startsWith('B') ? 'b' : grade.startsWith('C') ? 'c' : 'd';
  return <span className={`da-gb is-${tone} is-${size}`}>{grade ?? '—'}</span>;
}

function Head({ title, hint, sub, children }: { title: string; hint?: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="da-head">
      <div className="da-head-t">
        <div className="da-h2row"><h2 className="da-h2">{title}</h2>{hint && <Hint text={hint} />}</div>
        {sub && <p className="da-sub">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

/** The single most useful next step, derived from the phase states (same rules as the old "continue" strip). */
export interface NextAction { kind: 'continue' | 'start' | 'report' | 'none'; href: string; label: string; sub: string; phase?: PhaseState }
export function nextAction(m: DashModel, lang: string): NextAction {
  const live = m.phases.find((p) => p.status === 'in_progress' && p.attempt);
  if (live && live.attempt) {
    return { kind: 'continue', href: `/questionnaire/${live.attempt.id}`, label: T(lang, 'Continue assessment', 'Değerlendirmeye devam et'), sub: `${phaseLabel(live.num, lang)} · ${live.pct}%`, phase: live };
  }
  const next = m.phases.find((p) => p.status === 'available');
  if (next) {
    return { kind: 'start', href: '/surveys', label: T(lang, `Start ${phaseLabel(next.num, lang)}`, `${phaseLabel(next.num, lang)} aşamasını başlat`), sub: T(lang, `Phase ${next.num} of ${PHASES.length}`, `${PHASES.length} aşamadan ${next.num}.`), phase: next };
  }
  if (m.phasesCompleted === PHASES.length) {
    return { kind: 'report', href: '/results/combined', label: T(lang, 'Combined report', 'Birleşik rapor'), sub: T(lang, 'All five phases completed', 'Beş aşamanın tümü tamamlandı') };
  }
  return { kind: 'none', href: '/surveys', label: T(lang, 'Open surveys', 'Anketleri aç'), sub: '' };
}

/* ═══════════════════════ Executive KPI row ═══════════════════════ */
export function KpiRow({ m, lang }: P) {
  const [ref, shown] = useInView<HTMLDivElement>(0.2);
  const latest = m.latestResult;
  const qPct = m.applicable > 0 ? Math.min(100, Math.round((m.answered / m.applicable) * 100)) : 0;
  const overall = m.overall ? Math.round(m.overall.score) : null;
  return (
    <div className="da-kpis" ref={ref}>
      {/* Overall score — the lead figure */}
      <article className="da-card da-kpi da-kpi-hero">
        <div className="da-kpi-top">
          <span className="da-kpi-label">{T(lang, 'Overall sustainability score', 'Genel sürdürülebilirlik skoru')}</span>
          <Hint text={T(lang, 'Plain average of the latest completed score of each assessed phase. Phases that are not assessed yet are left out, not counted as 0.', 'Değerlendirilen her aşamanın son tamamlanan skorunun düz ortalaması. Henüz değerlendirilmeyen aşamalar 0 sayılmaz, hesaba katılmaz.')} />
        </div>
        <div className="da-kpi-hero-body">
          <div className="da-kpi-hero-main">
            <div className="da-kpi-val">{overall ?? '—'}<small>/100</small></div>
            {m.overall && <span className="da-kpi-chip">{bandLabel(bandOf(m.overall.score), lang)}</span>}
            <p className="da-kpi-note">
              {m.overall
                ? T(lang, `Based on ${m.overall.phases} of ${PHASES.length} phases assessed`, `${PHASES.length} aşamadan ${m.overall.phases} tanesine göre`)
                : T(lang, 'No completed phase yet', 'Henüz tamamlanan aşama yok')}
            </p>
          </div>
          <RingStat pct={m.overall?.score ?? 0} size={84} stroke={8} color="var(--olive)" track="rgba(255,255,255,.16)" className="is-hero">
            {overall !== null ? `${overall}%` : '—'}
          </RingStat>
        </div>
      </article>

      {/* Assessments — two counts, so a split figure rather than a single value */}
      <article className="da-card da-kpi">
        <div className="da-kpi-top"><span className="da-kpi-ic"><Ic name="layers" /></span><span className="da-kpi-label">{T(lang, 'Assessments', 'Değerlendirmeler')}</span></div>
        <div className="da-kpi-split">
          <div><b>{m.completedCount}</b><span>{T(lang, 'Completed', 'Tamamlanan')}</span></div>
          <i aria-hidden="true" />
          <div><b className={m.inProgressCount ? 'is-warn' : ''}>{m.inProgressCount}</b><span>{T(lang, 'In progress', 'Devam eden')}</span></div>
        </div>
        <p className="da-kpi-note">{T(lang, 'Across all assessment cycles', 'Tüm değerlendirme dönemlerinde')}</p>
      </article>

      {/* Questions answered — a ratio with a linear progress bar */}
      <article className="da-card da-kpi">
        <div className="da-kpi-top"><span className="da-kpi-ic"><Ic name="list" /></span><span className="da-kpi-label">{T(lang, 'Questions answered', 'Cevaplanan soru')}</span>
          <Hint text={T(lang, 'Answered questions in the selected cycle, out of the questions of every phase whose length is known. Sector questions are counted once a sector assessment is started.', 'Seçili dönemde cevaplanan sorular; uzunluğu bilinen tüm aşamaların sorularına oranla. Sektör soruları, sektör değerlendirmesi başlatılınca sayılır.')} />
        </div>
        <div className="da-kpi-val">{m.answered}<small>/ {m.applicable}</small></div>
        <div className="da-bar" role="img" aria-label={`${qPct}%`}><div className="da-anim-w" style={{ width: shown ? `${qPct}%` : '0%' }} /></div>
        <p className="da-kpi-note">{qPct}% · {m.applicableComplete ? T(lang, 'of applicable questions', 'geçerli soruların') : T(lang, 'sector not counted yet', 'sektör henüz sayılmadı')}</p>
      </article>

      {/* Completion — five discrete phases, so a segmented bar */}
      <article className="da-card da-kpi">
        <div className="da-kpi-top"><span className="da-kpi-ic"><Ic name="target" /></span><span className="da-kpi-label">{T(lang, 'Assessment completion', 'Değerlendirme tamamlanma')}</span></div>
        <div className="da-kpi-val">{m.phasesCompleted}<small>/ {PHASES.length} {T(lang, 'phases', 'aşama')}</small></div>
        <div className="da-segs" role="img" aria-label={`${m.completionPct}%`}>
          {m.phases.map((p, i) => (
            <span key={p.num} className={`is-${p.status}`} title={phaseLabel(p.num, lang)}>
              <i className="da-anim-w" style={{ width: shown ? (p.status === 'completed' ? '100%' : p.status === 'in_progress' ? `${p.pct}%` : '0%') : '0%', transitionDelay: `${i * 90}ms` }} />
            </span>
          ))}
        </div>
        <p className="da-kpi-note">{m.completionPct}% · {cycleLabel(m.activeCycle, lang)}</p>
      </article>

      {/* Latest grade — a letter, shown as a badge */}
      <article className="da-card da-kpi">
        <div className="da-kpi-top"><span className="da-kpi-ic"><Ic name="award" /></span><span className="da-kpi-label">{T(lang, 'Latest assessment grade', 'Son değerlendirme notu')}</span></div>
        <div className="da-kpi-grade">
          <GradeBadge grade={latest?.grade} size="lg" />
          <div>
            <b>{latest ? phaseLabel(latest.phase, lang) : T(lang, 'Not graded yet', 'Henüz notlandırılmadı')}</b>
            {latest && <span>{latest.score.toFixed(1)}%</span>}
          </div>
        </div>
        <p className="da-kpi-note">{latest ? fmtDate(latest.iso, lang) : T(lang, 'Complete a phase to get a grade', 'Not almak için bir aşamayı tamamlayın')}</p>
      </article>
    </div>
  );
}

/* ═══════════════════════ Performance analytics (switchable views) ═══════════════════════ */
type View = 'scores' | 'categories' | 'trend' | 'compare';

export function comparisonRows(m: DashModel) {
  return PHASES.map((p) => ({ p, cur: m.latest[p.num], prev: m.previous[p.num] })).filter((x) => x.cur && x.prev) as
    { p: (typeof PHASES)[number]; cur: ResultPoint; prev: ResultPoint }[];
}

export function PerformanceCard({ m, names, go, lang }: P & { names: NameMap; go: Go }) {
  const trend = hasTrend(m);                       // a real trend exists only when a survey has >= 2 scored results
  const cmp = comparisonRows(m);
  const withResults = PHASES.filter((p) => m.latest[p.num]);
  const [view, setView] = useState<View>('scores');
  const [catPhase, setCatPhase] = useState<number>(m.latestResult?.phase ?? withResults[0]?.num ?? 1);
  const [sort, setSort] = useState<'low' | 'high'>('low');

  const views: { id: View; label: string }[] = [
    { id: 'scores', label: T(lang, 'Phase scores', 'Aşama skorları') },
    { id: 'categories', label: T(lang, 'Categories', 'Kategoriler') },
    ...(trend ? [{ id: 'trend' as View, label: T(lang, 'Trend', 'Trend') }] : []),
    ...(cmp.length ? [{ id: 'compare' as View, label: T(lang, 'Previous vs latest', 'Önceki ve son') }] : []),
  ];
  const active: View = views.some((v) => v.id === view) ? view : 'scores';
  const open = (id: number) => go(`/results/${id}`);
  const cols = PHASES.map((p) => ({ num: p.num, result: m.latest[p.num], locked: m.phases[p.num - 1].status === 'locked' }));
  const unassessed = cols.filter((c) => !c.result).length;
  const activeCat = m.latest[catPhase] ? catPhase : (withResults[0]?.num ?? 1);

  const catRows = useMemo<BarRow[]>(() => {
    const r = m.latest[activeCat];
    if (!r) return [];
    const list = categoriesOf(r, names).sort((a, b) => (sort === 'low' ? a.pct - b.pct : b.pct - a.pct));
    return list.map((c, i) => ({
      key: `${r.id}-${i}-${c.name}`, label: c.name, pct: c.pct, color: scoreColor(c.pct),
      tip: <TipRows title={c.name} rows={[[T(lang, 'Score', 'Skor'), `${c.pct.toFixed(1)}%`], [T(lang, 'Points', 'Puan'), `${c.score ?? '—'} / ${c.max ?? '—'}`], [T(lang, 'Band', 'Bant'), bandLabel(bandOf(c.pct), lang)]]} />,
      href: `/results/${r.id}`,
    }));
  }, [m, names, activeCat, sort, lang]);
  const hiddenCats = (m.latest[activeCat]?.attempt.category_scores?.length ?? 0) - catRows.length;

  const compareRows: BarRow[] = cmp.flatMap(({ p, cur, prev }) => {
    const d = Math.round(cur.score) - Math.round(prev.score);
    return [
      { key: `${p.num}-prev`, label: phaseLabel(p.num, lang), sub: `${T(lang, 'previous', 'önceki')} · ${fmtShort(prev.iso, lang)}`, pct: prev.score, color: 'var(--ink-4)' },
      { key: `${p.num}-cur`, label: phaseLabel(p.num, lang), sub: `${T(lang, 'latest', 'son')} · ${fmtShort(cur.iso, lang)} · ${d > 0 ? '+' : ''}${d} ${T(lang, 'pts', 'puan')}`, pct: cur.score, color: PHASE_COLORS[p.num], href: `/results/${cur.id}` },
    ];
  });

  return (
    <section className="da-card da-fill">
      <Head title={T(lang, 'Performance analytics', 'Performans analizi')}
        hint={T(lang, 'Scores are the latest completed result of each phase, exactly as scored by the assessment engine.', 'Skorlar, her aşamanın değerlendirme motorunca puanlanan son tamamlanan sonucudur.')}>
        <div className="da-seg" role="tablist" aria-label={T(lang, 'Chart view', 'Grafik görünümü')}>
          {views.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={active === v.id} className={active === v.id ? 'is-on' : ''} onClick={() => setView(v.id)}>{v.label}</button>
          ))}
        </div>
      </Head>
      <div className="da-body">
        <div key={active} className="da-swap da-grow">
          {active === 'scores' && (
            <>
              <PhaseColumns cols={cols} lang={lang} onOpen={open} />
              {unassessed > 0 && <Legend items={[{ color: 'var(--olive-deep)', label: T(lang, 'Latest completed score', 'Son tamamlanan skor') }, { color: '', hollow: true, label: T(lang, 'Not assessed yet (no score)', 'Henüz değerlendirilmedi (skor yok)') }]} />}
            </>
          )}
          {active === 'trend' && <TrendChart results={m.results} lang={lang} onOpen={open} />}
          {active === 'compare' && <HBars rows={compareRows} onOpen={go} />}
          {active === 'categories' && (
            <>
              <div className="da-toolbar">
                <div className="da-chips" role="group" aria-label={T(lang, 'Phase', 'Aşama')}>
                  {withResults.map((p) => (
                    <button key={p.num} type="button" className={`da-chipbtn${activeCat === p.num ? ' is-on' : ''}`} aria-pressed={activeCat === p.num} onClick={() => setCatPhase(p.num)}>
                      <i style={{ background: PHASE_COLORS[p.num] }} />{phaseLabel(p.num, lang)}
                    </button>
                  ))}
                </div>
                <select className="da-select" value={sort} onChange={(e) => setSort(e.target.value as 'low' | 'high')} aria-label={T(lang, 'Sort categories', 'Kategorileri sırala')}>
                  <option value="low">{T(lang, 'Lowest first', 'Önce en düşük')}</option>
                  <option value="high">{T(lang, 'Highest first', 'Önce en yüksek')}</option>
                </select>
              </div>
              <div className="da-scroll">{catRows.length ? <HBars rows={catRows} onOpen={go} dense /> : <p className="da-empty">{T(lang, 'No category scores for this phase.', 'Bu aşama için kategori skoru yok.')}</p>}</div>
            </>
          )}
        </div>
        <p className="da-caption">
          {active === 'scores' && T(lang, 'Hover a column for details; select it to open the full report.', 'Ayrıntı için bir sütunun üzerine gelin; tam rapor için seçin.')}
          {active === 'categories' && (hiddenCats > 0
            ? T(lang, `${hiddenCats} categor${hiddenCats === 1 ? 'y has' : 'ies have'} no applicable questions and ${hiddenCats === 1 ? 'is' : 'are'} left out rather than shown as 0%.`, `${hiddenCats} kategorinin geçerli sorusu yok; 0% olarak değil, hiç gösterilmez.`)
            : T(lang, 'Category scores of the phase’s latest result. Bars are coloured by performance band.', 'Aşamanın son sonucundaki kategori skorları. Çubuklar performans bandına göre renklendirilir.'))}
          {active === 'trend' && T(lang, 'Lines connect completed results of the same survey only.', 'Çizgiler yalnızca aynı anketin tamamlanan sonuçlarını birleştirir.')}
          {active === 'compare' && T(lang, 'Previous and latest completed result of the same survey.', 'Aynı anketin önceki ve son tamamlanan sonucu.')}
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════ ESG performance (radar + expandable breakdown) ═══════════════════════ */
export function EsgCard({ m, names, go, lang }: P & { names: NameMap; go: Go }) {
  const [ref, shown] = useInView<HTMLDivElement>(0.15);
  const [openNum, setOpenNum] = useState<number | null>(null);
  const avg = m.overall && m.overall.phases > 1 ? m.overall.score : undefined;
  const order = [2, 3, 1, 4, 5];                  // E, S, G first, then the other two GRI dimensions
  const axes = order.map((n) => ({ key: n, label: phaseLabel(n, lang), value: m.latest[n] ? (m.latest[n] as ResultPoint).score : null, color: PHASE_COLORS[n] }));

  const item = (num: number) => {
    const r = m.latest[num];
    const st = m.phases[num - 1];
    if (!r) {
      return (
        <div key={num} className="da-esg-item is-na">
          <div className="da-esg-row">
            <span className="da-esg-ic"><Ic name={PHASE_ICON[num]} size={15} /></span>
            <span className="da-esg-name">{phaseLabel(num, lang)}</span>
            <span className="da-esg-na">{st.status === 'locked' && <Ic name="lock" size={12} />}{T(lang, 'Not assessed', 'Değerlendirilmedi')}</span>
          </div>
        </div>
      );
    }
    const cats = categoriesOf(r, names);
    const top = strongest(cats, 2), low = weakest(cats, 2);
    const isOpen = openNum === num;
    const delta = avg !== undefined ? Math.round(r.score) - Math.round(avg) : null;
    return (
      <div key={num} className={`da-esg-item${isOpen ? ' is-open' : ''}`}>
        <button type="button" className="da-esg-row" aria-expanded={isOpen} onClick={() => setOpenNum(isOpen ? null : num)}>
          <span className="da-esg-ic" style={{ color: PHASE_COLORS[num] }}><Ic name={PHASE_ICON[num]} size={15} /></span>
          <span className="da-esg-main">
            <span className="da-esg-name">{phaseLabel(num, lang)}</span>
            <span className="da-track" title={`${r.score.toFixed(1)}%`}>
              <span className="da-anim-w" style={{ width: shown ? `${r.score}%` : '0%', background: PHASE_COLORS[num] }} />
              {avg !== undefined && <i className="da-htick" style={{ left: `${avg}%` }} />}
            </span>
          </span>
          <span className="da-esg-pct">{Math.round(r.score)}%</span>
          <GradeBadge grade={r.grade} size="sm" />
          <Ic name="chevron" size={14} className="da-chev" />
        </button>
        <div className="da-expand" data-open={isOpen}>
          <div>
            <div className="da-esg-detail">
              <p className="da-esg-meta">
                {cats.length} {T(lang, 'scored categories', 'puanlanan kategori')} · {fmtDate(r.iso, lang)}
                {delta !== null && <> · <b className={delta >= 0 ? 'is-up' : 'is-down'}>{delta > 0 ? '+' : ''}{delta} {T(lang, 'vs overall average', 'genel ortalamaya göre')}</b></>}
              </p>
              <div className="da-esg-two">
                <div><h4>{T(lang, 'Strongest', 'En güçlü')}</h4>{top.map((c, i) => <div key={i} className="da-mini"><span>{c.name}</span><b>{Math.round(c.pct)}%</b></div>)}</div>
                <div><h4>{T(lang, 'Needs attention', 'Dikkat gerektiren')}</h4>{low.map((c, i) => <div key={i} className="da-mini"><span>{c.name}</span><b>{Math.round(c.pct)}%</b></div>)}</div>
              </div>
              <button type="button" className="da-link da-linkbtn" onClick={() => go(`/results/${r.id}`)}>{T(lang, 'Open full results', 'Tüm sonuçları aç')} <Ic name="arrow" size={13} /></button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const assessed = axes.filter((a) => a.value !== null).length;
  return (
    <section ref={ref} className="da-card da-fill da-esg-card">
      <Head title={T(lang, 'ESG performance', 'ESG performansı')}
        hint={T(lang, 'Each axis is one GRI dimension on a 0–100 scale. Dimensions without a completed assessment are shown as not assessed, never as 0. The thin marker on a bar is your overall average.', 'Her eksen 0–100 ölçeğinde bir GRI boyutudur. Tamamlanmış değerlendirmesi olmayan boyutlar 0 olarak değil, değerlendirilmedi olarak gösterilir. Çubuktaki ince işaret genel ortalamanızdır.')}>
        <span className="da-head-meta">{assessed} / {axes.length} {T(lang, 'assessed', 'değerlendirildi')}</span>
      </Head>
      <div className="da-body">
        <div className="da-esg-grid">
          <Radar axes={axes} lang={lang} />
          <div className="da-esg">
            <h3 className="da-h3">{T(lang, 'ESG breakdown', 'ESG dağılımı')}</h3>
            {[2, 3, 1].map(item)}
            <div className="da-esg-sep"><span>{T(lang, 'Other GRI dimensions', 'Diğer GRI boyutları')}</span></div>
            {[4, 5].map(item)}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════ GRI assessment progress ═══════════════════════ */
export function PhaseProgress({ m, lang }: P) {
  const [openNum, setOpenNum] = useState<number | null>(null);
  const statusLabel = (s: PhaseState['status']) => ({
    completed: T(lang, 'Completed', 'Tamamlandı'), in_progress: T(lang, 'In progress', 'Devam ediyor'),
    available: T(lang, 'Available', 'Başlanabilir'), locked: T(lang, 'Locked', 'Kilitli'),
  }[s]);
  const openState = openNum ? m.phases[openNum - 1] : null;
  const openAtt = openState?.attempt ?? null;
  return (
    <section className="da-card da-fill">
      <Head title={T(lang, 'GRI assessment progress', 'GRI değerlendirme ilerlemesi')}
        hint={T(lang, 'Phases unlock one after another within an assessment cycle: each phase opens once the previous one is completed.', 'Aşamalar bir değerlendirme döneminde sırayla açılır: her aşama, önceki tamamlanınca erişilebilir olur.')}
        sub={cycleLabel(m.activeCycle, lang)}>
        <span className="da-head-meta"><b>{m.phasesCompleted} / {PHASES.length}</b> {T(lang, 'phases', 'aşama')} · {m.completionPct}%</span>
      </Head>
      <div className="da-body">
        <ol className="da-gp">
          {PHASES.map((p) => {
            const st = m.phases[p.num - 1];
            const att = st.attempt;
            const href = st.status === 'completed' && att ? `/results/${att.id}`
                       : st.status === 'in_progress' && att ? `/questionnaire/${att.id}`
                       : st.status === 'available' ? '/surveys' : null;
            const cta = st.status === 'completed' ? T(lang, 'View results', 'Sonuçları gör')
                      : st.status === 'in_progress' ? T(lang, 'Continue', 'Devam et')
                      : st.status === 'available' ? T(lang, 'Start', 'Başla')
                      : T(lang, `Complete ${phaseLabel(p.num - 1, lang)} first`, `Önce ${phaseLabel(p.num - 1, lang)} tamamlanmalı`);
            const pct = st.status === 'completed' ? 100 : st.pct;
            const isOpen = openNum === p.num;
            return (
              <li key={p.num} className={`da-gp-item is-${st.status}`}>
                <div className="da-gp-rail" aria-hidden="true">
                  <span className="da-gp-node">{st.status === 'completed' ? <Ic name="check" size={13} /> : st.status === 'locked' ? <Ic name="lock" size={12} /> : p.num}</span>
                </div>
                <div className="da-gp-card">
                  <div className="da-gp-title">
                    <b>{phaseLabel(p.num, lang)}</b>
                    <span className={`da-chip c-${st.status}`}>{statusLabel(st.status)}</span>
                  </div>
                  <RingStat pct={pct} size={52} stroke={5} color={st.status === 'in_progress' ? 'var(--amber)' : 'var(--olive-deep)'} className="da-gp-ring">
                    {st.status === 'locked' ? <Ic name="lock" size={14} /> : `${pct}%`}
                  </RingStat>
                  <div className="da-gp-nums">
                    {st.total === null
                      ? <span>{T(lang, 'Depends on sector', 'Sektöre göre değişir')}</span>
                      : <>
                          <span><b>{st.answered} / {st.total}</b> {T(lang, 'answered', 'cevaplandı')}</span>
                          <span>{st.remaining} {T(lang, 'remaining', 'kaldı')}</span>
                        </>}
                    {st.superseded && <span className="da-gp-flag" title={T(lang, 'This phase was completed in this cycle; its result was replaced when the same assessment was completed again later.', 'Bu aşama bu dönemde tamamlanmıştı; aynı değerlendirme daha sonra yeniden tamamlanınca sonucu yenisiyle değiştirildi.')}>{T(lang, 'Completed earlier · result replaced', 'Daha önce tamamlandı · sonuç yenilendi')}</span>}
                  </div>
                  <div className="da-gp-foot">
                    {href
                      ? <Link href={href} className={`da-btn da-btn-sm${st.status === 'in_progress' || st.status === 'available' ? ' da-btn-primary' : ''}`}>{cta} <Ic name="arrow" size={12} /></Link>
                      : <span className="da-gp-locked" title={T(lang, 'Phases unlock one after another within an assessment cycle', 'Aşamalar bir değerlendirme döneminde sırayla açılır')}><Ic name="lock" size={12} />{cta}</span>}
                    {att && (
                      <button type="button" className="da-gp-more" aria-expanded={isOpen} aria-controls="da-gp-detail" onClick={() => setOpenNum(isOpen ? null : p.num)}>
                        {T(lang, 'Details', 'Ayrıntı')} <Ic name="chevron" size={12} className={isOpen ? 'is-flip' : ''} />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="da-expand" data-open={!!openAtt} id="da-gp-detail">
          <div>
            {openAtt && openState && (
              <dl className="da-dl">
                <div><dt>{T(lang, 'Phase', 'Aşama')}</dt><dd>{openState.num}. {phaseLabel(openState.num, lang)}</dd></div>
                <div><dt>{T(lang, 'Survey', 'Anket')}</dt><dd>{openAtt.survey_name}</dd></div>
                <div><dt>{T(lang, 'Cycle', 'Dönem')}</dt><dd>{cycleLabel(openAtt.cycle_name, lang)}</dd></div>
                <div><dt>{T(lang, 'Started', 'Başlangıç')}</dt><dd>{fmtDate(openAtt.started_at, lang)}</dd></div>
                {openAtt.completed_at && <div><dt>{T(lang, 'Completed', 'Tamamlanma')}</dt><dd>{fmtDate(openAtt.completed_at, lang)}</dd></div>}
                {openState.status === 'completed' && <div><dt>{T(lang, 'Score', 'Skor')}</dt><dd>{(openAtt.total_score ?? 0).toFixed(1)}%{openAtt.overall_grade ? ` · ${openAtt.overall_grade}` : ''}</dd></div>}
                <div><dt>{T(lang, 'Flagged', 'İşaretli')}</dt><dd>{openAtt.bookmarked_count ?? 0}</dd></div>
                {openState.status === 'completed' && <div><dt>{T(lang, 'Categories', 'Kategori')}</dt><dd>{openAtt.category_scores?.length ?? 0}</dd></div>}
              </dl>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════ Key insights ═══════════════════════ */
function InsightList({ list, m, go, lang, tone }: { list: RankedCategory[]; m: DashModel; go: Go; lang: string; tone: 'up' | 'down' }) {
  const [ref, shown] = useInView<HTMLDivElement>(0.15);
  const tt = useTooltip();
  return (
    <div ref={ref} className="da-ins-list">
      {list.map((x, i) => {
        const href = m.latest[x.phase] ? `/results/${m.latest[x.phase]!.id}` : undefined;
        const tip = <TipRows title={x.name} rows={[[T(lang, 'Phase', 'Aşama'), phaseLabel(x.phase, lang)], [T(lang, 'Score', 'Skor'), `${x.pct.toFixed(1)}%`], [T(lang, 'Points', 'Puan'), `${x.score ?? '—'} / ${x.max ?? '—'}`]]} />;
        return (
          <div key={`${x.phase}-${i}-${x.name}`} className={`da-ins-row${href ? ' is-link' : ''}`} tabIndex={0} role={href ? 'link' : undefined}
            onClick={() => href && go(href)} onKeyDown={(e) => { if (e.key === 'Enter' && href) go(href); }} {...tt.bind(tip)}>
            <span className="da-ins-name"><span>{x.name}</span><small>{phaseLabel(x.phase, lang)}</small></span>
            <b className="da-ins-pct">{Math.round(x.pct)}%</b>
            <span className="da-ins-bar"><span className="da-anim-w" style={{ width: shown ? `${x.pct}%` : '0%', background: tone === 'up' ? 'var(--olive-deep)' : scoreColor(x.pct), transitionDelay: `${i * 60}ms` }} /></span>
          </div>
        );
      })}
      {tt.node}
    </div>
  );
}

export function InsightsCard({ m, cats, go, lang }: P & { cats: RankedCategory[]; go: Go }) {
  const c = bandCounts(cats);
  const unfinished = m.phases.filter((p) => p.status === 'in_progress').reduce((s, p) => s + (p.remaining ?? 0), 0);
  const notStarted = m.phases.filter((p) => p.status === 'available' || p.status === 'locked').length;
  const bands: { band: Band; hint: string }[] = [{ band: 'strong', hint: '≥ 60%' }, { band: 'developing', hint: '35–59%' }, { band: 'gap', hint: '< 35%' }];
  // with few categories the two lists must not show the same category twice
  const n = Math.min(3, Math.floor(cats.length / 2) || cats.length);
  const top = strongest(cats, n);
  const low = weakest(cats, n).filter((x) => !top.includes(x) && !top.some((t) => t.phase === x.phase && t.name === x.name));
  return (
    <section className="da-card da-fill">
      <Head title={T(lang, 'Key insights', 'Öne çıkan içgörüler')}
        hint={T(lang, 'Categories of the latest completed result of each phase. Bands: strong ≥ 60%, developing 35–59%, gap < 35%.', 'Her aşamanın son tamamlanan sonucundaki kategoriler. Bantlar: güçlü ≥ %60, gelişen %35–59, açık < %35.')}>
        <span className="da-head-meta">{cats.length} {T(lang, 'scored categories', 'puanlanan kategori')}</span>
      </Head>
      <div className="da-body">
        {cats.length === 0 ? <p className="da-empty">{T(lang, 'No category scores yet.', 'Henüz kategori skoru yok.')}</p> : (
          <>
            <div className="da-ins2">
              <div className="da-ins-panel is-up">
                <h3 className="da-h3"><Ic name="up" size={15} />{T(lang, 'Strongest areas', 'En güçlü alanlar')}</h3>
                <InsightList list={top} m={m} go={go} lang={lang} tone="up" />
              </div>
              <div className="da-ins-panel is-down">
                <h3 className="da-h3"><Ic name="down" size={15} />{T(lang, 'Areas for improvement', 'Gelişim alanları')}</h3>
                {low.length ? <InsightList list={low} m={m} go={go} lang={lang} tone="down" /> : <p className="da-empty">{T(lang, 'Not enough categories to compare yet.', 'Karşılaştırma için henüz yeterli kategori yok.')}</p>}
              </div>
            </div>
            <div className="da-band">
              <StackBar label={T(lang, 'Share of categories by performance band', 'Kategorilerin performans bandına göre dağılımı')}
                parts={bands.map((b) => ({ key: b.band, value: c[b.band], color: BAND_COLOR[b.band], tip: `${bandLabel(b.band, lang)}: ${c[b.band]}` }))} />
              <div className="da-band-legend">
                {bands.map((b) => <span key={b.band}><i className="da-dot" style={{ background: BAND_COLOR[b.band] }} />{bandLabel(b.band, lang)} <small>{b.hint}</small> <b>{c[b.band]}</b></span>)}
              </div>
            </div>
          </>
        )}
        <div className="da-facts">
          <div className={c.gap ? 'is-bad' : ''}><b>{c.gap}</b><span>{T(lang, 'categories below 35%', '%35 altında kategori')}</span></div>
          <div className={m.flagged ? 'is-warn' : ''}><b>{m.flagged}</b><span>{T(lang, 'flagged questions', 'işaretli soru')}</span></div>
          <div className={unfinished ? 'is-warn' : ''}><b>{unfinished}</b><span>{T(lang, 'questions left in open phases', 'açık aşamalarda kalan soru')}</span></div>
          <div><b>{notStarted}</b><span>{T(lang, 'phases not started', 'başlanmamış aşama')}</span></div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════ Latest results ═══════════════════════ */
export function LatestCard({ m, details, names, go, lang }: P & { details: Record<number, Detail>; names: NameMap; go: Go }) {
  const withResults = PHASES.filter((p) => m.latest[p.num]);
  const [sel, setSel] = useState<number>(m.latestResult?.phase ?? 1);
  const phase = m.latest[sel] ? sel : (m.latestResult?.phase ?? 1);
  const r = m.latest[phase];
  if (!r) return null;
  const detail = details[r.id];
  const cats = categoriesOf(r, names);
  const c = bandCounts(cats);
  const vsAvg = m.overall && m.overall.phases > 1 ? Math.round(r.score) - Math.round(m.overall.score) : null;
  const prev = m.previous[phase];                                   // an earlier scored result of the SAME survey, when one exists
  const vsPrev = prev ? Math.round(r.score) - Math.round(prev.score) : null;
  const delta = (d: number, text: string) => (
    <span className={`da-delta ${d > 0 ? 'is-up' : d < 0 ? 'is-down' : ''}`}><Ic name={d < 0 ? 'down' : 'up'} size={13} />{d > 0 ? '+' : ''}{d} {text}</span>
  );
  return (
    <section className="da-card da-fill">
      <Head title={T(lang, 'Latest results', 'Son sonuçlar')} sub={r.name}>
        {m.latestResult?.id === r.id && <span className="da-head-meta">{T(lang, 'Most recent', 'En yeni')}</span>}
      </Head>
      <div className="da-body">
        {withResults.length > 1 && (
          <div className="da-chips" role="group" aria-label={T(lang, 'Phase', 'Aşama')}>
            {withResults.map((p) => (
              <button key={p.num} type="button" className={`da-chipbtn${phase === p.num ? ' is-on' : ''}`} aria-pressed={phase === p.num} onClick={() => setSel(p.num)}>
                <i style={{ background: PHASE_COLORS[p.num] }} />{phaseLabel(p.num, lang)}
              </button>
            ))}
          </div>
        )}
        <div key={phase} className="da-swap da-grow">
          <div className="da-latest">
            <GradeBadge grade={r.grade} size="lg" />
            <div className="da-latest-main">
              <span className="da-latest-score">{r.score.toFixed(1)}<small>%</small></span>
              <span className="da-latest-phase">{phaseLabel(phase, lang)} · {T(lang, 'phase', 'aşama')} {phase}</span>
            </div>
            <RingStat pct={r.score} size={64} stroke={6} color={PHASE_COLORS[phase]}>{Math.round(r.score)}</RingStat>
          </div>
          <dl className="da-latest-facts">
            <div><dt>{T(lang, 'Maturity', 'Olgunluk')}</dt><dd>{detail?.maturity?.label ?? '—'}</dd></div>
            <div><dt>{T(lang, 'Completed', 'Tamamlanma')}</dt><dd>{fmtDate(r.iso, lang)}</dd></div>
            <div><dt>{T(lang, 'Cycle', 'Dönem')}</dt><dd>{cycleLabel(r.cycle, lang)}</dd></div>
          </dl>
          {(vsPrev !== null || vsAvg !== null) && (
            <div className="da-deltas">
              {vsPrev !== null && prev && delta(vsPrev, T(lang, `pts vs previous result (${fmtShort(prev.iso, lang)})`, `puan, önceki sonuca göre (${fmtShort(prev.iso, lang)})`))}
              {vsAvg !== null && delta(vsAvg, T(lang, 'pts vs overall average', 'puan, genel ortalamaya göre'))}
            </div>
          )}
          {detail?.maturity?.narrative && <p className="da-narr">{detail.maturity.narrative}</p>}
          {cats.length > 0 && (
            <div className="da-band is-flush">
              <StackBar label={T(lang, 'Category bands', 'Kategori bantları')} parts={(['strong', 'developing', 'gap'] as Band[]).map((b) => ({ key: b, value: c[b], color: BAND_COLOR[b], tip: `${bandLabel(b, lang)}: ${c[b]}` }))} />
              <div className="da-band-legend">
                {(['strong', 'developing', 'gap'] as Band[]).map((b) => <span key={b}><i className="da-dot" style={{ background: BAND_COLOR[b] }} />{bandLabel(b, lang)} <b>{c[b]}</b></span>)}
              </div>
            </div>
          )}
        </div>
        <button type="button" className="da-btn da-btn-primary da-btn-block" onClick={() => go(`/results/${r.id}`)}>{T(lang, 'Open full report', 'Tam raporu aç')} <Ic name="arrow" size={14} /></button>
      </div>
    </section>
  );
}

/* ═══════════════════════ Recommendations & action plan ═══════════════════════ */
export function RecommendationsCard({ recs, state, tasks, tasksState, onAdded, lang }: P & {
  recs: RecWithPhase[]; state: LoadState; tasks: ActionTask[]; tasksState: LoadState; onAdded: () => void;
}) {
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const inPlan = (r: RecWithPhase) => tasks.some((t) => t.title === r.title && t.attempt === r.attemptId);
  const shown = all ? recs : recs.slice(0, 3);

  const add = async (r: RecWithPhase) => {
    const k = `${r.attemptId}|${r.title}`;
    setBusy(k); setErr('');
    try {
      // identical payload to the "Add to action plan" button on the Results page
      await actionTaskAPI.createTask({ attempt: r.attemptId, title: r.title, description: r.description ?? '', category: r.category ?? '', priority: r.priority ?? '', status: 'todo' });
      onAdded();
    } catch { setErr(T(lang, 'Could not add the task. Please try again.', 'Görev eklenemedi. Lütfen tekrar deneyin.')); }
    finally { setBusy(null); }
  };

  const open = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');
  const done = tasks.filter((t) => t.status === 'done').length;
  const next = open.slice().sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')).slice(0, 3);
  const counts = { todo: tasks.filter((t) => t.status === 'todo').length, in_progress: tasks.filter((t) => t.status === 'in_progress').length, done };

  return (
    <section className="da-card da-fill">
      <Head title={T(lang, 'Recommendations & action plan', 'Öneriler ve eylem planı')}
        hint={T(lang, 'Recommendations come from the same scoring rules as your results report (categories below 80%), highest priority first.', 'Öneriler, sonuç raporunuzdaki aynı puanlama kurallarından gelir (%80 altındaki kategoriler); en yüksek öncelik önce.')}>
        <Link href="/action-plan" className="da-link">{T(lang, 'Open action plan', 'Eylem planını aç')} <Ic name="arrow" size={13} /></Link>
      </Head>
      <div className="da-rec2">
        <div className="da-rec2-main">
          <h3 className="da-h3">{T(lang, 'Recommended actions', 'Önerilen eylemler')}{recs.length > 0 && <small>{recs.length}</small>}</h3>
          {state === 'loading' && <><div className="da-skel" /><div className="da-skel" style={{ width: '80%' }} /><div className="da-skel" style={{ width: '60%' }} /></>}
          {state !== 'loading' && recs.length === 0 && (
            <p className="da-empty">{state === 'error' || state === 'partial' ? T(lang, 'Recommendations could not be loaded.', 'Öneriler yüklenemedi.') : T(lang, 'No recommendations: every category scored 80% or above.', 'Öneri yok: tüm kategoriler %80 veya üzerinde.')}</p>
          )}
          {state !== 'loading' && shown.map((r, i) => {
            const k = `${r.attemptId}|${r.title}`;
            const added = inPlan(r);
            return (
              <div key={k + i} className="da-rec">
                <div className="da-rec-body">
                  <div className="da-rec-top"><span className={`da-prio ${r.priority}`}>{prioLabel(r.priority, lang)}</span><span className="da-rec-ctx">{phaseLabel(r.phase, lang)} · {r.category}{r.gri_standard ? ` · ${r.gri_standard}` : ''}</span></div>
                  <div className="da-rec-title">{r.title}</div>
                  <div className="da-rec-meta">{r.quick_win || r.description}{r.timeline_days ? ` · ~${r.timeline_days} ${T(lang, 'days', 'gün')}` : ''}{r.effort ? ` · ${r.effort}` : ''}</div>
                </div>
                <button type="button" className={`da-btn da-btn-sm${added ? ' is-done' : ''}`} disabled={added || busy === k} onClick={() => add(r)}>
                  {added ? <><Ic name="check" size={12} />{T(lang, 'In plan', 'Planda')}</> : busy === k ? '…' : <><Ic name="plus" size={12} />{T(lang, 'Add to plan', 'Plana ekle')}</>}
                </button>
              </div>
            );
          })}
          {err && <p className="da-err" role="alert">{err}</p>}
          {recs.length > 3 && <button type="button" className="da-link da-linkbtn" onClick={() => setAll((v) => !v)}>{all ? T(lang, 'Show fewer', 'Daha az göster') : `${T(lang, 'Show all', 'Tümünü göster')} (${recs.length})`}</button>}
        </div>
        <div className="da-rec2-side">
          <h3 className="da-h3">{T(lang, 'Your action plan', 'Eylem planınız')}{tasks.length > 0 && <small>{tasks.length}</small>}</h3>
          {tasksState === 'loading' && <div className="da-skel" />}
          {tasksState === 'error' && <p className="da-empty">{T(lang, 'Action plan could not be loaded.', 'Eylem planı yüklenemedi.')}</p>}
          {tasksState !== 'loading' && tasksState !== 'error' && tasks.length === 0 && (
            <div className="da-plan-empty">
              <Ic name="clipboard" size={20} />
              <p>{T(lang, 'No tasks yet. Add a recommendation to turn it into a tracked task.', 'Henüz görev yok. Bir öneriyi takip edilen göreve dönüştürmek için plana ekleyin.')}</p>
            </div>
          )}
          {tasks.length > 0 && (
            <>
              <div className="da-plan-counts">
                <div><b>{counts.todo}</b><span>{T(lang, 'To do', 'Yapılacak')}</span></div>
                <div><b>{counts.in_progress}</b><span>{T(lang, 'In progress', 'Devam eden')}</span></div>
                <div><b>{counts.done}</b><span>{T(lang, 'Done', 'Tamamlanan')}</span></div>
              </div>
              <StackBar label={T(lang, 'Tasks by status', 'Duruma göre görevler')} parts={[
                { key: 'done', value: counts.done, color: 'var(--olive-deep)', tip: `${T(lang, 'Done', 'Tamamlandı')}: ${counts.done}` },
                { key: 'ip', value: counts.in_progress, color: 'var(--amber)', tip: `${T(lang, 'In progress', 'Devam ediyor')}: ${counts.in_progress}` },
                { key: 'todo', value: counts.todo, color: 'var(--ink-4)', tip: `${T(lang, 'To do', 'Yapılacak')}: ${counts.todo}` },
              ]} />
              {next.map((t) => (
                <Link key={t.id} href="/action-plan" className="da-task">
                  <span className={`da-prio ${t.priority || 'Low'}`}>{t.priority ? prioLabel(t.priority, lang) : '—'}</span>
                  <span className="da-task-t">{t.title}</span>
                  <small>{t.due_date ? fmtDate(t.due_date, lang) : T(lang, 'no due date', 'tarih yok')}</small>
                </Link>
              ))}
            </>
          )}
          <Link href="/action-plan" className="da-btn da-btn-sm da-plan-open">{T(lang, 'Go to action plan', 'Eylem planına git')} <Ic name="arrow" size={12} /></Link>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════ Recent assessments ═══════════════════════ */
export function RecentCard({ m, lang }: P) {
  type Row = { key: string; phase: number; name: string; cycle: string; status: 'completed' | 'in_progress'; iso: string | null; score: number | null; grade: string | null; answered: number; total: number; href: string };
  const [filter, setFilter] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [showAll, setShowAll] = useState(false);
  const rows: Row[] = useMemo(() => {
    const live: Row[] = m.phases.filter((p) => p.status === 'in_progress' && p.attempt).map((p) => ({
      key: `live-${p.attempt!.id}`, phase: p.num, name: p.attempt!.survey_name, cycle: p.attempt!.cycle_name, status: 'in_progress', iso: p.attempt!.started_at,
      score: null, grade: null, answered: p.answered, total: p.attempt!.total_questions, href: `/questionnaire/${p.attempt!.id}`,
    }));
    const done: Row[] = m.results.slice().reverse().map((r) => ({
      key: `res-${r.id}`, phase: r.phase, name: r.name, cycle: r.cycle, status: 'completed', iso: r.iso, score: r.score, grade: r.grade,
      answered: r.attempt.answered_count, total: r.attempt.total_questions, href: `/results/${r.id}`,
    }));
    return [...live, ...done];
  }, [m]);
  const counts = { all: rows.length, completed: rows.filter((r) => r.status === 'completed').length, in_progress: rows.filter((r) => r.status === 'in_progress').length };
  const filtered = rows.filter((r) => filter === 'all' || r.status === filter);
  const visible = showAll ? filtered : filtered.slice(0, 5);
  const [ref, shown] = useInView<HTMLDivElement>(0.12);
  return (
    <section className="da-card" ref={ref}>
      <Head title={T(lang, 'Recent assessments', 'Son değerlendirmeler')}>
        <div className="da-seg" role="tablist" aria-label={T(lang, 'Filter assessments', 'Değerlendirmeleri filtrele')}>
          {(['all', 'completed', 'in_progress'] as const).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} className={filter === f ? 'is-on' : ''} onClick={() => { setFilter(f); setShowAll(false); }}>
              {f === 'all' ? T(lang, 'All', 'Tümü') : f === 'completed' ? T(lang, 'Completed', 'Tamamlanan') : T(lang, 'In progress', 'Devam eden')} <small>{counts[f]}</small>
            </button>
          ))}
        </div>
      </Head>
      <div className="da-tbl" role="table" aria-label={T(lang, 'Recent assessments', 'Son değerlendirmeler')}>
        <div className="da-tr is-head" role="row">
          <span role="columnheader">{T(lang, 'Assessment', 'Değerlendirme')}</span>
          <span role="columnheader" className="c-cycle">{T(lang, 'Cycle', 'Dönem')}</span>
          <span role="columnheader" className="c-status">{T(lang, 'Status', 'Durum')}</span>
          <span role="columnheader" className="c-score">{T(lang, 'Score', 'Skor')}</span>
          <span role="columnheader" className="c-grade">{T(lang, 'Grade', 'Not')}</span>
          <span role="columnheader" className="c-date">{T(lang, 'Date', 'Tarih')}</span>
          <span role="columnheader" className="c-act"><span className="da-sr">{T(lang, 'Action', 'İşlem')}</span></span>
        </div>
        {visible.length === 0 && <p className="da-empty">{T(lang, 'Nothing to show for this filter.', 'Bu filtre için gösterilecek bir şey yok.')}</p>}
        <div key={filter} className="da-swap">
          {visible.map((r, i) => {
            const prog = r.total ? Math.round((r.answered / r.total) * 100) : 0;
            return (
              <Link key={r.key} href={r.href} className="da-tr" role="row">
                <span role="cell" className="c-name">
                  <i className="da-dot" style={{ background: PHASE_COLORS[r.phase] }} />
                  <span><b>{phaseLabel(r.phase, lang)}</b><small>{r.name}</small><small className="c-sub">{cycleLabel(r.cycle, lang)} · {fmtDate(r.iso, lang)}</small></span>
                </span>
                <span role="cell" className="c-cycle">{cycleLabel(r.cycle, lang)}</span>
                <span role="cell" className="c-status"><em className={`da-chip c-${r.status}`}>{r.status === 'completed' ? T(lang, 'Completed', 'Tamamlandı') : T(lang, 'In progress', 'Devam ediyor')}</em></span>
                <span role="cell" className="c-score">
                  {r.score === null
                    ? <><span className="da-track"><span className="da-anim-w" style={{ width: shown ? `${prog}%` : '0%', background: 'var(--amber)', transitionDelay: `${i * 50}ms` }} /></span><b title={T(lang, 'Questions answered', 'Cevaplanan soru')}>{r.answered}/{r.total}</b></>
                    : <><span className="da-track"><span className="da-anim-w" style={{ width: shown ? `${r.score}%` : '0%', background: scoreColor(r.score), transitionDelay: `${i * 50}ms` }} /></span><b>{r.score.toFixed(1)}%</b></>}
                </span>
                <span role="cell" className="c-grade"><GradeBadge grade={r.grade} size="sm" /></span>
                <span role="cell" className="c-date">{fmtDate(r.iso, lang)}</span>
                <span role="cell" className="c-act">{r.status === 'in_progress' ? T(lang, 'Continue', 'Devam et') : T(lang, 'View results', 'Sonuçları gör')}<Ic name="arrow" size={13} /></span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="da-tbl-foot">
        {filtered.length > 5
          ? <button type="button" className="da-link da-linkbtn" onClick={() => setShowAll((v) => !v)}>{showAll ? T(lang, 'Show fewer', 'Daha az göster') : `${T(lang, 'Show all', 'Tümünü göster')} (${filtered.length})`}</button>
          : <span className="da-tbl-count">{filtered.length} {T(lang, filtered.length === 1 ? 'assessment' : 'assessments', 'değerlendirme')}</span>}
        <Link href="/history" className="da-link">{T(lang, 'Full assessment history', 'Tüm değerlendirme geçmişi')} <Ic name="arrow" size={13} /></Link>
      </div>
    </section>
  );
}

/* ═══════════════════════ Quick actions ═══════════════════════ */
export function QuickCard({ m, lang }: P) {
  const na = nextAction(m, lang);
  const r = m.latestResult;
  const items: { href: string; label: string; sub?: string; icon: IconName; primary?: boolean }[] = [
    { href: na.href, label: na.kind === 'continue' ? T(lang, 'Continue assessment', 'Değerlendirmeye devam') : na.kind === 'report' ? na.label : T(lang, 'Start assessment', 'Değerlendirme başlat'), sub: na.kind === 'report' ? undefined : na.phase ? (na.kind === 'continue' ? na.sub : phaseLabel(na.phase.num, lang)) : undefined, icon: na.kind === 'report' ? 'chart' : 'play', primary: true },
    ...(r ? [{ href: `/results/${r.id}`, label: T(lang, 'View results', 'Sonuçları gör'), sub: phaseLabel(r.phase, lang), icon: 'chart' as IconName }] : []),
    { href: '/action-plan', label: T(lang, 'Action plan', 'Eylem planı'), icon: 'clipboard' },
    { href: '/courses', label: T(lang, 'Courses', 'Kurslar'), icon: 'book' },
    { href: '/history', label: T(lang, 'Assessment history', 'Değerlendirme geçmişi'), icon: 'clock' },
    { href: '/documents', label: T(lang, 'Documents', 'Belgeler'), icon: 'doc' },
  ];
  return (
    <section className="da-card">
      <Head title={T(lang, 'Quick actions', 'Hızlı işlemler')} />
      <nav className="da-quick" aria-label={T(lang, 'Quick actions', 'Hızlı işlemler')}>
        {items.map((it) => (
          <Link key={it.href + it.label} href={it.href} className={`da-qa${it.primary ? ' is-primary' : ''}`}>
            <span className="da-qa-ic"><Ic name={it.icon} size={17} /></span>
            <span className="da-qa-t">{it.label}{it.sub && <small>{it.sub}</small>}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}

/* ═══════════════════════ First-time dashboard ═══════════════════════ */
export function FirstTime({ m, lang }: P) {
  const live = m.phases.find((p) => p.status === 'in_progress' && p.attempt);
  const teasers: { icon: IconName; title: string; text: string }[] = [
    { icon: 'chart', title: T(lang, 'Performance analytics', 'Performans analizi'), text: T(lang, 'Scores per phase, with category detail and a switchable chart view.', 'Aşama başına skorlar, kategori ayrıntısı ve değiştirilebilir grafik görünümü.') },
    { icon: 'target', title: T(lang, 'ESG breakdown', 'ESG dağılımı'), text: T(lang, 'Environmental, social and governance results side by side.', 'Çevre, sosyal ve yönetişim sonuçları yan yana.') },
    { icon: 'clipboard', title: T(lang, 'Insights & actions', 'İçgörüler ve eylemler'), text: T(lang, 'Strongest areas, gaps and recommended next steps you can add to your action plan.', 'Güçlü alanlar, açıklar ve eylem planınıza ekleyebileceğiniz önerilen adımlar.') },
  ];
  return (
    <>
      <Reveal>
        <section className="da-card da-first">
          <div className="da-first-main">
            <span className="da-eyebrow">{live ? T(lang, 'In progress', 'Devam ediyor') : T(lang, 'Get started', 'Başlayın')}</span>
            <h2>{live ? T(lang, 'Finish your first phase to unlock your analytics', 'Analizlerinizi açmak için ilk aşamayı bitirin') : T(lang, 'Measure your sustainability performance', 'Sürdürülebilirlik performansınızı ölçün')}</h2>
            <p>{live
              ? T(lang, 'Your scores, ESG breakdown, trends and recommendations appear here as soon as one phase is completed.', 'Bir aşama tamamlanır tamamlanmaz skorlarınız, ESG dağılımınız, trendleriniz ve önerileriniz burada görünür.')
              : T(lang, 'Complete the five-phase GRI assessment to see your score, grade, ESG breakdown, strengths, gaps and a recommended action plan.', 'Skorunuzu, notunuzu, ESG dağılımınızı, güçlü yönlerinizi, açıklarınızı ve önerilen eylem planını görmek için beş aşamalı GRI değerlendirmesini tamamlayın.')}</p>
            <Link href={live ? `/questionnaire/${live.attempt!.id}` : '/surveys'} className="da-btn da-btn-primary da-btn-lg">
              {live ? T(lang, 'Continue assessment', 'Devam et') : T(lang, 'Choose a survey', 'Anket seç')} <Ic name="arrow" size={14} />
            </Link>
          </div>
          <div className="da-first-side">
            <h3 className="da-h3">{T(lang, 'Your assessment roadmap', 'Değerlendirme yol haritanız')}</h3>
            <ol className="da-road">
              {PHASES.map((p) => {
                const st = m.phases[p.num - 1];
                return (
                  <li key={p.num} className={`da-road-row is-${st.status}`}>
                    <span className="da-gp-node">{st.status === 'locked' ? <Ic name="lock" size={12} /> : p.num}</span>
                    <b>{phaseLabel(p.num, lang)}</b>
                    <small>{st.status === 'in_progress' ? `${st.answered}/${st.total ?? '?'} ${T(lang, 'answered', 'cevap')}` : st.total !== null ? `${st.total} ${T(lang, 'questions', 'soru')}` : T(lang, 'by sector', 'sektöre göre')}</small>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      </Reveal>
      <Reveal delay={80}>
        <section className="da-card">
          <Head title={T(lang, 'What you will see here', 'Burada neler göreceksiniz')} />
          <div className="da-teaser">
            {teasers.map((x) => (
              <div key={x.title}><span className="da-kpi-ic"><Ic name={x.icon} /></span><b>{x.title}</b><span>{x.text}</span></div>
            ))}
          </div>
        </section>
      </Reveal>
    </>
  );
}

/* ═══════════════════════ Loading skeleton ═══════════════════════ */
export function DashSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="da-skeleton">
      <div className="da-sk" style={{ height: 64, maxWidth: 420 }} />
      <div className="da-kpis">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="da-card da-sk" style={{ height: 132 }} />)}</div>
      <div className="da-row da-row-analytics"><div className="da-card da-sk" style={{ height: 360 }} /><div className="da-card da-sk" style={{ height: 360 }} /></div>
      <div className="da-card da-sk" style={{ height: 240 }} />
    </div>
  );
}

/* re-export for the page */
export { hasTrend, rankCategories };
