/**
 * Checks that every named import actually exists in the module it comes from.
 *
 * `node --check` parses each file alone and cannot see across modules, so importing
 * a name from the wrong file — `backLink` from app.js instead of bits.js — parses
 * cleanly and then throws the first time a learner opens that page. Views are loaded
 * lazily, so the broken one may be a page nobody visits during a test run.
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';

const files = ['sw.js'];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (extname(p) === '.js') files.push(p);
  }
})('src');

const problems = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)) {
    const spec = m[2];
    if (!spec.startsWith('.')) continue; // node: builtins and bare specifiers
    const target = resolve(dirname(file), spec);
    if (!existsSync(target)) { problems.push(`${file}: no such module ${spec}`); continue; }

    const mod = readFileSync(target, 'utf8');
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (!name) continue;
      const declared = new RegExp(`export\\s+(async\\s+)?(function|const|let|var|class)\\s+${name}\\b`).test(mod)
        || new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(mod);
      if (!declared) problems.push(`${file}: "${name}" is not exported by ${spec}`);
    }
  }
}

// Dynamic imports are used for lazy views, and a typo there fails just as silently.
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/import\('([^']+)'\)/g)) {
    if (!m[1].startsWith('.')) continue;
    if (!existsSync(resolve(dirname(file), m[1]))) problems.push(`${file}: dynamic import of missing ${m[1]}`);
  }
}

if (problems.length) {
  console.error(`\n${problems.length} broken import(s):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`✓ every import in ${files.length} files resolves.`);
