'use client';
/**
 * Admin Analytics Dashboard — /admin/analytics
 * Only accessible to staff users (backend enforces IsAdminUser; frontend shows
 * 403 error for non-staff).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { attemptAPI } from '@/lib/api';
import { gradeColor } from '@/lib/utils';
import AppNav from '@/components/AppNav';
import { useLang } from '@/lib/i18n';

interface SurveyStat   { survey_name: string; count: number; avg_score: number }
interface ScoreBucket  { range: string; count: number }
interface RecentItem   { id: number; user: string; survey: string; score: number; grade: string; completed_at: string | null }
interface DailyItem    { date: string; count: number }
interface Analytics {
  total_users: number;
  total_attempts: number;
  completed: number;
  in_progress: number;
  average_score: number;
  attempts_per_survey: SurveyStat[];
  score_distribution: ScoreBucket[];
  grade_breakdown: Record<string, number>;
  recent_completions: RecentItem[];
  daily_completions: DailyItem[];
}

function MiniBarChart({ data, maxVal }: { data: { label: string; value: number }[]; maxVal: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.map(({ label, value }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5,
            color: 'var(--ink-4)', width: 44, flexShrink: 0, letterSpacing: '0.04em',
          }}>{label}</span>
          <div style={{ flex: 1, height: 14, background: 'var(--line-soft)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${maxVal > 0 ? (value / maxVal) * 100 : 0}%`,
              height: '100%',
              background: 'var(--olive-deep)',
              borderRadius: 2,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5,
            color: 'var(--ink-3)', width: 24, flexShrink: 0, textAlign: 'right',
          }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function DailySparkline({ data }: { data: DailyItem[] }) {
  if (data.length === 0) return <p style={{ fontSize: 11, color: 'var(--ink-4)' }}>No data</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  const W = 440, H = 60;
  const padL = 4, padR = 4, padT = 6, padB = 16;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const step = innerW / Math.max(data.length - 1, 1);

  const pts = data.map((d, i) => ({
    x: padL + i * step,
    y: padT + innerH - (d.count / max) * innerH,
    ...d,
  }));

  const linePath = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${padT + innerH} L${pts[0].x},${padT + innerH} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
        <path d={areaPath} fill="var(--olive-deep)" opacity={0.12} />
        <path d={linePath} fill="none" stroke="var(--olive-deep)" strokeWidth={1.8}
          strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p) => (
          <circle key={p.date} cx={p.x} cy={p.y} r={2.5}
            fill="var(--olive-deep)" stroke="white" strokeWidth={1} />
        ))}
        {/* First + last date labels */}
        {pts.length > 1 && (
          <>
            <text x={pts[0].x} y={H - 3} textAnchor="start" fontSize={8}
              fontFamily="'IBM Plex Mono',monospace" fill="var(--ink-4)">
              {new Date(pts[0].date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
            </text>
            <text x={pts[pts.length - 1].x} y={H - 3} textAnchor="end" fontSize={8}
              fontFamily="'IBM Plex Mono',monospace" fill="var(--ink-4)">
              {new Date(pts[pts.length - 1].date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { lang } = useLang();
  const [data,    setData]    = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const res = await attemptAPI.getAdminAnalytics();
        if (active) setData(res);
      } catch (err: unknown) {
        if (!active) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 403) {
          setError(lang === 'tr' ? 'Bu sayfaya erişim yetkiniz yok.' : 'You do not have permission to view this page.');
        } else {
          setError(lang === 'tr' ? 'Veri yüklenemedi.' : 'Failed to load analytics data.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user, lang]);

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>
          Loading…
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
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <button className="btn btn-outline" style={{ marginTop: 20 }}>← Dashboard</button>
          </Link>
        </main>
      </div>
    );
  }

  if (!data) return null;

  const gradeOrder = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D'];
  const gradeData  = gradeOrder
    .filter((g) => data.grade_breakdown[g] !== undefined)
    .map((g) => ({ label: g, value: data.grade_breakdown[g] || 0 }));
  const maxGrade   = Math.max(...gradeData.map((g) => g.value), 1);

  const maxBucket  = Math.max(...data.score_distribution.map((b) => b.count), 1);

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <AppNav />

      <main className="wrap" style={{ padding: '36px 32px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              ← {lang === 'tr' ? 'Dashboard' : 'Dashboard'}
            </span>
          </Link>
          <h1 style={{ fontSize: 34, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.05, marginTop: 14, marginBottom: 6 }}>
            {lang === 'tr' ? 'Yönetici ' : 'Admin '}
            <em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500 }}>
              {lang === 'tr' ? 'Analitik' : 'Analytics'}
            </em>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em' }}>
            {lang === 'tr' ? 'Tüm kullanıcılar genelinde gerçek zamanlı istatistikler' : 'Real-time statistics across all users'}
          </p>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 28 }}>
          {[
            { label: lang === 'tr' ? 'Toplam Kullanıcı' : 'Total Users',       value: data.total_users },
            { label: lang === 'tr' ? 'Toplam Deneme'   : 'Total Attempts',     value: data.total_attempts },
            { label: lang === 'tr' ? 'Tamamlandı'      : 'Completed',          value: data.completed },
            { label: lang === 'tr' ? 'Devam Ediyor'    : 'In Progress',        value: data.in_progress },
            { label: lang === 'tr' ? 'Ort. Puan'       : 'Avg Score',          value: `${data.average_score}%` },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '18px 16px' }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: 28, letterSpacing: '-0.03em', marginBottom: 4 }}>
                {value}
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Row 1: Daily completions + Score distribution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* Daily completions sparkline */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '20px 22px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
              {lang === 'tr' ? 'Son 30 Gün — Tamamlanan Denemeler' : 'Last 30 Days — Completions'}
            </div>
            <DailySparkline data={data.daily_completions} />
          </div>

          {/* Score distribution */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '20px 22px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
              {lang === 'tr' ? 'Puan Dağılımı' : 'Score Distribution'}
            </div>
            <MiniBarChart
              data={data.score_distribution.map((b) => ({ label: b.range, value: b.count }))}
              maxVal={maxBucket}
            />
          </div>
        </div>

        {/* Row 2: Per-survey stats + Grade breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* Per-survey table */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '20px 22px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
              {lang === 'tr' ? 'Ankete Göre' : 'By Survey'}
            </div>
            {data.attempts_per_survey.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--ink-4)' }}>—</p>
            ) : (
              <table className="t" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>{lang === 'tr' ? 'Anket' : 'Survey'}</th>
                    <th style={{ textAlign: 'right' }}>{lang === 'tr' ? 'Adet' : 'Count'}</th>
                    <th style={{ textAlign: 'right' }}>{lang === 'tr' ? 'Ort. Puan' : 'Avg Score'}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attempts_per_survey.map((s) => (
                    <tr key={s.survey_name}>
                      <td style={{ fontSize: 12 }}>{s.survey_name}</td>
                      <td style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{s.count}</td>
                      <td style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{s.avg_score}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Grade breakdown */}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '20px 22px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
              {lang === 'tr' ? 'Not Dağılımı' : 'Grade Breakdown'}
            </div>
            {gradeData.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--ink-4)' }}>—</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {gradeData.map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500,
                      fontSize: 16, color: gradeColor(label),
                      width: 30, flexShrink: 0, letterSpacing: '-0.02em',
                    }}>{label}</span>
                    <div style={{ flex: 1, height: 12, background: 'var(--line-soft)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        width: `${(value / maxGrade) * 100}%`, height: '100%',
                        background: gradeColor(label), borderRadius: 2, opacity: 0.75,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-3)', width: 22, textAlign: 'right' }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent completions */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '20px 22px' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            {lang === 'tr' ? 'Son Tamamlanan Denemeler' : 'Recent Completions'}
          </div>
          {data.recent_completions.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-4)' }}>—</p>
          ) : (
            <table className="t" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>{lang === 'tr' ? 'Kullanıcı' : 'User'}</th>
                  <th>{lang === 'tr' ? 'Anket' : 'Survey'}</th>
                  <th style={{ textAlign: 'right' }}>{lang === 'tr' ? 'Puan' : 'Score'}</th>
                  <th style={{ textAlign: 'right' }}>{lang === 'tr' ? 'Not' : 'Grade'}</th>
                  <th style={{ textAlign: 'right' }}>{lang === 'tr' ? 'Tarih' : 'Date'}</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_completions.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>{r.user}</td>
                    <td style={{ fontSize: 11 }}>{r.survey}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{r.score}%</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: gradeColor(r.grade) }}>{r.grade}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)' }}>
                      {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  );
}
