/* Dashboard analytics model.
 *
 * Pure functions (no React, no I/O) that turn the data the app already loads —
 * GET /attempts/my_attempts/ and GET /surveys/ — into everything the dashboard
 * shows. Nothing here invents data: every figure is either copied from the API
 * or derived with the rules documented next to it. Covered by tests/dashboard-data.test.mjs.
 */

export interface CategoryScore { id: number; key?: string; name: string; percentage: number; score?: number; max_score?: number }

export interface DashAttempt {
  id: number;
  survey?: number;
  survey_name: string;
  is_completed: boolean;
  completed_at: string | null;
  total_score: number | null;
  overall_grade: string | null;
  category_scores?: CategoryScore[];
  answered_count: number;
  total_questions: number;
  started_at: string;
  cycle_name: string;
  bookmarked_count?: number;
}

export interface SurveyLite { id: number; name: string; name_en?: string; question_count?: number }

/** The five GRI assessment phases. `key` is matched against survey names (same keys the app already used). */
export const PHASES = [
  { num: 1, key: 'Strateji',    en: 'Governance',  tr: 'Yönetişim', pillar: 'governance'    },
  { num: 2, key: 'Cevre',       en: 'Environment', tr: 'Çevre',     pillar: 'environmental' },
  { num: 3, key: 'Sosyal',      en: 'Social',      tr: 'Sosyal',    pillar: 'social'        },
  { num: 4, key: 'Ekonomik',    en: 'Economic',    tr: 'Ekonomik',  pillar: null            },
  { num: 5, key: 'GRI Sector:', en: 'Sector',      tr: 'Sektör',    pillar: null            },
] as const;

export type PhaseStatus = 'completed' | 'in_progress' | 'available' | 'locked';
export type Band = 'strong' | 'developing' | 'gap';

/** Same thresholds the dashboard's category bars already used: >=60 strong, >=35 developing, else gap. */
export function bandOf(pct: number): Band {
  return pct >= 60 ? 'strong' : pct >= 35 ? 'developing' : 'gap';
}

/** 1-based phase number for a survey / attempt name, or 0 when it is not one of the five GRI phases. */
export function phaseOf(name: string | null | undefined): number {
  const n = name || '';
  const hit = PHASES.find((p) => n.includes(p.key));
  return hit ? hit.num : 0;
}

export interface ResultPoint {
  id: number;
  survey: number;           // survey id: only results of the SAME survey are comparable
  phase: number;
  t: number;               // completed_at as epoch ms
  iso: string;
  score: number;           // total_score exactly as the backend scored it (0-100)
  grade: string | null;
  cycle: string;
  name: string;
  attempt: DashAttempt;
}

export interface PhaseState {
  num: number;
  status: PhaseStatus;
  attempt: DashAttempt | null;   // the attempt that drives the card: in-progress one, else the completed one
  answered: number;
  total: number | null;          // null = not knowable (e.g. Sector before a sector survey is chosen)
  remaining: number | null;
  pct: number;                   // answered / total, 0 when unknown
  /** True when the phase WAS completed in this cycle but the API no longer scores that attempt
   *  (the same survey was completed again later). Informational only: it never changes `status`. */
  superseded: boolean;
}

export interface DashModel {
  activeCycle: string;                             // the cycle the progress figures are evaluated in
  latestCycle: string;                             // cycle of the most recent attempt (the default)
  cycles: string[];                                // every cycle the user has attempts in, most recent first
  phases: PhaseState[];
  results: ResultPoint[];                          // every scored completion, oldest first
  latest: Record<number, ResultPoint | null>;      // most recent scored completion per phase
  previous: Record<number, ResultPoint | null>;    // the one before it
  completedCount: number;                          // is_completed attempts
  inProgressCount: number;                         // started, never completed
  phasesCompleted: number;                         // phases completed in the active cycle
  completionPct: number;
  overall: { score: number; phases: number } | null;
  latestResult: ResultPoint | null;                // most recent completion overall
  answered: number;
  applicable: number;
  applicableComplete: boolean;                     // false when some phase total is unknown (Sector)
  flagged: number;
  hasResults: boolean;
}

const ts = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN);

export function isInProgress(a: DashAttempt): boolean {
  return !a.is_completed && !a.completed_at;
}

/** Every assessment cycle that has at least one attempt, most recently used first. */
export function cyclesOf(attempts: DashAttempt[]): string[] {
  const out: string[] = [];
  for (const a of attempts.slice().sort((x, y) => y.id - x.id)) {
    const c = a.cycle_name ?? '';
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

/**
 * @param cycle optional cycle to evaluate the progress figures in (the dashboard's cycle selector).
 *              Unknown / omitted => the cycle of the most recent attempt, exactly as before.
 *              Scores are NOT cycle-scoped: the API keeps a single scored result per survey, so
 *              `results`, `latest`, `previous` and `overall` are the same for every cycle.
 */
export function buildModel(attempts: DashAttempt[], surveys: SurveyLite[] = [], cycle?: string | null): DashModel {
  const byIdDesc = attempts.slice().sort((a, b) => b.id - a.id);

  // Default cycle = cycle of the most recent attempt (identical to the Surveys page).
  const cycles = cyclesOf(attempts);
  const latestCycle = byIdDesc.length ? (byIdDesc[0].cycle_name ?? '') : '';
  const activeCycle = typeof cycle === 'string' && cycles.includes(cycle) ? cycle : latestCycle;

  // Scored results = completed attempts only.
  // DATA LIMITATION: the API reports total_score = 0 for any attempt that is not currently completed
  // (an earlier completion is flagged is_completed=false once the same survey is completed again), so
  // superseded attempts are NOT scored results and are never plotted.
  const results: ResultPoint[] = attempts
    .filter((a) => a.is_completed && a.completed_at && typeof a.total_score === 'number' && phaseOf(a.survey_name) > 0 && !Number.isNaN(ts(a.completed_at)))
    .map((a) => ({
      id: a.id, survey: a.survey ?? 0, phase: phaseOf(a.survey_name), t: ts(a.completed_at), iso: a.completed_at as string,
      score: a.total_score as number, grade: a.overall_grade ?? null, cycle: a.cycle_name ?? '',
      name: a.survey_name, attempt: a,
    }))
    .sort((a, b) => a.t - b.t || a.id - b.id);

  const latest: Record<number, ResultPoint | null> = {};
  const previous: Record<number, ResultPoint | null> = {};
  for (const p of PHASES) {
    const mine = results.filter((r) => r.phase === p.num);
    const cur = mine.length ? mine[mine.length - 1] : null;
    latest[p.num] = cur;
    // "previous" must be an earlier result of the very same survey (the Sector phase spans several different surveys)
    const same = cur ? mine.filter((r) => r.survey === cur.survey && r !== cur) : [];
    previous[p.num] = same.length ? same[same.length - 1] : null;
  }

  // Phase state — same sequential unlock rule as the Surveys page, evaluated in the active cycle.
  const cycleAttempts = (num: number) =>
    byIdDesc.filter((a) => phaseOf(a.survey_name) === num && (a.cycle_name ?? '') === activeCycle);
  const phases: PhaseState[] = PHASES.map((p, idx) => {
    const recent = cycleAttempts(p.num)[0] ?? null;
    const live = recent && isInProgress(recent) ? recent : null;
    const done = recent && recent.is_completed ? recent : null;
    let status: PhaseStatus;
    if (live) status = 'in_progress';
    else if (done) status = 'completed';
    else if (idx === 0) status = 'available';
    else {
      const prevDone = attempts.some((a) => a.is_completed && phaseOf(a.survey_name) === PHASES[idx - 1].num && (a.cycle_name ?? '') === activeCycle);
      status = prevDone ? 'available' : 'locked';
    }
    const attempt = live ?? done;
    let total: number | null = null;
    if (attempt) total = attempt.total_questions;
    else if (p.num < 5) {
      const sv = surveys.find((s) => phaseOf(s.name) === p.num);
      total = sv && typeof sv.question_count === 'number' ? sv.question_count : null;
    }
    const answered = attempt ? attempt.answered_count ?? 0 : 0;
    const remaining = total === null ? null : status === 'completed' ? 0 : Math.max(total - answered, 0);
    const pct = total && total > 0 ? Math.min(100, Math.round((answered / total) * 100)) : 0;
    const superseded = !!recent && !recent.is_completed && !!recent.completed_at;
    return { num: p.num, status, attempt, answered, total, remaining, pct, superseded };
  });

  const scored = PHASES.map((p) => latest[p.num]).filter((r): r is ResultPoint => !!r);
  const overall = scored.length
    ? { score: scored.reduce((s, r) => s + r.score, 0) / scored.length, phases: scored.length }
    : null;

  const phasesCompleted = phases.filter((p) => p.status === 'completed').length;
  const known = phases.filter((p) => p.total !== null);
  const flaggedSources = new Set<number>();
  for (const p of phases) if (p.attempt) flaggedSources.add(p.attempt.id);
  const flagged = attempts.filter((a) => flaggedSources.has(a.id)).reduce((s, a) => s + (a.bookmarked_count ?? 0), 0);

  return {
    activeCycle, latestCycle, cycles, phases, results, latest, previous,
    completedCount: attempts.filter((a) => a.is_completed).length,
    inProgressCount: attempts.filter(isInProgress).length,
    phasesCompleted,
    completionPct: Math.round((phasesCompleted / PHASES.length) * 100),
    overall,
    latestResult: results.length ? results[results.length - 1] : null,
    answered: phases.reduce((s, p) => s + p.answered, 0),
    applicable: known.reduce((s, p) => s + (p.total as number), 0),
    applicableComplete: known.length === phases.length,
    flagged,
    hasResults: results.length > 0,
  };
}

/** True when at least one survey has two or more scored completions (a real trend exists). */
export function hasTrend(m: DashModel): boolean {
  const seen = new Map<number, number>();
  for (const r of m.results) seen.set(r.survey, (seen.get(r.survey) ?? 0) + 1);
  return [...seen.values()].some((n) => n >= 2);
}

export interface RankedCategory { phase: number; name: string; pct: number; band: Band; score?: number; max?: number }

/** A category is "unavailable" (not 0%) when it has no applicable points: max_score is 0, or the percentage is not a number. */
export function categoryAvailable(c: CategoryScore): boolean {
  if (typeof c.percentage !== 'number' || Number.isNaN(c.percentage)) return false;
  if (typeof c.max_score === 'number' && c.max_score <= 0) return false;
  return true;
}

/** Categories of ONE result (unavailable ones dropped). `names` optionally overrides labels with localised detail data. */
export function categoriesOf(r: ResultPoint, names?: Record<number, Record<number, string>>): RankedCategory[] {
  const out: RankedCategory[] = [];
  for (const c of r.attempt.category_scores ?? []) {
    if (!categoryAvailable(c)) continue;
    out.push({ phase: r.phase, name: names?.[r.id]?.[c.id] ?? c.name, pct: c.percentage, band: bandOf(c.percentage), score: c.score, max: c.max_score });
  }
  return out;
}

/** Categories of each phase's latest completed result, flattened. */
export function rankCategories(m: DashModel, names?: Record<number, Record<number, string>>): RankedCategory[] {
  const out: RankedCategory[] = [];
  for (const p of PHASES) {
    const r = m.latest[p.num];
    if (r) out.push(...categoriesOf(r, names));
  }
  return out;
}

export function bandCounts(cats: RankedCategory[]): Record<Band, number> {
  const c: Record<Band, number> = { strong: 0, developing: 0, gap: 0 };
  for (const x of cats) c[x.band] += 1;
  return c;
}

export const strongest = (cats: RankedCategory[], n = 3) => cats.slice().sort((a, b) => b.pct - a.pct).slice(0, n);
export const weakest   = (cats: RankedCategory[], n = 3) => cats.slice().sort((a, b) => a.pct - b.pct).slice(0, n);
