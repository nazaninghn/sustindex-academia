'use client';
/**
 * Central Document Library — /documents
 * Shows all supporting documents uploaded by the user across all attempts.
 * Groups by survey, supports search + sort.
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
  survey_name: string | null;
  attempt_id: number;
}

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

  const [docs,    setDocs]    = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [survey,  setSurvey]  = useState('all');
  const [sortBy,  setSortBy]  = useState<'date_desc' | 'date_asc' | 'title' | 'size'>('date_desc');

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
        if (active) setError(lang === 'tr' ? 'Belgeler yüklenemedi.' : 'Failed to load documents.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user, lang]);

  const surveys = useMemo(
    () => Array.from(new Set(docs.map((d) => d.survey_name ?? 'Unknown'))).sort(),
    [docs]
  );

  const visible = useMemo(() => {
    let filtered = docs;
    if (survey !== 'all') filtered = filtered.filter((d) => (d.survey_name ?? 'Unknown') === survey);
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.question_text ?? '').toLowerCase().includes(q) ||
          (d.survey_name ?? '').toLowerCase().includes(q)
      );
    }
    switch (sortBy) {
      case 'date_asc':  return [...filtered].sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at));
      case 'title':     return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
      case 'size':      return [...filtered].sort((a, b) => b.file_size - a.file_size);
      default:          return [...filtered].sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
    }
  }, [docs, survey, search, sortBy]);

  const totalSize = docs.reduce((s, d) => s + (d.file_size || 0), 0);
  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024)        return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>
          {lang === 'tr' ? 'Yükleniyor…' : 'Loading…'}
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

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <AppNav />

      <main className="wrap" style={{ padding: '36px 32px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              ← {lang === 'tr' ? 'Dashboard' : 'Dashboard'}
            </span>
          </Link>
          <h1 style={{ fontSize: 34, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.05, marginTop: 14, marginBottom: 6 }}>
            {lang === 'tr' ? 'Belge ' : 'Document '}
            <em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500 }}>
              {lang === 'tr' ? 'Kütüphanesi' : 'Library'}
            </em>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em' }}>
            {docs.length} {lang === 'tr' ? 'belge' : 'documents'} · {formatSize(totalSize)} {lang === 'tr' ? 'toplam' : 'total'}
          </p>
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
          marginBottom: 20, padding: '10px 14px',
          background: 'var(--paper)', border: '1px solid var(--line)',
        }}>
          {/* Search */}
          <input
            type="search"
            placeholder={lang === 'tr' ? 'Başlık veya soru ara…' : 'Search title or question…'}
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
              value={survey}
              onChange={(e) => setSurvey(e.target.value)}
              style={{
                padding: '6px 10px', fontSize: 11.5, border: '1px solid var(--line)',
                background: 'var(--cream)', color: 'var(--ink)',
                fontFamily: "'IBM Plex Sans', sans-serif", cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="all">{lang === 'tr' ? 'Tüm anketler' : 'All surveys'}</option>
              {surveys.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

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
            <option value="date_desc">{lang === 'tr' ? 'En yeni önce' : 'Newest first'}</option>
            <option value="date_asc">{lang === 'tr'  ? 'En eski önce' : 'Oldest first'}</option>
            <option value="title">{lang === 'tr'     ? 'Başlığa göre' : 'By title'}</option>
            <option value="size">{lang === 'tr'      ? 'Boyuta göre'  : 'By size'}</option>
          </select>

          <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)' }}>
            {visible.length} {lang === 'tr' ? 'sonuç' : 'results'}
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
                ? (lang === 'tr' ? 'Henüz belge yüklenmemiş.' : 'No documents uploaded yet.')
                : (lang === 'tr' ? 'Arama kriterlerine uyan belge bulunamadı.' : 'No documents match your search.')}
            </p>
            {docs.length === 0 && (
              <Link href="/surveys" style={{ textDecoration: 'none' }}>
                <button className="btn btn-primary">
                  {lang === 'tr' ? 'Değerlendirme Başlat' : 'Start Assessment'} →
                </button>
              </Link>
            )}
          </div>
        )}

        {/* Document grid */}
        {visible.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visible.map((doc) => (
              <div key={doc.id} style={{
                background: 'var(--paper)', border: '1px solid var(--line)',
                padding: '16px 20px',
                display: 'flex', alignItems: 'flex-start', gap: 16,
                transition: 'border-color 0.15s',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ink-3)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
              >
                {/* File type icon */}
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
                      fontSize: 11, color: 'var(--ink-4)', marginBottom: 4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontStyle: 'italic',
                    }}>
                      {doc.question_text.length > 120 ? `${doc.question_text.slice(0, 120)}…` : doc.question_text}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace", flexWrap: 'wrap' }}>
                    {doc.survey_name && <span>{doc.survey_name}</span>}
                    <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
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
                    ↓ {lang === 'tr' ? 'İndir' : 'Download'}
                  </a>
                  {doc.attempt_id && (
                    <Link href={`/results/${doc.attempt_id}`} style={{ textDecoration: 'none' }}>
                      <button style={{
                        padding: '5px 12px',
                        background: 'transparent', color: 'var(--ink-3)',
                        border: '1px solid var(--line)',
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                        letterSpacing: '0.06em', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}>
                        {lang === 'tr' ? 'Rapora Git' : 'View Report'} →
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
