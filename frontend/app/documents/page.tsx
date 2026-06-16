'use client';
/**
 * Central Document Library — /documents
 * Shows all supporting documents uploaded by the user across all attempts.
 * Groups by survey or by GRI criterion code; supports search + sort.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { attemptAPI, documentDownloadUrl } from '@/lib/api';
import AppNav from '@/components/AppNav';
import { useLang } from '@/lib/i18n';

interface Doc {
  id: number;
  title: string;
  description: string;
  file: string;
  uploaded_at: string;
  file_size: number;
  file_size_display: string;
  answer_id: number;
  question_text: string | null;
  criterion_code: string | null;
  survey_name: string | null;
  attempt_id: number;
}

type GroupMode = 'criterion' | 'survey' | 'none';

function FileIcon({ title }: { title: string }) {
  const ext = title.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
    png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', webp: '🖼',
    zip: '📦', csv: '📊',
  };
  return <span style={{ fontSize: 16 }}>{map[ext] ?? '📎'}</span>;
}

export default function DocumentLibraryPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { lang } = useLang();

  const [docs,      setDocs]      = useState<Doc[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [search,    setSearch]    = useState('');
  const [surveyFilter, setSurveyFilter] = useState('all');
  const [sortBy,    setSortBy]    = useState<'date_desc' | 'date_asc' | 'title' | 'size'>('date_desc');
  const [groupMode, setGroupMode] = useState<GroupMode>('criterion');

  const tr = (en: string, trStr: string) => lang === 'tr' ? trStr : en;

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const res = await attemptAPI.getMyDocuments();
        if (!active) return;
        const arr: Doc[] = Array.isArray(res) ? res : (res.results ?? []);
        setDocs(arr);
      } catch {
        if (active) setError(tr('Failed to load documents.', 'Belgeler yüklenemedi.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const surveys = useMemo(
    () => Array.from(new Set(docs.map((d) => d.survey_name ?? tr('Unknown', 'Bilinmiyor')))).sort(),
    [docs, lang],
  );

  /* ── Filtered + sorted list ── */
  const visible = useMemo(() => {
    let filtered = docs;
    if (surveyFilter !== 'all') filtered = filtered.filter((d) => (d.survey_name ?? '') === surveyFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.question_text ?? '').toLowerCase().includes(q) ||
          (d.survey_name ?? '').toLowerCase().includes(q) ||
          (d.criterion_code ?? '').toLowerCase().includes(q),
      );
    }
    switch (sortBy) {
      case 'date_asc': return [...filtered].sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at));
      case 'title':    return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
      case 'size':     return [...filtered].sort((a, b) => b.file_size - a.file_size);
      default:         return [...filtered].sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
    }
  }, [docs, surveyFilter, search, sortBy]);

  /* ── Group by criterion or survey ── */
  const grouped = useMemo(() => {
    if (groupMode === 'none') return { [tr('All Documents', 'Tüm Belgeler')]: visible };

    const map: Record<string, Doc[]> = {};
    for (const doc of visible) {
      const key = groupMode === 'criterion'
        ? (doc.criterion_code?.trim() || tr('— No Criterion', '— Kriter Yok'))
        : (doc.survey_name?.trim()    || tr('— No Survey',    '— Anket Yok'));
      if (!map[key]) map[key] = [];
      map[key].push(doc);
    }
    // Sort group keys: criterion codes alphabetically; survey names alphabetically
    return Object.fromEntries(
      Object.entries(map).sort(([a], [b]) => {
        // Put "— No …" groups last
        if (a.startsWith('—')) return 1;
        if (b.startsWith('—')) return -1;
        return a.localeCompare(b);
      }),
    );
  }, [visible, groupMode, lang]);

  const totalSize = docs.reduce((s, d) => s + (d.file_size || 0), 0);
  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024)        return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  /* ── Loading / error states ── */
  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>
          {tr('Loading…', 'Yükleniyor…')}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
        <AppNav />
        <main className="wrap" style={{ padding: '64px 32px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</p>
          <Link href="/dashboard"><button className="btn btn-outline" style={{ marginTop: 20 }}>← Dashboard</button></Link>
        </main>
      </div>
    );
  }

  const groupKeys = Object.keys(grouped);

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <AppNav />

      <main className="wrap" style={{ padding: '36px 32px 80px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.08em' }}>
              ← {tr('Dashboard', 'Ana Sayfa')}
            </span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <div>
              <h1 style={{ fontSize: 34, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.05, marginBottom: 6 }}>
                {tr('Evidence ', 'Kanıt ')}
                <em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500 }}>
                  {tr('Library', 'Kütüphanesi')}
                </em>
              </h1>
              <p style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em' }}>
                {docs.length} {tr('documents', 'belge')} · {formatSize(totalSize)} {tr('total', 'toplam')}
              </p>
            </div>
          </div>
        </div>

        {/* Controls bar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
          marginBottom: 20, padding: '10px 14px',
          background: 'var(--paper)', border: '1px solid var(--line)',
        }}>
          {/* Search */}
          <input
            type="search"
            placeholder={tr('Search title, question, or criterion…', 'Başlık, soru veya kriter ara…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: '1 1 220px', padding: '6px 12px',
              border: '1px solid var(--line)', background: 'var(--cream)',
              fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12,
              color: 'var(--ink)', outline: 'none',
            }}
          />

          {/* Survey filter */}
          {surveys.length > 1 && (
            <select
              value={surveyFilter}
              onChange={(e) => setSurveyFilter(e.target.value)}
              style={{
                padding: '6px 10px', fontSize: 11.5, border: '1px solid var(--line)',
                background: 'var(--cream)', color: 'var(--ink)',
                fontFamily: "'IBM Plex Sans', sans-serif", cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="all">{tr('All surveys', 'Tüm anketler')}</option>
              {surveys.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {/* Group by */}
          <div style={{ display: 'flex', gap: 0, border: '1px solid var(--line)', overflow: 'hidden' }}>
            {([
              ['criterion', tr('By Criterion', 'Kritere Göre')],
              ['survey',    tr('By Survey',    'Ankete Göre')],
              ['none',      tr('All',          'Tümü')],
            ] as [GroupMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setGroupMode(mode)}
                style={{
                  padding: '5px 11px',
                  background: groupMode === mode ? 'var(--ink)' : 'transparent',
                  color:      groupMode === mode ? 'var(--cream)' : 'var(--ink-3)',
                  border: 'none', cursor: 'pointer',
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                  letterSpacing: '0.06em', borderRight: '1px solid var(--line)',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            style={{
              padding: '6px 10px', fontSize: 11.5, border: '1px solid var(--line)',
              background: 'var(--cream)', color: 'var(--ink)',
              fontFamily: "'IBM Plex Sans', sans-serif", cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="date_desc">{tr('Newest first', 'En yeni önce')}</option>
            <option value="date_asc">{tr('Oldest first',  'En eski önce')}</option>
            <option value="title">{tr('By title',         'Başlığa göre')}</option>
            <option value="size">{tr('By size',           'Boyuta göre')}</option>
          </select>

          <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)' }}>
            {visible.length} {tr('results', 'sonuç')}
          </span>
        </div>

        {/* Empty state */}
        {visible.length === 0 && (
          <div style={{
            background: 'var(--paper)', border: '1px solid var(--line)',
            padding: '60px 40px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.02em', marginBottom: 8 }}>0</p>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 24 }}>
              {docs.length === 0
                ? tr('No documents uploaded yet.', 'Henüz belge yüklenmemiş.')
                : tr('No documents match your search.', 'Arama kriterlerine uyan belge bulunamadı.')}
            </p>
            {docs.length === 0 && (
              <Link href="/surveys" style={{ textDecoration: 'none' }}>
                <button className="btn btn-primary">
                  {tr('Start Assessment', 'Değerlendirme Başlat')} →
                </button>
              </Link>
            )}
          </div>
        )}

        {/* Grouped document list */}
        {visible.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {groupKeys.map((groupKey) => {
              const groupDocs = grouped[groupKey];
              return (
                <div key={groupKey}>
                  {/* Group header */}
                  {groupMode !== 'none' && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
                    }}>
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                        color: 'var(--ink-2)',
                        textTransform: groupMode === 'criterion' ? 'uppercase' : 'none',
                      }}>
                        {groupMode === 'criterion' && !groupKey.startsWith('—') && (
                          <span style={{ color: 'var(--olive-deep)' }}>◈ </span>
                        )}
                        {groupKey}
                      </span>
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.06em',
                      }}>
                        {groupDocs.length} {tr('doc', 'belge')}{groupDocs.length !== 1 && (lang === 'en' ? 's' : '')}
                      </span>
                      <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                    </div>
                  )}

                  {/* Documents in this group */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {groupDocs.map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          background: 'var(--paper)', border: '1px solid var(--line)',
                          padding: '14px 18px',
                          display: 'flex', alignItems: 'flex-start', gap: 14,
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ink-3)')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                      >
                        {/* File icon */}
                        <div style={{ flexShrink: 0, paddingTop: 2 }}>
                          <FileIcon title={doc.title} />
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.title}
                          </div>
                          {doc.question_text && (
                            <div style={{
                              fontSize: 11, color: 'var(--ink-4)', marginBottom: 3,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              fontStyle: 'italic',
                            }}>
                              {doc.question_text.length > 120 ? `${doc.question_text.slice(0, 120)}…` : doc.question_text}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace", flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Criterion badge — shown in non-criterion grouped views */}
                            {groupMode !== 'criterion' && doc.criterion_code && (
                              <span style={{
                                padding: '1px 6px', border: '1px solid var(--olive-deep)',
                                color: 'var(--olive-deep)', borderRadius: 2, fontSize: 9,
                                letterSpacing: '0.06em', fontWeight: 700, textTransform: 'uppercase',
                              }}>
                                {doc.criterion_code}
                              </span>
                            )}
                            {doc.survey_name && groupMode !== 'survey' && (
                              <span>{doc.survey_name}</span>
                            )}
                            <span>{new Date(doc.uploaded_at).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB')}</span>
                            <span>{doc.file_size_display}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <a
                            href={documentDownloadUrl(doc.id)}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              padding: '5px 12px',
                              background: 'var(--olive-deep)', color: '#fff',
                              fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                              letterSpacing: '0.06em', textDecoration: 'none',
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                            }}
                          >
                            ↓ {tr('Download', 'İndir')}
                          </a>
                          {doc.attempt_id && (
                            <Link href={`/results/${doc.attempt_id}`} style={{ textDecoration: 'none' }}>
                              <button style={{
                                padding: '5px 12px',
                                background: 'transparent', color: 'var(--ink-3)',
                                border: '1px solid var(--line)',
                                fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                                letterSpacing: '0.06em', cursor: 'pointer',
                              }}>
                                {tr('Report →', 'Rapor →')}
                              </button>
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
