/**
 * Mastery + lightweight spaced repetition.
 *
 * A concept is not "known" because it was answered right once. Each concept
 * carries a strength score (0-100) that rises with correct answers (bigger
 * jumps on harder questions), falls sharply on mistakes, and is combined with
 * repetition count and a recent streak to produce a mastery state.
 */

export const STATES = ['new', 'learning', 'familiar', 'strong', 'mastered'];

export const STATE_LABEL = {
  new: { en: 'New', ar: 'جديد' },
  learning: { en: 'Learning', ar: 'قيد التعلّم' },
  familiar: { en: 'Familiar', ar: 'مألوف' },
  strong: { en: 'Strong', ar: 'قوي' },
  mastered: { en: 'Mastered', ar: 'مُتقَن' },
};

/** Review intervals in days, indexed by successful repetition count. */
const INTERVALS = [1, 2, 4, 9, 21, 45, 90];

const DAY = 86400000;

export function stateFor(c) {
  if (!c || !c.seen) return 'new';
  if (c.strength >= 85 && c.reps >= 4 && c.streak >= 3) return 'mastered';
  if (c.strength >= 62) return 'strong';
  if (c.strength >= 38) return 'familiar';
  return 'learning';
}

/**
 * Update a concept record in place after one answer.
 * @param {object} c concept progress record (mutated)
 * @param {boolean} correct
 * @param {number} difficulty 1..5
 * @param {number} now epoch ms
 */
export function applyAnswer(c, correct, difficulty = 2, now = Date.now()) {
  c.seen += 1;
  c.lastSeen = now;

  if (correct) {
    c.correct += 1;
    c.streak += 1;
    c.reps += 1;
    // Harder questions prove more: gain scales with difficulty.
    const gain = 0.18 + Math.min(difficulty, 5) * 0.035;   // 0.215 .. 0.355
    c.strength = c.strength + (100 - c.strength) * gain;
    c.ease = Math.min(2.8, c.ease + 0.05);
  } else {
    c.wrong += 1;
    c.streak = 0;
    c.reps = Math.max(0, c.reps - 1);
    c.strength = Math.max(0, c.strength * 0.55 - 6);
    c.ease = Math.max(1.5, c.ease - 0.2);
  }

  c.state = stateFor(c);
  scheduleNext(c, correct, now);
  return c;
}

/** Decide when this concept should come back. */
export function scheduleNext(c, correct, now = Date.now()) {
  if (!correct) {
    c.intervalDays = 0;
    c.dueAt = now;               // eligible again immediately (same/next session)
    return c;
  }
  const base = INTERVALS[Math.min(c.reps, INTERVALS.length - 1)];
  const days = Math.max(1, Math.round(base * (c.ease / 2.3)));
  c.intervalDays = days;
  c.dueAt = now + days * DAY;
  return c;
}

export function isDue(c, now = Date.now()) {
  if (!c || !c.seen) return false;
  if (c.state === 'mastered' && c.intervalDays >= 45) return c.dueAt <= now;
  return c.dueAt === null || c.dueAt <= now;
}

/** 0..1 — how much this concept needs work right now (used for weighting). */
export function needScore(c, now = Date.now()) {
  if (!c || !c.seen) return 0.75;                       // new material matters, but reviews matter more
  const weakness = 1 - c.strength / 100;                 // 0 (strong) .. 1 (weak)
  const overdueDays = c.dueAt ? Math.max(0, (now - c.dueAt) / DAY) : 0;
  const urgency = Math.min(1, overdueDays / 7);
  return Math.min(1, weakness * 0.65 + urgency * 0.35 + (c.streak === 0 ? 0.12 : 0));
}

/** Aggregate a set of concept records into counts per mastery state. */
export function masteryBreakdown(concepts) {
  const out = { new: 0, learning: 0, familiar: 0, strong: 0, mastered: 0 };
  // Always recompute: a stored `state` can lag behind an imported or migrated record.
  for (const c of concepts) out[stateFor(c)] += 1;
  return out;
}
