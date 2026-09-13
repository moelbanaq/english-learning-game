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
/**
 * Drive the placement test deliberately, rather than by clicking the first option:
 * the runner shuffles options, so "right" and "wrong" have to be looked up in the
 * bank. Questions are identified by their option set, which is unique per question.
 */
async function playPlacement(page, questions, correctly, max) {
  const key = (opts) => opts.map((o) => String(o).trim()).sort().join('\u0000');
  const byOptions = new Map(questions.filter((q) => q.options).map((q) => [key(q.options), q]));
  let answered = 0;
  let steps = 0;

  for (let i = 0; i < max; i++) {
    if (await page.locator('.result-hero').isVisible().catch(() => false)) break;
    if (await page.locator('.place-step').isVisible().catch(() => false)) {
      steps += 1;
      await page.locator('.place-step button').first().click();
      await sleep(120);
      continue;
    }
    if (await page.locator('.feedback').isVisible().catch(() => false)) {
      await page.locator('.runner__footer button:not(.hidden)').last().click();
      await sleep(80);
      continue;
    }
    const shown = await page.locator('.opt .opt__text').allInnerTexts();
    const q = byOptions.get(key(shown));
    if (!q) throw new Error(`placement: no bank question matches [${shown.join(' | ')}]`);
    const wanted = correctly
      ? q.options[q.answer]
      : q.options.find((_, idx) => idx !== q.answer);
    const idx = shown.findIndex((text) => text.trim() === String(wanted).trim());
    await page.locator('.opt').nth(idx).click();
    await page.locator('.runner__footer button:not(.hidden)').first().click();
    answered += 1;
    await sleep(80);
  }

  const level = (await page.locator('.result-hero__score').innerText().catch(() => '')).trim();
  const rows = await page.locator('.concept-row').count();
  return { answered, steps, level, rows };
}

async function playSession(page, max = 40, wrongly = false) {
  for (let i = 0; i < max; i++) {
    if (await page.locator('.result-hero').isVisible().catch(() => false)) return true;
    if (await page.locator('.place-step').isVisible().catch(() => false)) {
      await page.locator('.place-step button').first().click();
      await sleep(80);
      continue;
    }
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
  // The test is adaptive, so the two runs worth checking are the extremes: someone
  // who cannot clear A1 must not be marched through 36 questions, and someone who
  // clears everything must actually reach C2.
  const bank = await page.evaluate(() => fetch('content/placement.json').then((r) => r.json()));

  await page.goto(base + '#/placement', { waitUntil: 'networkidle' });
  await page.locator('button.btn--primary').first().click();
  await page.waitForSelector('.runner');
  const wrongRun = await playPlacement(page, bank.questions, false, 30);
  check('failing the first block ends the test', wrongRun.answered === 4, `${wrongRun.answered} questions`);
  check('a learner who fails A1 is placed at A1', wrongRun.level === 'A1', wrongRun.level);
  check('no level-cleared screen is shown after a failed block', wrongRun.steps === 0, `${wrongRun.steps} shown`);

  // A second goto to the same hash would not re-render, so leave the route first.
  await page.goto(base + '#/', { waitUntil: 'networkidle' });
  await page.goto(base + '#/placement', { waitUntil: 'networkidle' });
  await page.locator('button.btn--primary').first().click();
  await page.waitForSelector('.runner');
  const rightRun = await playPlacement(page, bank.questions, true, 120);
  check('answering everything correctly reaches C2', rightRun.level === 'C2', rightRun.level);
  check('every level is tested on the way up', rightRun.answered === 24, `${rightRun.answered} questions`);
  check('each cleared level is announced', rightRun.steps === 5, `${rightRun.steps} shown`);
  check('the result breaks the score down by level', rightRun.rows === 6, `${rightRun.rows} rows`);

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

  /* ---------- 13. The vocabulary track ---------- */
  // Vocabulary sits beside grammar but must not gate progress, so the level counter
  // and the unlock rule both have to keep ignoring it.
  {
    const trk = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const tp = await trk.newPage();
    await tp.goto(base + '#/learn', { waitUntil: 'networkidle' });
    await tp.waitForSelector('.level-card', { timeout: 5000 });
    // innerText is what the reader sees, and CSS upper-cases these headings.
    const heads = (await tp.locator('.level-card[data-level="A1"] .track-head__name').allInnerTexts())
      .map((x) => x.trim().toLowerCase());
    check('a level shows both tracks', heads.length === 2 && heads.includes('grammar') && heads.includes('vocabulary'),
      heads.join(' | '));
    const a1meta = await tp.locator('.level-card[data-level="A1"] .level-card__meta').innerText();
    check('level progress counts grammar only', /\b8\b/.test(a1meta) && !/\b10\b/.test(a1meta), a1meta);
    const rows = await tp.locator('.level-card[data-level="A1"] .unit-row').count();
    check('vocabulary units are listed too', rows === 10, `${rows} rows`);

    await tp.goto(base + '#/unit/a1-v1', { waitUntil: 'networkidle' });
    // Wait for the unit's own content, not just the page shell: the shell renders a
    // spinner first and the assertion would read that instead.
    await tp.waitForSelector('.rowcard--static', { timeout: 8000 }).catch(() => {});
    const vocabText = await tp.locator('.page').innerText();
    check('a vocabulary unit opens like any other', /family/i.test(vocabText), vocabText.slice(0, 80).replace(/\n/g, ' '));
    await trk.close();
  }

  /* ---------- 14. Writing practice ---------- */
  // The order of the three stages is the whole point: a model answer shown before the
  // learner has marked their own work is just something to copy.
  {
    const wctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const wp = await wctx.newPage();
    await wp.goto(base + '#/unit/a1-u8', { waitUntil: 'networkidle' });
    await wp.waitForSelector('.rowcard--static', { timeout: 8000 });
    const hasWrite = await wp.locator('.rowcard', { hasText: 'Write' }).first().isVisible();
    check('a unit with prompts offers writing practice', hasWrite);

    await wp.goto(base + '#/write/a1-u8', { waitUntil: 'networkidle' });
    await wp.waitForSelector('.rowcard', { timeout: 8000 });
    await wp.locator('.rowcard').first().click();
    await wp.waitForSelector('textarea.field', { timeout: 5000 });
    check('no model answer is visible before writing', (await wp.locator('.write__model').count()) === 0);

    await wp.locator('textarea.field').fill('On Friday I am going to visit my grandmother in the morning. '
      + 'In the afternoon I am going to meet two friends at a cafe near the market. '
      + 'We are going to watch a football match together. On Saturday I am going to rest.');
    const counted = await wp.locator('.row--between .small').first().innerText();
    check('the word counter tracks the draft', /\b4[0-9]\b/.test(counted), counted);

    await wp.locator('button', { hasText: "I've finished" }).first().click();
    await wp.waitForSelector('.check', { timeout: 5000 });
    check('the checklist appears before the model', (await wp.locator('.check').count()) >= 3);
    check('still no model answer at the checklist stage', (await wp.locator('.write__model').count()) === 0);

    const boxes = wp.locator('.check__box');
    for (const i of [0, 1, 2]) await boxes.nth(i).check();
    await wp.locator('button', { hasText: 'Show a model answer' }).first().click();
    await wp.waitForSelector('.write__model', { timeout: 5000 });
    check('the model answer appears last', await wp.locator('.write__model').isVisible());
    const scored = await wp.locator('.write__score').innerText();
    check('self-marking is reported back', scored.trim() === '60%', scored);

    await sleep(400); // the store batches writes on a short timer
    const stored = await wp.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('masar.v1.progress'));
      const rec = s.writing['a1u8-w1'];
      return { xp: s.profile.xp, words: (rec.text || '').split(/\s+/).length, done: Boolean(rec.completedAt) };
    });
    check('the draft is saved locally', stored.words > 30 && stored.done, JSON.stringify(stored));
    check('finishing a prompt earns XP', stored.xp >= 20, `xp=${stored.xp}`);

    // Writing is self-marked, so it must never feed the mastery model.
    const noMastery = await wp.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('masar.v1.progress'));
      return Object.keys(s.concepts).length === 0 && Object.keys(s.questions).length === 0;
    });
    check('self-marked writing does not touch concept mastery', noMastery);
    await wctx.close();
  }

  /* ---------- 15. Reading passages ---------- */
  {
    const rctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const rp = await rctx.newPage();
    // A relative fetch inside the page only resolves once the page has a real URL.
    await rp.goto(base, { waitUntil: 'domcontentloaded' });
    const levels = ['a1-v2', 'a2-v2', 'b1-v2', 'b2-v2', 'c1-v2', 'c2-v2'];
    let withPassage = 0;
    for (const id of levels) {
      const unit = await rp.evaluate(async (u) => {
        const map = {
          'a1-v2': 'levels/a1/v2-home-food-town.json',
          'a2-v2': 'levels/a2/v2-travel-weather-leisure.json',
          'b1-v2': 'levels/b1/v2-work-personality.json',
          'b2-v2': 'levels/b2/v2-business-data-change.json',
          'c1-v2': 'levels/c1/v2-politics-ethics-abstraction.json',
          'c2-v2': 'levels/c2/v2-idiom-metaphor-frames.json',
        };
        return (await fetch('content/' + map[u])).json();
      }, id);
      const passages = Object.keys(unit.passages || {});
      const linked = (unit.questions || []).filter((q) => q.passageId).length;
      if (passages.length && linked >= 4) withPassage += 1;
    }
    check('every level has a graded reading passage', withPassage === 6, `${withPassage}/6`);
    await rctx.close();
  }

  /* ---------- 16. Offline ---------- */
  // The point of the service worker is a learner on a train, so the check is the real
  // thing: visit online once, kill the network, reload, and expect the app to work.
  {
    const net = await browser.newContext();
    const off = await net.newPage();
    await off.goto(base, { waitUntil: 'networkidle' });
    const controlled = await off.evaluate(() => navigator.serviceWorker.ready
      .then(() => new Promise((res) => {
        if (navigator.serviceWorker.controller) return res(true);
        navigator.serviceWorker.addEventListener('controllerchange', () => res(true));
        setTimeout(() => res(Boolean(navigator.serviceWorker.controller)), 3000);
      })).catch(() => false));
    check('a service worker installs and takes control', controlled === true);

    // Warm the cache through the worker: the first load happened before it was active.
    await off.goto(base + '#/learn', { waitUntil: 'networkidle' });
    await off.waitForSelector('.level-card', { timeout: 5000 });
    await sleep(500);

    await net.setOffline(true);
    await off.goto(base + '#/learn', { waitUntil: 'domcontentloaded' });
    let booted = true;
    try { await off.waitForSelector('.level-card', { timeout: 8000 }); }
    catch { booted = false; }
    check('the app opens with no network at all', booted);
    check('all six levels are still listed offline', (await off.locator('.level-card').count()) === 6);
    check('an offline notice is shown', await off.locator('.offline-bar').isVisible().catch(() => false));

    await net.setOffline(false);

    // The pre-download is the difference between "the app opens offline" and "the
    // course works offline", so check a unit the learner never visited.
    await off.goto(base + '#/settings', { waitUntil: 'networkidle' });
    await off.locator('#offline-dl').click();
    await off.waitForFunction(() => {
      const s = document.getElementById('offline-status');
      return s && s.textContent.includes('✓');
    }, { timeout: 60000 }).catch(() => {});
    const dlStatus = await off.locator('#offline-status').innerText();
    check('every lesson can be downloaded in one tap', dlStatus.includes('✓'), dlStatus);

    await net.setOffline(true);
    await off.goto(base + '#/unit/c1-u3', { waitUntil: 'domcontentloaded' });
    let unitOffline = true;
    try { await off.waitForSelector('.page', { timeout: 8000 }); await sleep(600); }
    catch { unitOffline = false; }
    const unitText = unitOffline ? await off.locator('.page').innerText() : '';
    check('a never-opened unit works offline after the download',
      unitText.length > 40 && !unitText.includes('Something went wrong'), unitText.slice(0, 60));

    await net.setOffline(false);
    await net.close();
  }

  check('no uncaught JavaScript errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed.`);
process.exit(failed.length ? 1 : 0);
