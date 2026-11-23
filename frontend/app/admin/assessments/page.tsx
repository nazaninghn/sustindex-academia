'use client';
/** Admin console — Assessments. Every attempt across all accounts, filterable and exportable. */
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { adminAPI, fmtAgo, fmtDate, initialsOf, type AssessmentPage } from '@/lib/admin';
import { GradeChip, Icon, Pager, ScoreBar, Skeleton, SortTh, useDebounced, useToast, useTx } from '@/components/admin/ui';

function AssessmentsInner() {
  const { tx, lang } = useTx();
  const toast = useToast();
  const params = useSearchParams();

  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [status, setStatus] = useState(params.get('status') || '');
  const [survey, setSurvey] = useState('');
  const [grade, setGrade] = useState('');
  const [sector, setSector] = useState('');
  const [ordering, setOrdering] = useState('-started');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AssessmentPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => { setPage(1); }, [q, status, survey, grade, sector, ordering]);
  useEffect(() => {
    let active = true;
    setBusy(true);
    adminAPI.assessments({ search: q, status, survey, grade, sector, ordering, page })
      .then((d) => { if (active) { setData(d); setFailed(false); } })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [q, status, survey, grade, sector, ordering, page, reload]);

  const exportCsv = async () => {
    try { await adminAPI.exportAssessments({ search: q, status, survey, grade, sector, ordering }); }
    catch { toast.show({ msg: tx('Export failed. Try again.', 'Dışa aktarma başarısız. Tekrar deneyin.'), err: true }); }
  };

  const statuses: [string, string][] = [
    ['', tx('All', 'Tümü')], ['completed', tx('Completed', 'Tamamlanan')],
    ['in_progress', tx('In progress', 'Devam eden')], ['stalled', tx('Stalled', 'Durmuş')],
  ];
  const hasFilters = Boolean(q || status || survey || grade || sector);
  const clear = () => { setSearch(''); setStatus(''); setSurvey(''); setGrade(''); setSector(''); };

  return (
    <>
      <div className="adm-head">
        <div>
          <h1 className="adm-title">{tx('Assessments', 'Değerlendirmeler')}</h1>
          <p className="adm-lede">{tx('All assessment attempts across accounts. "Stalled" means an open assessment with no new answer for 14 days or more.', 'Tüm hesaplardaki değerlendirme denemeleri. "Durmuş", 14 gün veya daha uzun süredir yeni yanıt girilmemiş açık değerlendirme demektir.')}</p>
        </div>
        <div className="adm-head-actions">
          <button className="adm-btn" onClick={exportCsv}><Icon name="download" size={14} />{tx('Export CSV', 'CSV dışa aktar')}</button>
        </div>
      </div>

      <div className="adm-toolbar">
        <label className="adm-search">
          <Icon name="search" size={14} />
          <input className="adm-input" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={tx('Search user, company or survey', 'Kullanıcı, şirket veya anket ara')} aria-label={tx('Search assessments', 'Değerlendirme ara')} />
        </label>
        <div className="adm-chips" role="group" aria-label={tx('Status', 'Durum')}>
          {statuses.map(([v, label]) => <button key={v} className="adm-chip" aria-pressed={status === v} onClick={() => setStatus(v)}>{label}</button>)}
        </div>
      </div>
      <div className="adm-toolbar">
        <select className="adm-select" value={survey} onChange={(e) => setSurvey(e.target.value)} aria-label={tx('Survey', 'Anket')} style={{ maxWidth: 260 }}>
          <option value="">{tx('Any survey', 'Tüm anketler')}</option>
          {data?.filters.surveys.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="adm-select" value={sector} onChange={(e) => setSector(e.target.value)} aria-label={tx('Sector', 'Sektör')}>
          <option value="">{tx('Any sector', 'Tüm sektörler')}</option>
          {data?.filters.sectors.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="adm-select" value={grade} onChange={(e) => setGrade(e.target.value)} aria-label={tx('Grade', 'Not')}>
          <option value="">{tx('Any grade', 'Tüm notlar')}</option>
          {data?.filters.grades.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        {hasFilters && <button className="adm-btn sm" onClick={clear}><Icon name="close" size={12} />{tx('Clear filters', 'Filtreleri temizle')}</button>}
      </div>

      <section className="adm-card" style={{ opacity: busy && data ? 0.7 : 1 }}>
        {failed && !data ? <div className="adm-empty">{tx('Assessments could not be loaded.', 'Değerlendirmeler yüklenemedi.')}{' '}
          <button className="adm-btn sm" onClick={() => setReload((n) => n + 1)}>{tx('Try again', 'Tekrar dene')}</button></div>
        : !data ? <Skeleton h={420} />
        : data.results.length === 0 ? <div className="adm-empty">{tx('No assessments match these filters.', 'Bu filtrelere uyan değerlendirme yok.')}</div>
        : (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <SortTh label={tx('User', 'Kullanıcı')} field="user" ordering={ordering} onSort={setOrdering} />
                    <th>{tx('Survey', 'Anket')}</th>
                    <th>{tx('Sector', 'Sektör')}</th>
                    <th>{tx('Status', 'Durum')}</th>
                    <SortTh label={tx('Score', 'Puan')} field="score" ordering={ordering} onSort={setOrdering} />
                    <th>{tx('Grade', 'Not')}</th>
                    <th title={tx('Environmental / Social / Governance', 'Çevresel / Sosyal / Yönetişim')}>E · S · G</th>
                    <SortTh label={tx('Started', 'Başlangıç')} field="started" ordering={ordering} onSort={setOrdering} />
                    <SortTh label={tx('Completed', 'Bitiş')} field="completed" ordering={ordering} onSort={setOrdering} right />
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/admin/users?user=${a.user_id}`} className="adm-cell-user">
                          <span className="adm-dot-avatar">{initialsOf(a.user || '')}</span>
                          <div style={{ minWidth: 0 }}>
                            <div className="adm-row-title">{a.user}</div>
                            <div className="adm-row-sub">{a.company_name || `@${a.username}`}</div>
                          </div>
                        </Link>
                      </td>
                      <td style={{ maxWidth: 240 }}>
                        <div className="adm-row-title" title={a.survey}>{a.survey}</div>
                        {a.cycle_name && <div className="adm-row-sub">{a.cycle_name}</div>}
                      </td>
                      <td style={{ color: 'var(--a-ink-2)', whiteSpace: 'nowrap' }}>{a.sector_label || '—'}</td>
                      <td>
                        {a.is_completed
                          ? <span className="adm-pill good">{tx('Completed', 'Tamamlandı')}</span>
                          : <>
                              <span className="adm-pill warn">{tx('In progress', 'Devam ediyor')}</span>
                              <div className="adm-row-sub" style={{ marginTop: 3 }}>
                                {a.answers_count} {tx(a.answers_count === 1 ? 'answer' : 'answers', 'yanıt')}
                                {a.last_answer_at ? ` · ${tx('last', 'son')} ${fmtAgo(a.last_answer_at, lang)}` : ''}
                              </div>
                            </>}
                      </td>
                      <td><ScoreBar score={a.score} /></td>
                      <td><GradeChip grade={a.grade} /></td>
                      <td className="num" style={{ whiteSpace: 'nowrap', color: 'var(--a-ink-2)' }}>
                        {a.is_completed ? `${Math.round(a.environmental || 0)} · ${Math.round(a.social || 0)} · ${Math.round(a.governance || 0)}` : '—'}
                      </td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.started_at, lang)}</td>
                      <td className="num r" style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.completed_at, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={data.page} pages={data.pages} count={data.count} onPage={setPage} />
          </>
        )}
      </section>
      {toast.node}
    </>
  );
}

export default function AdminAssessmentsPage() {
  return <Suspense fallback={<Skeleton h={420} />}><AssessmentsInner /></Suspense>;
}
