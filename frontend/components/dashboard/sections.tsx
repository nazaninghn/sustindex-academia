'use client';
/* Dashboard sections. Every figure comes from lib/dashboard-data.ts (derived from the API);
   every control (tabs, chips, expanders, filters, buttons) performs a real action. */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/shared';
import { gradeColor } from '@/lib/utils';
import { actionTaskAPI } from '@/lib/api';
import type { ActionTask } from '@/lib/api';
import {
  PHASES, bandCounts, bandOf, categoriesOf, hasTrend, rankCategories, strongest, weakest,
} from '@/lib/dashboard-data';
import type { Band, DashModel, PhaseState, RankedCategory, ResultPoint } from '@/lib/dashboard-data';
import {
  HBars, Legend, PHASE_COLORS, Radar, Ring, ResultBars, StackBar, TipRows, TrendChart, fmtFull, fmtShort, phaseLabel,
} from './charts';
import type { BarRow } from './charts';
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

/* ═══════════════════════ KPI strip ═══════════════════════ */
export function KpiStrip({ m, lang }: P) {
  const latest = m.latestResult;
  const qPct = m.applicable > 0 ? Math.min(100, Math.round((m.answered / m.applicable) * 100)) : 0;
  return (
    <div className="da-kpis">
      <div className="da-card da-kpi is-hero">
        <div className="da-ring"><Ring pct={m.overall?.score ?? 0} size={46} stroke={5} /><span>{m.overall ? Math.round(m.overall.score) : '—'}</span></div>
        <div style={{ minWidth: 0 }}>
          <span className="da-klabel">{T(lang, 'Overall score', 'Genel skor')}</span>
          <div className="da-kval">{m.overall ? Math.round(m.overall.score) : '—'}<small>/ 100</small></div>
          <span className="da-ksub" title={T(lang, 'Average of the latest completed score of each phase', 'Her aşamanın son tamamlanan skorunun ortalaması')}>
            {m.overall ? T(lang, `mean of ${m.overall.phases} completed phase${m.overall.phases !== 1 ? 's' : ''}`, `${m.overall.phases} aşamanın ortalaması`) : T(lang, 'no completed phase yet', 'henüz tamamlanan aşama yok')}
          </span>
        </div>
      </div>
      <div className="da-card da-kpi">
        <div className="da-ring"><Ring pct={latest?.score ?? 0} size={46} stroke={5} color={latest?.grade ? gradeColor(latest.grade) : 'var(--line)'} /><span>{latest ? `${Math.round(latest.score)}%` : '—'}</span></div>
        <div style={{ minWidth: 0 }}>
          <span className="da-klabel">{T(lang, 'Latest grade', 'Son not')}</span>
          <div className="da-kval" style={latest?.grade ? { color: gradeColor(latest.grade), fontWeight: 700 } : undefined}>{latest?.grade ?? '—'}</div>
          <span className="da-ksub">{latest ? `${phaseLabel(latest.phase, lang)} · ${fmtDate(latest.iso, lang)}` : T(lang, 'not graded yet', 'henüz notlandırılmadı')}</span>
        </div>
      </div>
      <div className="da-card da-kpi">
        <div className="da-ring"><Ring pct={m.completionPct} size={46} stroke={5} /><span>{m.completionPct}%</span></div>
        <div style={{ minWidth: 0 }}>
          <span className="da-klabel">{T(lang, 'Completion', 'Tamamlanma')}</span>
          <div className="da-kval">{m.phasesCompleted}<small>/ {PHASES.length} {T(lang, 'phases', 'aşama')}</small></div>
          <span className="da-ksub">{m.activeCycle ? `${T(lang, 'cycle', 'dönem')}: ${m.activeCycle}` : T(lang, 'GRI assessment', 'GRI değerlendirmesi')}</span>
        </div>
      </div>
      <div className="da-card da-kpi">
        <div className="da-ring"><Ring pct={qPct} size={46} stroke={5} /><span>{qPct}%</span></div>
        <div style={{ minWidth: 0 }}>
          <span className="da-klabel">{T(lang, 'Questions answered', 'Cevaplanan soru')}</span>
          <div className="da-kval">{m.answered}<small>/ {m.applicable}</small></div>
          <span className="da-ksub" title={T(lang, 'Sector questions are counted once a sector assessment is started', 'Sektör soruları, sektör değerlendirmesi başlatılınca sayılır')}>
            {m.applicableComplete ? T(lang, 'applicable questions', 'geçerli soru') : T(lang, 'sector not counted yet', 'sektör henüz sayılmadı')}
          </span>
        </div>
      </div>
      <div className="da-card da-kpi" style={{ gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <span className="da-klabel">{T(lang, 'Completed', 'Tamamlanan')}</span>
          <div className="da-kval" style={{ color: 'var(--olive-deep)' }}>{m.completedCount}</div>
          <span className="da-ksub">{T(lang, 'assessments', 'değerlendirme')}</span>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)' }} />
        <div style={{ minWidth: 0 }}>
          <span className="da-klabel">{T(lang, 'In progress', 'Devam eden')}</span>
          <div className="da-kval" style={{ color: m.inProgressCount ? 'var(--amber)' : 'var(--ink)' }}>{m.inProgressCount}</div>
          <span className="da-ksub">{T(lang, 'assessments', 'değerlendirme')}</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ Continue assessment ═══════════════════════ */
export function ContinueStrip({ m, lang }: P) {
  const [ref, shown] = useInView<HTMLDivElement>(0.2);
  const live = m.phases.find((p) => p.status === 'in_progress' && p.attempt);
  const next = !live ? m.phases.find((p) => p.status === 'available') : undefined;
  if (!live && !next && m.phasesCompleted < PHASES.length) return null;

  if (live && live.attempt) {
    const a = live.attempt;
    return (
      <section ref={ref} className="da-card da-continue">
        <div className="da-continue-main">
          <span className="da-eyebrow">{T(lang, 'Continue assessment', 'Değerlendirmeye devam et')}{a.cycle_name ? ` · ${a.cycle_name}` : ''}</span>
          <h2 className="da-h2">{phaseLabel(live.num, lang)} <span>· {a.survey_name}</span></h2>
        </div>
        <div className="da-continue-prog">
          <div className="da-continue-meta">
            <span><b>{live.answered}</b> {T(lang, 'of', '/')} {live.total ?? '?'} {T(lang, 'answered', 'cevaplandı')} · {live.remaining ?? '?'} {T(lang, 'remaining', 'kaldı')}</span>
            <span>{live.pct}%</span>
          </div>
          <div className="da-track da-track-lg"><div className="da-anim-w" style={{ width: shown ? `${live.pct}%` : '0%', background: 'var(--amber)' }} /></div>
          <span className="da-continue-sub">{T(lang, 'Started', 'Başlangıç')} {timeAgo(a.started_at, lang)}</span>
        </div>
        <Link href={`/questionnaire/${a.id}`} className="da-btn da-btn-primary da-btn-lg">{T(lang, 'Continue', 'Devam et')} <Icon.arrow /></Link>
      </section>
    );
  }
  if (next) {
    return (
      <section className="da-card da-continue">
        <div className="da-continue-main">
          <span className="da-eyebrow">{T(lang, 'Next step', 'Sonraki adım')}</span>
          <h2 className="da-h2">{T(lang, `Ready for phase ${next.num}: ${phaseLabel(next.num, lang)}`, `${next.num}. aşama hazır: ${phaseLabel(next.num, lang)}`)}</h2>
        </div>
        <div className="da-continue-prog"><span className="da-continue-sub">{next.total !== null ? `${next.total} ${T(lang, 'questions', 'soru')}` : T(lang, 'Questions depend on the sector you choose', 'Sorular seçeceğiniz sektöre göre değişir')}</span></div>
        <Link href="/surveys" className="da-btn da-btn-primary da-btn-lg">{T(lang, 'Start', 'Başla')} <Icon.arrow /></Link>
      </section>
    );
  }
  return (
    <section className="da-card da-continue">
      <div className="da-continue-main">
        <span className="da-eyebrow">{T(lang, 'All phases completed', 'Tüm aşamalar tamamlandı')}</span>
        <h2 className="da-h2">{T(lang, 'Your five-phase GRI assessment is complete', 'Beş aşamalı GRI değerlendirmeniz tamamlandı')}</h2>
      </div>
      <div className="da-continue-prog" />
      <Link href="/results/combined" className="da-btn da-btn-primary da-btn-lg">{T(lang, 'Combined report', 'Birleşik rapor')} <Icon.arrow /></Link>
    </section>
  );
}

/* ═══════════════════════ Performance analytics (switchable views) ═══════════════════════ */
type View = 'scores' | 'categories' | 'trend' | 'compare';

export function comparisonRows(m: DashModel) {
  return PHASES.map((p) => ({ p, cur: m.latest[p.num], prev: m.previous[p.num] })).filter((x) => x.cur && x.prev) as
    { p: (typeof PHASES)[number]; cur: ResultPoint; prev: ResultPoint }[];
}

export function PerformanceCard({ m, names, go, lang }: P & { names: NameMap; go: Go }) {
  const trend = hasTrend(m);
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
  const latestPerPhase = withResults.map((p) => m.latest[p.num] as ResultPoint).sort((a, b) => a.t - b.t);
  const open = (id: number) => go(`/results/${id}`);

  const catRows = useMemo<BarRow[]>(() => {
    const r = m.latest[catPhase];
    if (!r) return [];
    const list = categoriesOf(r, names).sort((a, b) => (sort === 'low' ? a.pct - b.pct : b.pct - a.pct));
    return list.map((c, i) => ({
      key: `${r.id}-${i}-${c.name}`, label: c.name, pct: c.pct, color: scoreColor(c.pct),
      tip: <TipRows title={c.name} rows={[[T(lang, 'Score', 'Skor'), `${c.pct.toFixed(1)}%`], [T(lang, 'Points', 'Puan'), `${c.score ?? '—'} / ${c.max ?? '—'}`], [T(lang, 'Band', 'Bant'), bandOf(c.pct)]]} />,
      href: `/results/${r.id}`,
    }));
  }, [m, names, catPhase, sort, lang]);

  const compareRows: BarRow[] = cmp.flatMap(({ p, cur, prev }) => {
    const d = Math.round(cur.score) - Math.round(prev.score);
    return [
      { key: `${p.num}-prev`, label: phaseLabel(p.num, lang), sub: `${T(lang, 'previous', 'önceki')} · ${fmtShort(prev.iso, lang)}`, pct: prev.score, color: 'var(--ink-4)' },
      { key: `${p.num}-cur`, label: phaseLabel(p.num, lang), sub: `${T(lang, 'latest', 'son')} · ${fmtShort(cur.iso, lang)} · ${d > 0 ? '+' : ''}${d} ${T(lang, 'pts', 'puan')}`, pct: cur.score, color: PHASE_COLORS[p.num], href: `/results/${cur.id}` },
    ];
  });

  return (
    <section className="da-card da-fill">
      <div className="da-head">
        <div>
          <span className="da-eyebrow">{T(lang, 'Performance analytics', 'Performans analizi')}</span>
          <h2 className="da-h2">{views.find((v) => v.id === active)?.label}</h2>
        </div>
        <div className="da-seg" role="tablist" aria-label={T(lang, 'Chart view', 'Grafik görünümü')}>
          {views.map((v) => (
            <button key={v.id} role="tab" aria-selected={active === v.id} className={active === v.id ? 'is-on' : ''} onClick={() => setView(v.id)}>{v.label}</button>
          ))}
        </div>
      </div>
      <div className="da-body">
        <div key={active} className="da-swap">
          {active === 'scores' && <ResultBars results={latestPerPhase} lang={lang} onOpen={open} />}
          {active === 'trend' && <TrendChart results={m.results} lang={lang} onOpen={open} />}
          {active === 'compare' && <HBars rows={compareRows} onOpen={go} />}
          {active === 'categories' && (
            <>
              <div className="da-toolbar">
                <div className="da-chips" role="group" aria-label={T(lang, 'Phase', 'Aşama')}>
                  {withResults.map((p) => (
                    <button key={p.num} className={`da-chipbtn${catPhase === p.num ? ' is-on' : ''}`} aria-pressed={catPhase === p.num} onClick={() => setCatPhase(p.num)}>
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
        <p className="da-note">
          {active === 'scores' && T(lang, 'Each bar is a phase’s latest completed result. Hover for details, click to open the report.', 'Her çubuk bir aşamanın son tamamlanan sonucudur. Ayrıntı için üzerine gelin, rapor için tıklayın.')}
          {active === 'categories' && T(lang, 'Category scores of the phase’s latest result. Categories without applicable questions are left out, not shown as 0%.', 'Aşamanın son sonucundaki kategori skorları. Geçerli sorusu olmayan kategoriler 0% olarak değil, hiç gösterilmez.')}
          {active === 'trend' && T(lang, 'Lines connect completed results of the same survey only.', 'Çizgiler yalnızca aynı anketin tamamlanan sonuçlarını birleştirir.')}
          {active === 'compare' && T(lang, 'Previous and latest completed result of the same survey.', 'Aynı anketin önceki ve son tamamlanan sonucu.')}
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════ ESG performance (expandable) ═══════════════════════ */
export function EsgCard({ m, names, go, lang }: P & { names: NameMap; go: Go }) {
  const [ref, shown] = useInView<HTMLDivElement>(0.15);
  const [openNum, setOpenNum] = useState<number | null>(null);
  const tick = m.overall?.score;
  const order = [2, 3, 1, 4, 5];
  const axes = order.map((n) => ({ n, r: m.latest[n] })).filter((x) => x.r)
    .map((x) => ({ label: phaseLabel(x.n, lang), value: (x.r as ResultPoint).score, color: PHASE_COLORS[x.n] }));

  const item = (num: number) => {
    const r = m.latest[num];
    const st = m.phases[num - 1];
    if (!r) {
      return (
        <div key={num} className="da-esg-item is-na">
          <div className="da-esg-row">
            <span className="da-esg-name"><i className="da-dot" style={{ background: PHASE_COLORS[num] }} />{phaseLabel(num, lang)}</span>
            <span className="da-esg-na">{st.status === 'locked' ? '🔒 ' : ''}{T(lang, 'Not assessed yet', 'Henüz değerlendirilmedi')}</span>
          </div>
        </div>
      );
    }
    const cats = categoriesOf(r, names);
    const top = strongest(cats, 2), low = weakest(cats, 2);
    const isOpen = openNum === num;
    const delta = tick !== undefined && m.overall && m.overall.phases > 1 ? Math.round(r.score) - Math.round(tick) : null;
    return (
      <div key={num} className={`da-esg-item${isOpen ? ' is-open' : ''}`}>
        <button className="da-esg-row" aria-expanded={isOpen} onClick={() => setOpenNum(isOpen ? null : num)}>
          <span className="da-esg-name"><i className="da-dot" style={{ background: PHASE_COLORS[num] }} />{phaseLabel(num, lang)}</span>
          <span className="da-track" title={`${r.score.toFixed(1)}%`}>
            <div className="da-anim-w" style={{ width: shown ? `${r.score}%` : '0%', background: PHASE_COLORS[num] }} />
            {tick !== undefined && m.overall && m.overall.phases > 1 && <i className="da-htick" style={{ left: `${tick}%` }} />}
          </span>
          <span className="da-pct" style={{ color: scoreColor(r.score) }}>{Math.round(r.score)}%</span>
          <span className="da-grade" style={{ color: r.grade ? gradeColor(r.grade) : 'var(--ink-4)' }}>{r.grade ?? ''}</span>
          <span className="da-chev" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
        </button>
        <div className="da-expand" data-open={isOpen}>
          <div>
            <div className="da-esg-detail">
              <p className="da-esg-meta">
                {cats.length} {T(lang, 'scored categories', 'puanlanan kategori')} · {fmtDate(r.iso, lang)}
                {delta !== null && <> · <b style={{ color: delta >= 0 ? 'var(--olive-deep)' : 'var(--danger)' }}>{delta > 0 ? '+' : ''}{delta} {T(lang, 'vs overall average', 'genel ortalamaya göre')}</b></>}
              </p>
              <div className="da-esg-two">
                <div><h4><i className="da-dot" style={{ background: BAND_COLOR.strong }} />{T(lang, 'Strongest', 'En güçlü')}</h4>{top.map((c, i) => <div key={i} className="da-mini"><span>{c.name}</span><b style={{ color: scoreColor(c.pct) }}>{Math.round(c.pct)}%</b></div>)}</div>
                <div><h4><i className="da-dot" style={{ background: BAND_COLOR.gap }} />{T(lang, 'Needs attention', 'Dikkat gerektiren')}</h4>{low.map((c, i) => <div key={i} className="da-mini"><span>{c.name}</span><b style={{ color: scoreColor(c.pct) }}>{Math.round(c.pct)}%</b></div>)}</div>
              </div>
              <button className="da-link da-linkbtn" onClick={() => go(`/results/${r.id}`)}>{T(lang, 'Open full results', 'Tüm sonuçları aç')} <Icon.arrow /></button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section ref={ref} className="da-card da-fill">
      <div className="da-head">
        <div>
          <span className="da-eyebrow">{T(lang, 'ESG performance', 'ESG performansı')}</span>
          <h2 className="da-h2">{T(lang, 'Environmental · Social · Governance', 'Çevre · Sosyal · Yönetişim')}</h2>
        </div>
      </div>
      <div className="da-body">
        {axes.length >= 3 && <div style={{ marginBottom: 8 }}><Radar axes={axes} lang={lang} /></div>}
        <div className="da-esg">
          {[2, 3, 1].map(item)}
          <div className="da-esg-sep"><span>{T(lang, 'Other GRI dimensions', 'Diğer GRI boyutları')}</span></div>
          {[4, 5].map(item)}
        </div>
        <p className="da-note">
          {m.overall && m.overall.phases > 1
            ? T(lang, 'The thin marker on each bar is your overall average. Click a row for its strongest and weakest categories.', 'Her çubuktaki ince işaret genel ortalamanızdır. En güçlü ve en zayıf kategoriler için bir satıra tıklayın.')
            : T(lang, 'Each score is the latest completed result of that GRI phase. Click a row for details.', 'Her skor ilgili GRI aşamasının son tamamlanan sonucudur. Ayrıntı için bir satıra tıklayın.')}
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════ GRI assessment progress ═══════════════════════ */
export function PhaseProgress({ m, lang }: P) {
  const [openNum, setOpenNum] = useState<number | null>(null);
  const [ref, shown] = useInView<HTMLDivElement>(0.2);
  const statusLabel = (s: PhaseState['status']) => ({
    completed: T(lang, 'Completed', 'Tamamlandı'), in_progress: T(lang, 'In progress', 'Devam ediyor'),
    available: T(lang, 'Available', 'Başlanabilir'), locked: T(lang, 'Locked', 'Kilitli'),
  }[s]);
  return (
    <section className="da-card" ref={ref}>
      <div className="da-head">
        <div>
          <span className="da-eyebrow">{T(lang, 'GRI assessment progress', 'GRI değerlendirme ilerlemesi')}</span>
          <h2 className="da-h2">{T(lang, 'Five-phase assessment journey', 'Beş aşamalı değerlendirme yolculuğu')}</h2>
        </div>
        <span className="da-sub" style={{ whiteSpace: 'nowrap' }}>{m.phasesCompleted} / {PHASES.length} · {m.completionPct}%</span>
      </div>
      <div className="da-steps" aria-hidden="true">
        {PHASES.map((p, i) => {
          const st = m.phases[p.num - 1];
          return <span key={p.num} className={`is-${st.status}`}><i className="da-anim-w" style={{ width: shown ? (st.status === 'completed' ? '100%' : st.status === 'in_progress' ? `${st.pct}%` : '0%') : '0%', transitionDelay: `${i * 110}ms` }} /></span>;
        })}
      </div>
      <div className="da-phases">
        {PHASES.map((p) => {
          const st = m.phases[p.num - 1];
          const res = m.latest[p.num];
          const att = st.attempt;
          const href = st.status === 'completed' && att ? `/results/${att.id}`
                     : st.status === 'in_progress' && att ? `/questionnaire/${att.id}`
                     : st.status === 'available' ? '/surveys' : null;
          const cta = st.status === 'completed' ? T(lang, 'View results', 'Sonuçları gör')
                    : st.status === 'in_progress' ? T(lang, 'Continue', 'Devam et')
                    : st.status === 'available' ? T(lang, 'Start', 'Başla')
                    : T(lang, `Complete ${phaseLabel(p.num - 1, lang)} first`, `Önce ${phaseLabel(p.num - 1, lang)} aşamasını tamamlayın`);
          const pct = st.status === 'completed' ? 100 : st.pct;
          const isOpen = openNum === p.num;
          const body = (
            <>
              <div className="da-phase-top">
                <span className="da-phase-name"><b>{String(p.num).padStart(2, '0')}</b>{phaseLabel(p.num, lang)}</span>
                <span className={`da-chip c-${st.status}`}>{statusLabel(st.status)}</span>
              </div>
              <div className="da-phase-hero">
                <div className="da-phase-ring">
                  <Ring pct={pct} size={58} stroke={6} color={st.status === 'in_progress' ? 'var(--amber)' : st.status === 'completed' ? 'var(--olive-deep)' : 'var(--ink-4)'} />
                  <span>{st.status === 'locked' ? '🔒' : `${pct}%`}</span>
                </div>
                <div className="da-phase-nums">
                  {st.status === 'completed' && att ? (
                    <><b style={{ color: 'var(--olive-deep)' }}>{Math.round(att.total_score ?? 0)}<small>%</small></b>{att.overall_grade && <em style={{ color: gradeColor(att.overall_grade) }}>{att.overall_grade}</em>}</>
                  ) : res && st.status !== 'completed' ? (
                    <span className="da-phase-meta">{T(lang, 'last result', 'son sonuç')}: {Math.round(res.score)}%</span>
                  ) : null}
                </div>
              </div>
              <div className="da-phase-meta">
                {st.total === null
                  ? T(lang, 'Questions depend on the chosen sector', 'Sorular seçilen sektöre göre değişir')
                  : <><b>{st.answered}</b> {T(lang, 'answered', 'cevaplandı')} · <b>{st.remaining}</b> {T(lang, 'remaining', 'kaldı')} {T(lang, 'of', '/')} {st.total}</>}
              </div>
            </>
          );
          return (
            <div key={p.num} className={`da-phase is-${st.status}${isOpen ? ' is-open' : ''}`}>
              {href ? <Link href={href} className="da-phase-link">{body}</Link> : <div className="da-phase-link is-static" aria-disabled="true" title={T(lang, 'Phases unlock one after another within an assessment cycle', 'Aşamalar bir değerlendirme döneminde sırayla açılır')}>{body}</div>}
              <div className="da-phase-foot">
                {href
                  ? <Link href={href} className="da-phase-cta">{cta} <Icon.arrow /></Link>
                  : <span className="da-phase-cta is-off">{st.status === 'locked' && '🔒 '}{cta}</span>}
                {att && <button className="da-phase-more" aria-expanded={isOpen} onClick={() => setOpenNum(isOpen ? null : p.num)}>{isOpen ? T(lang, 'Less', 'Az') : T(lang, 'Details', 'Ayrıntı')} {isOpen ? '▴' : '▾'}</button>}
              </div>
              <div className="da-expand" data-open={isOpen}>
                <div>
                  {att && (
                    <dl className="da-dl">
                      <dt>{T(lang, 'Survey', 'Anket')}</dt><dd>{att.survey_name}</dd>
                      <dt>{T(lang, 'Cycle', 'Dönem')}</dt><dd>{att.cycle_name || '—'}</dd>
                      <dt>{T(lang, 'Started', 'Başlangıç')}</dt><dd>{fmtDate(att.started_at, lang)}</dd>
                      {att.completed_at && <><dt>{T(lang, 'Completed', 'Tamamlanma')}</dt><dd>{fmtDate(att.completed_at, lang)}</dd></>}
                      <dt>{T(lang, 'Flagged', 'İşaretli')}</dt><dd>{att.bookmarked_count ?? 0}</dd>
                      {st.status === 'completed' && <><dt>{T(lang, 'Categories', 'Kategori')}</dt><dd>{att.category_scores?.length ?? 0}</dd></>}
                    </dl>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ═══════════════════════ Performance insights ═══════════════════════ */
export function InsightsCard({ m, cats, go, lang }: P & { cats: RankedCategory[]; go: Go }) {
  const c = bandCounts(cats);
  const unfinished = m.phases.filter((p) => p.status === 'in_progress').reduce((s, p) => s + (p.remaining ?? 0), 0);
  const notStarted = m.phases.filter((p) => p.status === 'available' || p.status === 'locked').length;
  const rows = (list: RankedCategory[]): BarRow[] => list.map((x, i) => ({
    key: `${x.phase}-${i}-${x.name}`, label: x.name, sub: phaseLabel(x.phase, lang), pct: x.pct, color: scoreColor(x.pct),
    tip: <TipRows title={x.name} rows={[[T(lang, 'Phase', 'Aşama'), phaseLabel(x.phase, lang)], [T(lang, 'Score', 'Skor'), `${x.pct.toFixed(1)}%`], [T(lang, 'Points', 'Puan'), `${x.score ?? '—'} / ${x.max ?? '—'}`]]} />,
    href: m.latest[x.phase] ? `/results/${m.latest[x.phase]!.id}` : undefined,
  }));
  const bands: { band: Band; label: string; hint: string }[] = [
    { band: 'strong', label: T(lang, 'Strong', 'Güçlü'), hint: '≥ 60%' },
    { band: 'developing', label: T(lang, 'Developing', 'Gelişen'), hint: '35–59%' },
    { band: 'gap', label: T(lang, 'Gap', 'Açık'), hint: '< 35%' },
  ];
  return (
    <section className="da-card">
      <div className="da-head">
        <div>
          <span className="da-eyebrow">{T(lang, 'Performance insights', 'Performans içgörüleri')}</span>
          <h2 className="da-h2">{T(lang, 'Strengths and gaps across your results', 'Sonuçlarınızdaki güçlü yönler ve açıklar')}</h2>
        </div>
        <span className="da-sub">{cats.length} {T(lang, 'scored categories', 'puanlanan kategori')}</span>
      </div>
      <div className="da-attn">
        <span className={`da-attn-chip${c.gap ? ' is-bad' : ''}`}><b>{c.gap}</b> {T(lang, 'categories below 35%', '%35 altında kategori')}</span>
        <span className={`da-attn-chip${m.flagged ? ' is-warn' : ''}`}><b>{m.flagged}</b> {T(lang, 'flagged questions', 'işaretli soru')}</span>
        <span className={`da-attn-chip${unfinished ? ' is-warn' : ''}`}><b>{unfinished}</b> {T(lang, 'questions left in open phases', 'açık aşamalarda kalan soru')}</span>
        <span className="da-attn-chip"><b>{notStarted}</b> {T(lang, 'phases not started', 'başlanmamış aşama')}</span>
      </div>
      {cats.length === 0 ? <p className="da-empty">{T(lang, 'No category scores yet.', 'Henüz kategori skoru yok.')}</p> : (
        <>
          <div className="da-band">
            <StackBar label={T(lang, 'Share of categories by performance band', 'Kategorilerin performans bandına göre dağılımı')}
              parts={bands.map((b) => ({ key: b.band, value: c[b.band], color: BAND_COLOR[b.band], tip: `${b.label}: ${c[b.band]}` }))} />
            <div className="da-band-legend">
              {bands.map((b) => <span key={b.band}><i className="da-dot" style={{ background: BAND_COLOR[b.band] }} />{b.label} <small>{b.hint}</small> <b style={{ color: BAND_COLOR[b.band] }}>{c[b.band]}</b></span>)}
            </div>
          </div>
          <div className="da-ins2">
            <div><h3><i className="da-dot" style={{ background: BAND_COLOR.strong }} />{T(lang, 'Strongest areas', 'En güçlü alanlar')}</h3><HBars rows={rows(strongest(cats, 4))} onOpen={go} dense /></div>
            <div><h3><i className="da-dot" style={{ background: BAND_COLOR.gap }} />{T(lang, 'Weakest areas & gaps', 'En zayıf alanlar ve açıklar')}</h3><HBars rows={rows(weakest(cats, 4))} onOpen={go} dense /></div>
          </div>
        </>
      )}
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
  const delta = m.overall && m.overall.phases > 1 ? Math.round(r.score) - Math.round(m.overall.score) : null;
  return (
    <section className="da-card da-fill">
      <div className="da-head">
        <div>
          <span className="da-eyebrow">{T(lang, 'Latest results', 'Son sonuçlar')}</span>
          <h2 className="da-h2">{r.name}</h2>
        </div>
      </div>
      <div className="da-body">
        {withResults.length > 1 && (
          <div className="da-chips" role="group" aria-label={T(lang, 'Phase', 'Aşama')} style={{ marginBottom: 12 }}>
            {withResults.map((p) => (
              <button key={p.num} className={`da-chipbtn${phase === p.num ? ' is-on' : ''}`} aria-pressed={phase === p.num} onClick={() => setSel(p.num)}>
                <i style={{ background: PHASE_COLORS[p.num] }} />{phaseLabel(p.num, lang)}
              </button>
            ))}
          </div>
        )}
        <div key={phase} className="da-swap">
          <div className="da-latest">
            <div className="da-ring" style={{ width: 72, height: 72 }}>
              <Ring pct={r.score} size={72} stroke={7} color={r.grade ? gradeColor(r.grade) : 'var(--olive-deep)'} />
              <span style={{ fontSize: 16, fontWeight: 400 }}>{Math.round(r.score)}</span>
            </div>
            <div className="da-latest-grade" style={{ color: r.grade ? gradeColor(r.grade) : 'var(--ink)' }}>{r.grade ?? '—'}</div>
            <div className="da-latest-meta">
              <b>{detail?.maturity?.label ?? T(lang, 'Overall grade', 'Genel not')}</b><br />
              {fmtDate(r.iso, lang)}{r.cycle ? ` · ${r.cycle}` : ''}
              {delta !== null && <><br /><span style={{ color: delta >= 0 ? 'var(--olive-deep)' : 'var(--danger)', fontWeight: 600 }}>{delta > 0 ? '+' : ''}{delta} {T(lang, 'pts vs overall average', 'puan, genel ortalamaya göre')}</span></>}
            </div>
          </div>
          {detail?.maturity?.narrative && <p className="da-narr">{detail.maturity.narrative}</p>}
          {cats.length > 0 && (
            <div className="da-band" style={{ padding: 0, marginTop: 12 }}>
              <StackBar label={T(lang, 'Category bands', 'Kategori bantları')} parts={[
                { key: 's', value: c.strong, color: BAND_COLOR.strong, tip: `${T(lang, 'Strong', 'Güçlü')}: ${c.strong}` },
                { key: 'd', value: c.developing, color: BAND_COLOR.developing, tip: `${T(lang, 'Developing', 'Gelişen')}: ${c.developing}` },
                { key: 'g', value: c.gap, color: BAND_COLOR.gap, tip: `${T(lang, 'Gap', 'Açık')}: ${c.gap}` },
              ]} />
              <div className="da-band-legend">
                <span><i className="da-dot" style={{ background: BAND_COLOR.strong }} />{T(lang, 'Strong', 'Güçlü')} <b>{c.strong}</b></span>
                <span><i className="da-dot" style={{ background: BAND_COLOR.developing }} />{T(lang, 'Developing', 'Gelişen')} <b>{c.developing}</b></span>
                <span><i className="da-dot" style={{ background: BAND_COLOR.gap }} />{T(lang, 'Gap', 'Açık')} <b>{c.gap}</b></span>
              </div>
            </div>
          )}
        </div>
        <div className="da-actions-col" style={{ marginTop: 'auto', paddingTop: 14 }}>
          <button className="da-btn da-btn-primary da-btn-block" onClick={() => go(`/results/${r.id}`)}>{T(lang, 'Full report', 'Tam rapor')} <Icon.arrow /></button>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════ Recommendations & action plan ═══════════════════════ */
export function RecommendationsCard({ m, recs, state, tasks, tasksState, onAdded, lang }: P & {
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
  const next = open.slice().sort((a, b) => (a.due_date ?? '9999') .localeCompare(b.due_date ?? '9999')).slice(0, 3);
  const counts = { todo: tasks.filter((t) => t.status === 'todo').length, in_progress: tasks.filter((t) => t.status === 'in_progress').length, done };

  return (
    <section className="da-card">
      <div className="da-head">
        <div>
          <span className="da-eyebrow">{T(lang, 'Recommendations & action plan', 'Öneriler ve eylem planı')}</span>
          <h2 className="da-h2">{T(lang, 'From your results to concrete next steps', 'Sonuçlarınızdan somut adımlara')}</h2>
        </div>
        <Link href="/action-plan" className="da-link">{T(lang, 'Open action plan', 'Eylem planını aç')} <Icon.arrow /></Link>
      </div>
      <div className="da-rec2">
        <div className="da-rec2-main">
          <h3>{T(lang, 'Recommended actions', 'Önerilen eylemler')}</h3>
          {state === 'loading' && <><div className="da-skel" /><div className="da-skel" style={{ width: '80%' }} /><div className="da-skel" style={{ width: '60%' }} /></>}
          {state !== 'loading' && recs.length === 0 && (
            <p className="da-empty">{state === 'error' || state === 'partial' ? T(lang, 'Recommendations could not be loaded.', 'Öneriler yüklenemedi.') : T(lang, 'No recommendations: every category scored 80% or above.', 'Öneri yok: tüm kategoriler %80 veya üzerinde.')}</p>
          )}
          {state !== 'loading' && shown.map((r, i) => {
            const k = `${r.attemptId}|${r.title}`;
            const added = inPlan(r);
            return (
              <div key={k + i} className="da-rec">
                <div className="da-rec-top"><span className={`da-prio ${r.priority}`}>{r.priority}</span><span className="da-ins-phase" style={{ display: 'inline' }}>{phaseLabel(r.phase, lang)} · {r.category}{r.gri_standard ? ` · ${r.gri_standard}` : ''}</span></div>
                <div className="da-rec-row">
                  <div>
                    <div className="da-rec-title">{r.title}</div>
                    <div className="da-rec-meta">{r.quick_win || r.description}{r.timeline_days ? ` · ~${r.timeline_days} ${T(lang, 'days', 'gün')}` : ''}{r.effort ? ` · ${r.effort}` : ''}</div>
                  </div>
                  <button className={`da-btn da-btn-sm${added ? ' is-done' : ''}`} disabled={added || busy === k} onClick={() => add(r)}>
                    {added ? `✓ ${T(lang, 'In plan', 'Planda')}` : busy === k ? '…' : `+ ${T(lang, 'Add to plan', 'Plana ekle')}`}
                  </button>
                </div>
              </div>
            );
          })}
          {err && <p className="da-err" role="alert">{err}</p>}
          {recs.length > 3 && <button className="da-link da-linkbtn" onClick={() => setAll((v) => !v)}>{all ? T(lang, 'Show fewer', 'Daha az göster') : `${T(lang, 'Show all', 'Tümünü göster')} (${recs.length})`}</button>}
        </div>
        <div className="da-rec2-side">
          <h3>{T(lang, 'Your action plan', 'Eylem planınız')}</h3>
          {tasksState === 'loading' && <div className="da-skel" />}
          {tasksState === 'error' && <p className="da-empty">{T(lang, 'Action plan could not be loaded.', 'Eylem planı yüklenemedi.')}</p>}
          {tasksState !== 'loading' && tasksState !== 'error' && tasks.length === 0 && (
            <p className="da-empty">{T(lang, 'No tasks yet. Add a recommendation to turn it into a tracked task.', 'Henüz görev yok. Bir öneriyi takip edilen göreve dönüştürmek için plana ekleyin.')}</p>
          )}
          {tasks.length > 0 && (
            <>
              <StackBar label={T(lang, 'Tasks by status', 'Duruma göre görevler')} parts={[
                { key: 'done', value: counts.done, color: 'var(--olive-deep)', tip: `${T(lang, 'Done', 'Tamamlandı')}: ${counts.done}` },
                { key: 'ip', value: counts.in_progress, color: 'var(--amber)', tip: `${T(lang, 'In progress', 'Devam ediyor')}: ${counts.in_progress}` },
                { key: 'todo', value: counts.todo, color: 'var(--ink-4)', tip: `${T(lang, 'To do', 'Yapılacak')}: ${counts.todo}` },
              ]} />
              <div className="da-band-legend" style={{ marginTop: 8 }}>
                <span><i className="da-dot" style={{ background: 'var(--olive-deep)' }} />{T(lang, 'Done', 'Bitti')} <b>{counts.done}</b></span>
                <span><i className="da-dot" style={{ background: 'var(--amber)' }} />{T(lang, 'In progress', 'Devam')} <b>{counts.in_progress}</b></span>
                <span><i className="da-dot" style={{ background: 'var(--ink-4)' }} />{T(lang, 'To do', 'Yapılacak')} <b>{counts.todo}</b></span>
              </div>
              {next.map((t) => (
                <Link key={t.id} href="/action-plan" className="da-task">
                  <span className={`da-prio ${t.priority || 'Low'}`}>{t.priority || '—'}</span>
                  <span className="da-task-t">{t.title}</span>
                  <small>{t.due_date ? fmtDate(t.due_date, lang) : T(lang, 'no due date', 'tarih yok')}</small>
                </Link>
              ))}
            </>
          )}
        </div>
      </div>
      <p className="da-note" style={{ margin: '0 16px 14px' }}>{T(lang, 'Recommendations come from the same scoring rules as your results report (categories below 80%).', 'Öneriler, sonuç raporunuzdaki aynı puanlama kurallarından gelir (%80 altındaki kategoriler).')}</p>
    </section>
  );
}

/* ═══════════════════════ Recent assessments ═══════════════════════ */
export function RecentCard({ m, lang }: P) {
  type Row = { key: string; name: string; cycle: string; status: 'completed' | 'in_progress'; iso: string | null; score: number | null; grade: string | null; answered: number; total: number; href: string };
  const [filter, setFilter] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [showAll, setShowAll] = useState(false);
  const rows: Row[] = useMemo(() => {
    const live: Row[] = m.phases.filter((p) => p.status === 'in_progress' && p.attempt).map((p) => ({
      key: `live-${p.attempt!.id}`, name: p.attempt!.survey_name, cycle: p.attempt!.cycle_name, status: 'in_progress', iso: p.attempt!.started_at,
      score: null, grade: null, answered: p.answered, total: p.attempt!.total_questions, href: `/questionnaire/${p.attempt!.id}`,
    }));
    const done: Row[] = m.results.slice().reverse().map((r) => ({
      key: `res-${r.id}`, name: r.name, cycle: r.cycle, status: 'completed', iso: r.iso, score: r.score, grade: r.grade,
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
      <div className="da-head" style={{ paddingBottom: 10 }}>
        <div>
          <span className="da-eyebrow">{T(lang, 'Recent activity', 'Son etkinlik')}</span>
          <h2 className="da-h2">{T(lang, 'Recent assessments', 'Son değerlendirmeler')}</h2>
        </div>
        <div className="da-seg" role="tablist" aria-label={T(lang, 'Filter assessments', 'Değerlendirmeleri filtrele')}>
          {(['all', 'completed', 'in_progress'] as const).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'is-on' : ''} onClick={() => { setFilter(f); setShowAll(false); }}>
              {f === 'all' ? T(lang, 'All', 'Tümü') : f === 'completed' ? T(lang, 'Completed', 'Tamamlanan') : T(lang, 'In progress', 'Devam eden')} <small>{counts[f]}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="da-row-tbl head"><span>{T(lang, 'ASSESSMENT', 'DEĞERLENDİRME')}</span><span className="da-tbl-date">{T(lang, 'DATE', 'TARİH')}</span><span>{T(lang, 'SCORE', 'SKOR')}</span><span className="da-num">{T(lang, 'GRADE', 'NOT')}</span><span /></div>
      {visible.length === 0 && <p className="da-empty">{T(lang, 'Nothing to show for this filter.', 'Bu filtre için gösterilecek bir şey yok.')}</p>}
      <div key={filter} className="da-swap">
        {visible.map((r, i) => (
          <Link key={r.key} href={r.href} className="da-row-tbl">
            <div className="da-tbl-name">
              <small>{r.cycle || ' '}<em className={`da-st c-${r.status}`}>{r.status === 'completed' ? T(lang, 'Completed', 'Tamamlandı') : T(lang, 'In progress', 'Devam ediyor')}</em></small>
              <span>{r.name}</span>
            </div>
            <span className="da-tbl-date">{fmtDate(r.iso, lang)}</span>
            <div className="da-tbl-bar">
              {r.score === null
                ? <><div className="da-track"><div className="da-anim-w" style={{ width: shown ? `${r.total ? Math.round((r.answered / r.total) * 100) : 0}%` : '0%', background: 'var(--amber)', transitionDelay: `${i * 50}ms` }} /></div><b>{r.answered}/{r.total}</b></>
                : <><div className="da-track"><div className="da-anim-w" style={{ width: shown ? `${r.score}%` : '0%', background: scoreColor(r.score), transitionDelay: `${i * 50}ms` }} /></div><b>{Math.round(r.score)}</b></>}
            </div>
            <span className="da-num" style={{ font: "600 13px 'IBM Plex Sans', sans-serif", color: r.grade ? gradeColor(r.grade) : 'var(--ink-4)' }}>{r.grade ?? '—'}</span>
            <span className="da-tbl-act">{r.status === 'in_progress' ? T(lang, 'Continue', 'Devam et') : T(lang, 'View', 'Görüntüle')}<Icon.arrow /></span>
          </Link>
        ))}
      </div>
      <div className="da-tbl-foot">
        {filtered.length > 5 && <button className="da-link da-linkbtn" onClick={() => setShowAll((v) => !v)}>{showAll ? T(lang, 'Show fewer', 'Daha az göster') : `${T(lang, 'Show all', 'Tümünü göster')} (${filtered.length})`}</button>}
        <Link href="/history" className="da-link">{T(lang, 'Full history', 'Tüm geçmiş')} <Icon.arrow /></Link>
      </div>
    </section>
  );
}

/* ═══════════════════════ Quick actions ═══════════════════════ */
const QI = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
export function QuickCard({ m, lang }: P) {
  const live = m.phases.find((p) => p.status === 'in_progress' && p.attempt);
  const r = m.latestResult;
  const items: { href: string; label: string; sub?: string; icon: string; primary?: boolean }[] = [
    live ? { href: `/questionnaire/${live.attempt!.id}`, label: T(lang, 'Continue assessment', 'Devam et'), sub: `${phaseLabel(live.num, lang)} · ${live.pct}%`, icon: 'M5 12h14M13 6l6 6-6 6', primary: true }
         : { href: '/surveys', label: T(lang, 'Start an assessment', 'Değerlendirme başlat'), icon: 'M12 5v14M5 12h14', primary: true },
    ...(r ? [{ href: `/results/${r.id}`, label: T(lang, 'View results', 'Sonuçlar'), sub: phaseLabel(r.phase, lang), icon: 'M4 20V10M10 20V4M16 20v-8M22 20H2' }] : []),
    { href: '/action-plan', label: T(lang, 'Action plan', 'Eylem planı'), icon: 'M9 11l3 3 8-8M4 12v7a2 2 0 002 2h12' },
    { href: '/courses', label: T(lang, 'Courses', 'Kurslar'), icon: 'M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2V5zM8 7h6' },
    { href: '/history', label: T(lang, 'History', 'Geçmiş'), icon: 'M12 8v5l3 2M21 12a9 9 0 11-3-6.7' },
  ];
  return (
    <section className="da-card">
      <div className="da-head"><div><span className="da-eyebrow">{T(lang, 'Quick actions', 'Hızlı işlemler')}</span></div></div>
      <div className="da-quick2">
        {items.map((it) => (
          <Link key={it.href + it.label} href={it.href} className={`da-qa2${it.primary ? ' is-primary' : ''}`}>
            <span className="da-qa2-ic"><QI d={it.icon} /></span>
            <span className="da-qa2-t">{it.label}{it.sub && <small>{it.sub}</small>}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════ First-time dashboard ═══════════════════════ */
export function FirstTime({ m, lang }: P) {
  const live = m.phases.find((p) => p.status === 'in_progress' && p.attempt);
  return (
    <>
      <Reveal>
        <section className="da-card da-first" style={{ marginBottom: 12 }}>
          <div>
            <span className="da-eyebrow" style={{ marginBottom: 8 }}>{live ? T(lang, 'In progress', 'Devam ediyor') : T(lang, 'Get started', 'Başlayın')}</span>
            <h2>{live ? T(lang, 'Finish your first phase to unlock your analytics', 'Analizlerinizi açmak için ilk aşamayı bitirin') : T(lang, 'Measure your sustainability performance', 'Sürdürülebilirlik performansınızı ölçün')}</h2>
            <p>{live
              ? T(lang, 'Your scores, ESG breakdown, trends and recommendations appear here as soon as one phase is completed.', 'Bir aşama tamamlanır tamamlanmaz skorlarınız, ESG dağılımınız, trendleriniz ve önerileriniz burada görünür.')
              : T(lang, 'Complete the five-phase GRI assessment to see your score, grade, ESG breakdown, strengths, gaps and a recommended action plan.', 'Skorunuzu, notunuzu, ESG dağılımınızı, güçlü yönlerinizi, açıklarınızı ve önerilen eylem planını görmek için beş aşamalı GRI değerlendirmesini tamamlayın.')}</p>
            <Link href={live ? `/questionnaire/${live.attempt!.id}` : '/surveys'} className="da-btn da-btn-primary da-btn-lg" style={{ display: 'inline-flex' }}>
              {live ? T(lang, 'Continue assessment', 'Devam et') : T(lang, 'Choose a survey', 'Anket seç')} <Icon.arrow />
            </Link>
          </div>
          <div className="da-first-side">
            <span className="da-eyebrow" style={{ marginBottom: 10 }}>{T(lang, 'Your assessment roadmap', 'Değerlendirme yol haritanız')}</span>
            <div className="da-road">
              {PHASES.map((p) => {
                const st = m.phases[p.num - 1];
                return (
                  <div key={p.num} className={`da-road-row is-${st.status}`}>
                    <span className="da-node">{p.num}</span>
                    <span style={{ fontWeight: 500 }}>{phaseLabel(p.num, lang)}</span>
                    <small>{st.status === 'in_progress' ? `${st.answered}/${st.total ?? '?'} ${T(lang, 'answered', 'cevap')}` : st.total !== null ? `${st.total} ${T(lang, 'questions', 'soru')}` : T(lang, 'by sector', 'sektöre göre')}</small>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </Reveal>
      <Reveal delay={80}>
        <section className="da-card" style={{ marginBottom: 12 }}>
          <div className="da-head"><div><span className="da-eyebrow">{T(lang, 'What you will see here', 'Burada neler göreceksiniz')}</span></div></div>
          <div className="da-teaser">
            <div><b>{T(lang, 'Performance analytics', 'Performans analizi')}</b><span>{T(lang, 'Scores per phase, with category detail and a switchable chart view.', 'Aşama başına skorlar, kategori ayrıntısı ve değiştirilebilir grafik görünümü.')}</span></div>
            <div><b>{T(lang, 'ESG breakdown', 'ESG dağılımı')}</b><span>{T(lang, 'Environmental, social and governance results side by side.', 'Çevre, sosyal ve yönetişim sonuçları yan yana.')}</span></div>
            <div><b>{T(lang, 'Insights & actions', 'İçgörüler ve eylemler')}</b><span>{T(lang, 'Strongest areas, gaps and recommended next steps you can add to your action plan.', 'Güçlü alanlar, açıklar ve eylem planınıza ekleyebileceğiniz önerilen adımlar.')}</span></div>
          </div>
        </section>
      </Reveal>
    </>
  );
}

/* ═══════════════════════ Loading skeleton ═══════════════════════ */
export function DashSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="da-sk" style={{ height: 40, width: 260, marginBottom: 14 }} />
      <div className="da-kpis">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="da-card da-sk" style={{ height: 72 }} />)}</div>
      <div className="da-row da-row-2"><div className="da-card da-sk" style={{ height: 330 }} /><div className="da-card da-sk" style={{ height: 330 }} /></div>
      <div className="da-card da-sk" style={{ height: 190, marginBottom: 12 }} />
      <div className="da-card da-sk" style={{ height: 240 }} />
    </div>
  );
}

/* re-export for the page */
export { Legend, hasTrend, rankCategories };
