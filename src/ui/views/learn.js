/** Learning path — all six CEFR levels and their units. */
import { el } from '../../core/dom.js';
import { t, lang } from '../../core/i18n.js';
import { setView, page, pageHead } from '../app.js';
import { bar, loading } from '../components/bits.js';
import { getState } from '../../core/store.js';
import { getCurriculum, LEVEL_META } from '../../data/content.js';
import { setLevel } from '../../engine/record.js';
import { navigate } from '../../core/router.js';

export async function learnView() {
  setView(page(loading()));
  const cur = await getCurriculum();
  const state = getState();

  const levels = cur.levels.map((lv) => renderLevel(lv, state));

  setView(page([
    pageHead(t('learn.title'), t('learn.sub')),
    el('div.levels', levels),
  ]));
}

function renderLevel(lv, state) {
  const unlocked = state.profile.unlocked.includes(lv.id);
  const published = lv.units.filter((u) => u.status !== 'planned');
  const done = published.filter((u) => state.units[u.id] && state.units[u.id].completedAt).length;
  const open = lv.id === state.profile.level;

  const unitsHost = el('div.level-card__units', { hidden: !open }, [
    !unlocked && published.length
      ? el('p.tiny.muted', { style: { padding: '.2rem .3rem' } }, t('learn.lockedNote'))
      : null,
    ...(published.length
      ? published.map((u) => unitRow(u, state, unlocked))
      : [el('p.small.muted.center', { style: { padding: '.6rem' } }, t('learn.soon'))]),
  ]);

  const head = el('button.level-card__head', {
    type: 'button', dataset: { level: lv.id },
    'aria-expanded': String(open),
    onClick: () => {
      const nowOpen = unitsHost.hidden;
      unitsHost.hidden = !nowOpen;
      head.setAttribute('aria-expanded', String(nowOpen));
    },
  }, [
    el('span.level-card__badge', lv.id),
    el('span.level-card__body', [
      el('span.level-card__name', LEVEL_META[lv.id].name[lang()] || lv.id),
      el('span.level-card__meta', published.length
        ? t('learn.units', { done, total: published.length })
        : t('learn.soon')),
      published.length ? bar((done / published.length) * 100, { thin: true, level: true, levelId: lv.id }) : null,
    ]),
    el('span.rowcard__end', unlocked ? (open ? '▾' : '▸') : '🔒'),
  ]);

  return el('div.level-card', { dataset: { level: lv.id } }, [head, unitsHost]);
}

function unitRow(u, state, levelUnlocked) {
  const p = state.units[u.id];
  const done = p && p.completedAt;
  const started = p && (p.conceptsSeen.length || p.practiced);
  const meta = [];
  if (p && p.testBest !== null && p.testBest !== undefined) meta.push(t('unit.best', { n: p.testBest }));
  meta.push(t('common.questions', { n: u.questions || 0 }));

  return el(`button.unit-row${done ? '.is-done' : ''}${started && !done ? '.is-current' : ''}`, {
    type: 'button',
    onClick: () => {
      if (!levelUnlocked) setLevel(u.level);
      navigate(`/unit/${u.id}`);
    },
  }, [
    el('span.unit-row__n', done ? '✓' : String(u.index)),
    el('span.unit-row__body', [
      el('span.unit-row__title', u.title ? (u.title[lang()] || u.title.en) : u.id),
      el('span.unit-row__meta', meta.join(' · ')),
    ]),
    el('span.rowcard__end', lang() === 'ar' ? '‹' : '›'),
  ]);
}
