'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/AppNav';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/shared';
import { surveyAPI, attemptAPI } from '@/lib/api';
import logger from '@/lib/logger';

/* ═══════════════════════════════════════════════════════════════
   Sector selection modal
   ═══════════════════════════════════════════════════════════════ */

/**
 * Sector options — GRI Sector Standards require every company to select
 * one sector.  The "General / no sector" option was removed because GRI 3
 * Material Topics are always assessed in the context of a sector standard.
 */
const SECTORS: { value: string; key: string }[] = [
  { value: 'agri',         key: 'surv_sector_agri'          },
  { value: 'energy',       key: 'surv_sector_energy'        },
  { value: 'finance',      key: 'surv_sector_finance'       },
  { value: 'construction', key: 'surv_sector_construction'  },
  { value: 'manufacturing',key: 'surv_sector_manufacturing' },
  { value: 'health',       key: 'surv_sector_health'        },
  { value: 'tech',         key: 'surv_sector_tech'          },
  { value: 'retail',       key: 'surv_sector_retail'        },
];

interface SectorModalProps {
  onConfirm: (sector: string) => void;
  onCancel: () => void;
}

function SectorModal({ onConfirm, onCancel }: SectorModalProps) {
  const { t, lang } = useLang();
  // No pre-selection — user must actively choose a sector (GRI requirement).
  const [selected, setSelected] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    /* Overlay */
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(20, 20, 18, 0.55)',
        backdropFilter: 'blur(2px)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Card */}
      <div style={{
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        width: '100%', maxWidth: 560,
        padding: '32px 36px',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--ink-4)', display: 'block', marginBottom: 8,
          }}>
            GRI · Phase 4 — Sector Standard
          </span>
          <h2 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 8 }}>
            {t('surv_sector_title')}
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.65 }}>
            {lang === 'tr'
              ? 'GRI Sektör Standartları, her şirketin ilgili sektör için materyel konuları raporlamasını gerektirir. Lütfen şirketinizin ana faaliyet alanına en uygun sektörü seçin.'
              : 'GRI Sector Standards require every organisation to report on material topics for their relevant sector. Please select the sector that best matches your primary business activities.'}
          </p>
        </div>

        {/* Sector grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 28 }}>
          {SECTORS.map(({ value, key }) => {
            const isSelected = selected === value;
            return (
              <button
                key={value}
                onClick={() => setSelected(value)}
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  border: `1px solid ${isSelected ? 'var(--ink)' : 'var(--line)'}`,
                  background: isSelected ? 'var(--ink)' : 'var(--cream)',
                  color: isSelected ? 'var(--paper)' : 'var(--ink)',
                  cursor: 'pointer',
                  transition: 'border-color 0.12s, background 0.12s',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: 12.5, fontWeight: isSelected ? 500 : 400,
                  borderRadius: 0,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'var(--ink-3)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'var(--line)';
                }}
              >
                {/* dot indicator */}
                <span style={{
                  display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                  background: isSelected ? 'var(--paper)' : 'var(--line)',
                  marginRight: 8, marginBottom: 1,
                  transition: 'background 0.12s',
                }} />
                {t(key)}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        {selected === null && (
          <p style={{
            fontSize: 11, color: 'var(--ink-4)', marginBottom: 12,
            fontFamily: "'IBM Plex Mono', monospace",
          }}>
            {lang === 'tr' ? '* Devam etmek için bir sektör seçin.' : '* Select a sector to continue.'}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={onCancel}
          >
            {t('surv_sector_cancel')}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => selected !== null && onConfirm(selected)}
            disabled={selected === null}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              opacity: selected === null ? 0.4 : 1,
              cursor: selected === null ? 'not-allowed' : 'pointer',
            }}
          >
            {t('surv_sector_confirm')} <Icon.arrow />
          </button>
        </div>
      </div>
    </div>
  );
}

interface Survey {
  id: number;
  name: string; name_en?: string; name_tr?: string;
  description?: string; description_en?: string; description_tr?: string;
  /** Per-company effective count: universal + 8 sector (returned by SurveyListSerializer). */
  question_count?: number;
  /** Raw total used by SurveySerializer detail endpoint. */
  total_questions?: number;
  /** Fallback when neither field is present (e.g. cached old API response). */
  questions?: { id: number }[];
  estimated_time?: string;
  category?: string;   // env | soc | gov — may not come from API
  tag?: string;
}

/** Pick the right language field, fall back to default text */
function loc(
  obj: { name?: string; name_en?: string; name_tr?: string;
         description?: string; description_en?: string; description_tr?: string },
  field: 'name' | 'description',
  lang: string
): string {
  const trKey  = `${field}_tr`  as 'name_tr'  | 'description_tr';
  const enKey  = `${field}_en`  as 'name_en'  | 'description_en';
  if (lang === 'tr' && obj[trKey]) return obj[trKey]!;
  if (lang === 'en' && obj[enKey]) return obj[enKey]!;
  return obj[field] || '';
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
  const { lang, t } = useLang();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  // Fix HIGH #19 pattern: ref-based lock prevents double-submit on rapid re-renders
  const submitLockRef = useRef(false);

  const [filter,          setFilter]          = useState('all');
  const [surveys,         setSurveys]         = useState<Survey[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [loadErr,         setLoadErr]         = useState(false);   // Fix H-7: distinguish load failure from empty list
  const [retryKey,        setRetryKey]        = useState(0);       // increment to re-trigger the fetch effect
  const [starting,        setStarting]        = useState<number | null>(null);
  const [startErr,        setStartErr]        = useState('');
  // Sector modal: pendingSurveyId (state) drives the modal open/closed;
  // pendingSurveyRef (ref) holds the value for handleSectorConfirm so the
  // callback doesn't need pendingSurveyId in its dependency array (Fix LOW-04).
  const [pendingSurveyId, setPendingSurveyId] = useState<number | null>(null);
  const pendingSurveyRef  = useRef<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      setSurveys([]);
      setLoadErr(false);
      surveyAPI
        .getSurveys()
        .then((data: Survey[] | { results: Survey[] }) => {
          const list = Array.isArray(data) ? data : (data?.results ?? []);
          setSurveys(list);
        })
        // Fix H-7: surface the error so users know it's a network/server issue,
        // not just an empty library.  Previously .catch(() => setSurveys([]))
        // showed the same "no surveys yet" message for both states.
        .catch(() => { setSurveys([]); setLoadErr(true); })
        .finally(() => setLoading(false));
    }
  // retryKey is added so the Retry button re-runs the same effect cleanly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, retryKey]);

  /* Step 1 — user clicks "Start" on a survey card: open sector-selection modal */
  const handleStart = (surveyId: number) => {
    if (starting !== null || submitLockRef.current) return;
    setStartErr('');
    pendingSurveyRef.current = surveyId;   // Fix LOW-04: store in ref (no stale-closure risk)
    setPendingSurveyId(surveyId);
  };

  /* Step 2 — user picks a sector in the modal and clicks "Continue" */
  // Fix LOW-04: read surveyId from the ref instead of from state so this callback
  // never needs pendingSurveyId or starting in its dependency array, eliminating
  // the stale-closure risk that caused occasional "null surveyId" bugs on rapid clicks.
  const handleSectorConfirm = useCallback(async (sector: string) => {
    const surveyId = pendingSurveyRef.current;
    pendingSurveyRef.current = null;
    setPendingSurveyId(null);  // close modal immediately so UX is snappy
    if (surveyId === null || submitLockRef.current) return;
    submitLockRef.current = true;
    setStarting(surveyId);
    setStartErr('');
    try {
      // sector is always a non-empty string: sector selection is now required by GRI.
      const attempt = await attemptAPI.startAttempt(surveyId, sector);
      router.push(`/questionnaire/${attempt.id}`);
    } catch (err: unknown) {
      // Fix R4-H-04: environment-gated logger — silent in production
      logger.error('Failed to start attempt:', err);
      setStartErr(t('surv_start_err'));
      setStarting(null);
    } finally {
      submitLockRef.current = false;
    }
  }, [router, t]);

  /* Modal cancel — just dismiss without starting */
  const handleSectorCancel = useCallback(() => {
    pendingSurveyRef.current = null;
    setPendingSurveyId(null);
  }, []);

  // question_count → new smart field (per-company count, e.g. 180 for Combined).
  // total_questions → raw total (includes all sector questions).
  // questions.length → legacy fallback for old API responses.
  const qCount = (s: Survey) =>
    s.question_count ?? s.total_questions ?? s.questions?.length ?? 0;

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

  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
        {/* Fix R7-14: use i18n key instead of hardcoded English string */}
        {t('t_loading_auth')}
      </span>
    </div>
  );

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      {/* Sector selection modal — rendered outside the main layout flow */}
      {pendingSurveyId !== null && (
        <SectorModal
          onConfirm={handleSectorConfirm}
          onCancel={handleSectorCancel}
        />
      )}
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

        {/* ── GRI phased structure info banner ── */}
        {!loading && !loadErr && surveys.some((s) =>
          s.name?.includes('GRI') || s.name_en?.includes('GRI')
        ) && (
          <div style={{
            background: 'var(--paper)', border: '1px solid var(--line)',
            padding: '20px 24px', marginBottom: 18,
            display: 'flex', flexWrap: 'wrap', gap: 0,
          }}>
            <div style={{
              fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em',
              textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace",
              width: '100%', marginBottom: 12,
            }}>
              GRI Universal Standards · {lang === 'tr' ? 'Değerlendirme sırası' : 'Assessment flow'}
            </div>
            {([
              { phase: '01', label: lang === 'tr' ? 'GRI 1 · Temel'             : 'GRI 1 · Foundation',           q: '32',  desc: lang === 'tr' ? 'GRI gereksinimlerini anlama' : 'Understanding GRI requirements' },
              { phase: '02', label: lang === 'tr' ? 'GRI 2 · Genel Açıklamalar' : 'GRI 2 · General Disclosures', q: '80',  desc: lang === 'tr' ? 'Şirket profili & yönetişim' : 'Org. profile & governance'        },
              { phase: '03', label: lang === 'tr' ? 'GRI 3 · Önemli Konular'    : 'GRI 3 · Material Topics',     q: '60',  desc: lang === 'tr' ? 'Materyellik & yönetim yaklaşımı' : 'Materiality & management approach' },
              { phase: '04', label: lang === 'tr' ? 'Sektör Standardı'           : 'Sector Standard',             q: '8',   desc: lang === 'tr' ? 'Sektörünüze özel konular' : 'Industry-specific topics'          },
            ] as const).map((step, i, arr) => (
              <div key={step.phase} style={{ display: 'flex', alignItems: 'stretch', flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ flex: 1, paddingRight: 16 }}>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                    color: 'var(--ink-4)', letterSpacing: '0.08em', marginBottom: 4,
                  }}>
                    PHASE {step.phase}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4, lineHeight: 1.4 }}>
                    {step.desc}
                  </div>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                    color: 'var(--olive-deep)', fontWeight: 500,
                  }}>
                    {step.q} {lang === 'tr' ? 'soru' : 'Q'}
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', padding: '0 8px',
                    color: 'var(--ink-4)', fontSize: 16, flexShrink: 0,
                  }}>→</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Survey cards ── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : loadErr ? (
          /* Fix H-7: distinct error state — user sees a real problem message + retry */
          <div style={{
            background: '#FEF2F0', border: '1px solid #F5C6BB',
            padding: '48px 40px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12, fontWeight: 500 }}>
              {lang === 'tr' ? 'Anketler yüklenemedi.' : 'Failed to load surveys.'}
            </p>
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 20 }}>
              {lang === 'tr'
                ? 'Sunucuya bağlanılamadı. Lütfen bağlantınızı kontrol edin ve tekrar deneyin.'
                : 'Could not reach the server. Check your connection and try again.'}
            </p>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setRetryKey((k) => k + 1)}
            >
              {lang === 'tr' ? 'Tekrar Dene' : 'Retry'}
            </button>
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
                  {loc(s, 'name', lang)}
                </h3>
                {s.description && (
                  <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 24, lineHeight: 1.65 }}>
                    {loc(s, 'description', lang)}
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

                  {/* Fix H-09: only disable the button for the survey actively being
                      started.  The old disabled={starting !== null} froze ALL buttons
                      while one request was in flight — if it hung, users were stuck. */}
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleStart(s.id)}
                    disabled={starting === s.id}
                    style={{ opacity: starting === s.id ? 0.6 : 1, minWidth: 80 }}
                  >
                    {starting === s.id
                      ? t('surv_opening')
                      : t('surv_start')}
                    {starting !== s.id && <Icon.arrow aria-hidden="true" />}
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
