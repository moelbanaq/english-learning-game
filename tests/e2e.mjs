/**
 * End-to-end browser test: drives the real app in Chromium.
 * Run: node tests/e2e.mjs
 *
 * Playwright is used only as a dev tool; the app itself has no dependencies.
 */
import { createRequire } from 'node:module';
import { startServer } from './serve.mjs';

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
  try { ({ chromium } = require(candidate)); break; } catch { /* try next */ }
}
if (!chromium) {
  console.error('Playwright is not installed — skipping browser tests.');
  process.exit(0);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Answer whatever question is on screen, then press Check.
 * `wrongly` picks the last option instead of the first: options are shuffled, so this is
 * the reliable way to generate mistakes and exercise the review path.
 */
async function answerCurrent(page, wrongly = false) {
  const opt = wrongly ? page.locator('.opt:not([disabled])').last() : page.locator('.opt:not([disabled])').first();
  const field = page.locator('input.field:not([disabled])').first();
  const slot = page.locator('.answer-slot:not(.is-correct):not(.is-wrong)').first();

  if (await opt.isVisible().catch(() => false)) {
    await opt.click();
  } else if (await field.isVisible().catch(() => false)) {
    await field.fill('test answer');
  } else if (await slot.isVisible().catch(() => false)) {
    const tokens = page.locator('.tokens .token:not([disabled])');
    const n = await tokens.count();
    for (let i = 0; i < n; i++) {
      const tok = page.locator('.tokens .token:not([disabled])').first();
      if (await tok.isVisible().catch(() => false)) await tok.click();
    }
  } else if (await page.locator('.match').first().isVisible().catch(() => false)) {
    const lefts = page.locator('.match__col').nth(0).locator('.match__btn');
    const rights = page.locator('.match__col').nth(1).locator('.match__btn');
    const ln = await lefts.count();
    for (let i = 0; i < ln; i++) {
      const left = lefts.nth(i);
      if (((await left.getAttribute('class')) || '').includes('is-done')) continue;
      if (await left.isDisabled().catch(() => true)) continue;
      await left.click();
      const rn = await rights.count();
      for (let j = 0; j < rn; j++) {
        const right = rights.nth(j);
        if (((await right.getAttribute('class')) || '').includes('is-done')) continue;
        await right.click();
        await sleep(30);
        if (((await left.getAttribute('class')) || '').includes('is-done')) break;
      }
    }
    return; // matching auto-checks once every pair is placed
  }
  const checkBtn = page.locator('.runner__footer button:not(.hidden)').first();
  if (await checkBtn.isEnabled().catch(() => false)) await checkBtn.click();
}

/** Play a whole session through to the results screen. */
async function playSession(page, max = 40, wrongly = false) {
  for (let i = 0; i < max; i++) {
    if (await page.locator('.result-hero').isVisible().catch(() => false)) return true;
    if (await page.locator('.feedback').isVisible().catch(() => false)) {
      const next = page.locator('.runner__footer button:not(.hidden)').last();
      if (await next.isVisible().catch(() => false)) await next.click();
      await sleep(80);
      continue;
    }
    await answerCurrent(page, wrongly);
    await sleep(80);
  }
  return page.locator('.result-hero').isVisible();
}

const { server, port } = await startServer(0);
const base = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch();

try {
  /* ---------- 1. Mobile-first first run ---------- */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(base, { waitUntil: 'networkidle' });
  check('app boots to the welcome screen', await page.locator('.welcome').isVisible());
  check('welcome shows a level choice', (await page.locator('.pick').count()) === 6);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no horizontal overflow on a 390px screen', overflow <= 1, `overflow ${overflow}px`);

  /* ---------- 2. Choose a level and reach the path ---------- */
  await page.locator('.pick').first().click();
  await page.locator('.welcome button.btn--lg').click();
  await page.waitForSelector('.level-card');
  check('learning path lists all six CEFR levels', (await page.locator('.level-card').count()) === 6);
  check('A1 units are visible by default', (await page.locator('.unit-row').count()) >= 8);

  /* ---------- 3. Learn a concept ---------- */
  await page.locator('.unit-row').first().click();
  await page.waitForSelector('.rowcard');
  check('unit hub shows Learn / Practice / Test', (await page.locator('button.rowcard').count()) === 3);
  check('practice is locked before studying', await page.locator('button.rowcard').nth(1).isDisabled());

  await page.locator('button.rowcard').first().click();
  await page.waitForSelector('.teach');
  check('lesson shows teaching content', (await page.locator('.teach').innerText()).length > 80);
  check('lesson shows Arabic alongside English', (await page.locator('.teach [lang="ar"]').count()) > 0);

  /* ---------- 4. Practice session with real feedback ---------- */
  const dots = await page.locator('.dot').count();
  for (let i = 1; i < dots; i++) {
    await page.locator('.lesson__nav .btn--primary').click();
    await sleep(50);
  }
  await page.locator('.lesson__nav .btn--primary').click();  // → practice
  await page.waitForSelector('.runner');
  check('practice session starts', await page.locator('.qcard').isVisible());
  check('navigation is hidden during a session', await page.locator('.nav').isHidden());

  await answerCurrent(page);
  await page.waitForSelector('.feedback');
  const fb = await page.locator('.feedback').innerText();
  check('answering shows immediate feedback with an explanation', fb.length > 30);
  check('feedback includes an Arabic explanation', (await page.locator('.feedback [lang="ar"]').count()) > 0);

  const finished = await playSession(page, 40, true);
  check('session reaches the results screen', finished);
  const resultText = await page.locator('.page').innerText();
  check('results explain performance, not just a score', /%/.test(resultText) && resultText.length > 120);

  /* ---------- 5. Progress persists across a reload ---------- */
  const xpBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('masar.v1.progress')).profile.xp);
  check('XP was earned', xpBefore > 0, `xp=${xpBefore}`);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.hero', { timeout: 5000 });
  const xpAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('masar.v1.progress')).profile.xp);
  check('progress survives a reload', xpAfter === xpBefore, `${xpBefore} → ${xpAfter}`);
  check('dashboard shows a recommended next action', await page.locator('.next-card').isVisible());
  check('dashboard shows the daily mission', (await page.locator('.mission__item').count()) === 4);

  /* ---------- 6. Mistakes are saved and reviewable ---------- */
  const mistakes = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('masar.v1.progress')).mistakes).length);
  await page.goto(base + '#/review', { waitUntil: 'networkidle' });
  await sleep(400);
  const reviewText = await page.locator('.page').innerText();
  check('review page renders', reviewText.length > 20, reviewText.slice(0, 60));
  check('wrong answers are saved as mistakes', mistakes > 0, `${mistakes} saved`);
  await page.locator('a[href="#/session/review"]').first().click();
  await page.waitForSelector('.runner', { timeout: 5000 });
  check('a review session can be started', await page.locator('.qcard').isVisible());
  await page.goto(base + '#/', { waitUntil: 'networkidle' });

  /* ---------- 7. Mini test + stats ---------- */
  await page.goto(base + '#/session/test/a1-u1', { waitUntil: 'networkidle' });
  await page.waitForSelector('.runner', { timeout: 5000 });
  const tested = await playSession(page);
  check('mini test can be completed', tested);

  await page.goto(base + '#/stats', { waitUntil: 'networkidle' });
  await sleep(300);
  check('stats page shows mastery data', (await page.locator('.concept-row').count()) > 0);
  check('achievements are listed', (await page.locator('.ach').count()) > 5);

  /* ---------- 8. Arabic interface + RTL ---------- */
  await page.goto(base + '#/settings', { waitUntil: 'networkidle' });
  await sleep(200);
  await page.locator('.seg__btn', { hasText: 'العربية' }).first().click();
  await sleep(300);
  const dir = await page.evaluate(() => document.documentElement.dir);
  check('switching to Arabic sets RTL direction', dir === 'rtl', `dir=${dir}`);
  const arOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no horizontal overflow in RTL', arOverflow <= 1, `overflow ${arOverflow}px`);
  await page.locator('.seg__btn', { hasText: 'English' }).first().click();
  await sleep(200);

  /* ---------- 9. Placement test ---------- */
  await page.goto(base + '#/placement', { waitUntil: 'networkidle' });
  await page.locator('button.btn--primary').first().click();
  await page.waitForSelector('.runner');
  check('placement test produces a recommended level', await playSession(page, 60));

  /* ---------- 10. The app at full content scale ---------- */
  // These four all regressed once the curriculum grew to 48 units and were invisible
  // until the app was driven with a realistic mid-course profile.
  {
    const scale = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await scale.addInitScript(() => {
      const now = Date.now();
      const s = { version: 1, createdAt: now, updatedAt: now, onboarded: true,
        settings: { uiLang: 'en', explainLang: 'both', theme: 'system', dailyGoal: 30, sound: false },
        profile: { level: 'B2', unlocked: ['A1', 'A2', 'B1', 'B2'], xp: 4200, placement: null },
        streak: { current: 12, best: 19, lastDay: new Date().toISOString().slice(0, 10), days: {} },
        daily: { day: null, learned: 0, answered: 0, reviewed: 0, tests: 0, xp: 0, claimed: false },
        units: {}, concepts: {}, questions: {}, mistakes: {}, history: [], achievements: {} };
      // A learner with XP, units and concepts but no per-question records — the shape an
      // imported or migrated backup takes.
      s.units['b1-u1'] = { started: now, conceptsSeen: ['x'], practiced: 2, testBest: 82,
        testLast: 82, attempts: 1, completedAt: now };
      s.concepts['a1.be.affirmative'] = { seen: 6, correct: 3, wrong: 3, strength: 40,
        state: 'familiar', streak: 1, reps: 2, ease: 2.3, intervalDays: 2, dueAt: now - 86400000, lastSeen: now };
      s.history.push({ at: now, type: 'test', unitId: 'b1-u1', level: 'B1', correct: 8, total: 10, xp: 95 });
      localStorage.setItem('masar.v1.progress', JSON.stringify(s));
    });
    const sp = await scale.newPage();

    await sp.goto(base + '#/learn', { waitUntil: 'networkidle' });
    await sleep(700);
    const openUnits = await sp.locator('.unit-row:visible').count();
    check('the learning path opens one level, not all six', openUnits > 0 && openUnits <= 10,
      `${openUnits} unit rows visible`);

    const runTogether = await sp.evaluate(() => {
      const row = document.querySelector('.unit-row__body');
      if (!row) return 'no row';
      const title = row.querySelector('.unit-row__title');
      const meta = row.querySelector('.unit-row__meta');
      return title && meta ? (title.getBoundingClientRect().bottom <= meta.getBoundingClientRect().top + 1) : 'missing';
    });
    check('unit title and question count are on separate lines', runTogether === true, String(runTogether));

    await sp.goto(base + '#/', { waitUntil: 'networkidle' });
    await sleep(800);
    const weakNames = await sp.locator('.rowcard__title').allInnerTexts();
    check('concept names are titles, not raw ids', !weakNames.some((n) => /^[a-c][12]\.[a-z]/.test(n.trim())),
      weakNames.slice(0, 2).join(' | '));

    await sp.goto(base + '#/stats', { waitUntil: 'networkidle' });
    await sleep(800);
    const statsBody = await sp.locator('.page').innerText();
    check('stats show progress for a learner with XP but no question records',
      !statsBody.includes('Answer a few questions'), statsBody.slice(0, 60));
    await scale.close();
  }

  /* ---------- 11. Shuffled options still grade correctly ---------- */
  // Authors naturally put the correct answer first, so the UI shuffles options. This
  // proves the shuffle does not break the mapping back to the content file, and that
  // the correct answer really does move around.
  {
    const norm = (x) => String(x).replace(/\s+/g, ' ').trim().toLowerCase();
    const keyOf = (stem, opts) => norm(stem || '') + ' || ' + opts.map(norm).sort().join('|');
    const truth = new Map();
    for (const f of ['levels/a1/u1-be.json', 'levels/a2/u7-word-partners.json']) {
      const unit = await (await fetch(base + 'content/' + f)).json();
      for (const q of unit.questions) {
        if (q.type !== 'choice') continue;
        truth.set(keyOf(q.sentence || (q.prompt && q.prompt.en) || '', q.options), norm(q.options[q.answer]));
      }
    }

    const positions = new Set();
    const wrong = [];
    let seen = 0;
    for (const unitId of ['a1-u1', 'a2-u7']) {
      for (let run = 0; run < 2; run++) {
        const c = await browser.newContext();
        const p2 = await c.newPage();
        await p2.goto(base + `#/session/practice/${unitId}`, { waitUntil: 'networkidle' });
        await p2.waitForSelector('.runner');
        for (let i = 0; i < 12; i++) {
          if (await p2.locator('.result-hero').isVisible().catch(() => false)) break;
          if (await p2.locator('.opt').count() === 0) break;
          const shown = (await p2.locator('.opt .opt__text').allInnerTexts()).map(norm);
          const stem = (await p2.locator('.sentence').innerText().catch(() => ''))
            || (await p2.locator('.qcard__prompt').first().innerText().catch(() => ''));
          await p2.locator('.opt').last().click();
          await p2.locator('.runner__footer button:not(.hidden)').first().click();
          await p2.waitForSelector('.feedback');
          const marked = norm(await p2.locator('.opt.is-correct .opt__text').innerText());
          positions.add(await p2.locator('.opt.is-correct').evaluate((n) => [...n.parentElement.children].indexOf(n)));
          // The rendered gap shows "?" where the content file has "___".
          const expect = truth.get(keyOf(stem.replace('?', '___'), shown)) || truth.get(keyOf(stem, shown));
          if (expect) { seen++; if (expect !== marked) wrong.push(`${stem}: marked "${marked}", content says "${expect}"`); }
          await p2.locator('.runner__footer button:not(.hidden)').last().click();
          await sleep(70);
        }
        await c.close();
      }
    }
    check('shuffled options still grade against the content file', seen > 15 && wrong.length === 0,
      wrong.slice(0, 2).join(' | ') || `only ${seen} questions compared`);
    check('the correct answer is not always in the same position', positions.size >= 3,
      `appeared in ${positions.size} distinct positions`);
  }

  /* ---------- 12. Desktop layout ---------- */
  const wide = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const desk = await wide.newPage();
  await desk.goto(base, { waitUntil: 'networkidle' });
  const navBottom = await desk.evaluate(() => {
    const nav = document.querySelector('.nav');
    return nav ? getComputedStyle(nav).position : 'none';
  });
  check('navigation moves out of the way on desktop', navBottom !== 'fixed', `position=${navBottom}`);
  await wide.close();

  check('no uncaught JavaScript errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed.`);
process.exit(failed.length ? 1 : 0);
