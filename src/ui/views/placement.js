/**
 * Placement test — estimates a starting level from real questions.
 * It deliberately does not write concept/mistake progress: it is a measurement,
 * not a lesson, and a bad guess here should not poison the learner's history.
 *
 * The flow is adaptive (see src/engine/placement.js): one block of questions per
 * level, walking up from A1 and stopping at the first block the learner cannot
 * clear. A beginner answers four questions instead of the whole bank.
 */
import { el, mount } from '../../core/dom.js';
import { t, lang } from '../../core/i18n.js';
import { setView, page } from '../app.js';
import { loading, errorState } from '../components/bits.js';
import { renderQuestion } from '../components/question.js';
import { getPlacementTest, LEVELS, LEVEL_META } from '../../data/content.js';
import { recordPlacement } from '../../engine/record.js';
import { update } from '../../core/store.js';
import { navigate } from '../../core/router.js';
import {
  BLOCK_SIZE, blockFor, afterBlock, recommendLevel, securedLevels,
} from '../../engine/placement.js';

export async function placementView() {
  setView(page(loading()), { hideNav: true });
  let test;
  try { test = await getPlacementTest(); }
  catch { setView(page(errorState(t('common.error')))); return; }

  setView(page([
    el('div.card.card--pad-lg', [
      el('h1', t('place.title')),
      el('p.muted', t('place.sub')),
      el('button.btn.btn--primary.btn--lg.btn--block', {
        type: 'button', style: { marginTop: '.8rem' }, onClick: () => run(test),
      }, t('place.begin')),
      el('a.btn.btn--ghost.btn--block', { href: '#/', style: { marginTop: '.4rem' } }, t('common.cancel')),
    ]),
  ]), { hideNav: true });
}

function run(test) {
  // One seed for the whole test, so a block is stable if the view re-renders.
  const seed = Date.now();
  /** @type {Array<{level: string, correct: number, asked: number}>} */
  const blocks = [];
  let level = LEVELS[0];
  let queue = blockFor(test.questions, level, seed);
  let i = 0;
  let blockCorrect = 0;
  let totalCorrect = 0;
  let active = null;

  const host = el('div');
  const counter = el('span.chip', { dataset: { level } }, [el('span.level-dot'), `1/${BLOCK_SIZE}`]);
  const progress = el('div.bar', el('div.bar__fill', { style: { width: '0%' } }));

  setView(page([
    el('div.runner__top', [
      el('button.btn.btn--ghost.btn--sm', { type: 'button', onClick: () => navigate('/') }, '✕'),
      el('div.runner__bar', progress),
      counter,
    ]),
    host,
  ], { flush: true }), { hideNav: true });

  show();

  function show() {
    if (active) active.destroy();
    const q = queue[i];
    // The bar tracks the current block, not the whole test: the test can end after
    // any block, so a bar promising six blocks would be a lie for most learners.
    mount(counter, [el('span.level-dot'), `${level} · ${i + 1}/${queue.length}`]);
    counter.dataset.level = level;
    progress.querySelector('.bar__fill').style.width = `${(i / queue.length) * 100}%`;

    active = renderQuestion({
      question: q,
      index: i,
      total: queue.length,
      onCheck: (r) => { if (r.correct) { blockCorrect += 1; totalCorrect += 1; } },
      onNext: advance,
    });

    const skip = el('button.btn.btn--ghost.btn--block', {
      type: 'button',
      onClick: advance,
    }, t('place.dontKnow'));

    mount(host, [active.node, el('div', { style: { marginTop: '.4rem' } }, skip)]);
  }

  function advance() {
    i += 1;
    if (i < queue.length) { show(); return; }
    endBlock();
  }

  function endBlock() {
    if (active) { active.destroy(); active = null; }
    blocks.push({ level, correct: blockCorrect, asked: queue.length });
    const { passed, next } = afterBlock(level, blockCorrect);
    if (!passed || !next) { finish(); return; }
    const cleared = level;
    level = next;
    queue = blockFor(test.questions, level, seed);
    i = 0;
    blockCorrect = 0;
    if (!queue.length) { finish(); return; }
    interstitial(cleared, level);
  }

  function interstitial(cleared, upcoming) {
    progress.querySelector('.bar__fill').style.width = '100%';
    mount(host, el('div.card.place-step', [
      el('div.place-step__level', { dataset: { level: cleared }, style: { color: 'var(--lvl)' } }, cleared),
      el('h2', { style: { marginTop: '.5rem' } }, t('place.cleared', { lvl: cleared })),
      el('p.muted', t('place.clearedSub', { lvl: upcoming })),
      el('button.btn.btn--primary.btn--lg.btn--block', {
        type: 'button', style: { marginTop: '.8rem' }, onClick: show,
      }, t('place.continue')),
    ]));
  }

  function finish() {
    const asked = blocks.reduce((n, b) => n + b.asked, 0);
    showResult(recommendLevel(blocks), totalCorrect, asked, blocks);
  }
}

function showResult(level, correct, total, blocks) {
  const secured = securedLevels(blocks);
  // "Topped out" means every level in the bank was cleared; otherwise the recommended
  // level is exactly the block that stopped them, and saying so makes the number mean something.
  const toppedOut = secured.length === LEVELS.length;
  const summary = secured.length
    ? t('place.secured', { levels: secured.join(', ') })
    : t('place.securedNone');

  setView(page([
    el('div.card.result-hero', [
      el('div.result-hero__score', { dataset: { level }, style: { color: 'var(--lvl)' } }, level),
      el('h2', { style: { marginTop: '.5rem' } }, t('place.result', { lvl: level })),
      el('p.muted', `${correct}/${total} · ${LEVEL_META[level].name[lang()] || level}`),
      el('p.small.muted', toppedOut ? t('place.ceilingTop') : t('place.ceiling', { lvl: level })),
      el('p.small.muted', t('place.resultSub')),
    ]),

    el('div.card', { style: { marginTop: '.8rem' } }, [
      el('div.card__label', t('place.byLevel')),
      el('p.small.muted', { style: { marginTop: '.2rem' } }, summary),
      el('div', { style: { marginTop: '.4rem' } }, blocks.map((b) => el('div.concept-row', [
        el('span.chip', { dataset: { level: b.level } }, [el('span.level-dot'), b.level]),
        el('span.concept-row__name.small.muted', `${b.correct}/${b.asked}`),
        el('span.concept-row__bar', el('div.bar.bar--thin', el('div.bar__fill', { style: { width: `${(b.correct / b.asked) * 100}%` } }))),
      ]))),
    ]),

    el('div.btn-row', { style: { marginTop: '1rem' } }, [
      el('button.btn.btn--primary.btn--lg', {
        type: 'button',
        onClick: () => {
          recordPlacement({ level, score: correct, total });
          navigate('/learn');
        },
      }, t('place.accept', { lvl: level })),
      el('button.btn', {
        type: 'button',
        onClick: () => {
          update((s) => { s.onboarded = true; }, 'onboard');
          navigate('/settings');
        },
      }, t('place.choose')),
    ]),
  ]), { hideNav: false });
}
