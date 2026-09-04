/** Review — the mistake book plus everything due for spaced repetition. */
import { el } from '../../core/dom.js';
import { t, lang } from '../../core/i18n.js';
import { setView, page, pageHead, confirmDialog } from '../app.js';
import { bilingual, emptyState, loading } from '../components/bits.js';
import { getState, update } from '../../core/store.js';
import { getUnits, findConceptTitle } from '../../data/content.js';
import { dueConceptIds } from '../../engine/select.js';
import { correctText } from '../../engine/grade.js';

export async function reviewView() {
  setView(page(loading()));
  const state = getState();
  const all = Object.values(state.mistakes);
  const open = all.filter((m) => m.status === 'open');
  const fixed = all.filter((m) => m.status === 'fixed');
  const due = dueConceptIds(state);

  // Load the units that own these mistakes so we can show the actual question.
  const units = await getUnits([...new Set(open.map((m) => m.unitId).filter(Boolean))]);
  const qById = new Map(units.flatMap((u) => u.questions).map((q) => [q.id, q]));

  const byConcept = new Map();
  open.forEach((m) => {
    const list = byConcept.get(m.conceptId) || [];
    list.push(m);
    byConcept.set(m.conceptId, list);
  });

  const header = pageHead(t('review.title'), t('review.sub'));

  if (!open.length && !due.length) {
    setView(page([
      header,
      emptyState('🌤️', all.length ? t('review.allClear') : t('review.empty'),
        el('a.btn.btn--primary', { href: '#/learn' }, t('nav.learn'))),
      fixed.length ? fixedCard(fixed.length) : null,
    ]));
    return;
  }

  setView(page([
    header,
    el('div.grid.grid--3', [
      el('div.stat', [el('div.stat__v', String(open.length)), el('div.stat__k', t('review.mistakes'))]),
      el('div.stat', [el('div.stat__v', String(due.length)), el('div.stat__k', t('review.due'))]),
      el('div.stat', [el('div.stat__v', String(fixed.length)), el('div.stat__k', t('review.fixed'))]),
    ]),

    el('a.btn.btn--primary.btn--lg.btn--block', { href: '#/session/review', style: { marginTop: '.9rem' } },
      t('review.start')),

    byConcept.size ? el('div', { style: { marginTop: '1.1rem' } }, [
      el('h2', { style: { fontSize: '1.05rem' } }, t('review.byConcept')),
      el('div.list', [...byConcept.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([cid, list]) => conceptGroup(cid, list, qById))),
    ]) : null,

    fixed.length ? fixedCard(fixed.length) : null,
  ]));
}

function conceptGroup(conceptId, list, qById) {
  const title = findConceptTitle(conceptId);
  const details = el('details.card', { style: { padding: '.75rem .85rem' } });
  const summary = el('summary', { style: { cursor: 'pointer', fontWeight: '650' } }, [
    `${title ? (title[lang()] || title.en) : conceptId} `,
    el('span.chip.chip--danger', String(list.length)),
  ]);
  details.append(summary);
  details.append(el('div.list', { style: { marginTop: '.6rem' } }, list.slice(0, 8).map((m) => {
    const q = qById.get(m.qid);
    return el('div.rowcard.rowcard--static', [
      el('div.rowcard__body', [
        el('div.rowcard__title.small', { lang: 'en', dir: 'ltr' },
          q ? (q.sentence ? q.sentence.replace('___', correctText(q)) : (correctText(q) || q.id)) : m.qid),
        q && q.prompt && q.prompt.en && !q.sentence ? el('div.rowcard__meta.tiny', { lang: 'en', dir: 'ltr' }, q.prompt.en) : null,
        q && q.explanation ? el('div.rowcard__meta', bilingual(q.explanation)) : null,
        el('div.rowcard__meta.tiny', t('review.times', { n: m.times })),
      ]),
    ]);
  })));
  return details;
}

function fixedCard(count) {
  return el('div.card', { style: { marginTop: '1rem' } }, [
    el('div.row.row--between', [
      el('span.small.muted', `${t('review.fixed')}: ${count}`),
      el('button.btn.btn--ghost.btn--sm', {
        type: 'button',
        onClick: async () => {
          const ok = await confirmDialog({
            title: t('review.clearAll'),
            confirmLabel: t('review.clearAll'),
          });
          if (!ok) return;
          update((s) => {
            for (const [id, m] of Object.entries(s.mistakes)) if (m.status === 'fixed') delete s.mistakes[id];
          }, 'clear-fixed');
          reviewView();
        },
      }, t('review.clearAll')),
    ]),
  ]);
}
