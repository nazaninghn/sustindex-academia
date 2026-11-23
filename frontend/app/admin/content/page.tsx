'use client';
/** Admin console — Content. Surveys and courses with usage, and a visibility switch for each. */
import { useCallback, useEffect, useState } from 'react';
import { adminAPI, apiError, djangoAdminUrl, fmtAgo, fmtInt, type Content } from '@/lib/admin';
import { Icon, Skeleton, Switch, useToast, useTx } from '@/components/admin/ui';

const LEVELS: Record<string, [string, string]> = { beg: ['Beginner', 'Başlangıç'], int: ['Intermediate', 'Orta'], adv: ['Advanced', 'İleri'] };

export default function AdminContentPage() {
  const { tx, lang } = useTx();
  const toast = useToast();
  const [data, setData] = useState<Content | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    adminAPI.content().then(setData).catch(() => setFailed(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (kind: 'survey' | 'course', id: number, name: string, next: boolean) => {
    setPending(`${kind}-${id}`);
    try {
      if (kind === 'survey') await adminAPI.setSurveyActive(id, next); else await adminAPI.setCourseActive(id, next);
      setData((d) => d && ({
        ...d,
        surveys: kind === 'survey' ? d.surveys.map((s) => (s.id === id ? { ...s, is_active: next } : s)) : d.surveys,
        courses: kind === 'course' ? d.courses.map((c) => (c.id === id ? { ...c, is_active: next } : c)) : d.courses,
      }));
      toast.show({ msg: next ? tx(`"${name}" is now visible to members.`, `"${name}" artık üyelere görünür.`) : tx(`"${name}" is now hidden from members.`, `"${name}" artık üyelerden gizli.`) });
    } catch (err) {
      toast.show({ msg: apiError(err, tx('The change was not saved.', 'Değişiklik kaydedilmedi.')), err: true });
    } finally { setPending(null); }
  };

  if (failed && !data) {
    return <div className="adm-center"><div>
      <p style={{ marginBottom: 14 }}>{tx('Content could not be loaded.', 'İçerik yüklenemedi.')}</p>
      <button className="adm-btn solid" onClick={load}><Icon name="refresh" size={14} />{tx('Try again', 'Tekrar dene')}</button>
    </div></div>;
  }
  if (!data) return <div className="adm-grid"><Skeleton h={90} className="c12" /><Skeleton h={380} className="c12" /></div>;

  const t = data.totals;
  const tiles: [string, string, string][] = [
    [tx('Surveys', 'Anketler'), `${t.active_surveys}`, tx(`of ${t.surveys} visible`, `/ ${t.surveys} görünür`)],
    [tx('Active questions', 'Aktif sorular'), fmtInt(t.questions, lang), tx('across all surveys', 'tüm anketlerde')],
    [tx('Courses', 'Kurslar'), `${t.active_courses}`, tx(`of ${t.courses} visible`, `/ ${t.courses} görünür`)],
    [tx('Lessons', 'Dersler'), fmtInt(t.lessons, lang), tx('across all courses', 'tüm kurslarda')],
  ];

  return (
    <>
      <div className="adm-head">
        <div>
          <h1 className="adm-title">{tx('Content', 'İçerik')}</h1>
          <p className="adm-lede">{tx('Switch a survey or course off to hide it from members without deleting anything. Questions, choices and lessons are edited in the Django admin.', 'Bir anketi veya kursu hiçbir şeyi silmeden üyelerden gizlemek için kapatın. Sorular, seçenekler ve dersler Django yönetiminde düzenlenir.')}</p>
        </div>
        <div className="adm-head-actions">
          <a className="adm-btn" href={djangoAdminUrl('questionnaire/question/')} target="_blank" rel="noopener noreferrer"><Icon name="external" size={14} />{tx('Edit questions', 'Soruları düzenle')}</a>
          <a className="adm-btn solid" href={djangoAdminUrl('questionnaire/survey/add/')} target="_blank" rel="noopener noreferrer">{tx('New survey', 'Yeni anket')}</a>
        </div>
      </div>

      <div className="adm-grid">
        {tiles.map(([label, value, sub]) => (
          <section className="adm-card c3" key={label}>
            <div className="adm-kpi-label">{label}</div>
            <div className="adm-kpi-value num" style={{ marginTop: 10 }}>{value}<span className="adm-kpi-unit">{sub}</span></div>
          </section>
        ))}

        <section className="adm-card c12">
          <div className="adm-card-head"><div>
            <h2 className="adm-card-title">{tx('Surveys', 'Anketler')}</h2>
            <div className="adm-card-sub">{tx('Usage counts cover all time', 'Kullanım sayıları tüm zamanları kapsar')}</div>
          </div></div>
          {data.surveys.length === 0 ? <div className="adm-empty">{tx('No surveys yet.', 'Henüz anket yok.')}</div> : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr>
                  <th>{tx('Survey', 'Anket')}</th>
                  <th className="r">{tx('Questions', 'Soru')}</th>
                  <th className="r">{tx('Started', 'Başlatılan')}</th>
                  <th className="r">{tx('Completed', 'Tamamlanan')}</th>
                  <th style={{ paddingLeft: 24 }}>{tx('Completion rate', 'Tamamlama oranı')}</th>
                  <th className="r">{tx('Avg score', 'Ort. puan')}</th>
                  <th style={{ paddingLeft: 24 }}>{tx('Last activity', 'Son etkinlik')}</th>
                  <th className="r">{tx('Visible', 'Görünür')}</th>
                </tr></thead>
                <tbody>
                  {data.surveys.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <a href={djangoAdminUrl(`questionnaire/survey/${s.id}/change/`)} target="_blank" rel="noopener noreferrer"
                          className="adm-row-title" style={{ display: 'block', maxWidth: 380 }} title={s.name}>{s.name}</a>
                        <div className="adm-row-sub">{s.categories} {tx(s.categories === 1 ? 'category' : 'categories', 'kategori')}</div>
                      </td>
                      <td className="r num" style={{ paddingRight: 12 }}>{s.questions}</td>
                      <td className="r num" style={{ paddingRight: 12 }}>{s.attempts}</td>
                      <td className="r num" style={{ paddingRight: 12 }}>{s.completed}</td>
                      <td style={{ paddingLeft: 24 }}>
                        {s.completion_rate === null ? <span style={{ color: 'var(--a-ink-3)' }}>—</span> : (
                          <span className="adm-scorebar"><b className="num" style={{ fontWeight: 600, width: 38 }}>{Math.round(s.completion_rate)}%</b>
                            <span className="adm-meter s1" style={{ height: 6 }}><i style={{ width: `${s.completion_rate}%` }} /></span></span>
                        )}
                      </td>
                      <td className="r num" style={{ paddingRight: 12 }}>{s.avg_score ?? '—'}</td>
                      <td style={{ paddingLeft: 24, color: 'var(--a-ink-2)', whiteSpace: 'nowrap' }}>{s.last_activity ? fmtAgo(s.last_activity, lang) : tx('Never used', 'Hiç kullanılmadı')}</td>
                      <td className="r">
                        <Switch checked={s.is_active} disabled={pending === `survey-${s.id}`} label={tx(`Visible: ${s.name}`, `Görünür: ${s.name}`)}
                          onChange={(v) => toggle('survey', s.id, s.name, v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="adm-card c12">
          <div className="adm-card-head">
            <div>
              <h2 className="adm-card-title">{tx('Courses', 'Kurslar')}</h2>
              <div className="adm-card-sub">{tx('Average progress is the share of lessons finished by people who started the course', 'Ortalama ilerleme, kursa başlayanların bitirdiği derslerin oranıdır')}</div>
            </div>
            <a className="adm-btn sm" href={djangoAdminUrl('elearning/course/')} target="_blank" rel="noopener noreferrer"><Icon name="external" size={12} />{tx('Manage', 'Yönet')}</a>
          </div>
          {data.courses.length === 0 ? <div className="adm-empty">{tx('No courses yet.', 'Henüz kurs yok.')}</div> : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr>
                  <th>{tx('Course', 'Kurs')}</th>
                  <th>{tx('Level', 'Seviye')}</th>
                  <th className="r">{tx('Lessons', 'Ders')}</th>
                  <th className="r">{tx('Learners', 'Öğrenen')}</th>
                  <th style={{ paddingLeft: 24 }}>{tx('Average progress', 'Ortalama ilerleme')}</th>
                  <th className="r">{tx('Visible', 'Görünür')}</th>
                </tr></thead>
                <tbody>
                  {data.courses.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="adm-row-title">{c.title}</div>
                        {c.tag && <div className="adm-row-sub">{c.tag}</div>}
                      </td>
                      <td><span className="adm-pill">{LEVELS[c.level] ? tx(...LEVELS[c.level]) : c.level}</span></td>
                      <td className="r num" style={{ paddingRight: 12 }}>{c.lessons}</td>
                      <td className="r num" style={{ paddingRight: 12 }}>{c.learners}</td>
                      <td style={{ paddingLeft: 24 }}>
                        {c.avg_progress === null ? <span style={{ color: 'var(--a-ink-3)' }}>—</span> : (
                          <span className="adm-scorebar"><b className="num" style={{ fontWeight: 600, width: 38 }}>{Math.round(c.avg_progress)}%</b>
                            <span className="adm-meter s1" style={{ height: 6 }}><i style={{ width: `${c.avg_progress}%` }} /></span></span>
                        )}
                      </td>
                      <td className="r">
                        <Switch checked={c.is_active} disabled={pending === `course-${c.id}`} label={tx(`Visible: ${c.title}`, `Görünür: ${c.title}`)}
                          onChange={(v) => toggle('course', c.id, c.title, v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      {toast.node}
    </>
  );
}
