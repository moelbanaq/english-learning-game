/**
 * Placement test — estimates a starting level from real questions.
 * It deliberately does not write concept/mistake progress: it is a measurement,
 * not a lesson, and a bad guess here should not poison the learner's history.
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
  // Ordered easiest → hardest so the learner meets their ceiling naturally.
  const questions = test.questions.slice().sort(
    (a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || (a.difficulty || 2) - (b.difficulty || 2),
  );
  const results = [];
  let i = 0;
  let active = null;

  const host = el('div');
  const counter = el('span.chip', `1/${questions.length}`);
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
    const q = questions[i];
    counter.textContent = `${i + 1}/${questions.length}`;
    progress.querySelector('.bar__fill').style.width = `${(i / questions.length) * 100}%`;

    active = renderQuestion({
      question: q,
      index: i,
      total: questions.length,
      onCheck: (r) => results.push({ level: q.level, correct: r.correct }),
      onNext: () => { i += 1; if (i >= questions.length) finish(); else show(); },
    });

    const skip = el('button.btn.btn--ghost.btn--block', {
      type: 'button',
      onClick: () => {
        results.push({ level: q.level, correct: false });
        i += 1;
        if (i >= questions.length) finish(); else show();
      },
    }, t('place.dontKnow'));

    mount(host, [active.node, el('div', { style: { marginTop: '.4rem' } }, skip)]);
  }

  function finish() {
    if (active) active.destroy();
    const level = estimateLevel(results);
    const correct = results.filter((r) => r.correct).length;
    showResult(level, correct, results.length, results);
  }
}

/**
 * Walk up the levels; the recommended start is the first level the learner has
 * not yet secured (>=60% correct). Ace everything and you land on C2.
 */
export function estimateLevel(results) {
  const byLevel = new Map();
  for (const r of results) {
    const item = byLevel.get(r.level) || { correct: 0, total: 0 };
    item.total += 1;
    if (r.correct) item.correct += 1;
    byLevel.set(r.level, item);
  }
  for (const lv of LEVELS) {
    const item = byLevel.get(lv);
    if (!item || !item.total) continue;
    if (item.correct / item.total < 0.6) return lv;
  }
  return LEVELS[LEVELS.length - 1];
}

function showResult(level, correct, total, results) {
  const perLevel = LEVELS.map((lv) => {
    const items = results.filter((r) => r.level === lv);
    if (!items.length) return null;
    const c = items.filter((r) => r.correct).length;
    return { lv, c, n: items.length };
  }).filter(Boolean);

  setView(page([
    el('div.card.result-hero', [
      el('div.result-hero__score', { dataset: { level }, style: { color: 'var(--lvl)' } }, level),
      el('h2', { style: { marginTop: '.5rem' } }, t('place.result', { lvl: level })),
      el('p.muted', `${correct}/${total} · ${LEVEL_META[level].name[lang()] || level}`),
      el('p.small.muted', t('place.resultSub')),
    ]),

    el('div.card', { style: { marginTop: '.8rem' } }, [
      el('div.card__label', t('stats.accuracy')),
      el('div', { style: { marginTop: '.4rem' } }, perLevel.map((p) => el('div.concept-row', [
        el('span.chip', { dataset: { level: p.lv } }, [el('span.level-dot'), p.lv]),
        el('span.concept-row__name.small.muted', `${p.c}/${p.n}`),
        el('span.concept-row__bar', el('div.bar.bar--thin', el('div.bar__fill', { style: { width: `${(p.c / p.n) * 100}%` } }))),
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
