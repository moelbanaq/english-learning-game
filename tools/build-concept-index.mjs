/**
 * Generates content/concept-index.json: a small id → title map for every concept.
 *
 * The dashboard, stats and review screens name concepts the learner has studied, but
 * they must not download eight unit files to do it. This index is one small request
 * that covers the whole curriculum.
 *
 * Run after adding or renaming any concept:  node tools/build-concept-index.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');
const read = (rel) => JSON.parse(readFileSync(join(CONTENT, rel), 'utf8'));

export function buildIndex() {
  const curriculum = read('curriculum.json');
  const index = {};
  for (const level of curriculum.levels) {
    for (const meta of level.units) {
      if (meta.status === 'planned') continue;
      for (const concept of read(meta.file).concepts || []) {
        index[concept.id] = { en: concept.title.en, ar: concept.title.ar, unit: meta.id, level: level.id };
      }
    }
  }
  return index;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const index = buildIndex();
  writeFileSync(join(CONTENT, 'concept-index.json'), JSON.stringify(index, null, 1) + '\n');
  console.log(`Wrote concept-index.json with ${Object.keys(index).length} concepts.`);
}
