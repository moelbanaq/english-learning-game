/**
 * Session builders — combine the content layer with learner progress to decide
 * exactly which questions a session contains.
 */
import { getState } from '../core/store.js';
import { getUnit, getUnits, getLevelUnits, getLevelUnitMetas, getCurriculum } from './content.js';
import { pickQuestions, pickTest, dueConceptIds, weakConcepts } from '../engine/select.js';

export const SESSION_SIZE = { practice: 10, test: 10, review: 12, daily: 12, concept: 8 };

export async function buildPractice(unitId, conceptId = null) {
  const unit = await getUnit(unitId);
  const state = getState();
  const pool = conceptId ? unit.questions.filter((q) => q.concept === conceptId) : unit.questions;
  const count = Math.min(conceptId ? SESSION_SIZE.concept : SESSION_SIZE.practice, pool.length);
  const questions = pickQuestions(pool, state, { count, favourNew: true, order: 'ramp' });
  return { kind: 'practice', unit, level: unit.level, questions, conceptId };
}

export async function buildTest(unitId) {
  const unit = await getUnit(unitId);
  const state = getState();
  const count = Math.min(SESSION_SIZE.test, unit.questions.length);
  return { kind: 'test', unit, level: unit.level, questions: pickTest(unit, state, count) };
}

/** Mistakes first, then anything due for spaced review, then weak concepts. */
export async function buildReview(limit = SESSION_SIZE.review) {
  const state = getState();
  const open = Object.values(state.mistakes).filter((m) => m.status === 'open');
  const dueIds = new Set(dueConceptIds(state));
  const weak = new Set(weakConcepts(state, 8).map((w) => w.id));

  const unitIds = new Set(open.map((m) => m.unitId).filter(Boolean));
  // Units that own due/weak concepts are found via the curriculum's concept index.
  const cur = await getCurriculum();
  for (const lv of cur.levels) {
    for (const u of lv.units) {
      if (u.status === 'planned') continue;
      const owns = (u.concepts || []).some((cid) => dueIds.has(cid) || weak.has(cid));
      if (owns) unitIds.add(u.id);
    }
  }
  const units = await getUnits([...unitIds]);
  const all = units.flatMap((u) => u.questions);
  const byId = new Map(all.map((q) => [q.id, q]));

  const questions = [];
  // 1. the exact questions the learner got wrong, worst first
  open.sort((a, b) => b.times - a.times || b.lastAt - a.lastAt);
  for (const m of open) {
    const q = byId.get(m.qid);
    if (q && !questions.includes(q)) questions.push(q);
    if (questions.length >= Math.ceil(limit * 0.6)) break;
  }
  // 2. fill the rest with due / weak concept practice (different questions, same ideas)
  const rest = all.filter((q) => !questions.includes(q) && (dueIds.has(q.concept) || weak.has(q.concept)));
  questions.push(...pickQuestions(rest, state, { count: limit - questions.length, order: 'shuffle' }));

  // 3. still short? any seen concept, spaced
  if (questions.length < limit) {
    const seen = all.filter((q) => !questions.includes(q) && state.concepts[q.concept]);
    questions.push(...pickQuestions(seen, state, { count: limit - questions.length, order: 'shuffle' }));
  }

  return { kind: 'review', unit: null, level: null, questions: questions.slice(0, limit) };
}

/** The daily mission session: part review, part current unit, part spaced recall. */
export async function buildDaily(limit = SESSION_SIZE.daily) {
  const state = getState();
  const review = await buildReview(Math.ceil(limit * 0.45));
  const questions = [...review.questions];

  const levelUnits = await getLevelUnits(state.profile.level);
  const current = pickCurrentUnit(levelUnits, state);
  if (current) {
    const fresh = pickQuestions(current.questions, state, {
      count: limit - questions.length, favourNew: true, order: 'ramp',
      excludeIds: new Set(questions.map((q) => q.id)),
    });
    questions.push(...fresh);
  }
  if (questions.length < limit) {
    const all = levelUnits.flatMap((u) => u.questions);
    questions.push(...pickQuestions(all, state, {
      count: limit - questions.length, order: 'shuffle',
      excludeIds: new Set(questions.map((q) => q.id)),
    }));
  }
  return { kind: 'daily', unit: null, level: state.profile.level, questions: questions.slice(0, limit) };
}

/** First unit that is not finished yet; otherwise the weakest finished one. */
export function pickCurrentUnit(units, state = getState()) {
  const unfinished = units.find((u) => !(state.units[u.id] && state.units[u.id].completedAt));
  if (unfinished) return unfinished;
  return units.slice().sort((a, b) => (state.units[a.id]?.testBest ?? 0) - (state.units[b.id]?.testBest ?? 0))[0] || null;
}

/**
 * What the dashboard should suggest next.
 * Deliberately uses curriculum metadata only: opening the app must not download
 * every unit file in the level just to render a recommendation.
 */
export async function nextAction(state = getState()) {
  const openMistakes = Object.values(state.mistakes).filter((m) => m.status === 'open');
  const due = dueConceptIds(state);
  const levelUnits = await getLevelUnitMetas(state.profile.level);
  const current = pickCurrentUnit(levelUnits, state);
  const up = current ? state.units[current.id] : null;

  if (openMistakes.length >= 5 || (openMistakes.length && due.length >= 3)) {
    return { type: 'review', path: '/session/review', count: openMistakes.length };
  }
  if (current && (!up || !up.conceptsSeen.length)) {
    return { type: 'learn', path: `/unit/${current.id}`, unit: current };
  }
  if (current && up && up.conceptsSeen.length < (current.concepts || []).length) {
    return { type: 'learn', path: `/unit/${current.id}`, unit: current };
  }
  if (current && up && up.practiced < 1) {
    return { type: 'practice', path: `/session/practice/${current.id}`, unit: current };
  }
  if (current && up && (up.testBest === null || up.testBest < 75)) {
    return { type: 'test', path: `/session/test/${current.id}`, unit: current };
  }
  if (openMistakes.length || due.length) {
    return { type: 'review', path: '/session/review', count: openMistakes.length || due.length };
  }
  if (current) return { type: 'practice', path: `/session/practice/${current.id}`, unit: current };
  return { type: 'daily', path: '/session/daily' };
}
