'use client';
/** Admin console — Overview. Platform-wide activity for a selectable period. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { adminAPI, apiError, fmtAgo, fmtDate, fmtInt, initialsOf, type Overview, type RangeDays, type SeriesPoint } from '@/lib/admin';
import { BarChart, Heatmap, LineChart, Sparkline, type LinePoint } from '@/components/admin/charts';
import { DeltaPill, GradeChip, Icon, Skeleton, useToast, useTx } from '@/components/admin/ui';

const RANGES: RangeDays[] = [30, 90, 365, 0];

/** Daily points up to a month, weekly up to a quarter, monthly beyond — keeps the line readable. */
function bucket(series: SeriesPoint[], lang: 'en' | 'tr'): LinePoint[] {
  const loc = lang === 'tr' ? 'tr-TR' : 'en-GB';
  const day = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso + 'T00:00:00').toLocaleDateString(loc, o);
  if (series.length <= 31) {
    return series.map((d) => ({
      label: day(d.date, { day: 'numeric', month: 'short' }), tip: day(d.date, { weekday: 'short', day: 'numeric', month: 'short' }),
      a: d.completed, b: d.signups,
    }));
  }
  const monthly = series.length > 120;
  const out: (LinePoint & { key: string })[] = [];
  series.forEach((d, i) => {
    const key = monthly ? d.date.slice(0, 7) : String(Math.floor(i / 7));
    let cur = out[out.length - 1];
    if (!cur || cur.key !== key) {
      cur = {
        key, a: 0, b: 0,
        label: monthly ? day(d.date, { month: 'short', year: '2-digit' }) : day(d.date, { day: 'numeric', month: 'short' }),
        tip: monthly ? day(d.date, { month: 'long', year: 'numeric' })
          : `${lang === 'tr' ? 'Hafta:' : 'Week of'} ${day(d.date, { day: 'numeric', month: 'short' })}`,
      };
      out.push(cur);
    }
    cur.a += d.completed; cur.b += d.signups;
  });
  return out;
}

/** Downsample a daily series to ~24 points for a sparkline. */
function spark(series: SeriesPoint[], key: 'completed' | 'signups'): number[] {
  const size = Math.max(1, Math.ceil(series.length / 24));
  const out: number[] = [];
  for (let i = 0; i < series.length; i += size) out.push(series.slice(i, i + size).reduce((s, d) => s + d[key], 0));
  return out;
}

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const { tx, lang } = useTx();
  const toast = useToast();
  const [days, setDays] = useState<RangeDays>(30);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (d: RangeDays) => {
    setBusy(true); setError('');
    try { setData(await adminAPI.overview(d)); }
    catch (err) { setError(apiError(err, 'load')); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { load(days); }, [days, load]);

  const rangeLabel = (d: RangeDays) => d === 0 ? tx('All time', 'Tüm zamanlar') : d === 365 ? tx('12 months', '12 ay') : tx(`${d} days`, `${d} gün`);
  const periodPhrase = days === 0 ? tx('since launch', 'başlangıçtan beri') : tx(`in the last ${days} days`, `son ${days} günde`);
  const versus = days === 0 ? '' : tx(`vs previous ${days} days`, `önceki ${days} güne göre`);

  const line = useMemo(() => (data ? bucket(data.series, lang) : []), [data, lang]);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? tx('Good morning', 'Günaydın') : hour < 18 ? tx('Good afternoon', 'İyi günler') : tx('Good evening', 'İyi akşamlar');
  const firstName = user?.first_name || user?.username || '';

  const exportCsv = async () => {
    try { await adminAPI.exportAssessments({ status: 'completed' }); }
    catch { toast.show({ msg: tx('Export failed. Try again.', 'Dışa aktarma başarısız. Tekrar deneyin.'), err: true }); }
  };

  if (error && !data) {
    return (
      <div className="adm-center">
        <div>
          <p style={{ marginBottom: 14 }}>{tx('The overview could not be loaded.', 'Genel bakış yüklenemedi.')}</p>
          <button className="adm-btn solid" onClick={() => load(days)}><Icon name="refresh" size={14} />{tx('Try again', 'Tekrar dene')}</button>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="adm-grid" aria-busy="true">
        <Skeleton h={90} className="c12" />
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={140} className="c3" />)}
        <Skeleton h={320} className="c8" /><Skeleton h={320} className="c4" />
      </div>
    );
  }

  const k = data.kpis;
  const completedTotal = data.grades.reduce((s, g) => s + g.count, 0);
  const funnelLabels: Record<string, string> = {
    registered: tx('Registered', 'Kayıt oldu'), started: tx('Started an assessment', 'Değerlendirme başlattı'),
    completed: tx('Completed one', 'Birini tamamladı'), action_plan: tx('Created action tasks', 'Eylem görevi oluşturdu'),
  };
  const funnelTop = Math.max(data.funnel[0]?.count || 0, 1);
  const sectorMax = Math.max(1, ...data.sectors.map((s) => s.count));
  const memberTotal = Math.max(1, data.memberships.reduce((s, m) => s + m.count, 0));
  const pillars = [
    { key: 'environmental', label: tx('Environmental', 'Çevresel'), v: data.esg.environmental },
    { key: 'social', label: tx('Social', 'Sosyal'), v: data.esg.social },
    { key: 'governance', label: tx('Governance', 'Yönetişim'), v: data.esg.governance },
  ];
  const noData = <div className="adm-empty">{tx('No completed assessments in this period.', 'Bu dönemde tamamlanan değerlendirme yok.')}</div>;

  return (
    <>
      <div className="adm-head">
        <div>
          <div className="adm-eyebrow">{fmtDate(new Date().toISOString(), lang, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 className="adm-title">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
          <p className="adm-lede">
            <b className="num">{fmtInt(k.signups.value || 0, lang)}</b> {tx('new accounts and', 'yeni hesap ve')}{' '}
            <b className="num">{fmtInt(k.completed.value || 0, lang)}</b> {tx('completed assessments', 'tamamlanan değerlendirme')} {periodPhrase}.
            {k.stalled > 0 && <> {' '}<b className="num">{fmtInt(k.stalled, lang)}</b> {tx(
              `open assessments have had no answer for ${data.stalled_after_days}+ days.`,
              `açık değerlendirmede ${data.stalled_after_days}+ gündür yanıt yok.`)}</>}
          </p>
        </div>
        <div className="adm-head-actions">
          <div className="adm-seg" role="group" aria-label={tx('Period', 'Dönem')} style={{ opacity: busy ? 0.6 : 1 }}>
            {RANGES.map((d) => <button key={d} aria-pressed={days === d} onClick={() => setDays(d)}>{rangeLabel(d)}</button>)}
          </div>
          <button className="adm-btn" onClick={exportCsv}><Icon name="download" size={14} />{tx('Results CSV', 'Sonuçlar CSV')}</button>
        </div>
      </div>

      <div className="adm-grid">
        {/* ── KPI row ── */}
        <section className="adm-card accent adm-kpi c3">
          <div className="adm-kpi-label"><span className="adm-kpi-icon"><Icon name="check" size={14} /></span>{tx('Completed assessments', 'Tamamlanan değerlendirme')}</div>
          <div className="adm-kpi-value num">{fmtInt(k.completed.value || 0, lang)}</div>
          <div className="adm-kpi-foot">
            <span><DeltaPill value={k.completed.delta_pct} />{versus}</span>
            <Sparkline values={spark(data.series, 'completed')} />
          </div>
        </section>
        <section className="adm-card adm-kpi c3">
          <div className="adm-kpi-label"><span className="adm-kpi-icon"><Icon name="userplus" size={14} /></span>{tx('New accounts', 'Yeni hesaplar')}</div>
          <div className="adm-kpi-value num">{fmtInt(k.signups.value || 0, lang)}
            <span className="adm-kpi-unit">{tx(`of ${fmtInt(k.total_users, lang)} total`, `/ toplam ${fmtInt(k.total_users, lang)}`)}</span></div>
          <div className="adm-kpi-foot">
            <span><DeltaPill value={k.signups.delta_pct} />{versus}</span>
            <span style={{ color: 'var(--a-ink-2)' }}><Sparkline values={spark(data.series, 'signups')} /></span>
          </div>
        </section>
        <section className="adm-card adm-kpi c3">
          <div className="adm-kpi-label"><span className="adm-kpi-icon"><Icon name="gauge" size={14} /></span>{tx('Average score', 'Ortalama puan')}</div>
          <div className="adm-kpi-value num">{k.avg_score.value ?? '—'}<span className="adm-kpi-unit">/ 100</span></div>
          <div className="adm-kpi-foot">
            <span><DeltaPill value={k.avg_score.delta_pts} unit={tx(' pts', ' puan')} />{versus}</span>
          </div>
          <div className="adm-meter" style={{ flex: 'none' }}><i style={{ width: `${k.avg_score.value || 0}%` }} /></div>
        </section>
        <section className="adm-card adm-kpi c3">
          <div className="adm-kpi-label"><span className="adm-kpi-icon"><Icon name="flag" size={14} /></span>{tx('Completion rate', 'Tamamlama oranı')}</div>
          <div className="adm-kpi-value num">{k.completion_rate.value ?? '—'}<span className="adm-kpi-unit">%</span></div>
          <div className="adm-kpi-foot">
            <span><DeltaPill value={k.completion_rate.delta_pts} unit={tx(' pts', ' puan')} />{tx('of assessments started', 'başlatılan değerlendirmelerin')}</span>
          </div>
          <div className="adm-meter" style={{ flex: 'none' }}><i style={{ width: `${k.completion_rate.value || 0}%` }} /></div>
        </section>

        {/* ── activity + attention ── */}
        <section className="adm-card c8">
          <div className="adm-card-head">
            <div>
              <h2 className="adm-card-title">{tx('Activity', 'Etkinlik')}</h2>
              <div className="adm-card-sub">{line.length === data.series.length ? tx('Per day', 'Günlük') : data.series.length > 120 ? tx('Per month', 'Aylık') : tx('Per week', 'Haftalık')} · {rangeLabel(days)}</div>
            </div>
            <div className="adm-legend">
              <span><i style={{ background: 'var(--a-s1)' }} />{tx('Completed assessments', 'Tamamlanan değerlendirme')}</span>
              <span><i style={{ background: 'var(--a-s2)' }} />{tx('New accounts', 'Yeni hesaplar')}</span>
            </div>
          </div>
          <LineChart data={line} nameA={tx('Completed', 'Tamamlanan')} nameB={tx('New accounts', 'Yeni hesaplar')} height={290} />
        </section>

        <section className="adm-card dark c4">
          <div className="adm-card-head">
            <div>
              <h2 className="adm-card-title">{tx('Needs attention', 'Dikkat gerektirenler')}</h2>
              <div className="adm-card-sub">{tx('Right now, across all accounts', 'Şu anda, tüm hesaplarda')}</div>
            </div>
          </div>
          <div className="adm-attn">
            <div><div className="adm-attn-n num">{fmtInt(k.stalled, lang)}</div>
              <div className="adm-card-sub">{tx(`Stalled ${data.stalled_after_days}+ days`, `${data.stalled_after_days}+ gündür durmuş`)}</div></div>
            <Link href="/admin/assessments?status=stalled">{tx('Review', 'İncele')} →</Link>
          </div>
          <div className="adm-attn">
            <div><div className="adm-attn-n num">{fmtInt(k.in_progress, lang)}</div>
              <div className="adm-card-sub">{tx('Assessments in progress', 'Devam eden değerlendirme')}</div></div>
            <Link href="/admin/assessments?status=in_progress">{tx('Open', 'Aç')} →</Link>
          </div>
          <div className="adm-attn">
            <div><div className="adm-attn-n num">{fmtInt(k.inactive_accounts, lang)}</div>
              <div className="adm-card-sub">{tx('Deactivated accounts', 'Devre dışı hesap')}</div></div>
            <Link href="/admin/users?status=inactive">{tx('Open', 'Aç')} →</Link>
          </div>
          <div className="adm-attn">
            <div><div className="adm-attn-n num">{fmtInt(k.open_tasks, lang)}</div>
              <div className="adm-card-sub">{tx('Open action-plan tasks', 'Açık eylem planı görevi')}</div></div>
          </div>
        </section>

        {/* ── score shape ── */}
        <section className="adm-card c5">
          <div className="adm-card-head"><div>
            <h2 className="adm-card-title">{tx('Score distribution', 'Puan dağılımı')}</h2>
            <div className="adm-card-sub">{tx(`${fmtInt(completedTotal, lang)} completed assessments, by score band`, `${fmtInt(completedTotal, lang)} tamamlanan değerlendirme, puan aralığına göre`)}</div>
          </div></div>
          {completedTotal === 0 ? noData : (
            <BarChart data={data.score_distribution.map((b) => ({
              label: `${b.from}`, value: b.count,
              tip: `${b.from}–${b.to}: ${b.count} ${tx('assessments', 'değerlendirme')}`,
            }))} />
          )}
        </section>
        <section className="adm-card c3">
          <div className="adm-card-head"><div>
            <h2 className="adm-card-title">{tx('Grades', 'Notlar')}</h2>
            <div className="adm-card-sub">{tx('A+ is 80 and above', 'A+ 80 ve üzeridir')}</div>
          </div></div>
          {completedTotal === 0 ? noData : (
            <BarChart data={data.grades.map((g) => ({
              label: g.grade, value: g.count,
              tip: `${g.grade}: ${g.count} (${Math.round((g.count / completedTotal) * 100)}%)`,
            }))} />
          )}
        </section>
        <section className="adm-card c4">
          <div className="adm-card-head"><div>
            <h2 className="adm-card-title">{tx('Onboarding funnel', 'Katılım hunisi')}</h2>
            <div className="adm-card-sub">{tx('Accounts registered', 'Kayıt olan hesaplar')} {periodPhrase}</div>
          </div></div>
          {data.funnel.map((f) => (
            <div className="adm-funnel-step" key={f.key}>
              <span style={{ color: 'var(--a-ink-2)' }}>{funnelLabels[f.key]}</span>
              <span className="num"><b style={{ fontWeight: 600 }}>{fmtInt(f.count, lang)}</b>
                <span style={{ color: 'var(--a-ink-3)', marginLeft: 6 }}>{Math.round((f.count / funnelTop) * 100)}%</span></span>
              <div className="adm-hbar-track"><i style={{ width: `${(f.count / funnelTop) * 100}%`, minWidth: f.count ? 2 : 0 }} /></div>
            </div>
          ))}
        </section>

        {/* ── calendar + sectors ── */}
        <section className="adm-card c7">
          <div className="adm-card-head">
            <div>
              <h2 className="adm-card-title">{tx('Answer activity', 'Yanıt etkinliği')}</h2>
              <div className="adm-card-sub">{tx('Answers saved per day, last 26 weeks', 'Günlük kaydedilen yanıt, son 26 hafta')}</div>
            </div>
            <div className="adm-heat-legend">
              {tx('Less', 'Az')}
              {[0, 1, 2, 3, 4].map((l) => <i key={l} style={{ background: `var(--a-heat-${l})` }} />)}
              {tx('More', 'Çok')}
            </div>
          </div>
          <Heatmap days={data.calendar}
            tip={(d) => `${fmtDate(d.date + 'T00:00:00', lang, { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.count} ${tx('answers', 'yanıt')}`} />
        </section>
        <section className="adm-card c5">
          <div className="adm-card-head"><div>
            <h2 className="adm-card-title">{tx('Sectors', 'Sektörler')}</h2>
            <div className="adm-card-sub">{tx('Completed assessments · average score', 'Tamamlanan değerlendirme · ortalama puan')}</div>
          </div></div>
          {data.sectors.length === 0 ? noData : data.sectors.map((s) => (
            <div className="adm-hbar" key={s.sector} title={`${s.label}: ${s.count}`}>
              <span className="adm-hbar-label">{s.label}</span>
              <div className="adm-hbar-track"><i style={{ width: `${(s.count / sectorMax) * 100}%` }} /></div>
              <span className="adm-hbar-val num">{s.count}<small>{tx('avg', 'ort.')} {s.avg_score ?? '—'}</small></span>
            </div>
          ))}
        </section>

        {/* ── pillars, surveys, feed ── */}
        <section className="adm-card c4">
          <div className="adm-card-head"><div>
            <h2 className="adm-card-title">{tx('ESG pillars', 'ESG boyutları')}</h2>
            <div className="adm-card-sub">{tx('Average score out of 100', '100 üzerinden ortalama puan')}</div>
          </div></div>
          {pillars.map((p) => (
            <div className="adm-hbar" key={p.key}>
              <span className="adm-hbar-label">{p.label}</span>
              <div className="adm-hbar-track"><i style={{ width: `${p.v || 0}%`, minWidth: p.v ? 2 : 0 }} /></div>
              <span className="adm-hbar-val num">{p.v ?? '—'}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--a-line)', margin: '14px 0 12px' }} />
          <h2 className="adm-card-title" style={{ marginBottom: 8 }}>{tx('Membership', 'Üyelik')}</h2>
          {data.memberships.map((m) => (
            <div className="adm-hbar" key={m.type}>
              <span className="adm-hbar-label" style={{ textTransform: 'capitalize' }}>{m.type}</span>
              <div className="adm-hbar-track"><i style={{ width: `${(m.count / memberTotal) * 100}%`, minWidth: m.count ? 2 : 0 }} /></div>
              <span className="adm-hbar-val num">{m.count}<small>{Math.round((m.count / memberTotal) * 100)}%</small></span>
            </div>
          ))}
        </section>

        <section className="adm-card c4">
          <div className="adm-card-head">
            <div>
              <h2 className="adm-card-title">{tx('Top surveys', 'En çok kullanılan anketler')}</h2>
              <div className="adm-card-sub">{tx('By completed assessments', 'Tamamlanan değerlendirmeye göre')}</div>
            </div>
            <Link href="/admin/content" className="adm-btn sm">{tx('All', 'Tümü')}</Link>
          </div>
          {data.surveys.length === 0 ? noData : (
            <div className="adm-rowlist">
              {data.surveys.slice(0, 6).map((s) => (
                <div className="adm-row" key={`${s.id}-${s.name}`}>
                  <div className="adm-row-main"><div className="adm-row-title" title={s.name}>{s.name}</div>
                    <div className="adm-row-sub num">{s.completed} {tx('completed', 'tamamlandı')}</div></div>
                  <span className="adm-pill num">{tx('avg', 'ort.')} {s.avg_score ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="adm-card c4">
          <div className="adm-card-head">
            <div>
              <h2 className="adm-card-title">{tx('Latest activity', 'Son etkinlik')}</h2>
              <div className="adm-card-sub">{tx('Sign-ups and completed assessments', 'Kayıtlar ve tamamlanan değerlendirmeler')}</div>
            </div>
          </div>
          {data.recent.length === 0 ? <div className="adm-empty">{tx('Nothing yet.', 'Henüz bir şey yok.')}</div> : (
            <div className="adm-rowlist">
              {data.recent.slice(0, 6).map((r, i) => (
                <Link className="adm-row" key={i} href={`/admin/users?user=${r.user_id}`}>
                  <span className="adm-dot-avatar">{initialsOf(r.user)}</span>
                  <div className="adm-row-main">
                    <div className="adm-row-title">{r.user}{r.company ? <span style={{ color: 'var(--a-ink-3)', fontWeight: 400 }}> · {r.company}</span> : null}</div>
                    <div className="adm-row-sub">
                      {r.type === 'signup' ? tx('Created an account', 'Hesap oluşturdu') : `${tx('Completed', 'Tamamladı')} ${r.survey}`} · {fmtAgo(r.at, lang)}
                    </div>
                  </div>
                  {r.type === 'completed' ? <GradeChip grade={r.grade} /> : <span className="adm-pill">{tx('New', 'Yeni')}</span>}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
      {toast.node}
    </>
  );
}
