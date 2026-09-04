/**
 * Progress store — the single source of truth for everything the learner owns.
 *
 * Shape is versioned and migratable. All writes go through this module so the
 * persistence target (localStorage today, an account API later) is swappable.
 */
import { createAdapter } from './storage.js';

export const SCHEMA_VERSION = 1;
const KEY = 'progress';

const adapter = createAdapter();

/** Local calendar day key, e.g. "2026-09-04". */
export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86400000);
}

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    onboarded: false,
    settings: {
      uiLang: 'en',          // 'en' | 'ar' — interface language
      explainLang: 'both',   // 'both' | 'en' | 'ar' — explanation language
      theme: 'system',       // 'system' | 'light' | 'dark'
      dailyGoal: 30,         // XP per day
      sound: false,
    },
    profile: {
      level: 'A1',           // current working CEFR level
      unlocked: ['A1'],      // levels the learner may enter
      xp: 0,
      placement: null,       // { level, score, total, at }
    },
    streak: { current: 0, best: 0, lastDay: null, days: {} }, // days: { 'YYYY-MM-DD': xp }
    daily: { day: null, learned: 0, answered: 0, reviewed: 0, tests: 0, xp: 0, claimed: false },
    units: {},      // unitId -> { started, conceptsSeen:[], practiced, testBest, testLast, attempts, completedAt }
    concepts: {},   // conceptId -> { seen, correct, wrong, strength, state, streak, reps, ease, intervalDays, dueAt, lastSeen }
    questions: {},  // questionId -> { seen, correct, wrong, lastSeen, lastOk }
    mistakes: {},   // questionId -> { qid, conceptId, unitId, level, times, lastAt, fixStreak, status }
    history: [],    // last N sessions: { at, type, unitId, level, correct, total, xp }
    achievements: {}, // id -> earnedAt
  };
}

/** ---- migrations: keyed by the version they upgrade FROM ---- */
const migrations = {
  // 0: (s) => { ...; s.version = 1; return s; },
};

function migrate(state) {
  let s = state;
  while (s.version < SCHEMA_VERSION && migrations[s.version]) {
    s = migrations[s.version](s);
  }
  // Fill in any keys added since the snapshot was written.
  const base = defaultState();
  for (const k of Object.keys(base)) {
    if (s[k] === undefined) s[k] = base[k];
    else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      s[k] = { ...base[k], ...s[k] };
    }
  }
  s.version = SCHEMA_VERSION;
  return s;
}

let state = migrate(adapter.get(KEY) || defaultState());

const listeners = new Set();
let saveTimer = null;

export function getState() { return state; }

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(reason) {
  for (const fn of listeners) {
    try { fn(state, reason); } catch (e) { console.error('store listener failed', e); }
  }
}

/** Apply a mutation function to the state, then persist + notify. */
export function update(mutator, reason = 'update') {
  const result = mutator(state);
  state.updatedAt = Date.now();
  scheduleSave();
  emit(reason);
  return result;
}

/** Persist without notifying (used by update). */
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    adapter.set(KEY, state);
  }, 120);
}

export function saveNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  adapter.set(KEY, state);
}

export function resetAll() {
  state = defaultState();
  saveNow();
  emit('reset');
}

/** ---- portable backup: the migration path to cloud accounts ---- */
export function exportState() {
  return JSON.stringify({ app: 'masar-english', exportedAt: new Date().toISOString(), state }, null, 2);
}

export function importState(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  const incoming = parsed && parsed.state ? parsed.state : parsed;
  if (!incoming || typeof incoming !== 'object' || !incoming.profile) {
    throw new Error('Not a valid Masar English backup file.');
  }
  state = migrate(incoming);
  saveNow();
  emit('import');
}

/* -------------------------------------------------------------
   Convenience accessors used across the app
   ------------------------------------------------------------- */

export function unitProgress(unitId) {
  return state.units[unitId] || null;
}

export function ensureUnit(unitId) {
  if (!state.units[unitId]) {
    state.units[unitId] = {
      started: Date.now(), conceptsSeen: [], practiced: 0,
      testBest: null, testLast: null, attempts: 0, completedAt: null,
    };
  }
  return state.units[unitId];
}

export function conceptProgress(conceptId) {
  return state.concepts[conceptId] || null;
}

export function ensureConcept(conceptId) {
  if (!state.concepts[conceptId]) {
    state.concepts[conceptId] = {
      seen: 0, correct: 0, wrong: 0, strength: 0, state: 'new',
      streak: 0, reps: 0, ease: 2.3, intervalDays: 0, dueAt: null, lastSeen: null,
    };
  }
  return state.concepts[conceptId];
}

export function questionProgress(qid) {
  return state.questions[qid] || null;
}

export function ensureQuestion(qid) {
  if (!state.questions[qid]) {
    state.questions[qid] = { seen: 0, correct: 0, wrong: 0, lastSeen: null, lastOk: null };
  }
  return state.questions[qid];
}

export function openMistakes() {
  return Object.values(state.mistakes).filter((m) => m.status === 'open');
}

export function pushHistory(entry) {
  state.history.unshift({ at: Date.now(), ...entry });
  if (state.history.length > 120) state.history.length = 120;
}

/** Roll the daily counters over when the calendar day changes. */
export function ensureToday() {
  const today = dayKey();
  if (state.daily.day !== today) {
    state.daily = { day: today, learned: 0, answered: 0, reviewed: 0, tests: 0, xp: 0, claimed: false };
  }
  return state.daily;
}
