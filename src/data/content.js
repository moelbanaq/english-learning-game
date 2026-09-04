/**
 * Content access layer.
 *
 * Curriculum metadata is small and loaded once; unit files (teaching + questions)
 * are fetched lazily the first time a unit is opened, so a learner on mobile data
 * only downloads what they actually study.
 */

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const LEVEL_META = {
  A1: { name: { en: 'A1 · Beginner', ar: 'A1 · مبتدئ' } },
  A2: { name: { en: 'A2 · Elementary', ar: 'A2 · أساسي' } },
  B1: { name: { en: 'B1 · Intermediate', ar: 'B1 · متوسط' } },
  B2: { name: { en: 'B2 · Upper intermediate', ar: 'B2 · فوق المتوسط' } },
  C1: { name: { en: 'C1 · Advanced', ar: 'C1 · متقدم' } },
  C2: { name: { en: 'C2 · Proficiency', ar: 'C2 · إتقان' } },
};

const BASE = new URL('../../content/', import.meta.url);

let curriculum = null;
const unitCache = new Map();
const inflight = new Map();

async function loadJSON(relPath) {
  const url = new URL(relPath, BASE);
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${relPath} (${res.status})`);
  return res.json();
}

export async function getCurriculum() {
  if (curriculum) return curriculum;
  if (!inflight.has('curriculum')) {
    inflight.set('curriculum', loadJSON('curriculum.json').then((data) => {
      curriculum = normaliseCurriculum(data);
      inflight.delete('curriculum');
      return curriculum;
    }));
  }
  return inflight.get('curriculum');
}

function normaliseCurriculum(data) {
  const levels = data.levels.map((lv) => ({
    ...lv,
    units: (lv.units || []).map((u, i) => ({ ...u, level: lv.id, index: i + 1 })),
  }));
  const unitsById = new Map();
  levels.forEach((lv) => lv.units.forEach((u) => unitsById.set(u.id, u)));
  return { ...data, levels, unitsById };
}

export async function getLevel(levelId) {
  const c = await getCurriculum();
  return c.levels.find((l) => l.id === levelId) || null;
}

export async function getUnitMeta(unitId) {
  const c = await getCurriculum();
  return c.unitsById.get(unitId) || null;
}

/** Full unit: teaching concepts + question bank, with metadata stamped onto each question. */
export async function getUnit(unitId) {
  if (unitCache.has(unitId)) return unitCache.get(unitId);
  if (inflight.has(unitId)) return inflight.get(unitId);

  const p = (async () => {
    const meta = await getUnitMeta(unitId);
    if (!meta) throw new Error(`Unknown unit: ${unitId}`);
    const raw = await loadJSON(meta.file);
    const unit = hydrateUnit(raw, meta);
    unitCache.set(unitId, unit);
    inflight.delete(unitId);
    return unit;
  })();
  inflight.set(unitId, p);
  return p;
}

function hydrateUnit(raw, meta) {
  const unit = { ...meta, ...raw, id: meta.id, level: meta.level };
  unit.concepts = (raw.concepts || []).map((c) => ({ ...c, unit: unit.id, level: unit.level }));
  unit.questions = (raw.questions || []).map((q, i) => ({
    difficulty: 2,
    ...q,
    id: q.id || `${unit.id}-q${i + 1}`,
    unit: unit.id,
    level: unit.level,
    concept: q.concept || (unit.concepts[0] && unit.concepts[0].id) || unit.id,
    passage: q.passageId ? (raw.passages || {})[q.passageId] : undefined,
  }));
  unit.conceptById = new Map(unit.concepts.map((c) => [c.id, c]));
  return unit;
}

/** Load several units at once (review sessions span units). */
export async function getUnits(unitIds) {
  const unique = [...new Set(unitIds)];
  const loaded = await Promise.all(unique.map((id) => getUnit(id).catch(() => null)));
  return loaded.filter(Boolean);
}

/** Unit metadata for a level, straight from curriculum.json — no unit files fetched. */
export async function getLevelUnitMetas(levelId) {
  const lv = await getLevel(levelId);
  return lv ? lv.units.filter((u) => u.status !== 'planned') : [];
}

/** Every published unit of a level, fully loaded. */
export async function getLevelUnits(levelId) {
  const lv = await getLevel(levelId);
  if (!lv) return [];
  return getUnits(lv.units.filter((u) => u.status !== 'planned').map((u) => u.id));
}

export async function getPlacementTest() {
  if (unitCache.has('__placement__')) return unitCache.get('__placement__');
  const raw = await loadJSON('placement.json');
  const items = raw.questions.map((q, i) => ({
    difficulty: 2, ...q,
    id: q.id || `place-q${i + 1}`,
    unit: 'placement',
    concept: q.concept || 'placement',
  }));
  const test = { ...raw, questions: items };
  unitCache.set('__placement__', test);
  return test;
}

/** Cached lookup of a concept title from any loaded unit. */
export function findConceptTitle(conceptId) {
  for (const unit of unitCache.values()) {
    if (unit.conceptById && unit.conceptById.has(conceptId)) {
      return unit.conceptById.get(conceptId).title;
    }
  }
  return null;
}
