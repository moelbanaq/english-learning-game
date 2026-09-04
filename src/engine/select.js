/**
 * Adaptive question selection.
 *
 * Every question gets a score built from: how much its concept needs work,
 * how fresh the question itself is for this learner, whether it is an open
 * mistake, and how well its difficulty fits the learner's current strength.
 * The top-scoring questions are then spread across concepts so a session never
 * hammers one idea, and ordered from easier to harder.
 */
import { needScore, stateFor } from './mastery.js';
import { shuffle } from './grade.js';

const DAY = 86400000;

function qRecord(state, id) {
  return state.questions[id] || { seen: 0, correct: 0, wrong: 0, lastSeen: null, lastOk: null };
}
function cRecord(state, id) {
  return state.concepts[id] || null;
}

/** How well a question's difficulty fits the learner's strength on its concept. */
function difficultyFit(question, concept) {
  const strength = concept ? concept.strength : 0;
  const target = 1 + (strength / 100) * 3.2;            // 1.0 (new) .. 4.2 (strong)
  const gap = Math.abs((question.difficulty || 2) - target);
  return Math.max(0, 1 - gap / 3);
}

/** Penalise questions the learner saw very recently or already answers reliably. */
function freshness(rec, now) {
  if (!rec.seen) return 1;
  const ageDays = rec.lastSeen ? (now - rec.lastSeen) / DAY : 30;
  const recency = Math.min(1, ageDays / 10);            // 0 (just now) .. 1 (10+ days)
  const reliability = rec.seen ? rec.correct / rec.seen : 0;
  return Math.max(0.05, recency * (1 - reliability * 0.55));
}

export function scoreQuestion(question, state, now = Date.now(), opts = {}) {
  const rec = qRecord(state, question.id);
  const con = cRecord(state, question.concept);
  const mistake = state.mistakes[question.id];

  let score = 0;
  score += needScore(con, now) * 3.0;
  score += freshness(rec, now) * 2.0;
  score += difficultyFit(question, con) * 1.2;
  if (mistake && mistake.status === 'open') score += 2.6 + Math.min(mistake.times, 4) * 0.25;
  if (!rec.seen) score += opts.favourNew ? 1.2 : 0.5;
  if (rec.lastSeen && now - rec.lastSeen < 20 * 60000) score -= 3.5;   // seen in the last 20 minutes
  if (opts.excludeIds && opts.excludeIds.has(question.id)) score -= 100;
  return score;
}

/**
 * Pick `count` questions from a pool, spreading them across concepts.
 * @param {Array} pool questions
 * @param {object} state progress state
 * @param {object} opts { count, now, favourNew, maxPerConcept, seed, order }
 */
export function pickQuestions(pool, state, opts = {}) {
  const {
    count = 10, now = Date.now(), favourNew = false,
    maxPerConcept = Math.max(2, Math.ceil(count / 3)),
    seed = now, order = 'ramp',
  } = opts;
  if (!pool.length) return [];

  const scored = pool
    .map((q) => ({ q, s: scoreQuestion(q, state, now, opts) + Math.random() * 0.35 }))
    .sort((a, b) => b.s - a.s);

  const chosen = [];
  const perConcept = new Map();
  // First pass respects the per-concept cap; second pass fills any shortfall.
  for (const { q } of scored) {
    if (chosen.length >= count) break;
    const used = perConcept.get(q.concept) || 0;
    if (used >= maxPerConcept) continue;
    perConcept.set(q.concept, used + 1);
    chosen.push(q);
  }
  if (chosen.length < count) {
    for (const { q } of scored) {
      if (chosen.length >= count) break;
      if (!chosen.includes(q)) chosen.push(q);
    }
  }

  if (order === 'ramp') {
    // Gentle difficulty ramp keeps early questions winnable and builds momentum.
    return chosen.sort((a, b) => (a.difficulty || 2) - (b.difficulty || 2));
  }
  if (order === 'shuffle') return shuffle(chosen, seed);
  return chosen;
}

/** Even coverage of every concept in a unit — used for mini tests. */
export function pickTest(unit, state, count = 10, now = Date.now()) {
  const byConcept = new Map();
  for (const q of unit.questions) {
    if (!byConcept.has(q.concept)) byConcept.set(q.concept, []);
    byConcept.get(q.concept).push(q);
  }
  const concepts = [...byConcept.keys()];
  const out = [];
  let round = 0;
  while (out.length < count && round < 8) {
    for (const cid of concepts) {
      if (out.length >= count) break;
      const list = byConcept.get(cid).filter((q) => !out.includes(q));
      if (!list.length) continue;
      // Prefer questions that actually discriminate: unseen or previously wrong.
      list.sort((a, b) => scoreQuestion(b, state, now) - scoreQuestion(a, state, now));
      const bucket = list.slice(0, Math.min(4, list.length));
      out.push(bucket[Math.floor(Math.random() * bucket.length)]);
    }
    round += 1;
  }
  return shuffle(out, now).slice(0, count);
}

/** Concepts the learner is weakest at, strongest need first. */
export function weakConcepts(state, limit = 5) {
  const now = Date.now();
  return Object.entries(state.concepts)
    .filter(([, c]) => c.seen >= 2 && stateFor(c) !== 'mastered')
    .map(([id, c]) => ({ id, c, need: needScore(c, now), accuracy: c.seen ? c.correct / c.seen : 0 }))
    .filter((x) => x.c.strength < 62 || x.accuracy < 0.7)
    .sort((a, b) => b.need - a.need)
    .slice(0, limit);
}

/** Concept ids that are due for spaced review right now. */
export function dueConceptIds(state, now = Date.now()) {
  return Object.entries(state.concepts)
    .filter(([, c]) => c.seen > 0 && c.dueAt !== null && c.dueAt <= now)
    .sort((a, b) => a[1].dueAt - b[1].dueAt)
    .map(([id]) => id);
}
