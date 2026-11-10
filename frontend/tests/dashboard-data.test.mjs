// Calculations behind the dashboard analytics. Inputs below are test fixtures only;
// the app itself never fabricates data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModel, hasTrend, bandOf, phaseOf, rankCategories, categoriesOf, categoryAvailable, bandCounts, strongest, weakest } from '../lib/dashboard-data.ts';

let id = 0;
const surveyIds = new Map();                      // same survey name => same survey id (like the real data)
const sid = (name) => { if (!surveyIds.has(name)) surveyIds.set(name, 100 + surveyIds.size); return surveyIds.get(name); };
const att = (name, o = {}) => ({
  id: ++id, survey: sid(name), survey_name: name, is_completed: false, completed_at: null, total_score: 0, overall_grade: null,
  answered_count: 0, total_questions: 10, started_at: '2026-01-01T00:00:00Z', cycle_name: 'Q1', category_scores: [], ...o,
});
const done = (name, score, day, o = {}) =>
  att(name, { is_completed: true, completed_at: `2026-0${day[0]}-${day[1]}T10:00:00Z`, total_score: score, overall_grade: 'A', answered_count: 10, ...o });

const GOV = 'Bölüm 1: Yönetişim ve Strateji', ENV = 'Bolum 2: Cevre Performansi', SOC = 'Bolum 3: Sosyal Performans', ECO = 'Bolum 4: Ekonomik Performans';

test('phase names map to the five GRI phases', () => {
  assert.deepEqual([GOV, ENV, SOC, ECO, 'GRI Sector: Retail & Trade', 'Other'].map(phaseOf), [1, 2, 3, 4, 5, 0]);
});

test('bands use the thresholds the dashboard already used (60 / 35)', () => {
  assert.deepEqual([100, 60, 59.9, 35, 34.9, 0].map(bandOf), ['strong', 'strong', 'developing', 'developing', 'gap', 'gap']);
});

test('overall score is the plain mean of each phase\'s latest completed score', () => {
  const m = buildModel([done(GOV, 80, ['1', '10']), done(ENV, 60, ['1', '11']), att(SOC)]);
  assert.equal(m.overall.score, 70);
  assert.equal(m.overall.phases, 2);
  assert.equal(m.completedCount, 2);
  assert.equal(m.inProgressCount, 1);
});

test('phases unlock sequentially inside the active cycle (Surveys-page rule)', () => {
  const m = buildModel([done(GOV, 80, ['1', '10']), att(ENV, { answered_count: 4, total_questions: 10 })]);
  assert.deepEqual(m.phases.map((p) => p.status), ['completed', 'in_progress', 'locked', 'locked', 'locked']);
  const m2 = buildModel([done(GOV, 80, ['1', '10'])]);
  assert.deepEqual(m2.phases.map((p) => p.status), ['completed', 'available', 'locked', 'locked', 'locked']);
  assert.equal(m2.completionPct, 20);
});

test('completing a phase in another cycle does not unlock the next phase in the active cycle', () => {
  const old = done(GOV, 90, ['1', '10'], { cycle_name: 'Old' });
  const fresh = att(GOV, { cycle_name: 'New' });          // newest attempt => active cycle "New"
  const m = buildModel([old, fresh]);
  assert.equal(m.activeCycle, 'New');
  assert.deepEqual(m.phases.map((p) => p.status), ['in_progress', 'locked', 'locked', 'locked', 'locked']);
  assert.equal(m.latest[1].score, 90);                    // but the earlier real result is still the phase's latest score
});

test('a superseded attempt is neither "in progress" nor a scored result (the API reports its score as 0)', () => {
  const first = att(GOV, { is_completed: false, completed_at: '2026-01-10T10:00:00Z', total_score: 0 });   // superseded
  const second = done(GOV, 70, ['2', '10']);
  const m = buildModel([first, second]);
  assert.equal(m.inProgressCount, 0);
  assert.equal(m.completedCount, 1);
  assert.equal(m.results.length, 1);
  assert.equal(m.latest[1].score, 70);
  assert.equal(m.previous[1], null);
  assert.equal(hasTrend(m), false);
});

test('previous result and trend exist only for two completed results of the SAME survey', () => {
  const a = done(GOV, 50, ['1', '10'], { survey: 18 });
  const b = done(GOV, 70, ['2', '10'], { survey: 18 });
  const m = buildModel([a, b]);
  assert.equal(m.latest[1].score, 70);
  assert.equal(m.previous[1].score, 50);
  assert.equal(hasTrend(m), true);
});

test('different sector surveys share phase 5 but are never compared with each other', () => {
  const retail = done('GRI Sector: Retail & Trade', 40, ['1', '10'], { survey: 29 });
  const energy = done('GRI Sector: Energy & Utilities', 90, ['2', '10'], { survey: 26 });
  const m = buildModel([retail, energy]);
  assert.equal(m.latest[5].score, 90);
  assert.equal(m.previous[5], null);
  assert.equal(hasTrend(m), false);
});

test('no trend and no previous result when every phase has a single completion', () => {
  const m = buildModel([done(GOV, 80, ['1', '10']), done(ENV, 60, ['1', '11'])]);
  assert.equal(hasTrend(m), false);
  assert.equal(m.previous[1], null);
});

test('questions: answered / applicable use attempt totals, then survey counts; Sector stays unknown', () => {
  const surveys = [
    { id: 1, name: GOV, question_count: 20 }, { id: 2, name: ENV, question_count: 30 }, { id: 3, name: SOC, question_count: 40 },
    { id: 4, name: ECO, question_count: 50 }, { id: 5, name: 'GRI Sector: A', question_count: 12 }, { id: 6, name: 'GRI Sector: B', question_count: 13 },
  ];
  const m = buildModel([done(GOV, 80, ['1', '10'], { answered_count: 18, total_questions: 20 }), att(ENV, { answered_count: 5, total_questions: 30 })], surveys);
  assert.equal(m.answered, 23);
  assert.equal(m.applicable, 20 + 30 + 40 + 50);          // Sector excluded: several sector surveys, none chosen
  assert.equal(m.applicableComplete, false);
  assert.deepEqual(m.phases.map((p) => p.remaining), [0, 25, 40, 50, null]);
});

test('empty account: no results, no overall score', () => {
  const m = buildModel([]);
  assert.equal(m.hasResults, false);
  assert.equal(m.overall, null);
  assert.equal(m.phases[0].status, 'available');
});

test('category ranking uses each phase\'s latest result only', () => {
  const cats = (a, b) => [{ id: 1, name: 'E1', percentage: a }, { id: 2, name: 'E2', percentage: b }];
  const old = att(GOV, { completed_at: '2026-01-05T10:00:00Z', total_score: 10, category_scores: cats(5, 5) });   // superseded
  const cur = done(GOV, 70, ['2', '10'], { category_scores: cats(90, 20) });
  const m = buildModel([old, cur]);
  const r = rankCategories(m, { [cur.id]: { 1: 'Alpha' } });
  assert.deepEqual(r.map((c) => [c.name, c.pct, c.band]), [['Alpha', 90, 'strong'], ['E2', 20, 'gap']]);
  assert.deepEqual(bandCounts(r), { strong: 1, developing: 0, gap: 1 });
  assert.equal(strongest(r, 1)[0].pct, 90);
  assert.equal(weakest(r, 1)[0].pct, 20);
});

test('categories without applicable points are unavailable, never shown as 0%', () => {
  assert.equal(categoryAvailable({ id: 1, name: 'x', percentage: 0, score: 0, max_score: 0 }), false);
  assert.equal(categoryAvailable({ id: 1, name: 'x', percentage: 0, score: 0, max_score: 4 }), true);   // a real 0%
  assert.equal(categoryAvailable({ id: 1, name: 'x', percentage: NaN, max_score: 4 }), false);
  const a = done(GOV, 70, ['2', '10'], { category_scores: [
    { id: 1, name: 'Real zero', percentage: 0, score: 0, max_score: 4 },
    { id: 2, name: 'No points', percentage: 0, score: 0, max_score: 0 },
    { id: 3, name: 'Good', percentage: 80, score: 8, max_score: 10 },
  ] });
  const m = buildModel([a]);
  assert.deepEqual(rankCategories(m).map((c) => c.name), ['Real zero', 'Good']);
  assert.deepEqual(categoriesOf(m.latest[1]).map((c) => c.pct), [0, 80]);
});
