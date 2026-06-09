'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppNav from '@/components/AppNav';
import { useLang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/shared';
import { attemptAPI, documentDownloadUrl } from '@/lib/api';
import { sanitizeHtml, gradeColor, priorityColor } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────────── */
interface CategoryScore {
  id: number; key: string; name: string;
  score: number; max_score: number; percentage: number;
}
interface Recommendation {
  category: string; priority: string;
  gri_standard?: string; title?: string; description?: string;
  quick_win?: string; timeline_days?: number; effort?: string;
  score_pct?: number; suggestion?: string; text?: string; recommendation?: string;
}
interface AnswerDoc { id: number; title: string; file: string; file_size_display?: string; }
interface AttemptAnswer {
  id: number; question: number; question_text: string;
  choice_text?: string; choices_display?: string;
  notes?: string; documents?: AnswerDoc[];
}
interface PillarScores { environmental: number; social: number; governance: number; }
interface Maturity { label: string; narrative: string; }
interface FullAttempt {
  id: number; is_completed: boolean; completed_at: string | null;
  total_score: number; overall_grade: string;
  survey_name: string; user_name: string;
  category_scores: CategoryScore[];
  recommendations: Recommendation[];
  answers: AttemptAnswer[];
  pillar_scores?: PillarScores;
  maturity?: Maturity;
  answered_count?: number;
  total_questions?: number;
}
interface ListAttempt {
  id: number; survey_name: string; is_completed: boolean;
  completed_at: string | null; total_score: number; overall_grade: string;
}

/* ─── GRI Phase definitions ──────────────────────────────────── */
const PHASE_DEFS = [
  { phase: 1, labelEn: 'GRI 1: Foundation',          labelTr: 'GRI 1: Temel İlkeler',         match: 'GRI 1:',      standardsEn: 'GRI Universal Standards — Foundation', standardsTr: 'GRI Evrensel Standartları — Temel' },
  { phase: 2, labelEn: 'GRI 2: General Disclosures', labelTr: 'GRI 2: Genel Açıklamalar',      match: 'GRI 2:',      standardsEn: 'Governance, Strategy, Stakeholder Engagement', standardsTr: 'Yönetişim, Strateji, Paydaş Katılımı' },
  { phase: 3, labelEn: 'GRI 3: Material Topics',     labelTr: 'GRI 3: Önemli Konular',         match: 'GRI 3:',      standardsEn: 'Materiality Assessment, Impact Management', standardsTr: 'Önemlilik Değerlendirmesi, Etki Yönetimi' },
  { phase: 4, labelEn: 'Sector Standard',             labelTr: 'Sektör Standardı',               match: 'GRI Sector:', standardsEn: 'Industry-Specific Sustainability Topics', standardsTr: 'Sektöre Özgü Sürdürülebilirlik Konuları' },
];

/* ─── GRI Content Index data ─────────────────────────────────── */
const GRI_INDEX = [
  {
    section: { en: 'GRI 1: Foundation', tr: 'GRI 1: Temel' }, phase: 1,
    disclosures: [
      { code: 'GRI 1-1', en: 'Purpose of GRI Standards',              tr: 'GRI Standartlarının Amacı' },
      { code: 'GRI 1-2', en: 'System of GRI Standards',               tr: 'GRI Standartlarının Sistemi' },
      { code: 'GRI 1-3', en: 'Mandatory Requirements',                 tr: 'Zorunlu Gereksinimler' },
      { code: 'GRI 1-4', en: 'Statement of Use Requirements',          tr: 'Kullanım Beyanı Gereksinimleri' },
      { code: 'GRI 1-5', en: 'Due Diligence',                          tr: 'Durum Tespiti' },
    ],
  },
  {
    section: { en: 'GRI 2: General Disclosures', tr: 'GRI 2: Genel Açıklamalar' }, phase: 2,
    disclosures: [
      { code: 'GRI 2-1',  en: 'Organizational Details',                 tr: 'Kuruluş Detayları' },
      { code: 'GRI 2-2',  en: 'Entities Included in Sustainability Reporting', tr: 'Sürdürülebilirlik Raporlamasındaki Varlıklar' },
      { code: 'GRI 2-6',  en: 'Activities, Value Chain & Business Relationships', tr: 'Faaliyetler, Değer Zinciri ve İş İlişkileri' },
      { code: 'GRI 2-9',  en: 'Governance Structure & Composition',     tr: 'Yönetim Yapısı ve Bileşimi' },
      { code: 'GRI 2-14', en: 'Role of the Highest Governance Body',    tr: 'En Yüksek Yönetim Organının Rolü' },
      { code: 'GRI 2-22', en: 'Statement on Sustainable Development Strategy', tr: 'Sürdürülebilir Kalkınma Stratejisi Beyanı' },
      { code: 'GRI 2-25', en: 'Processes to Remediate Negative Impacts', tr: 'Olumsuz Etkilerin Giderilmesi Süreçleri' },
      { code: 'GRI 2-29', en: 'Approach to Stakeholder Engagement',     tr: 'Paydaş Katılımına Yaklaşım' },
    ],
  },
  {
    section: { en: 'GRI 3: Material Topics', tr: 'GRI 3: Önemli Konular' }, phase: 3,
    disclosures: [
      { code: 'GRI 3-1', en: 'Process to Determine Material Topics',   tr: 'Önemli Konuların Belirlenmesi Süreci' },
      { code: 'GRI 3-2', en: 'List of Material Topics',                tr: 'Önemli Konuların Listesi' },
      { code: 'GRI 3-3', en: 'Management of Material Topics',          tr: 'Önemli Konuların Yönetimi' },
    ],
  },
  {
    section: { en: 'Sector Standard', tr: 'Sektör Standardı' }, phase: 4,
    disclosures: [
      { code: 'Sector-1', en: 'Sector-Specific Environmental Topics',  tr: 'Sektöre Özgü Çevresel Konular' },
      { code: 'Sector-2', en: 'Sector-Specific Social Topics',         tr: 'Sektöre Özgü Sosyal Konular' },
      { code: 'Sector-3', en: 'Industry Governance & Compliance',      tr: 'Sektör Yönetişimi ve Uyum' },
    ],
  },
];

/* ─── Colour helpers ─────────────────────────────────────────── */
function scoreColor(pct: number): string {
  if (pct >= 80) return 'var(--olive-deep)';
  if (pct >= 60) return '#4a7c6f';
  if (pct >= 40) return 'var(--amber)';
  if (pct >= 20) return '#e07b39';
  return 'var(--danger)';
}
function scoreLabel(pct: number, lang: string): string {
  if (pct >= 80) return lang === 'tr' ? 'Mükemmel' : 'Excellent';
  if (pct >= 60) return lang === 'tr' ? 'İyi'       : 'Good';
  if (pct >= 40) return lang === 'tr' ? 'Gelişiyor' : 'Developing';
  if (pct >= 20) return lang === 'tr' ? 'Başlangıç' : 'Initial';
  return lang === 'tr' ? 'Kritik' : 'Critical';
}
function deriveGrade(score: number): string {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}
function maturityLabel(score: number, lang: string): string {
  if (score >= 80) return lang === 'tr' ? 'Lider'     : 'Leader';
  if (score >= 65) return lang === 'tr' ? 'Gelişmiş'  : 'Advanced';
  if (score >= 50) return lang === 'tr' ? 'Yönetilen' : 'Managed';
  if (score >= 35) return lang === 'tr' ? 'Gelişiyor' : 'Developing';
  return lang === 'tr' ? 'Başlangıç' : 'Initial';
}
function maturityNarrative(score: number, lang: string): string {
  if (score >= 80) return lang === 'tr'
    ? 'Kuruluşunuz GRI standartlarına tam uyum sağlamış ve sektörde lider konumdadır. ESG performansı sistematik olarak izlenmekte ve kamuoyuyla paylaşılmaktadır.'
    : 'Your organisation demonstrates full GRI alignment and leads the sector in sustainability maturity. ESG performance is systematically monitored and publicly disclosed.';
  if (score >= 65) return lang === 'tr'
    ? 'GRI uygulaması gelişmiş düzeyde olup çoğu alanda güçlü sistemler mevcuttur. Bazı boşluklar kapatıldığında sektör liderliğine ulaşılabilir.'
    : 'GRI implementation is advanced with strong systems in most areas. Closing remaining gaps will position your organisation as a sector leader.';
  if (score >= 50) return lang === 'tr'
    ? 'Temel GRI çerçevesi uygulanmaktadır ancak tutarlılık ve derinlik artırılmalıdır. Ölçüm ve raporlama sistemlerinin güçlendirilmesi öncelikli odak noktası olmalıdır.'
    : 'Core GRI framework is in place but consistency and depth need strengthening. Prioritise measurement systems and formalising reporting processes.';
  if (score >= 35) return lang === 'tr'
    ? 'GRI uyumuna yönelik ilk adımlar atılmış, ancak sistematik bir yaklaşım henüz geliştirilmemiştir. Politikaların resmileştirilmesi ve hedef belirlenmesi kritik öneme sahiptir.'
    : 'Initial steps toward GRI alignment have been taken but a systematic approach is not yet in place. Formalising policies and setting measurable targets is the critical next step.';
  return lang === 'tr'
    ? 'GRI uyumu için önemli çalışmalar gerekmektedir. Acil öncelikler: temel politikaların yazılı hale getirilmesi, sorumlu kişilerin atanması ve veri toplama altyapısının kurulması.'
    : 'Significant work is required for GRI alignment. Immediate priorities: documenting baseline policies, assigning owners, and establishing data collection infrastructure.';
}

/* ─── Score Ring SVG ─────────────────────────────────────────── */
function ScoreRing({ score, grade, size = 136 }: { score: number; grade: string; size?: number }) {
  const r = 52 * (size / 136);
  const cx = size / 2, cy = size / 2, stroke = 6;
  const circ = 2 * Math.PI * r;
  const dash  = (score / 100) * circ;
  const color = gradeColor(grade);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 1.2s ease' }} />
      <text x={cx} y={cy - 4} textAnchor="middle"
        fontFamily="'IBM Plex Sans', sans-serif" fontWeight="300" fontSize="30"
        letterSpacing="-2" fill="var(--ink)">{score}</text>
      <text x={cx} y={cy + 16} textAnchor="middle"
        fontFamily="'IBM Plex Mono', monospace" fontWeight="700" fontSize="14"
        fill={color}>{grade}</text>
    </svg>
  );
}

/* ─── Mini gauge bar ─────────────────────────────────────────── */
function MiniGauge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 13, color }}>{Math.min(Math.round(value), 100)}</span>
      </div>
      <div style={{ height: 5, background: 'var(--line)', borderRadius: 3 }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 1.2s ease' }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Combined Report Page
   ═══════════════════════════════════════════════════════════════ */
export default function CombinedReportPage() {
  const router = useRouter();
  const { lang } = useLang();
  const { user, isLoading: authLoading } = useAuth();

  const [phases,  setPhases]  = useState<(FullAttempt | null)[]>([null, null, null, null]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<'overview' | 'actions' | 'evidence' | 'index'>('overview');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const list = await attemptAPI.getMyAttempts();
        const allAttempts: ListAttempt[] = Array.isArray(list) ? list : (list?.results ?? []);
        const completed = allAttempts.filter((a) => a.is_completed);

        const phaseAttempts = await Promise.all(
          PHASE_DEFS.map(async (def) => {
            const matches = completed
              .filter((a) => a.survey_name?.includes(def.match))
              .sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime());
            if (!matches.length) return null;
            try { return await attemptAPI.getAttempt(matches[0].id); }
            catch { return null; }
          })
        );
        setPhases(phaseAttempts);
      } catch (e) {
        console.error('[combined-report] load error', e);
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ── Loading ── */
  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 36, height: 36, border: '2px solid var(--line)', borderTop: '2px solid var(--olive-deep)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>
          {lang === 'tr' ? 'GRI raporu hazırlanıyor…' : 'Preparing GRI report…'}
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const completedPhases = phases.filter(Boolean) as FullAttempt[];
  const phasesCompleted = completedPhases.length;

  /* ── Empty state ── */
  if (phasesCompleted === 0) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
        <div className="no-print"><AppNav /></div>
        <main className="wrap" style={{ padding: '80px 32px', textAlign: 'center', maxWidth: 600 }}>
          <p style={{ fontSize: 36, fontWeight: 300, letterSpacing: '-0.03em', marginBottom: 12 }}>0</p>
          <h2 style={{ fontSize: 20, fontWeight: 400, marginBottom: 10 }}>
            {lang === 'tr' ? 'Tamamlanmış değerlendirme bulunamadı' : 'No completed assessments found'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 32, lineHeight: 1.6 }}>
            {lang === 'tr'
              ? 'Birleştirilmiş GRI raporu için en az bir aşama (GRI 1, 2, 3 veya Sektör) tamamlanmalıdır.'
              : 'Complete at least one GRI phase (GRI 1, 2, 3 or Sector) to generate your consolidated report.'}
          </p>
          <Link href="/surveys" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary">
              {lang === 'tr' ? 'Değerlendirmeye Başla' : 'Start GRI Assessment'} <Icon.arrow />
            </button>
          </Link>
        </main>
      </div>
    );
  }

  /* ── Derived metrics ── */
  const combinedScore = Math.round(
    completedPhases.reduce((s, a) => s + (a.total_score ?? 0), 0) / phasesCompleted
  );
  const combinedGrade = deriveGrade(combinedScore);
  const companyName = (user as { company_name?: string; username?: string })?.company_name || user?.username || '';
  const reportDate  = new Date().toLocaleDateString(
    lang === 'tr' ? 'tr-TR' : 'en-GB',
    { day: 'numeric', month: 'long', year: 'numeric' }
  );

  /* Combined E/S/G pillars (average across phases that have them) */
  const pillarKeys = ['environmental', 'social', 'governance'] as const;
  const combinedPillars = pillarKeys.reduce((acc, k) => {
    const vals = completedPhases
      .filter((p) => p.pillar_scores?.[k] != null)
      .map((p) => p.pillar_scores![k]);
    acc[k] = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
    return acc;
  }, {} as Record<typeof pillarKeys[number], number>);

  /* All categories sorted worst → best */
  type CatWithPhase = CategoryScore & { phase: string };
  const allCategories: CatWithPhase[] = completedPhases
    .flatMap((p) => (p.category_scores ?? []).map((c) => ({ ...c, phase: p.survey_name })))
    .sort((a, b) => a.percentage - b.percentage);

  /* All recommendations sorted High → Medium → Low */
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  type RecWithPhase = Recommendation & { phase: string };
  const allRecs: RecWithPhase[] = completedPhases
    .flatMap((p) => (p.recommendations ?? []).map((r) => ({ ...r, phase: p.survey_name })))
    .sort((a, b) =>
      (priorityOrder[a.priority?.toLowerCase() ?? 'low'] ?? 2) -
      (priorityOrder[b.priority?.toLowerCase() ?? 'low'] ?? 2)
    );
  const highRecs   = allRecs.filter((r) => r.priority?.toLowerCase() === 'high');
  const mediumRecs = allRecs.filter((r) => r.priority?.toLowerCase() === 'medium');
  const lowRecs    = allRecs.filter((r) => r.priority?.toLowerCase() === 'low');

  /* All evidence (notes / documents) */
  type AnsWithPhase = AttemptAnswer & { phase: string };
  const allEvidence: AnsWithPhase[] = completedPhases
    .flatMap((p) => (p.answers ?? [])
      .filter((a) => a.notes || (a.documents?.length ?? 0) > 0)
      .map((a) => ({ ...a, phase: p.survey_name }))
    );

  const totalQsAnswered = completedPhases.reduce((s, p) => s + (p.answered_count ?? 0), 0);
  const totalQs         = completedPhases.reduce((s, p) => s + (p.total_questions ?? 0), 0);

  /* Pillar label/color helpers */
  const pillarLabel = (k: string) => ({
    environmental: { en: 'Environmental', tr: 'Çevre' },
    social:        { en: 'Social',        tr: 'Sosyal' },
    governance:    { en: 'Governance',    tr: 'Yönetişim' },
  }[k]?.[lang as 'en' | 'tr'] ?? k);

  const pillarColor = (k: string) => {
    if (k === 'environmental') return 'var(--olive-deep)';
    if (k === 'social')        return 'var(--olive)';
    return 'var(--ink-2)';
  };

  const shortPhaseName = (name: string) =>
    name.replace(/GRI \d+:\s*/, '').replace(/GRI Sector:\s*/, '').substring(0, 28);

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="no-print"><AppNav /></div>

      <main className="wrap" style={{ padding: '32px 32px 100px', maxWidth: 980 }}>

        {/* ── Toolbar ── */}
        <div className="no-print" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32,
        }}>
          <Link href="/history" style={{ textDecoration: 'none', fontSize: 11, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            ← {lang === 'tr' ? 'Geçmişe Dön' : 'Back to History'}
          </Link>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/surveys" style={{ textDecoration: 'none' }}>
              <button className="btn btn-outline btn-sm">
                {lang === 'tr' ? 'Değerlendirmeler' : 'Assessments'} <Icon.plus />
              </button>
            </Link>
            <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
              <Icon.download /> {lang === 'tr' ? 'PDF Kaydet' : 'Save as PDF'}
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            REPORT HEADER
            ══════════════════════════════════════════════════════ */}
        <div className="print-section" style={{
          borderTop: '4px solid var(--ink)', paddingTop: 28, paddingBottom: 28,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>

            {/* Left: metadata */}
            <div style={{ flex: 1, minWidth: 280 }}>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: 'var(--ink-4)',
                letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: 16,
              }}>
                {lang === 'tr' ? 'BİRLEŞTİRİLMİŞ GRI DEĞERLENDİRME RAPORU' : 'CONSOLIDATED GRI COMPETENCY REPORT'}
                {' · '}{reportDate}{' · '}SustIndex
              </span>

              <h1 style={{ fontSize: 26, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: 12 }}>
                {lang === 'tr' ? 'GRI Yetkinlik & ESG Performans Raporu' : 'GRI Competency & ESG Performance Report'}
                {companyName && (
                  <>
                    <br />
                    <em style={{ fontStyle: 'italic', color: 'var(--olive-deep)', fontWeight: 500, fontSize: 20 }}>
                      {companyName}
                    </em>
                  </>
                )}
              </h1>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 12 }}>
                <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                  <strong style={{ color: 'var(--ink)' }}>{lang === 'tr' ? 'Çerçeve:' : 'Framework:'}</strong>
                  {' '}GRI Universal Standards · SASB · TCFD
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                  <strong style={{ color: 'var(--ink)' }}>{lang === 'tr' ? 'Tamamlanan Aşama:' : 'Phases:'}</strong>
                  {' '}{phasesCompleted}/4
                </span>
                {totalQs > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                    {totalQsAnswered}/{totalQs} {lang === 'tr' ? 'soru yanıtlandı' : 'questions answered'}{' · '}
                    {Math.round((totalQsAnswered / totalQs) * 100)}%
                  </span>
                )}
              </div>

              {/* Maturity badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <span style={{
                  background: scoreColor(combinedScore), color: '#fff',
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 12px',
                }}>
                  {maturityLabel(combinedScore, lang)}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {lang === 'tr' ? 'GRI Olgunluk Seviyesi' : 'GRI Maturity Level'}
                </span>
              </div>
            </div>

            {/* Right: score ring */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <ScoreRing score={combinedScore} grade={combinedGrade} size={148} />
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)',
                letterSpacing: '0.1em', display: 'block', marginTop: 6, textTransform: 'uppercase',
              }}>
                {lang === 'tr' ? 'Birleşik Skor' : 'Combined Score'}
              </span>
            </div>
          </div>

          {/* Maturity narrative */}
          <div style={{
            marginTop: 20, padding: '16px 22px',
            background: 'var(--paper)', borderLeft: '3px solid var(--olive-deep)',
            fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7,
          }}>
            {maturityNarrative(combinedScore, lang)}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            GRI PHASE SCORECARD
            ══════════════════════════════════════════════════════ */}
        <div className="print-section" style={{ marginTop: 20, background: 'var(--paper)', border: '1px solid var(--line)' }}>
          <div style={{
            padding: '12px 24px', borderBottom: '1px solid var(--line)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {lang === 'tr' ? 'GRI Aşama Kart Skoru' : 'GRI Phase Scorecard'}
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)' }}>
              {phasesCompleted}/4 {lang === 'tr' ? 'tamamlandı' : 'complete'}
            </span>
          </div>

          {PHASE_DEFS.map((def, i) => {
            const attempt = phases[i];
            const score   = attempt ? Math.round(attempt.total_score ?? 0) : null;
            const grade   = attempt?.overall_grade ?? null;
            const color   = score != null ? scoreColor(score) : 'var(--ink-4)';
            const completedDate = attempt?.completed_at
              ? new Date(attempt.completed_at).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              : null;

            return (
              <div key={def.phase} style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 90px 52px 110px',
                gap: 16, alignItems: 'center',
                padding: '18px 24px',
                borderBottom: i < 3 ? '1px solid var(--line)' : 'none',
                opacity: attempt ? 1 : 0.42,
              }}>
                {/* Phase number circle */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: attempt ? 'var(--olive-deep)' : 'var(--line)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700,
                    color: attempt ? '#fff' : 'var(--ink-4)',
                  }}>
                    {def.phase}
                  </span>
                </div>

                {/* Name + description + bar */}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginBottom: 2 }}>
                    {lang === 'tr' ? def.labelTr : def.labelEn}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-4)', marginBottom: attempt ? 8 : 0 }}>
                    {lang === 'tr' ? def.standardsTr : def.standardsEn}
                  </div>
                  {attempt && (
                    <div style={{ height: 3, background: 'var(--line)', borderRadius: 2, maxWidth: 320 }}>
                      <div style={{
                        width: `${Math.min(score ?? 0, 100)}%`, height: '100%',
                        background: color, borderRadius: 2, transition: 'width 1.2s ease',
                      }} />
                    </div>
                  )}
                </div>

                {/* Q count + date */}
                <div style={{ textAlign: 'right' }}>
                  {attempt ? (
                    <>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-3)' }}>
                        {attempt.answered_count ?? '?'}/{attempt.total_questions ?? '?'} qs
                      </div>
                      {completedDate && (
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', marginTop: 2 }}>
                          {completedDate}
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>—</span>
                  )}
                </div>

                {/* Grade */}
                <div style={{ textAlign: 'center' }}>
                  <span style={{
                    fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: 28,
                    color: grade ? gradeColor(grade) : 'var(--ink-4)',
                    letterSpacing: '-0.02em', lineHeight: 1,
                  }}>
                    {grade ?? '—'}
                  </span>
                </div>

                {/* Score + link */}
                <div style={{ textAlign: 'right' }}>
                  {score != null ? (
                    <div>
                      <span style={{
                        fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 18,
                        color, letterSpacing: '-0.02em',
                      }}>
                        {score}%
                      </span>
                      <br />
                      <Link href={`/results/${attempt!.id}`} className="no-print" style={{ textDecoration: 'none' }}>
                        <span style={{
                          fontSize: 9.5, color: 'var(--olive-deep)',
                          fontFamily: "'IBM Plex Mono', monospace",
                          letterSpacing: '0.04em', cursor: 'pointer',
                        }}>
                          {lang === 'tr' ? 'detay →' : 'detail →'}
                        </span>
                      </Link>
                    </div>
                  ) : (
                    <span style={{
                      fontSize: 10, color: 'var(--ink-4)',
                      fontFamily: "'IBM Plex Mono', monospace",
                      border: '1px solid var(--line)', padding: '2px 8px',
                    }}>
                      {lang === 'tr' ? 'Bekliyor' : 'Pending'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════
            COMBINED ESG PILLAR SCORES
            ══════════════════════════════════════════════════════ */}
        <div className="print-section" style={{
          marginTop: 16, padding: '20px 24px',
          background: 'var(--paper)', border: '1px solid var(--line)',
        }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: 'var(--ink-4)',
            letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 18,
          }}>
            {lang === 'tr' ? 'Birleşik ESG Boyut Puanları' : 'Combined ESG Pillar Scores'}
            <span style={{ marginLeft: 10, fontWeight: 400, color: 'var(--ink-4)', fontSize: 8.5 }}>
              {lang === 'tr' ? '(tüm aşamaların ortalaması)' : '(average across completed phases)'}
            </span>
          </span>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            {pillarKeys.map((key) => (
              <MiniGauge key={key} label={pillarLabel(key)} value={combinedPillars[key]} color={pillarColor(key)} />
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            TABS
            ══════════════════════════════════════════════════════ */}
        <div role="tablist" aria-label={lang === 'tr' ? 'Rapor sekmeleri' : 'Report tabs'}
          className="no-print" style={{
            display: 'flex', gap: 0, marginTop: 30, borderBottom: '1px solid var(--line)',
          }}>
          {([
            ['overview', lang === 'tr' ? `Performans Analizi (${allCategories.length})` : `Performance Analysis (${allCategories.length})`],
            ['actions',  lang === 'tr' ? `Aksiyon Planı (${allRecs.length})` : `Action Plan (${allRecs.length})`],
            ['evidence', lang === 'tr' ? `Kanıt Kaydı (${allEvidence.length})` : `Evidence Register (${allEvidence.length})`],
            ['index',    lang === 'tr' ? 'GRI Açıklama Endeksi' : 'GRI Content Index'],
          ] as [typeof tab, string][]).map(([key, label]) => (
            <button key={key} id={`tab-${key}`} role="tab"
              aria-selected={tab === key} aria-controls={`tabpanel-${key}`}
              onClick={() => setTab(key)}
              style={{
                padding: '12px 22px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: tab === key ? '2px solid var(--ink)' : '2px solid transparent',
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontWeight: tab === key ? 600 : 400,
                fontSize: 12, color: tab === key ? 'var(--ink)' : 'var(--ink-3)',
                marginBottom: -1, transition: 'color 0.15s', letterSpacing: '0.02em',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════
            TAB: PERFORMANCE ANALYSIS
            ══════════════════════════════════════════════════════ */}
        {tab === 'overview' && (
          <div role="tabpanel" id="tabpanel-overview" aria-labelledby="tab-overview"
            className="print-section" style={{ marginTop: 24 }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
                {lang === 'tr' ? 'Tüm Aşamalarda Kategori Performansı' : 'Category Performance — All Phases'}
              </h2>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)' }}>
                {allCategories.length} {lang === 'tr' ? 'kategori · en düşük → en yüksek' : 'categories · lowest → highest'}
              </span>
            </div>

            <div style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}>
              {allCategories.map((cat, i) => {
                const pct   = Math.round(cat.percentage ?? 0);
                const color = scoreColor(pct);
                const label = scoreLabel(pct, lang);
                return (
                  <div key={`${cat.id}-${i}`} style={{
                    padding: '15px 24px',
                    borderBottom: i < allCategories.length - 1 ? '1px solid var(--line)' : 'none',
                    display: 'grid',
                    gridTemplateColumns: '1fr 130px 90px 56px 80px',
                    gap: 12, alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 7, color: 'var(--ink)' }}>
                        {cat.name}
                      </div>
                      <div style={{ height: 4, background: 'var(--line)', borderRadius: 2 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 1.2s ease' }} />
                      </div>
                    </div>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)',
                      textAlign: 'right', letterSpacing: '0.04em',
                    }}>
                      {shortPhaseName(cat.phase)}
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: 'var(--ink-3)', textAlign: 'right' }}>
                      {cat.score}/{cat.max_score} {lang === 'tr' ? 'puan' : 'pts'}
                    </span>
                    <span style={{
                      fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 17,
                      color, textAlign: 'right', letterSpacing: '-0.02em',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {pct}%
                    </span>
                    <span style={{
                      display: 'inline-block', padding: '3px 8px', textAlign: 'center',
                      fontSize: 9, fontFamily: "'IBM Plex Mono', monospace",
                      fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                      color, border: `1px solid ${color}`, borderRadius: 2,
                    }}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                ['#c1121f', lang === 'tr' ? '0–19%  Kritik'    : '0–19%  Critical'   ],
                ['#e07b39', lang === 'tr' ? '20–39% Başlangıç' : '20–39% Initial'    ],
                ['#b5835a', lang === 'tr' ? '40–59% Gelişiyor' : '40–59% Developing' ],
                ['#52796f', lang === 'tr' ? '60–79% İyi'       : '60–79% Good'       ],
                ['#2d6a4f', lang === 'tr' ? '80–100% Mükemmel' : '80–100% Excellent' ],
              ].map(([color, lbl]) => (
                <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: color as string, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>{lbl}</span>
                </div>
              ))}
            </div>

            {/* PDF CTA */}
            <div className="no-print" style={{
              marginTop: 28, padding: '20px 24px',
              background: 'var(--paper)', border: '1px solid var(--line)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24,
            }}>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>
                  {lang === 'tr' ? 'Tam raporu PDF olarak kaydet' : 'Export full consolidated report as PDF'}
                </h3>
                <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {lang === 'tr'
                    ? 'Tüm GRI aşamaları tek dosyada — yönetim kurulu ve yatırımcı sunumuna hazır.'
                    : 'All GRI phases in a single document — board-ready and investor-ready.'}
                </p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => window.print()} style={{ flexShrink: 0 }}>
                <Icon.download /> {lang === 'tr' ? 'PDF Kaydet' : 'Save as PDF'}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: ACTION PLAN
            ══════════════════════════════════════════════════════ */}
        {tab === 'actions' && (
          <div role="tabpanel" id="tabpanel-actions" aria-labelledby="tab-actions"
            className="print-section" style={{ marginTop: 24 }}>
            {allRecs.length === 0 ? (
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '56px 40px', textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  {lang === 'tr' ? 'Tebrikler — Aksiyon önerisi bulunmuyor!' : 'Excellent — No Action Items Found!'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {lang === 'tr' ? 'Tüm kategorilerde mükemmel performans.' : 'Excellent performance across all categories.'}
                </p>
              </div>
            ) : (
              <>
                {/* Priority summary */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                  {[
                    { count: highRecs.length,   label: lang === 'tr' ? 'Yüksek Öncelik' : 'High Priority',   color: '#c1121f' },
                    { count: mediumRecs.length, label: lang === 'tr' ? 'Orta Öncelik'   : 'Medium Priority',  color: '#b5835a' },
                    { count: lowRecs.length,    label: lang === 'tr' ? 'Düşük Öncelik'  : 'Low Priority',     color: '#52796f' },
                    { count: allRecs.length,    label: lang === 'tr' ? 'Toplam Aksiyon' : 'Total Actions',    color: 'var(--ink)' },
                  ].filter(({ count }) => count > 0).map(({ count, label, color }) => (
                    <div key={label} style={{
                      padding: '12px 20px', background: 'var(--paper)',
                      border: `1px solid ${color}`,
                      display: 'flex', gap: 10, alignItems: 'center',
                    }}>
                      <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: 30, color, letterSpacing: '-0.03em' }}>{count}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{label}</span>
                    </div>
                  ))}
                </div>

                {/* Rec cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {allRecs.map((r, i) => {
                    const pColor = priorityColor(r.priority);
                    const title  = r.title || r.text || r.recommendation || r.category;
                    const desc   = r.description || r.suggestion;
                    return (
                      <div key={i} style={{
                        background: 'var(--paper)', border: '1px solid var(--line)',
                        borderLeft: `4px solid ${pColor}`, padding: '18px 22px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{
                              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 700,
                              color: pColor, letterSpacing: '0.1em', textTransform: 'uppercase',
                              border: `1px solid ${pColor}`, padding: '2px 7px',
                            }}>
                              {r.priority === 'High'   ? (lang === 'tr' ? 'Yüksek' : 'High')   :
                               r.priority === 'Medium' ? (lang === 'tr' ? 'Orta'   : 'Medium') :
                                                         (lang === 'tr' ? 'Düşük'  : 'Low')}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: "'IBM Plex Mono', monospace" }}>{r.category}</span>
                            {r.gri_standard && (
                              <span style={{
                                fontSize: 9.5, color: 'var(--olive-deep)',
                                fontFamily: "'IBM Plex Mono', monospace",
                                background: 'var(--olive-wash)', padding: '2px 7px',
                              }}>
                                {r.gri_standard}
                              </span>
                            )}
                            <span style={{
                              fontSize: 9, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace",
                              background: 'var(--cream-deep)', padding: '2px 6px',
                            }}>
                              {shortPhaseName(r.phase)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                            {r.score_pct !== undefined && (
                              <span style={{ fontSize: 9.5, fontFamily: "'IBM Plex Mono', monospace", color: scoreColor(r.score_pct) }}>
                                {r.score_pct}% {lang === 'tr' ? 'mevcut' : 'current'}
                              </span>
                            )}
                            {r.effort && (
                              <span style={{
                                fontSize: 9, fontFamily: "'IBM Plex Mono', monospace",
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                color: r.effort === 'High' ? 'var(--danger)' : r.effort === 'Medium' ? 'var(--amber)' : 'var(--olive-deep)',
                                border: `1px solid ${r.effort === 'High' ? 'var(--danger)' : r.effort === 'Medium' ? 'var(--amber)' : 'var(--olive-deep)'}`,
                                padding: '1px 6px',
                              }}>
                                {r.effort === 'High'   ? (lang === 'tr' ? 'Yüksek Efor' : 'High Effort')   :
                                 r.effort === 'Medium' ? (lang === 'tr' ? 'Orta Efor'   : 'Medium Effort') :
                                                         (lang === 'tr' ? 'Düşük Efor'  : 'Low Effort')}
                              </span>
                            )}
                            {r.timeline_days && (
                              <span style={{
                                fontSize: 9, fontFamily: "'IBM Plex Mono', monospace",
                                color: 'var(--ink-4)', background: 'var(--cream-deep)', padding: '2px 7px',
                              }}>
                                {r.timeline_days}{lang === 'tr' ? ' gün' : 'd'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', marginBottom: 7, lineHeight: 1.4 }}>
                          {title}
                        </div>
                        {desc && (
                          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.65, marginBottom: r.quick_win ? 10 : 0 }}>
                            {desc}
                          </p>
                        )}
                        {r.quick_win && (
                          <div style={{
                            marginTop: 10, padding: '10px 14px',
                            background: 'var(--olive-wash)', display: 'flex', gap: 10, alignItems: 'flex-start',
                          }}>
                            <span style={{
                              fontFamily: "'IBM Plex Mono', monospace", fontSize: 8.5, color: 'var(--olive-deep)',
                              letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, flexShrink: 0, paddingTop: 1,
                            }}>
                              {lang === 'tr' ? 'Hızlı Kazanım' : 'Quick Win'}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55 }}>{r.quick_win}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Implementation Roadmap */}
                <div style={{ marginTop: 24, padding: '20px 24px', background: 'var(--paper)', border: '1px solid var(--line)' }}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: 'var(--ink-4)',
                    letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 16,
                  }}>
                    {lang === 'tr' ? 'Uygulama Yol Haritası' : 'Implementation Roadmap'}
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                    {[
                      { days: 90,  label: lang === 'tr' ? '0–90 Gün'   : '0–90 Days',  sub: lang === 'tr' ? 'Hızlı kazanımlar' : 'Quick wins'   },
                      { days: 180, label: lang === 'tr' ? '90–180 Gün' : '90–180 Days', sub: lang === 'tr' ? 'Orta vadeli'      : 'Mid-term'     },
                      { days: 365, label: lang === 'tr' ? '180–365 Gün': '180–365 Days',sub: lang === 'tr' ? 'Uzun vadeli'      : 'Long-term'    },
                    ].map(({ days, label, sub }) => {
                      const lowerBound: Record<number, number> = { 90: 0, 180: 90, 365: 180 };
                      const bucket = allRecs.filter((r) => {
                        const td = r.timeline_days ?? 90;
                        return td <= days && td > (lowerBound[days] ?? 0);
                      });
                      const accent = days === 90 ? '#c1121f' : days === 180 ? 'var(--amber)' : 'var(--olive-deep)';
                      return (
                        <div key={days} style={{ borderTop: `3px solid ${accent}`, paddingTop: 14 }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: 'var(--ink)', marginBottom: 2, fontWeight: 600 }}>
                            {label}
                          </div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', marginBottom: 10 }}>
                            {bucket.length} {lang === 'tr' ? 'aksiyon' : 'actions'} · {sub}
                          </div>
                          {bucket.slice(0, 5).map((r, j) => (
                            <div key={j} style={{
                              fontSize: 11.5, color: 'var(--ink-2)', marginBottom: 6, lineHeight: 1.4,
                              paddingLeft: 10, borderLeft: `2px solid ${priorityColor(r.priority)}`,
                            }}>
                              {r.title || r.category}
                            </div>
                          ))}
                          {bucket.length > 5 && (
                            <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace", marginTop: 4 }}>
                              +{bucket.length - 5} {lang === 'tr' ? 'daha' : 'more'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: EVIDENCE REGISTER
            ══════════════════════════════════════════════════════ */}
        {tab === 'evidence' && (
          <div role="tabpanel" id="tabpanel-evidence" aria-labelledby="tab-evidence" style={{ marginTop: 24 }}>
            {allEvidence.length === 0 ? (
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '56px 40px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 8 }}>
                  {lang === 'tr' ? 'Hiçbir aşamada not veya belge eklenmemiş.' : 'No notes or documents added across any phase.'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {lang === 'tr' ? 'Değerlendirme sırasında soru başına not ve kanıt dosyası ekleyebilirsiniz.' : 'Add per-question notes and evidence files during the assessment.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {allEvidence.map((ans, i) => (
                  <div key={ans.id} style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '18px 22px' }}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: 'var(--ink-4)',
                        letterSpacing: '0.06em', flexShrink: 0, paddingTop: 2,
                      }}>
                        Q{String(i + 1).padStart(2, '0')}
                      </span>
                      <span style={{
                        fontSize: 9, color: 'var(--olive-deep)',
                        fontFamily: "'IBM Plex Mono', monospace",
                        background: 'var(--olive-wash)', padding: '1px 7px', flexShrink: 0,
                      }}>
                        {shortPhaseName(ans.phase)}
                      </span>
                      <div className="prose" style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1, lineHeight: 1.5 }}
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(ans.question_text || '') }} />
                    </div>
                    {ans.choices_display && ans.choices_display !== 'No answer provided' && (
                      <div style={{ marginBottom: 10, paddingLeft: 26 }}>
                        <span style={{ background: 'var(--olive-wash)', padding: '3px 10px', fontSize: 12, color: 'var(--olive-deep)', fontWeight: 500 }}>
                          {ans.choices_display}
                        </span>
                      </div>
                    )}
                    {ans.notes && (
                      <div style={{
                        background: 'var(--cream-deep)', padding: '12px 16px',
                        borderLeft: '3px solid var(--olive-deep)', marginBottom: 8, marginLeft: 26,
                      }}>
                        <span style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)',
                          letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5,
                        }}>
                          {lang === 'tr' ? 'Not' : 'Note'}
                        </span>
                        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>{ans.notes}</p>
                      </div>
                    )}
                    {(ans.documents?.length ?? 0) > 0 && (
                      <div style={{ marginLeft: 26, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <span style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)',
                          letterSpacing: '0.1em', textTransform: 'uppercase',
                        }}>
                          {lang === 'tr' ? 'Belgeler' : 'Documents'} ({ans.documents!.length})
                        </span>
                        {ans.documents?.map((doc) => (
                          <a key={doc.id} href={documentDownloadUrl(doc.id)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                              background: 'var(--cream)', border: '1px solid var(--line)', transition: 'border-color 0.15s',
                            }}
                              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ink-3)')}
                              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                            >
                              <span style={{ fontSize: 16 }}>📎</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>{doc.title}</div>
                                {doc.file_size_display && (
                                  <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                                    {doc.file_size_display}
                                  </div>
                                )}
                              </div>
                              <span style={{ fontSize: 10, color: 'var(--olive-deep)' }}>
                                {lang === 'tr' ? 'İndir ↓' : 'Download ↓'}
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

        {/* ══════════════════════════════════════════════════════
            TAB: GRI CONTENT INDEX
            ══════════════════════════════════════════════════════ */}
        {tab === 'index' && (
          <div role="tabpanel" id="tabpanel-index" aria-labelledby="tab-index"
            className="print-section" style={{ marginTop: 24 }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>
                {lang === 'tr' ? 'GRI İçerik Endeksi' : 'GRI Content Index'}
              </h2>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--ink-4)' }}>
                GRI 1 · GRI 2 · GRI 3 · {lang === 'tr' ? 'Sektör' : 'Sector'}
              </span>
            </div>

            <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--paper)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
              {lang === 'tr'
                ? 'Bu tablo, kuruluşunuzun hangi GRI açıklamalarını kapsadığını gösterir. Tamamlanmış aşamalar ✓ ile işaretlenmiştir.'
                : 'This table shows which GRI disclosures are covered by your organisation\'s completed assessments. Completed phases are marked ✓.'}
            </div>

            {GRI_INDEX.map(({ section, phase, disclosures }) => {
              const attempt   = phases[phase - 1];
              const completed = !!attempt;
              return (
                <div key={`gri-${phase}`} style={{ marginBottom: 16, background: 'var(--paper)', border: '1px solid var(--line)' }}>
                  {/* Section header */}
                  <div style={{
                    padding: '13px 22px',
                    background: completed ? 'var(--olive-wash)' : 'var(--cream-deep)',
                    borderBottom: '1px solid var(--line)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: completed ? 'var(--olive-deep)' : 'var(--ink-4)' }}>
                        {section[lang as 'en' | 'tr']}
                      </span>
                      {attempt && (
                        <span style={{
                          marginLeft: 12, fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: 10, color: gradeColor(attempt.overall_grade),
                        }}>
                          {Math.round(attempt.total_score)}% · {attempt.overall_grade}
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: '0.1em',
                      textTransform: 'uppercase', padding: '3px 10px',
                      background: completed ? 'var(--olive-deep)' : 'transparent',
                      color: completed ? '#fff' : 'var(--ink-4)',
                      border: completed ? 'none' : '1px solid var(--ink-4)',
                    }}>
                      {completed
                        ? (lang === 'tr' ? '✓ Tamamlandı' : '✓ Completed')
                        : (lang === 'tr' ? 'Bekliyor' : 'Pending')}
                    </span>
                  </div>

                  {/* Disclosure rows */}
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        {[
                          lang === 'tr' ? 'Açıklama' : 'Disclosure',
                          lang === 'tr' ? 'Başlık' : 'Title',
                          lang === 'tr' ? 'Durum' : 'Status',
                          lang === 'tr' ? 'Konum' : 'Location',
                        ].map((h) => (
                          <th key={h} style={{
                            padding: '8px 16px', textAlign: 'left',
                            fontFamily: "'IBM Plex Mono', monospace", fontSize: 8.5,
                            color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase',
                            fontWeight: 600,
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {disclosures.map((d, j) => (
                        <tr key={d.code} style={{
                          borderBottom: j < disclosures.length - 1 ? '1px solid var(--line)' : 'none',
                          opacity: completed ? 1 : 0.5,
                        }}>
                          <td style={{ padding: '10px 16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--olive-deep)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {d.code}
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.4 }}>
                            {d[lang as 'en' | 'tr']}
                          </td>
                          <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5,
                              color: completed ? 'var(--olive-deep)' : 'var(--ink-4)',
                              fontWeight: completed ? 700 : 400,
                            }}>
                              {completed ? (lang === 'tr' ? '✓ Kapsandı' : '✓ Covered') : '—'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: 10, color: 'var(--ink-4)', fontFamily: "'IBM Plex Mono', monospace" }}>
                            {completed && attempt
                              ? `${lang === 'tr' ? 'Rapor' : 'Report'} REF-${String(attempt.id).padStart(4, '0')}`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}

            {/* GRI Statement of Use */}
            <div style={{ marginTop: 20, padding: '18px 22px', background: 'var(--paper)', border: '2px solid var(--olive-deep)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--olive-deep)',
                    letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700,
                  }}>
                    {lang === 'tr' ? 'GRI Kullanım Beyanı' : 'GRI Statement of Use'}
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.65, maxWidth: 620 }}>
                    {companyName
                      ? `${companyName} ${lang === 'tr'
                          ? `bu raporu GRI Standartları çerçevesini referans alarak hazırlamıştır. ${phasesCompleted}/4 aşama tamamlanmıştır.`
                          : `has prepared this report with reference to the GRI Standards framework. ${phasesCompleted}/4 phases completed.`}`
                      : lang === 'tr'
                        ? `Bu rapor GRI Standartları çerçevesini referans alarak hazırlanmıştır. ${phasesCompleted}/4 aşama tamamlanmıştır.`
                        : `This report has been prepared with reference to the GRI Standards framework. ${phasesCompleted}/4 phases completed.`}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'var(--ink-4)', marginBottom: 4 }}>
                    {lang === 'tr' ? 'Rapor Tarihi' : 'Report Date'}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{reportDate}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Final PDF CTA ── */}
        <div className="no-print" style={{
          marginTop: 40, padding: '24px 28px',
          background: 'var(--ink)', color: 'var(--cream)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 4, color: '#fff' }}>
              {lang === 'tr' ? 'Birleştirilmiş GRI Raporunuzu PDF Olarak Kaydedin' : 'Save Your Consolidated GRI Report as PDF'}
            </h3>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
              {lang === 'tr'
                ? 'Tüm GRI aşamaları, aksiyon planı ve kanıt kaydı tek belgede — yönetim kurulu ve yatırımcı sunumuna hazır.'
                : 'All GRI phases, action plan and evidence register in one document — board-ready and investor-ready.'}
            </p>
          </div>
          <button
            onClick={() => window.print()}
            style={{
              padding: '12px 28px', background: 'var(--olive-deep)', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              fontFamily: "'IBM Plex Sans', sans-serif", letterSpacing: '0.02em', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <Icon.download />
            {lang === 'tr' ? 'PDF Olarak Kaydet' : 'Save as PDF'}
          </button>
        </div>

      </main>
    </div>
  );
}
