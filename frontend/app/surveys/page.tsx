'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/AppNav';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/shared';
import { surveyAPI, attemptAPI } from '@/lib/api';

interface Survey {
  id: number;
  name: string;
  description?: string;
  question_count?: number;
  questions?: { id: number }[];
  estimated_time?: string;
  category?: string;   // env | soc | gov — may not come from API
  tag?: string;
}

function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--paper)', border: '1px solid var(--line)',
      padding: 28, minHeight: 200,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 22 }}>
        <div style={{ height: 10, width: 60, background: 'var(--cream-deep)', borderRadius: 2 }} />
        <div style={{ height: 20, width: 56, background: 'var(--cream-deep)', borderRadius: 999 }} />
      </div>
      <div style={{ height: 18, width: '65%', background: 'var(--cream-deep)', borderRadius: 2, marginBottom: 10 }} />
      <div style={{ height: 12, width: '90%', background: 'var(--cream-deep)', borderRadius: 2, marginBottom: 6 }} />
      <div style={{ height: 12, width: '75%', background: 'var(--cream-deep)', borderRadius: 2, marginBottom: 28 }} />
      <div style={{ height: 1, background: 'var(--line)', marginBottom: 18 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ height: 20, width: 120, background: 'var(--cream-deep)', borderRadius: 2 }} />
        <div style={{ height: 32, width: 72, background: 'var(--cream-deep)', borderRadius: 999 }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Surveys Page
   ═══════════════════════════════════════════════════════════════ */
export default function SurveysPage() {
  const { lang } = useLang();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [filter,   setFilter]   = useState('all');
  const [surveys,  setSurveys]  = useState<Survey[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [starting, setStarting] = useState<number | null>(null);
  const [startErr, setStartErr] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      surveyAPI
        .getSurveys()
        .then((data: any) => {
          const list = Array.isArray(data) ? data : (data?.results ?? []);
          setSurveys(list);
        })
        .catch(() => setSurveys([]))
        .finally(() => setLoading(false));
    }
  }, [user]);

  /* Start a new attempt for a given survey */
  const handleStart = async (surveyId: number) => {
    if (starting !== null) return;   // fix: truthy check fails for id=0
    setStarting(surveyId);
    setStartErr('');
    try {
      const attempt = await attemptAPI.startAttempt(surveyId);
      router.push(`/questionnaire/${attempt.id}`);
    } catch (err: any) {
      console.error('Failed to start attempt:', err);
      setStartErr(lang === 'tr' ? 'Başlatılamadı, tekrar dene.' : 'Could not start. Please try again.');
      setStarting(null);
    }
  };

  const qCount = (s: Survey) =>
    s.question_count ?? s.questions?.length ?? 0;

  // Category filter — only shown if surveys have a category field
  const hasCats = surveys.some((s) => s.category);
  const filters: [string, string][] = hasCats
    ? [
        ['all', lang === 'tr' ? 'Tümü'          : 'All'],
        ['env', lang === 'tr' ? 'Çevre'         : 'Environmental'],
        ['soc', lang === 'tr' ? 'Sosyal'        : 'Social'],
        ['gov', lang === 'tr' ? 'Yönetişim'     : 'Governance'],
      ]
    : [['all', lang === 'tr' ? 'Tümü' : 'All']];

  const visible = surveys.filter((s) => filter === 'all' || s.category === filter);

  if (authLoading) return null;

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <AppNav />

      <main className="wrap" style={{ padding: '36px 32px 80px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 40 }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11, color: 'var(--ink-4)',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            display: 'block', marginBottom: 10,
          }}>
            {loading
              ? '…'
              : `${lang === 'tr' ? 'Kütüphane · ' : 'Library · '}${surveys.length} ${lang === 'tr' ? 'anket' : 'surveys'}`}
          </span>
          <h1 style={{ fontSize: 36, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.05, marginBottom: 8 }}>
            {lang === 'tr'
              ? <>Bir{' '}<em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500 }}>değerlendirme</em>{' '}seçin.</>
              : <>Choose an{' '}<em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500 }}>assessment</em>.</>}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 520, lineHeight: 1.6 }}>
            {lang === 'tr'
              ? 'Her anket farklı bir kapsama ayarlanmıştır. Temel değerlendirmeden başlayın ya da odaklanmış bir gözden geçirmeye atlayın.'
              : 'Each survey is calibrated to a different scope. Start with the core baseline, or jump straight to a focused review.'}
          </p>
        </div>

        {/* ── Filter chips ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--line)',
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {filters.map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                style={{
                  padding: '6px 14px', borderRadius: 999,
                  background: filter === k ? 'var(--ink)' : 'transparent',
                  color:      filter === k ? 'var(--cream)' : 'var(--ink-3)',
                  border: 'none', cursor: 'pointer',
                  fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 11.5,
                }}
              >{l}</button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
            {loading ? '…' : `${visible.length} ${lang === 'tr' ? 'sonuç' : 'results'}`}
          </span>
        </div>

        {/* ── Error banner ── */}
        {startErr && (
          <div style={{
            background: '#FEF2F0', border: '1px solid #F5C6BB',
            padding: '12px 18px', marginBottom: 18,
            fontSize: 12, color: 'var(--danger)',
            fontFamily: "'IBM Plex Mono', monospace",
          }}>
            {startErr}
          </div>
        )}

        {/* ── Survey cards ── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : visible.length === 0 ? (
          <div style={{
            background: 'var(--paper)', border: '1px solid var(--line)',
            padding: '64px 40px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 8 }}>
              {lang === 'tr' ? 'Henüz hiç anket yok.' : 'No surveys available yet.'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
              {lang === 'tr' ? 'Yönetici tarafından eklendikten sonra burada görünecek.' : 'They will appear here once added by an admin.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {visible.map((s, idx) => (
              <div
                key={s.id}
                style={{
                  background: 'var(--paper)', border: '1px solid var(--line)',
                  padding: 28, display: 'flex', flexDirection: 'column',
                  cursor: 'default', transition: 'border-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ink-3)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
              >
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
                    color: 'var(--ink-4)', letterSpacing: '0.08em',
                  }}>
                    SX · {String(idx + 1).padStart(2, '0')}
                  </span>
                  {(s.tag || s.category) && (
                    <span className="pill pill-olive">
                      {s.tag ?? s.category?.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Title + description */}
                <h3 style={{ fontSize: 18, marginBottom: 10, fontWeight: 500, letterSpacing: '-0.01em' }}>
                  {s.name}
                </h3>
                {s.description && (
                  <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 24, lineHeight: 1.65 }}>
                    {s.description}
                  </p>
                )}

                {/* Footer */}
                <div style={{
                  marginTop: 'auto',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingTop: 18, borderTop: '1px solid var(--line)',
                }}>
                  <div style={{ display: 'flex', gap: 22, alignItems: 'baseline' }}>
                    {qCount(s) > 0 && (
                      <div>
                        <span style={{
                          fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
                          fontSize: 20, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
                        }}>{qCount(s)}</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>
                          {lang === 'tr' ? 'soru' : 'questions'}
                        </span>
                      </div>
                    )}
                    {s.estimated_time && (
                      <div>
                        <span style={{
                          fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
                          fontSize: 20, letterSpacing: '-0.03em',
                        }}>{s.estimated_time}</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>min</span>
                      </div>
                    )}
                  </div>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleStart(s.id)}
                    disabled={starting !== null}
                    style={{ opacity: starting === s.id ? 0.6 : 1, minWidth: 80 }}
                  >
                    {starting === s.id
                      ? (lang === 'tr' ? 'Açılıyor…' : 'Opening…')
                      : (lang === 'tr' ? 'Başla' : 'Start')}
                    {starting !== s.id && <Icon.arrow />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
