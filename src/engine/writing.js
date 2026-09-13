/**
 * Writing practice — pure logic for prompts the learner marks themselves.
 *
 * There is no grader here and there deliberately never will be one: automatic marking
 * of free writing needs a model, and this app must work with no API, no key and no
 * account. A checklist written by the person who wrote the exercise is the honest
 * offline substitute — it tells the learner what to look for, which is most of what
 * feedback does anyway.
 *
 * Because the score is self-reported, writing never touches concept mastery. It earns
 * a flat XP award for finishing, and ticking more boxes earns nothing extra: paying for
 * self-flattery would corrupt both the XP and the learner's own judgement.
 */

/** Flat award for completing a prompt, once. */
export const XP_PER_PROMPT = 20;

/** Words, counted the way a learner would count them. */
export function wordCount(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Long enough to be worth checking against the list. */
export function meetsLength(text, minWords = 0) {
  return wordCount(text) >= minWords;
}

/**
 * Where the learner is with one prompt.
 * @param {{text?: string, checked?: string[], completedAt?: number}|undefined} record
 * @returns {'new'|'draft'|'done'}
 */
export function promptState(record) {
  if (!record) return 'new';
  if (record.completedAt) return 'done';
  return wordCount(record.text) > 0 ? 'draft' : 'new';
}

/** How many boxes the learner ticked, as a fraction of the list. */
export function selfScore(checked = [], checklist = []) {
  if (!checklist.length) return 0;
  const ids = new Set(checked);
  const hit = checklist.filter((_, i) => ids.has(String(i))).length;
  return Math.round((hit / checklist.length) * 100);
}

/** Progress across a unit's prompts, for the unit hub row. */
export function unitWritingProgress(prompts = [], writing = {}) {
  const done = prompts.filter((p) => promptState(writing[p.id]) === 'done').length;
  return { done, total: prompts.length };
}
