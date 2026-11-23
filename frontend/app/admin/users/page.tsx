'use client';
/** Admin console — Users. Search, filter, export, and a detail drawer with the two account actions. */
import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  adminAPI, apiError, djangoAdminUrl, fmtAgo, fmtDate, initialsOf,
  type AdminUser, type AdminUserDetail, type Page,
} from '@/lib/admin';
import {
  GradeChip, Icon, MembershipPill, Pager, ScoreBar, Skeleton, SortTh, Switch, useDebounced, useToast, useTx,
} from '@/components/admin/ui';

const MEMBERSHIPS = ['free', 'silver', 'gold'];

function UserDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const { tx, lang } = useTx();
  const { user: me } = useAuth();
  const toast = useToast();
  const [u, setU] = useState<AdminUserDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  useEffect(() => {
    let active = true;
    setU(null); setFailed(false); setConfirmOff(false);
    adminAPI.user(id).then((d) => { if (active) setU(d); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async (body: { membership_type?: string; is_active?: boolean }, okMsg: string) => {
    setSaving(true);
    try {
      setU(await adminAPI.updateUser(id, body));
      toast.show({ msg: okMsg });
      onChanged();
    } catch (err) {
      toast.show({ msg: apiError(err, tx('The change was not saved.', 'Değişiklik kaydedilmedi.')), err: true });
    } finally { setSaving(false); setConfirmOff(false); }
  };

  const isSelf = me?.id === id;
  const openTasks = u ? (u.tasks.todo || 0) + (u.tasks.in_progress || 0) : 0;

  return (
    <>
      <div className="adm-scrim" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-modal="true" aria-label={tx('User details', 'Kullanıcı ayrıntıları')}>
        <div className="adm-drawer-head">
          <span className="adm-dot-avatar" style={{ width: 42, height: 42, fontSize: 13 }}>{u ? initialsOf(u.name) : '…'}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-.01em' }}>{u?.name || '…'}</div>
            <div className="adm-row-sub">{u ? `@${u.username}${u.company_name ? ` · ${u.company_name}` : ''}` : ''}</div>
          </div>
          <button className="adm-icon-btn" onClick={onClose} aria-label={tx('Close', 'Kapat')} autoFocus><Icon name="close" /></button>
        </div>

        <div className="adm-drawer-body">
          {failed && <div className="adm-empty">{tx('This user could not be loaded.', 'Bu kullanıcı yüklenemedi.')}</div>}
          {!u && !failed && <><Skeleton h={70} /><Skeleton h={150} /><Skeleton h={200} /></>}
          {u && (
            <>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <MembershipPill type={u.membership_type} />
                <span className={`adm-pill ${u.is_active ? 'good' : 'bad'}`}>{u.is_active ? tx('Active', 'Aktif') : tx('Deactivated', 'Devre dışı')}</span>
                {u.is_superuser ? <span className="adm-pill warn">Superuser</span> : u.is_staff ? <span className="adm-pill warn">{tx('Staff', 'Yetkili')}</span> : null}
                {u.has_google && <span className="adm-pill">Google</span>}
              </div>

              <div className="adm-stat3">
                <div><b className="num">{u.completed_count}<span style={{ fontSize: 12, color: 'var(--a-ink-3)' }}> / {u.attempts_count}</span></b><span>{tx('Completed / started', 'Tamamlanan / başlatılan')}</span></div>
                <div><b className="num">{u.last_score ?? '—'}</b><span>{tx('Latest score', 'Son puan')}</span></div>
                <div><b className="num">{openTasks}</b><span>{tx('Open tasks', 'Açık görev')}</span></div>
              </div>

              <section className="adm-card">
                <h3 className="adm-card-title" style={{ marginBottom: 12 }}>{tx('Account', 'Hesap')}</h3>
                <dl className="adm-dl">
                  <dt>{tx('Email', 'E-posta')}</dt><dd><a href={`mailto:${u.email}`} style={{ textDecoration: 'underline' }}>{u.email || '—'}</a></dd>
                  <dt>{tx('Phone', 'Telefon')}</dt><dd>{u.phone || '—'}</dd>
                  <dt>{tx('Joined', 'Katılım')}</dt><dd>{fmtDate(u.date_joined, lang)}</dd>
                  <dt>{tx('Last sign-in', 'Son giriş')}</dt><dd>{u.last_login ? fmtAgo(u.last_login, lang) : tx('Never', 'Hiç')}</dd>
                  {u.profile?.industry ? <><dt>{tx('Industry', 'Sektör')}</dt><dd>{u.profile.industry}</dd></> : null}
                  {u.profile?.employee_count ? <><dt>{tx('Employees', 'Çalışan')}</dt><dd className="num">{u.profile.employee_count}</dd></> : null}
                  <dt>{tx('Documents', 'Belgeler')}</dt><dd className="num">{u.documents}</dd>
                  <dt>{tx('Lessons done', 'Biten dersler')}</dt><dd className="num">{u.lessons_completed}</dd>
                </dl>
              </section>

              <section className="adm-card">
                <h3 className="adm-card-title">{tx('Membership tier', 'Üyelik seviyesi')}</h3>
                <div className="adm-card-sub" style={{ marginBottom: 10 }}>{tx('Applies immediately and is recorded in the membership history.', 'Hemen uygulanır ve üyelik geçmişine kaydedilir.')}</div>
                <div className="adm-seg" role="group">
                  {MEMBERSHIPS.map((m) => (
                    <button key={m} aria-pressed={u.membership_type === m} disabled={saving} style={{ textTransform: 'capitalize' }}
                      onClick={() => u.membership_type !== m && save({ membership_type: m }, tx(`Membership set to ${m}.`, `Üyelik ${m} olarak ayarlandı.`))}>
                      {m}
                    </button>
                  ))}
                </div>
              </section>

              <section className="adm-card">
                <h3 className="adm-card-title" style={{ marginBottom: 10 }}>{tx('Assessments', 'Değerlendirmeler')}</h3>
                {u.attempts.length === 0 ? <div className="adm-card-sub">{tx('No assessments started yet.', 'Henüz değerlendirme başlatılmadı.')}</div> : (
                  <div className="adm-rowlist">
                    {u.attempts.slice(0, 8).map((a) => (
                      <div className="adm-row" key={a.id}>
                        <div className="adm-row-main">
                          <div className="adm-row-title" title={a.survey}>{a.survey}</div>
                          <div className="adm-row-sub">
                            {a.is_completed ? `${tx('Completed', 'Tamamlandı')} ${fmtDate(a.completed_at, lang)}` : `${tx('In progress since', 'Devam ediyor:')} ${fmtDate(a.started_at, lang)} · ${a.answers_count} ${tx('answers', 'yanıt')}`}
                          </div>
                        </div>
                        {a.is_completed ? <><b className="num">{a.score}</b><GradeChip grade={a.grade} /></> : <span className="adm-pill warn">{tx('Open', 'Açık')}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="adm-card">
                <h3 className="adm-card-title">{tx('Access', 'Erişim')}</h3>
                <div className="adm-card-sub" style={{ marginBottom: 12 }}>
                  {u.is_active
                    ? tx('Deactivating blocks sign-in. Data is kept and the account can be reactivated.', 'Devre dışı bırakmak girişi engeller. Veriler saklanır ve hesap yeniden etkinleştirilebilir.')
                    : tx('This account cannot sign in.', 'Bu hesap giriş yapamaz.')}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {!u.is_active && (
                    <button className="adm-btn solid" disabled={saving} onClick={() => save({ is_active: true }, tx('Account reactivated.', 'Hesap yeniden etkinleştirildi.'))}>
                      {tx('Reactivate account', 'Hesabı etkinleştir')}
                    </button>
                  )}
                  {u.is_active && !confirmOff && (
                    <button className="adm-btn danger" disabled={saving || isSelf} onClick={() => setConfirmOff(true)}
                      title={isSelf ? tx('You cannot deactivate your own account.', 'Kendi hesabınızı devre dışı bırakamazsınız.') : undefined}>
                      {tx('Deactivate account', 'Hesabı devre dışı bırak')}
                    </button>
                  )}
                  {u.is_active && confirmOff && (
                    <>
                      <button className="adm-btn danger" disabled={saving} onClick={() => save({ is_active: false }, tx('Account deactivated.', 'Hesap devre dışı bırakıldı.'))}>
                        {tx(`Yes, deactivate @${u.username}`, `Evet, @${u.username} devre dışı`)}
                      </button>
                      <button className="adm-btn" onClick={() => setConfirmOff(false)}>{tx('Cancel', 'Vazgeç')}</button>
                    </>
                  )}
                  <a className="adm-btn" href={djangoAdminUrl(`accounts/user/${u.id}/change/`)} target="_blank" rel="noopener noreferrer">
                    <Icon name="external" size={14} />{tx('Edit in Django admin', 'Django yönetiminde düzenle')}
                  </a>
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
      {toast.node}
    </>
  );
}

function UsersInner() {
  const { tx, lang } = useTx();
  const toast = useToast();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [membership, setMembership] = useState('');
  const [status, setStatus] = useState(params.get('status') || '');
  const [ordering, setOrdering] = useState('-joined');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<AdminUser> | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  const openId = Number(params.get('user')) || null;
  const setOpen = useCallback((id: number | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set('user', String(id)); else next.delete('user');
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  }, [params, pathname, router]);

  useEffect(() => { setPage(1); }, [q, membership, status, ordering]);
  useEffect(() => {
    let active = true;
    setBusy(true);
    adminAPI.users({ search: q, membership, status, ordering, page })
      .then((d) => { if (active) { setData(d); setFailed(false); } })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [q, membership, status, ordering, page, reload]);

  const exportCsv = async () => {
    try { await adminAPI.exportUsers({ search: q, membership, status, ordering }); }
    catch { toast.show({ msg: tx('Export failed. Try again.', 'Dışa aktarma başarısız. Tekrar deneyin.'), err: true }); }
  };

  const statuses: [string, string][] = [
    ['', tx('All', 'Tümü')], ['active', tx('Active', 'Aktif')], ['inactive', tx('Deactivated', 'Devre dışı')],
    ['no_assessment', tx('No assessment yet', 'Değerlendirme yok')], ['staff', tx('Staff', 'Yetkili')],
  ];

  return (
    <>
      <div className="adm-head">
        <div>
          <h1 className="adm-title">{tx('Users', 'Kullanıcılar')}</h1>
          <p className="adm-lede">{tx('Every registered account, with its assessment activity. Open a row to change the membership tier or access.', 'Tüm kayıtlı hesaplar ve değerlendirme etkinlikleri. Üyelik seviyesini veya erişimi değiştirmek için bir satırı açın.')}</p>
        </div>
        <div className="adm-head-actions">
          <button className="adm-btn" onClick={exportCsv}><Icon name="download" size={14} />{tx('Export CSV', 'CSV dışa aktar')}</button>
        </div>
      </div>

      <div className="adm-toolbar">
        <label className="adm-search">
          <Icon name="search" size={14} />
          <input className="adm-input" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={tx('Search name, email or company', 'Ad, e-posta veya şirket ara')} aria-label={tx('Search users', 'Kullanıcı ara')} />
        </label>
        <div className="adm-chips" role="group" aria-label={tx('Status', 'Durum')}>
          {statuses.map(([v, label]) => <button key={v} className="adm-chip" aria-pressed={status === v} onClick={() => setStatus(v)}>{label}</button>)}
        </div>
        <select className="adm-select" value={membership} onChange={(e) => setMembership(e.target.value)} aria-label={tx('Membership', 'Üyelik')}>
          <option value="">{tx('Any membership', 'Tüm üyelikler')}</option>
          {MEMBERSHIPS.map((m) => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
        </select>
      </div>

      <section className="adm-card" style={{ opacity: busy && data ? 0.7 : 1 }}>
        {failed && !data ? <div className="adm-empty">{tx('Users could not be loaded.', 'Kullanıcılar yüklenemedi.')}{' '}
          <button className="adm-btn sm" onClick={() => setReload((n) => n + 1)}>{tx('Try again', 'Tekrar dene')}</button></div>
        : !data ? <Skeleton h={420} />
        : data.results.length === 0 ? <div className="adm-empty">{tx('No users match these filters.', 'Bu filtrelere uyan kullanıcı yok.')}</div>
        : (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <SortTh label={tx('User', 'Kullanıcı')} field="username" ordering={ordering} onSort={setOrdering} />
                    <SortTh label={tx('Company', 'Şirket')} field="company" ordering={ordering} onSort={setOrdering} />
                    <th>{tx('Membership', 'Üyelik')}</th>
                    <SortTh label={tx('Assessments', 'Değerlendirme')} field="attempts" ordering={ordering} onSort={setOrdering} />
                    <SortTh label={tx('Latest score', 'Son puan')} field="score" ordering={ordering} onSort={setOrdering} />
                    <SortTh label={tx('Joined', 'Katılım')} field="joined" ordering={ordering} onSort={setOrdering} />
                    <SortTh label={tx('Last sign-in', 'Son giriş')} field="last_login" ordering={ordering} onSort={setOrdering} />
                    <th className="r">{tx('Status', 'Durum')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((u) => (
                    <tr key={u.id} className="click" tabIndex={0} onClick={() => setOpen(u.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setOpen(u.id); }}>
                      <td>
                        <div className="adm-cell-user">
                          <span className="adm-dot-avatar">{initialsOf(u.name)}</span>
                          <div style={{ minWidth: 0 }}>
                            <div className="adm-row-title">{u.name}{u.is_staff && <span className="adm-pill warn" style={{ marginLeft: 6, height: 18 }}>{tx('Staff', 'Yetkili')}</span>}</div>
                            <div className="adm-row-sub">{u.email || `@${u.username}`}</div>
                          </div>
                        </div>
                      </td>
                      <td>{u.company_name || <span style={{ color: 'var(--a-ink-3)' }}>—</span>}</td>
                      <td><MembershipPill type={u.membership_type} /></td>
                      <td className="num">{u.completed_count}<span style={{ color: 'var(--a-ink-3)' }}> / {u.attempts_count}</span></td>
                      <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><ScoreBar score={u.last_score} />{u.last_grade && <GradeChip grade={u.last_grade} />}</span></td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDate(u.date_joined, lang)}</td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--a-ink-2)' }}>{u.last_login ? fmtAgo(u.last_login, lang) : tx('Never', 'Hiç')}</td>
                      <td className="r"><span className={`adm-pill ${u.is_active ? 'good' : 'bad'}`}>{u.is_active ? tx('Active', 'Aktif') : tx('Deactivated', 'Devre dışı')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={data.page} pages={data.pages} count={data.count} onPage={setPage} />
          </>
        )}
      </section>

      {openId && <UserDrawer id={openId} onClose={() => setOpen(null)} onChanged={() => setReload((n) => n + 1)} />}
      {toast.node}
    </>
  );
}

export default function AdminUsersPage() {
  return <Suspense fallback={<Skeleton h={420} />}><UsersInner /></Suspense>;
}
