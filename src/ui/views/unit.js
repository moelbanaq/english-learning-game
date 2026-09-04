/** Unit hub + the "Learn" flow (one concept at a time, then practice). */
import { el, mount } from '../../core/dom.js';
import { t, lang } from '../../core/i18n.js';
import { setView, page } from '../app.js';
import { bar, bilingual, loading, errorState, backLink } from '../components/bits.js';
import { getState } from '../../core/store.js';
import { getUnit } from '../../data/content.js';
import { recordConceptStudied, PASS_MARK } from '../../engine/record.js';
import { navigate } from '../../core/router.js';
import { stateFor, STATE_LABEL } from '../../engine/mastery.js';

export async function unitView({ params }) {
  setView(page(loading()));
  let unit;
  try { unit = await getUnit(params.id); }
  catch (e) { setView(page(errorState(t('common.error'), () => location.reload()))); return; }

  const state = getState();
  const p = state.units[unit.id];
  const studied = p ? p.conceptsSeen.length : 0;
  const canPractice = studied > 0;
  const canTest = p && (p.practiced > 0 || studied >= unit.concepts.length);

  setView(page([
    backLink(() => navigate('/learn'), t('nav.learn')),
    el('div.page__head', { style: { marginTop: '.5rem' } }, [
      el('div.row', [
        el('span.chip', { dataset: { level: unit.level } }, [el('span.level-dot'), unit.level]),
        p && p.completedAt ? el('span.chip.chip--success', t('unit.completed')) : null,
      ]),
      el('h1.page__title', { style: { marginTop: '.4rem' } }, unit.title[lang()] || unit.title.en),
      unit.goal ? bilingual(unit.goal, { class: 'page__sub' }) : null,
    ]),

    el('div.card', [
      el('div.card__label', t('unit.concepts')),
      el('div.list', { style: { marginTop: '.5rem' } }, unit.concepts.map((c, i) => {
        const cp = state.concepts[c.id];
        const st = cp ? stateFor(cp) : 'new';
        const seen = p && p.conceptsSeen.includes(c.id);
        return el('div.rowcard.rowcard--static', [
          el('div.rowcard__icon', seen ? '✓' : String(i + 1)),
          el('div.rowcard__body', [
            el('div.rowcard__title.small', c.title[lang()] || c.title.en),
            el('div.rowcard__meta', STATE_LABEL[st][lang()] || STATE_LABEL[st].en),
          ]),
          cp ? el('span.rowcard__end', { style: { width: '70px' } }, bar(cp.strength, { thin: true, success: st === 'mastered' })) : null,
        ]);
      })),
    ]),

    el('div.list', { style: { marginTop: '.8rem' } }, [
      actionRow('📖', t('unit.learn'), t('unit.learnDesc'), true,
        `${studied}/${unit.concepts.length}`, () => navigate(`/lesson/${unit.id}`)),
      actionRow('✏️', t('unit.practice'), canPractice ? t('unit.practiceDesc') : t('unit.locked.practice'), canPractice,
        p && p.practiced ? `×${p.practiced}` : '', () => navigate(`/session/practice/${unit.id}`)),
      actionRow('🎯', t('unit.test'), canTest ? t('unit.testDesc', { n: PASS_MARK }) : t('unit.locked.test'), canTest,
        p && p.testBest !== null && p.testBest !== undefined ? `${p.testBest}%` : '', () => navigate(`/session/test/${unit.id}`)),
    ]),

    p && p.attempts ? el('p.small.muted.center', { style: { marginTop: '.8rem' } },
      t('unit.attempts', { n: p.attempts })) : null,
  ]));
}

function actionRow(icon, title, desc, enabled, end, onClick) {
  return el(`button.rowcard${enabled ? '' : '.rowcard--locked'}`, {
    type: 'button', disabled: !enabled, onClick: enabled ? onClick : null,
  }, [
    el('div.rowcard__icon', icon),
    el('div.rowcard__body', [
      el('div.rowcard__title', title),
      el('div.rowcard__meta', desc),
    ]),
    el('span.rowcard__end', end || (enabled ? (lang() === 'ar' ? '‹' : '›') : '🔒')),
  ]);
}

/* ------------------------------------------------------------------ */
/* Lesson: teaching cards, one concept at a time                       */
/* ------------------------------------------------------------------ */

export async function lessonView({ params, query }) {
  setView(page(loading()));
  let unit;
  try { unit = await getUnit(params.id); }
  catch { setView(page(errorState(t('common.error')))); return; }

  let idx = Math.max(0, Math.min(unit.concepts.length - 1, Number(query.c || 0)));
  const host = el('div');
  setView(page([
    backLink(() => navigate(`/unit/${unit.id}`), unit.title[lang()] || unit.title.en),
    host,
  ]));

  render();

  function render() {
    const c = unit.concepts[idx];
    recordConceptStudied(unit.id, c.id);

    mount(host, [
      el('div.card.card--pad-lg', { style: { marginTop: '.5rem' } }, [
        el('div.card__label', `${idx + 1} / ${unit.concepts.length}`),
        el('h1', { style: { marginTop: '.2rem' } }, c.title[lang()] || c.title.en),
        el('div.teach', teachBlocks(c)),
      ]),
      el('div.lesson__nav', [
        el('button.btn.btn--sm', {
          type: 'button', disabled: idx === 0,
          onClick: () => { idx -= 1; render(); window.scrollTo({ top: 0 }); },
        }, t('lesson.prev')),
        el('div.dots', unit.concepts.map((_, i) => el(`span.dot${i === idx ? '.is-on' : ''}`))),
        idx < unit.concepts.length - 1
          ? el('button.btn.btn--primary.btn--sm', {
            type: 'button',
            onClick: () => { idx += 1; render(); window.scrollTo({ top: 0 }); },
          }, t('lesson.next'))
          : el('button.btn.btn--primary.btn--sm', {
            type: 'button',
            onClick: () => navigate(`/session/practice/${unit.id}`),
          }, t('lesson.toPractice')),
      ]),
      el('div.btn-row', { style: { marginTop: '.8rem' } }, [
        el('a.btn.btn--ghost.btn--sm', { href: `#/session/practice/${unit.id}?c=${encodeURIComponent(c.id)}` },
          lang() === 'ar' ? 'تدرّب على هذا المفهوم' : 'Practise just this concept'),
      ]),
    ]);
  }
}

function teachBlocks(concept) {
  const out = [];
  for (const block of concept.teach || []) {
    switch (block.type) {
      case 'p':
        out.push(bilingual(block.text));
        break;
      case 'rule':
        out.push(el('div.teach__rule', [
          el('span.teach__label', t('lesson.rule')),
          bilingual(block.text, { tag: 'div' }),
        ]));
        break;
      case 'tip':
        out.push(el('div.teach__tip', [
          el('span.teach__label', t('lesson.tip')),
          bilingual(block.text, { tag: 'div' }),
        ]));
        break;
      case 'warn':
        out.push(el('div.teach__warn', [
          el('span.teach__label', t('lesson.watch')),
          bilingual(block.text, { tag: 'div' }),
        ]));
        break;
      case 'examples':
        out.push(el('div', [
          el('span.teach__label', t('lesson.examples')),
          el('ul.ex-list', block.items.map((ex) => el('li.ex', [
            el('div.ex__en', { lang: 'en' }, ex.en),
            ex.ar ? el('div.ex__ar', { lang: 'ar', dir: 'rtl' }, ex.ar) : null,
            ex.note ? el('div.ex__note', ex.note) : null,
          ]))),
        ]));
        break;
      case 'table':
        out.push(el('div.table-wrap', el('table.tbl', [
          el('thead', el('tr', block.head.map((h) => el('th', h)))),
          el('tbody', block.rows.map((r) => el('tr', r.map((cell, i) => el(i === 0 ? 'th' : 'td', { lang: 'en' }, cell))))),
        ])));
        break;
      default:
        break;
    }
  }
  return out;
}
