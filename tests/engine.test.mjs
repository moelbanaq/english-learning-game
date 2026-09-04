/**
 * Engine unit tests (node:test). Run: node --test tests/
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { normalize, grade, correctText, splitBlank, shuffle } from '../src/engine/grade.js';
import { applyAnswer, stateFor, isDue, needScore, masteryBreakdown } from '../src/engine/mastery.js';
import { xpForAnswer, rankFromXp, rankProgress, touchStreak, checkAchievements } from '../src/engine/xp.js';
import { pickQuestions, pickTest, weakConcepts, dueConceptIds } from '../src/engine/select.js';
import { defaultState, dayKey, daysBetween } from '../src/core/store.js';
import { parseHash } from '../src/core/router.js';

const DAY = 86400000;

function newConcept(over = {}) {
  return { seen: 0, correct: 0, wrong: 0, strength: 0, state: 'new', streak: 0, reps: 0, ease: 2.3, intervalDays: 0, dueAt: null, lastSeen: null, ...over };
}

/* ---------------- grading ---------------- */

test('normalize ignores case, spacing and final punctuation', () => {
  assert.equal(normalize('  She  IS   happy. '), 'she is happy');
  assert.equal(normalize('They’re here!'), "they're here");
});

test('choice grading compares the selected index', () => {
  const q = { type: 'choice', options: ['am', 'is', 'are'], answer: 1 };
  assert.equal(grade(q, 1).correct, true);
  assert.equal(grade(q, 0).correct, false);
  assert.equal(grade(q, null).correct, false);
  assert.equal(grade(q, 1).given, 'is');
});

test('text grading accepts alternatives and normalised input', () => {
  const q = { type: 'text', answer: "they aren't ready", accept: ['they are not ready'] };
  assert.equal(grade(q, "They aren't ready.").correct, true);
  assert.equal(grade(q, 'they are not ready').correct, true);
  assert.equal(grade(q, 'they is not ready').correct, false);
  assert.equal(grade(q, '   ').correct, false);
});

test('order grading joins tokens before comparing', () => {
  const q = { type: 'order', tokens: ['She', 'is', 'ready'], answer: 'She is ready' };
  assert.equal(grade(q, ['She', 'is', 'ready']).correct, true);
  assert.equal(grade(q, ['Is', 'she', 'ready']).correct, false);
});

test('match is only correct with zero wrong attempts', () => {
  const q = { type: 'match', pairs: [['a', '1'], ['b', '2']] };
  assert.equal(grade(q, { wrong: 0 }).correct, true);
  assert.equal(grade(q, { wrong: 2 }).correct, false);
});

test('correctText renders each question type', () => {
  assert.equal(correctText({ type: 'choice', options: ['x', 'y'], answer: 1 }), 'y');
  assert.equal(correctText({ type: 'text', answer: 'went' }), 'went');
  assert.equal(correctText({ type: 'match', pairs: [['a', '1']] }), 'a → 1');
});

test('splitBlank splits around the gap marker', () => {
  assert.deepEqual(splitBlank('She ___ happy.'), ['She ', ' happy.']);
  assert.deepEqual(splitBlank('No gap here'), ['No gap here']);
});

test('shuffle keeps every element and is deterministic for a seed', () => {
  const input = [1, 2, 3, 4, 5, 6];
  const a = shuffle(input, 42);
  const b = shuffle(input, 42);
  assert.deepEqual(a, b);
  assert.deepEqual([...a].sort(), input);
  assert.notDeepEqual(shuffle(input, 1), shuffle(input, 999));
});

/* ---------------- mastery ---------------- */

test('one correct answer does not equal mastery', () => {
  const c = newConcept();
  applyAnswer(c, true, 2);
  assert.equal(stateFor(c), 'learning');
  assert.ok(c.strength < 40);
});

test('repeated correct answers eventually reach mastered', () => {
  const c = newConcept();
  for (let i = 0; i < 12; i++) applyAnswer(c, true, 3);
  assert.equal(stateFor(c), 'mastered');
  assert.ok(c.intervalDays >= 7, 'a mastered concept should be scheduled far ahead');
});

test('a mistake drops strength sharply and makes the concept due again', () => {
  const c = newConcept();
  for (let i = 0; i < 8; i++) applyAnswer(c, true, 3);
  const before = c.strength;
  applyAnswer(c, false, 3);
  assert.ok(c.strength < before * 0.6);
  assert.equal(c.streak, 0);
  assert.ok(isDue(c), 'a wrong answer schedules the concept immediately');
});

test('harder questions raise strength faster than easy ones', () => {
  const easy = newConcept();
  const hard = newConcept();
  applyAnswer(easy, true, 1);
  applyAnswer(hard, true, 5);
  assert.ok(hard.strength > easy.strength);
});

test('needScore prioritises weak and overdue concepts', () => {
  const now = Date.now();
  const strong = newConcept({ seen: 10, correct: 10, strength: 95, streak: 6, reps: 6, dueAt: now + 20 * DAY });
  const weak = newConcept({ seen: 6, correct: 2, strength: 15, streak: 0, dueAt: now - 9 * DAY });
  assert.ok(needScore(weak, now) > needScore(strong, now));
});

test('masteryBreakdown counts every state', () => {
  const out = masteryBreakdown([newConcept({ seen: 1, strength: 10 }), newConcept()]);
  assert.equal(out.new, 1);
  assert.equal(out.learning + out.familiar + out.strong + out.mastered, 1);
});

/* ---------------- xp, streak, achievements ---------------- */

test('xp rewards correctness, difficulty and fixing mistakes', () => {
  assert.ok(xpForAnswer({ correct: true, difficulty: 5 }) > xpForAnswer({ correct: true, difficulty: 1 }));
  assert.ok(xpForAnswer({ correct: true, difficulty: 2, wasMistake: true }) > xpForAnswer({ correct: true, difficulty: 2 }));
  assert.equal(xpForAnswer({ correct: false, difficulty: 3 }), 2);
});

test('rank curve increases and reports progress inside a rank', () => {
  assert.equal(rankFromXp(0), 1);
  assert.ok(rankFromXp(1000) > rankFromXp(200));
  const p = rankProgress(75);
  assert.ok(p.pct > 0 && p.pct < 100);
});

test('streak grows on consecutive days and resets after a gap', () => {
  const s = defaultState();
  const today = dayKey();
  const yesterday = dayKey(new Date(Date.now() - DAY));

  s.streak.lastDay = yesterday;
  s.streak.current = 3;
  touchStreak(s, 10);
  assert.equal(s.streak.current, 4);
  assert.equal(s.streak.days[today], 10);

  s.streak.lastDay = dayKey(new Date(Date.now() - 5 * DAY));
  s.streak.current = 4;
  touchStreak(s, 5);
  assert.equal(s.streak.current, 1);
  assert.equal(s.streak.best, 4);
});

test('achievements unlock once and only once', () => {
  const s = defaultState();
  s.questions.q1 = { seen: 1, correct: 1, wrong: 0, lastSeen: Date.now(), lastOk: true };
  const first = checkAchievements(s);
  assert.ok(first.some((a) => a.id === 'first_answer'));
  const second = checkAchievements(s);
  assert.equal(second.length, 0);
});

/* ---------------- selection ---------------- */

const pool = [
  { id: 'q1', concept: 'c1', difficulty: 1 },
  { id: 'q2', concept: 'c1', difficulty: 2 },
  { id: 'q3', concept: 'c2', difficulty: 3 },
  { id: 'q4', concept: 'c2', difficulty: 2 },
  { id: 'q5', concept: 'c3', difficulty: 4 },
  { id: 'q6', concept: 'c3', difficulty: 1 },
];

test('pickQuestions returns the requested number without duplicates', () => {
  const s = defaultState();
  const picked = pickQuestions(pool, s, { count: 4 });
  assert.equal(picked.length, 4);
  assert.equal(new Set(picked.map((q) => q.id)).size, 4);
});

test('pickQuestions ramps difficulty upward by default', () => {
  const picked = pickQuestions(pool, defaultState(), { count: 6 });
  const diffs = picked.map((q) => q.difficulty);
  assert.deepEqual(diffs, [...diffs].sort((a, b) => a - b));
});

test('open mistakes are prioritised', () => {
  const s = defaultState();
  s.mistakes.q5 = { qid: 'q5', conceptId: 'c3', unitId: 'u', times: 3, lastAt: Date.now(), fixStreak: 0, status: 'open' };
  const picked = pickQuestions(pool, s, { count: 2 });
  assert.ok(picked.some((q) => q.id === 'q5'), 'the mistake should be selected');
});

test('a question answered minutes ago is pushed to the back', () => {
  const s = defaultState();
  s.questions.q1 = { seen: 3, correct: 3, wrong: 0, lastSeen: Date.now() - 60000, lastOk: true };
  const picked = pickQuestions(pool, s, { count: 3 });
  assert.ok(!picked.some((q) => q.id === 'q1'));
});

test('pickTest spreads questions across the concepts of a unit', () => {
  const unit = { questions: pool };
  const picked = pickTest(unit, defaultState(), 6);
  assert.equal(picked.length, 6);
  assert.equal(new Set(picked.map((q) => q.concept)).size, 3);
});

test('weakConcepts and dueConceptIds surface the right ids', () => {
  const s = defaultState();
  const now = Date.now();
  s.concepts.weak = newConcept({ seen: 6, correct: 1, wrong: 5, strength: 12, dueAt: now - DAY });
  s.concepts.solid = newConcept({ seen: 8, correct: 8, strength: 92, streak: 5, reps: 5, state: 'mastered', dueAt: now + 30 * DAY });
  const weak = weakConcepts(s, 5).map((w) => w.id);
  assert.deepEqual(weak, ['weak']);
  assert.deepEqual(dueConceptIds(s, now), ['weak']);
});

/* ---------------- store helpers & router ---------------- */

test('dayKey and daysBetween agree on calendar days', () => {
  const a = dayKey(new Date(2026, 0, 30));
  const b = dayKey(new Date(2026, 1, 2));
  assert.equal(a, '2026-01-30');
  assert.equal(daysBetween(a, b), 3);
});

test('parseHash extracts path and query', () => {
  assert.deepEqual(parseHash('#/session/practice/a1-u1?c=x'), { path: '/session/practice/a1-u1', query: { c: 'x' } });
  assert.deepEqual(parseHash(''), { path: '/', query: {} });
});

test('route patterns keep parameters in order, optional ones included', async () => {
  const { matchRoute } = await import('../src/core/router.js');
  assert.deepEqual(matchRoute('/session/:kind/:arg?', '/session/practice/a1-u1'), { kind: 'practice', arg: 'a1-u1' });
  assert.deepEqual(matchRoute('/session/:kind/:arg?', '/session/review'), { kind: 'review', arg: undefined });
  assert.deepEqual(matchRoute('/unit/:id', '/unit/a1-u2'), { id: 'a1-u2' });
  assert.equal(matchRoute('/unit/:id', '/learn'), null);
});
