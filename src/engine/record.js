/**
 * Writes an answer / session result into the progress store.
 * This is the only place that mutates learner progress during play.
 */
import { update, ensureConcept, ensureQuestion, ensureUnit, ensureToday, pushHistory } from '../core/store.js';
import { applyAnswer } from './mastery.js';
import { xpForAnswer, touchStreak, checkAchievements } from './xp.js';
import { LEVELS } from '../data/content.js';
import { XP_PER_PROMPT } from './writing.js';

export const PASS_MARK = 75;

/**
 * Record one answered question.
 * @returns {{xp:number, wasMistake:boolean, achievements:Array}}
 */
export function recordAnswer({ question, correct, kind = 'practice' }) {
  return update((s) => {
    const now = Date.now();
    ensureToday(s);

    const q = ensureQuestion(question.id);
    q.seen += 1;
    q.lastSeen = now;
    q.lastOk = correct;
    if (correct) q.correct += 1; else q.wrong += 1;

    const c = ensureConcept(question.concept);
    applyAnswer(c, correct, question.difficulty || 2, now);

    const existing = s.mistakes[question.id];
    const wasMistake = Boolean(existing && existing.status === 'open');

    if (!correct) {
      const m = existing || {
        qid: question.id, conceptId: question.concept, unitId: question.unit,
        level: question.level, times: 0, lastAt: now, fixStreak: 0, status: 'open',
      };
      m.times += 1;
      m.lastAt = now;
      m.fixStreak = 0;
      m.status = 'open';
      s.mistakes[question.id] = m;
    } else if (existing) {
      existing.fixStreak += 1;
      existing.lastAt = now;
      // Two clean answers in a row retire the mistake — one lucky guess is not enough.
      if (existing.fixStreak >= 2) existing.status = 'fixed';
    }

    const xp = xpForAnswer({ correct, difficulty: question.difficulty, wasMistake, kind });
    s.profile.xp += xp;

    s.daily.answered += 1;
    if (kind === 'review' || wasMistake) s.daily.reviewed += 1;
    s.daily.xp += xp;
    touchStreak(s, xp);

    const achievements = checkAchievements(s);
    return { xp, wasMistake, achievements };
  }, 'answer');
}

/** Mark a teaching concept as studied. */
export function recordConceptStudied(unitId, conceptId) {
  return update((s) => {
    ensureToday(s);
    const u = ensureUnit(unitId);
    if (!u.conceptsSeen.includes(conceptId)) {
      u.conceptsSeen.push(conceptId);
      s.daily.learned += 1;
      ensureConcept(conceptId);
    }
    return u;
  }, 'study');
}

/** Save a draft as the learner types. Cheap, local, and included in the export. */
export function saveDraft(promptId, text) {
  return update((s) => {
    const w = s.writing[promptId] || { text: '', checked: [], completedAt: null };
    w.text = text;
    w.updatedAt = Date.now();
    s.writing[promptId] = w;
    return w;
  }, 'draft');
}

/**
 * Mark a writing prompt finished.
 *
 * XP is flat and paid once. It deliberately does not scale with how many checklist
 * boxes the learner ticked: the marking is self-reported, and paying more for a better
 * self-assessment would teach people to lie to themselves for points. Writing also
 * never touches concept mastery, for the same reason.
 */
export function recordWriting(promptId, checked = []) {
  return update((s) => {
    ensureToday(s);
    const w = s.writing[promptId] || { text: '', checked: [], completedAt: null };
    w.checked = checked.slice();
    w.updatedAt = Date.now();
    const first = !w.completedAt;
    if (first) {
      w.completedAt = Date.now();
      s.profile.xp += XP_PER_PROMPT;
      s.daily.xp += XP_PER_PROMPT;
      touchStreak(s, XP_PER_PROMPT);
    }
    s.writing[promptId] = w;
    return { first, xp: first ? XP_PER_PROMPT : 0, record: w };
  }, 'writing');
}

/**
 * Record the end of a session.
 * @returns {{passed:boolean, best:boolean, xp:number, unlocked:string|null, achievements:Array}}
 */
export function recordSession({ kind, unitId, level, correct, total, xp = 0, units = [] }) {
  return update((s) => {
    ensureToday(s);
    const pct = total ? Math.round((correct / total) * 100) : 0;
    let passed = false;
    let best = false;
    let unlocked = null;
    let bonus = 0;

    if (unitId) {
      const u = ensureUnit(unitId);
      if (kind === 'test') {
        u.attempts += 1;
        u.testLast = pct;
        if (u.testBest === null || pct > u.testBest) { u.testBest = pct; best = true; }
        s.daily.tests += 1;
        passed = pct >= PASS_MARK;
        if (passed) {
          bonus += 25;
          if (pct === 100) bonus += 15;
          if (!u.completedAt) { u.completedAt = Date.now(); bonus += 50; }
        }
      } else {
        u.practiced += 1;
      }
    }

    if (passed) unlocked = maybeUnlockNextLevel(s, level, units);

    s.profile.xp += bonus;
    s.daily.xp += bonus;
    if (bonus) touchStreak(s, bonus);

    pushHistory({ type: kind, unitId: unitId || null, level: level || null, correct, total, xp: xp + bonus });
    const achievements = checkAchievements(s);
    return { passed, best, pct, xp: xp + bonus, bonus, unlocked, achievements };
  }, 'session');
}

/** Unlock the next CEFR level once most of the current level's units are done. */
function maybeUnlockNextLevel(s, level, unitsOfLevel) {
  if (!level || !unitsOfLevel.length) return null;
  const idx = LEVELS.indexOf(level);
  const next = LEVELS[idx + 1];
  if (!next || s.profile.unlocked.includes(next)) return null;

  const done = unitsOfLevel.filter((u) => s.units[u.id] && s.units[u.id].completedAt).length;
  const needed = Math.max(1, Math.ceil(unitsOfLevel.length * 0.75));
  if (done < needed) return null;

  s.profile.unlocked.push(next);
  return next;
}

/** Manually switch working level (settings / placement). */
export function setLevel(level) {
  update((s) => {
    s.profile.level = level;
    if (!s.profile.unlocked.includes(level)) s.profile.unlocked.push(level);
  }, 'level');
}

export function recordPlacement({ level, score, total }) {
  update((s) => {
    s.profile.placement = { level, score, total, at: Date.now() };
    s.profile.level = level;
    const idx = LEVELS.indexOf(level);
    s.profile.unlocked = LEVELS.slice(0, Math.max(1, idx + 1));
    s.onboarded = true;
  }, 'placement');
}
