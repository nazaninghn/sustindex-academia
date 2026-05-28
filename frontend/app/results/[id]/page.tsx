'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppNav from '@/components/AppNav';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/shared';
import { attemptAPI } from '@/lib/api';
import { gradeColor, priorityColor, sanitizeHtml } from '@/lib/utils';

function priorityDot(p: string) {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6,
      borderRadius: '50%', background: priorityColor(p), flexShrink: 0,
    }} />
  );
}

/* ─── Score ring ─────────────────────────────────────────── */
function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 52, cx = 64, cy = 64, stroke = 5;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={128} height={128} viewBox="0 0 128 128">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={gradeColor(grade)} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 64 64)"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text x={cx} y={cy - 6} textAnchor="middle"
        fontFamily="'IBM Plex Sans', sans-serif" fontWeight="300" fontSize="28"
        letterSpacing="-2" fill="var(--ink)">{score}</text>
      <text x={cx} y={cy + 14} textAnchor="middle"
        fontFamily="'IBM Plex Sans', sans-serif" fontWeight="600" fontSize="13"
        fill={gradeColor(grade)}>{grade}</text>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   Results Page
   ═══════════════════════════════════════════════════════════ */
/* ─── Types ────────────────────────────────────────────────── */
interface CategoryScore { id: number; key: string; name: string; score: number; max_score: number; percentage: number }
interface Recommendation {
  category: string;
  priority?: string;
  priority_level?: string;   // alternate field name from some API versions
  suggestion?: string;
  title?: string;
  text?: string;             // alternate title field
  recommendation?: string;   // alternate title field
  description?: string;
  detail?: string;           // alternate description field
}
interface AnswerDoc { id: number; title: string; file: string; file_size_display?: string }
interface AttemptAnswer { id: number; question: number; question_text: string; choice_text?: string; choices_display?: string; notes?: string; documents?: AnswerDoc[] }
interface Attempt {
  id: number; is_completed: boolean; completed_at: string | null;
  total_score: number; overall_grade: string;
  survey_name: string; user_name: string; session_name?: string;
  category_scores: CategoryScore[]; recommendations: Recommendation[];
  answers: AttemptAnswer[];
}

export default function ResultsPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { lang } = useLang();
  const { user, isLoading: authLoading } = useAuth();

  const [attempt,    setAttempt]    = useState<Attempt | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState('');   // Fix CRITICAL #6
  const [tab,        setTab]        = useState<'overview' | 'evidence'>('overview');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && id) {
      attemptAPI.getAttempt(Number(id))
        .then((data: Attempt) => setAttempt(data))
        .catch((err: unknown) => {
          console.error('Failed to load attempt:', err);
          setFetchError(lang === 'tr' ? 'Değerlendirme yüklenemedi.' : 'Failed to load assessment.');
        })
        .finally(() => setLoading(false));
    }
  // Fix #5: removed `lang` — language switch is presentational and must not
  // trigger a full API re-fetch; error message language is fine to be stale.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  // Redirect incomplete attempts — must be in effect, NOT during render
  useEffect(() => {
    if (!loading && attempt && !attempt.is_completed) {
      router.replace(`/questionnaire/${id}`);
    }
  }, [loading, attempt, id, router]);

  /* ── Loading ── */
  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>
          {lang === 'tr' ? 'YÜKLENİYOR…' : 'LOADING…'}
        </span>
      </div>
    );
  }

  /* ── Fetch error / not found ── */
  if (!attempt) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 13, color: fetchError ? 'var(--danger)' : 'var(--ink-3)' }}>
          {fetchError || (lang === 'tr' ? 'Değerlendirme bulunamadı.' : 'Assessment not found.')}
        </p>
        <Link href="/history" style={{ textDecoration: 'none' }}>
          <button className="btn btn-outline">{lang === 'tr' ? '← Geçmişe Dön' : '← Back to History'}</button>
        </Link>
      </div>
    );
  }

  /* ── Incomplete — redirect handled in useEffect above ── */
  if (!attempt.is_completed) return null;

  const score       = Math.round(attempt.total_score ?? 0);
  const grade       = attempt.overall_grade ?? '—';
  const categories  = attempt.category_scores ?? [];
  const recs        = attempt.recommendations ?? [];
  const answersArr  = attempt.answers ?? [];
  const companyName = user?.company_name || user?.username || '';
  const surveyName  = attempt.survey_name || (lang === 'tr' ? 'ESG Değerlendirmesi' : 'ESG Assessment');
  const completedAt = attempt.completed_at
    ? new Date(attempt.completed_at).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  // Answers that have notes or documents
  const evidenceAnswers = answersArr.filter((a) => a.notes || (a.documents?.length ?? 0) > 0);

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="no-print"><AppNav /></div>

      <main className="wrap" style={{ padding: '32px 32px 80px' }}>

        {/* ── Toolbar ── */}
        <div className="no-print" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32,
        }}>
          <Link href="/dashboard" style={{ textDecoration: 'none', fontSize: 11, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 6, letterSpacing: '0.02em' }}>
            ← {lang === 'tr' ? 'Panele Dön' : 'Back to Dashboard'}
          </Link>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/surveys" style={{ textDecoration: 'none' }}>
              <button className="btn btn-outline btn-sm">
                {lang === 'tr' ? 'Yeni Değerlendirme' : 'New Assessment'} <Icon.plus />
              </button>
            </Link>
            <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
              <Icon.download /> {lang === 'tr' ? 'PDF İndir' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════
            REPORT HEADER
            ══════════════════════════════════════ */}
        <div className="print-section" style={{
          borderTop: '2px solid var(--ink)',
          paddingTop: 28, paddingBottom: 32,
          marginBottom: 32, borderBottom: '1px solid var(--line)',
          display: 'grid', gridTemplateColumns: '1fr auto', gap: 48, alignItems: 'center',
        }}>
          <div>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)',
              letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 14,
            }}>
              REF-{String(attempt.id).padStart(4, '0')} · {completedAt} · sustindex
            </span>
            <h1 style={{ fontSize: 28, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 14 }}>
              {lang === 'tr' ? 'ESG Değerlendirme Raporu' : 'ESG Assessment Report'}
              {companyName && (
                <>
                  <br />
                  <em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500, fontSize: 20 }}>
                    {companyName}
                  </em>
                </>
              )}
            </h1>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                <strong style={{ fontWeight: 600, color: 'var(--ink)' }}>{lang === 'tr' ? 'Anket:' : 'Survey:'}</strong>
                {' '}{surveyName}
              </span>
              <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>·</span>
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                <strong style={{ fontWeight: 600, color: 'var(--ink)' }}>{lang === 'tr' ? 'Çerçeve:' : 'Framework:'}</strong>
                {' '}GRI · SASB · ISO 26000
              </span>
            </div>
          </div>

          {/* Score ring */}
          <div style={{ textAlign: 'center' }}>
            <ScoreRing score={score} grade={grade} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em', display: 'block', marginTop: 4 }}>
              {lang === 'tr' ? 'genel skor' : 'overall score'}
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════════
            TABS (Overview / Evidence)
            ══════════════════════════════════════ */}
        <div className="no-print" style={{
          display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid var(--line)',
        }}>
          {/* Fix LOW #45: renamed map param from `t` to `tabKey` to avoid shadowing the i18n t() function */}
          {(['overview', 'evidence'] as const).map((tabKey) => (
            <button key={tabKey} onClick={() => setTab(tabKey)} style={{
              padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === tabKey ? '2px solid var(--ink)' : '2px solid transparent',
              fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: tab === tabKey ? 600 : 400,
              fontSize: 12, color: tab === tabKey ? 'var(--ink)' : 'var(--ink-3)',
              marginBottom: -1, transition: 'color 0.15s',
              letterSpacing: '0.02em',
            }}>
              {tabKey === 'overview'
                ? (lang === 'tr' ? 'Genel Bakış' : 'Overview')
                : (lang === 'tr' ? `Notlar & Kanıtlar${evidenceAnswers.length > 0 ? ` (${evidenceAnswers.length})` : ''}` : `Notes & Evidence${evidenceAnswers.length > 0 ? ` (${evidenceAnswers.length})` : ''}`)}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════
            TAB: OVERVIEW
            ══════════════════════════════════════ */}
        {tab === 'overview' && (
          <>
            {/* Category breakdown */}
            {categories.length > 0 && (
              <div className="print-section" style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                  <div>
                    <span className="eyebrow" style={{ display: 'block', marginBottom: 3 }}>
                      {lang === 'tr' ? 'Kategori Dağılımı' : 'Category Breakdown'}
                    </span>
                    <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
                      {lang === 'tr'
                        ? <>ESG <em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500 }}>boyutları</em></>
                        : <>ESG <em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500 }}>dimensions</em></>}
                    </h2>
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)' }}>
                    {categories.length} {lang === 'tr' ? 'kategori' : 'categories'}
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(categories.length, 3)}, 1fr)`,
                  border: '1px solid var(--line)',
                }}>
                  {categories.map((cat, i) => (
                    <div key={cat.id} style={{
                      padding: '28px 28px 24px', background: 'var(--paper)',
                      borderRight: i < categories.length - 1 ? '1px solid var(--line)' : 'none',
                    }}>
                      {/* Category key letter */}
                      <div style={{
                        fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700,
                        fontSize: 36, color: 'var(--olive-deep)', letterSpacing: '-0.04em',
                        lineHeight: 1, marginBottom: 12,
                      }}>
                        {cat.key?.[0] || cat.name?.[0] || String(i + 1)}
                      </div>
                      <h3 style={{ fontSize: 11.5, marginBottom: 16, fontWeight: 600, color: 'var(--ink-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {cat.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
                        <span style={{
                          fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300,
                          fontSize: 48, letterSpacing: '-0.04em', lineHeight: 0.9,
                          fontVariantNumeric: 'tabular-nums', color: 'var(--ink)',
                        }}>{Math.round(cat.percentage ?? 0)}</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-3)', paddingBottom: 2 }}>/ 100</span>
                      </div>
                      <div className="bar bar-olive" style={{ marginBottom: 10, height: 3 }}>
                        <span style={{ width: `${cat.percentage ?? 0}%` }} />
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                        {cat.score} / {cat.max_score} {lang === 'tr' ? 'puan' : 'pts'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {recs.length > 0 && (
              <div className="print-section">
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                  borderBottom: '2px solid var(--ink)', paddingBottom: 14, marginBottom: 20,
                }}>
                  <div>
                    <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>
                      {lang === 'tr' ? 'Öncelikli Aksiyon Planı' : 'Priority Action Plan'}
                    </span>
                    <h2 style={{ fontSize: 22, fontWeight: 400, letterSpacing: '-0.02em' }}>
                      {lang === 'tr'
                        ? <>Sırada <em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500 }}>ne</em> yapılmalı.</>
                        : <>What to do <em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500 }}>next</em>.</>}
                    </h2>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {recs.length} {lang === 'tr' ? 'öneri' : 'recommendations'}
                  </span>
                </div>

                <div style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}>
                  {recs.map((r, i) => {
                    const priority = r.priority || r.priority_level || '';
                    const pColor   = priorityColor(priority);
                    return (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: '28px 116px 1fr',
                        gap: 20, alignItems: 'flex-start',
                        padding: '18px 24px',
                        borderBottom: i < recs.length - 1 ? '1px solid var(--line)' : 'none',
                        transition: 'background 0.1s',
                      }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cream-deep)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)', paddingTop: 2 }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span style={{
                          fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 10,
                          letterSpacing: '0.1em', textTransform: 'uppercase', color: pColor,
                          display: 'inline-flex', alignItems: 'center', gap: 6, paddingTop: 2,
                        }}>
                          {priorityDot(priority)}
                          {priority || (lang === 'tr' ? 'Öneri' : 'Action')}
                        </span>
                        <div>
                          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
                            {r.title || r.text || r.recommendation || r.category || JSON.stringify(r)}
                          </div>
                          {(r.description || r.detail || r.suggestion) && (
                            <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6, maxWidth: 640 }}>
                              {r.description || r.detail || r.suggestion}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Export CTA */}
            <div className="no-print" style={{
              marginTop: 40, padding: '24px 28px',
              background: 'var(--paper)', border: '1px solid var(--line)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24,
            }}>
              <div>
                <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>
                  {lang === 'tr' ? 'Raporu Dışa Aktar' : 'Export Report'}
                </span>
                <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 4, letterSpacing: '-0.01em' }}>
                  {lang === 'tr' ? 'Yönetici sunumu için PDF indirin' : 'Download a board-ready PDF report'}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--ink-3)', maxWidth: 480, lineHeight: 1.55 }}>
                  {lang === 'tr'
                    ? 'Tüm değerlendirme verileri, kategori dağılımı ve öneriler dahil profesyonel formatta.'
                    : 'Professional format including the full breakdown, category scores, and prioritized recommendations.'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button className="btn btn-primary" onClick={() => window.print()}>
                  <Icon.download /> {lang === 'tr' ? 'PDF İndir' : 'Export PDF'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════
            TAB: EVIDENCE & NOTES
            ══════════════════════════════════════ */}
        {tab === 'evidence' && (
          <div>
            {evidenceAnswers.length === 0 ? (
              <div style={{
                background: 'var(--paper)', border: '1px solid var(--line)',
                padding: '56px 40px', textAlign: 'center',
              }}>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 8 }}>
                  {lang === 'tr' ? 'Bu değerlendirmede not veya belge eklenmemiş.' : 'No notes or documents were added to this assessment.'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {lang === 'tr' ? 'Değerlendirme sırasında soru başına not veya kanıt dosyası ekleyebilirsiniz.' : 'You can add per-question notes and evidence files while completing assessments.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {evidenceAnswers.map((ans, i) => (
                  <div key={ans.id} style={{
                    background: 'var(--paper)', border: '1px solid var(--line)', padding: '20px 24px',
                  }}>
                    {/* Question text */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5,
                        color: 'var(--ink-4)', letterSpacing: '0.06em', flexShrink: 0, paddingTop: 2,
                      }}>Q{String(i + 1).padStart(2, '0')}</span>
                      <div
                        className="prose"
                        style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1 }}
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(ans.question_text || '') }}
                      />
                    </div>

                    {/* Answer */}
                    {ans.choices_display && ans.choices_display !== 'No answer provided' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.08em' }}>
                          {lang === 'tr' ? 'YANIT:' : 'ANSWER:'}
                        </span>
                        <span style={{
                          background: 'var(--olive-wash)', padding: '3px 10px',
                          fontSize: 12, color: 'var(--olive-deep)', fontWeight: 500,
                        }}>{ans.choices_display}</span>
                      </div>
                    )}

                    {/* Notes */}
                    {ans.notes && (
                      <div style={{
                        background: 'var(--cream-deep)', padding: '12px 16px',
                        borderLeft: '3px solid var(--olive-deep)', marginBottom: 10,
                      }}>
                        <span style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)',
                          letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6,
                        }}>
                          {lang === 'tr' ? 'Not' : 'Note'}
                        </span>
                        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>{ans.notes}</p>
                      </div>
                    )}

                    {/* Documents */}
                    {(ans.documents?.length ?? 0) > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)',
                          letterSpacing: '0.1em', textTransform: 'uppercase',
                        }}>
                          {lang === 'tr' ? 'Belgeler' : 'Documents'} ({ans.documents!.length})
                        </span>
                        {ans.documents?.map((doc) => (
                          <a key={doc.id} href={doc.file} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px 12px', background: 'var(--cream)',
                              border: '1px solid var(--line)',
                              transition: 'border-color 0.15s',
                            }}
                              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ink-3)')}
                              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                            >
                              <span style={{ fontSize: 16 }}>📎</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>{doc.title}</div>
                                {doc.file_size_display && (
                                  <div style={{ fontSize: 10.5, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                                    {doc.file_size_display}
                                  </div>
                                )}
                              </div>
                              <span style={{ fontSize: 10, color: 'var(--olive-deep)' }}>
                                {lang === 'tr' ? 'İndir' : 'Download'} ↓
                              </span>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
