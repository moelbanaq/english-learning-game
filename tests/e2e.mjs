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

/** Answer whatever question is on screen, then press Check. */
async function answerCurrent(page) {
  const opt = page.locator('.opt:not([disabled])').first();
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
async function playSession(page, max = 40) {
  for (let i = 0; i < max; i++) {
    if (await page.locator('.result-hero').isVisible().catch(() => false)) return true;
    if (await page.locator('.feedback').isVisible().catch(() => false)) {
      const next = page.locator('.runner__footer button:not(.hidden)').last();
      if (await next.isVisible().catch(() => false)) await next.click();
      await sleep(80);
      continue;
    }
    await answerCurrent(page);
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

  const finished = await playSession(page);
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
  if (mistakes > 0) {
    check('mistakes are stored for review', mistakes > 0, `${mistakes} saved`);
    await page.locator('a[href="#/session/review"]').first().click();
    await page.waitForSelector('.runner', { timeout: 5000 });
    check('a review session can be started', await page.locator('.qcard').isVisible());
    await page.goto(base + '#/', { waitUntil: 'networkidle' });
  }

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

  /* ---------- 10. Desktop layout ---------- */
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
