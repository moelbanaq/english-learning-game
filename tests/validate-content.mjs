/**
 * Content validator — the safety net that lets anyone add questions confidently.
 * Run: node tests/validate-content.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..');
const CONTENT = join(ROOT, 'content');

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const readJSON = (rel) => JSON.parse(readFileSync(join(CONTENT, rel), 'utf8'));

const TYPES = new Set(['choice', 'text', 'order', 'match']);
const FORMATS = new Set(['mcq', 'fill_blank', 'choose_sentence', 'error_id', 'meaning', 'synonym',
  'collocation', 'phrasal', 'natural', 'register', 'transform', 'order', 'match', 'comprehension',
  'write', 'inference']);

const norm = (s) => String(s).toLowerCase().replace(/[.!?;,:]+$/g, '').replace(/\s+/g, ' ').trim();

const seenQuestionIds = new Set();
let totalQuestions = 0;
let totalConcepts = 0;

function validateQuestion(q, where, opts = {}) {
  totalQuestions += 1;
  if (!q.id) return err(where, 'question has no id');
  const at = `${where} [${q.id}]`;
  if (seenQuestionIds.has(q.id)) err(at, 'duplicate question id');
  seenQuestionIds.add(q.id);

  if (!TYPES.has(q.type)) err(at, `unknown type "${q.type}"`);
  if (q.format && !FORMATS.has(q.format)) warn(at, `unusual format "${q.format}"`);
  if (typeof q.difficulty !== 'number' || q.difficulty < 1 || q.difficulty > 5) err(at, 'difficulty must be 1-5');

  if (!q.explanation || !q.explanation.en) err(at, 'missing English explanation');
  else if (!q.explanation.ar) warn(at, 'missing Arabic explanation');

  if (!q.sentence && !q.prompt && !q.passageId) err(at, 'question has no sentence, prompt or passage');
  if (q.prompt && !q.prompt.en) warn(at, 'prompt has no English text');

  switch (q.type) {
    case 'choice': {
      if (!Array.isArray(q.options) || q.options.length < 2) { err(at, 'choice needs at least 2 options'); break; }
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) err(at, 'answer index out of range');
      const set = new Set(q.options.map(norm));
      if (set.size !== q.options.length) err(at, 'duplicate options');
      if (q.options.some((o) => String(o).trim() === '')) err(at, 'empty option');
      // The UI shuffles options, so nothing may refer to a position or to another option.
      const positional = /\b(all|none|both) of the (above|below)\b|\b(a|b|c|d) and (b|c|d)\b|\bthe (first|second|third|last) (option|answer)\b/i;
      if (q.options.some((o) => positional.test(String(o)))) {
        err(at, 'option refers to a position — options are displayed in a random order');
      }
      // Length is a tell. If the correct answer is visibly the longest (or shortest)
      // option, a learner can pick it without reading any English at all.
      const lenOf = (o) => String(o).length;
      const answerLen = lenOf(q.options[q.answer]);
      const otherLens = q.options.filter((_, i) => i !== q.answer).map(lenOf);
      const longestOther = Math.max(...otherLens);
      const shortestOther = Math.min(...otherLens);
      if (answerLen - longestOther >= 6 && answerLen >= longestOther * 1.2) {
        err(at, `correct answer is ${answerLen - longestOther} characters longer than every distractor `
          + '— lengthen the distractors so length is not a clue');
      }
      if (shortestOther - answerLen >= 6 && answerLen <= shortestOther * 0.8) {
        err(at, `correct answer is ${shortestOther - answerLen} characters shorter than every distractor `
          + '— even out the option lengths');
      }
      break;
    }
    case 'text': {
      const answers = [].concat(q.answer || [], q.accept || []).filter(Boolean);
      if (!answers.length) err(at, 'text question needs an answer');
      if (!q.prompt && !q.sentence) err(at, 'text question needs a prompt');
      break;
    }
    case 'order': {
      if (!Array.isArray(q.tokens) || q.tokens.length < 3) { err(at, 'order needs at least 3 tokens'); break; }
      const answers = [q.answer].concat(q.accept || []).filter(Boolean);
      if (!answers.length) { err(at, 'order needs an answer sentence'); break; }
      const tokenBag = q.tokens.map(norm).sort().join('|');
      const answerBag = norm(answers[0]).split(' ').sort().join('|');
      if (tokenBag !== answerBag) {
        err(at, `tokens do not match the answer\n    tokens: ${tokenBag}\n    answer: ${answerBag}`);
      }
      break;
    }
    case 'match': {
      if (!Array.isArray(q.pairs) || q.pairs.length < 2) { err(at, 'match needs at least 2 pairs'); break; }
      if (q.pairs.some((p) => !Array.isArray(p) || p.length !== 2)) err(at, 'each pair needs exactly 2 items');
      const rights = q.pairs.map((p) => norm(p[1]));
      if (new Set(rights).size !== rights.length) err(at, 'duplicate right-hand items make matching ambiguous');
      const lefts = q.pairs.map((p) => norm(p[0]));
      if (new Set(lefts).size !== lefts.length) err(at, 'duplicate left-hand items');
      break;
    }
    default: break;
  }

  if (opts.conceptIds && q.concept && !opts.conceptIds.has(q.concept)) {
    err(at, `concept "${q.concept}" is not declared in this unit`);
  }
  if (opts.passages && q.passageId && !opts.passages[q.passageId]) {
    err(at, `passageId "${q.passageId}" not found`);
  }
}

const curriculum = readJSON('curriculum.json');
const allConceptIds = new Set();

for (const level of curriculum.levels) {
  for (const meta of level.units) {
    const where = `${level.id}/${meta.id}`;
    if (!meta.file) { err(where, 'unit has no file'); continue; }
    if (!existsSync(join(CONTENT, meta.file))) { err(where, `missing file ${meta.file}`); continue; }

    let unit;
    try { unit = readJSON(meta.file); }
    catch (e) { err(where, `invalid JSON: ${e.message}`); continue; }

    if (unit.id !== meta.id) err(where, `unit id "${unit.id}" does not match curriculum id "${meta.id}"`);
    if (!Array.isArray(unit.concepts) || !unit.concepts.length) err(where, 'unit has no concepts');

    const conceptIds = new Set();
    for (const c of unit.concepts || []) {
      totalConcepts += 1;
      if (!c.id) { err(where, 'concept without id'); continue; }
      if (allConceptIds.has(c.id)) err(where, `duplicate concept id "${c.id}"`);
      allConceptIds.add(c.id);
      conceptIds.add(c.id);
      if (!c.title || !c.title.en) err(`${where}/${c.id}`, 'concept needs an English title');
      if (!c.title || !c.title.ar) warn(`${where}/${c.id}`, 'concept has no Arabic title');
      if (!Array.isArray(c.teach) || !c.teach.length) err(`${where}/${c.id}`, 'concept has no teaching blocks');
      for (const b of c.teach || []) {
        if (!['p', 'rule', 'tip', 'warn', 'examples', 'table'].includes(b.type)) err(`${where}/${c.id}`, `unknown teach block "${b.type}"`);
        if (b.type === 'examples' && (!Array.isArray(b.items) || !b.items.length)) err(`${where}/${c.id}`, 'empty examples block');
        if (b.type === 'table' && (!Array.isArray(b.head) || !Array.isArray(b.rows))) err(`${where}/${c.id}`, 'table needs head and rows');
      }
    }

    const declared = new Set(meta.concepts || []);
    for (const id of conceptIds) if (!declared.has(id)) err(where, `concept "${id}" missing from curriculum.json concepts list`);
    for (const id of declared) if (!conceptIds.has(id)) err(where, `curriculum lists concept "${id}" which the unit file does not define`);

    if (!Array.isArray(unit.questions) || unit.questions.length < 8) err(where, 'a unit needs at least 8 questions');
    for (const q of unit.questions || []) validateQuestion(q, where, { conceptIds, passages: unit.passages });

    if (meta.questions && meta.questions !== (unit.questions || []).length) {
      warn(where, `curriculum says ${meta.questions} questions, file has ${(unit.questions || []).length}`);
    }

    // Every concept should be practised by at least two questions.
    for (const id of conceptIds) {
      const n = (unit.questions || []).filter((q) => q.concept === id).length;
      if (n < 2) err(where, `concept "${id}" has only ${n} question(s) — needs at least 2`);
    }

    // Even without individual outliers, a unit where the answer is usually the longest
    // option is guessable. Chance is roughly 1/(number of options).
    const choices = (unit.questions || []).filter((q) => q.type === 'choice' && Array.isArray(q.options));
    if (choices.length >= 8) {
      // Only count a difference a learner could actually notice: "are" beating "is" by one
      // character is not a tell, but a whole extra clause is.
      const visiblyLongest = choices.filter((q) => {
        const a = String(q.options[q.answer]).length;
        const other = Math.max(...q.options.filter((_, i) => i !== q.answer).map((o) => String(o).length));
        return a - other >= 3 && a >= other * 1.15;
      }).length;
      const pct = Math.round((visiblyLongest / choices.length) * 100);
      if (pct > 45) warn(where, `the correct answer is visibly the longest option in ${pct}% of questions — aim for about 25%`);
    }
  }
}

// Placement test
if (!existsSync(join(CONTENT, 'placement.json'))) err('placement', 'placement.json is missing');
else {
  const placement = readJSON('placement.json');
  const levels = new Set(curriculum.levels.map((l) => l.id));
  for (const q of placement.questions || []) {
    validateQuestion(q, 'placement');
    if (!levels.has(q.level)) err(`placement [${q.id}]`, `question has no valid level (${q.level})`);
  }
  for (const lv of levels) {
    const n = (placement.questions || []).filter((q) => q.level === lv).length;
    if (n < 3) err('placement', `level ${lv} has only ${n} question(s) — needs at least 3`);
  }
}

console.log(`Checked ${totalQuestions} questions, ${totalConcepts} concepts.`);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  warnings.forEach((w) => console.log('  ! ' + w));
}
if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  errors.forEach((e) => console.error('  ✗ ' + e));
  process.exit(1);
}
console.log('✓ Content is valid.');
