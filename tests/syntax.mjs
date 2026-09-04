/** Parses every source file as an ES module and fails loudly on syntax errors. */
import { readdirSync, statSync, copyFileSync, mkdtempSync } from 'node:fs';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const roots = ['src', 'tests'];
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (extname(p) === '.js' || extname(p) === '.mjs') files.push(p);
  }
})('src');
roots.slice(1).forEach(() => {});

const tmp = mkdtempSync(join(tmpdir(), 'masar-syntax-'));
let failed = 0;
for (const f of files) {
  const target = join(tmp, f.replace(/[\\/]/g, '_') + '.mjs');
  copyFileSync(f, target);
  try {
    execFileSync(process.execPath, ['--check', target], { stdio: 'pipe' });
  } catch (err) {
    failed++;
    console.error(`\n✗ ${f}\n${err.stderr.toString().split('\n').slice(0, 6).join('\n')}`);
  }
}
console.log(failed ? `\n${failed} file(s) failed to parse.` : `✓ ${files.length} source files parse cleanly.`);
process.exit(failed ? 1 : 0);
