/**
 * Placement logic — pure, so it can be tested without a browser.
 *
 * The test walks up the levels in blocks. A learner who cannot handle A1 answers four
 * questions and stops; only someone heading for C2 sees the whole bank. Placing a
 * learner slightly low is recoverable — they can move up in one tap and the material
 * will feel easy. Placing them too high is where people give up, so a borderline block
 * counts as a fail.
 */
import { LEVELS } from '../data/content.js';
import { shuffle } from './grade.js';

export const BLOCK_SIZE = 4;
/** Out of BLOCK_SIZE. 3/4 passes; 2/4 is borderline and deliberately does not. */
export const BLOCK_PASS = 3;

/** Pick the questions for one level's block, newest bank order shuffled. */
export function blockFor(questions, level, seed = Date.now()) {
  const pool = questions.filter((q) => q.level === level);
  return shuffle(pool, seed).slice(0, BLOCK_SIZE)
    .sort((a, b) => (a.difficulty || 2) - (b.difficulty || 2));
}

/**
 * Decide what happens after a completed block.
 * @param {string} level the level just tested
 * @param {number} correct answers right in that block
 * @returns {{passed: boolean, next: string|null}} next is null when the test should end
 */
export function afterBlock(level, correct) {
  const passed = correct >= BLOCK_PASS;
  if (!passed) return { passed, next: null };
  const next = LEVELS[LEVELS.indexOf(level) + 1] || null;
  return { passed, next };
}

/**
 * The level to start the learner at: the first one they did not secure.
 * Passing every block means C2 — there is nothing above it to recommend.
 * @param {Array<{level: string, correct: number, asked: number}>} blocks
 */
export function recommendLevel(blocks) {
  for (const b of blocks) {
    if (b.correct < BLOCK_PASS) return b.level;
  }
  return blocks.length ? LEVELS[Math.min(LEVELS.indexOf(blocks[blocks.length - 1].level), LEVELS.length - 1)] : LEVELS[0];
}

/** Levels the learner demonstrably handled, for the result screen. */
export function securedLevels(blocks) {
  return blocks.filter((b) => b.correct >= BLOCK_PASS).map((b) => b.level);
}

/** How many questions a learner will see, worst case. Used for the progress bar. */
export function maxQuestions() {
  return LEVELS.length * BLOCK_SIZE;
}
