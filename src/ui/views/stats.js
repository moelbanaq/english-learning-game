/** Statistics — accuracy, activity, mastery and achievements. */
import { el } from '../../core/dom.js';
import { t, lang } from '../../core/i18n.js';
import { setView, page, pageHead } from '../app.js';
import { bar, emptyState } from '../components/bits.js';
import { getState, dayKey } from '../../core/store.js';
import { stateFor, STATE_LABEL, masteryBreakdown } from '../../engine/mastery.js';
import { ACHIEVEMENTS, totalAnswered, totalCorrect, rankProgress } from '../../engine/xp.js';
import { findConceptTitle, LEVEL_META } from '../../data/content.js';

export async function statsView() {
  const state = getState();
  const answered = totalAnswered(state);
  const correct = totalCorrect(state);
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const rank = rankProgress(state.profile.xp);
  const concepts = Object.values(state.concepts);
  const breakdown = masteryBreakdown(concepts);

  if (!answered) {
    setView(page([pageHead(t('stats.title')), emptyState('📈', t('stats.noData'),
      el('a.btn.btn--primary', { href: '#/learn' }, t('nav.learn')))]));
    return;
  }

  const days = last14Days(state);
  const maxXp = Math.max(10, ...days.map((d) => d.xp));

  const conceptRows = Object.entries(state.concepts)
    .map(([id, c]) => ({ id, c, st: stateFor(c) }))
    .sort((a, b) => b.c.strength - a.c.strength)
    .slice(0, 30);

  setView(page([
    pageHead(t('stats.title')),

    el('div.grid.grid--3', [
      el('div.stat', [el('div.stat__v', `${accuracy}%`), el('div.stat__k', t('stats.accuracy'))]),
      el('div.stat', [el('div.stat__v', String(answered)), el('div.stat__k', t('stats.answered'))]),
      el('div.stat', [el('div.stat__v', String(state.history.length)), el('div.stat__k', t('stats.sessions'))]),
    ]),

    el('div.card', { style: { marginTop: '.9rem' } }, [
      el('div.row.row--between', [
        el('div.card__label', t('stats.activity')),
        el('span.small.muted', `🔥 ${state.streak.current} · ${lang() === 'ar' ? 'الأفضل' : 'best'} ${state.streak.best}`),
      ]),
      el('div.spark', { style: { marginTop: '.6rem' } }, days.map((d) => el(
        `div.spark__bar${d.xp ? '' : '.spark__bar--empty'}`,
        { style: { height: `${Math.max(4, (d.xp / maxXp) * 100)}%` }, title: `${d.key}: ${d.xp} XP` },
      ))),
    ]),

    el('div.card', { style: { marginTop: '.9rem' } }, [
      el('div.card__label', t('stats.level')),
      el('div.row.row--between', { style: { marginTop: '.3rem' } }, [
        el('span', LEVEL_META[state.profile.level].name[lang()] || state.profile.level),
        el('span.small.muted', { dir: 'ltr' }, `${t('common.rank', { n: rank.rank })} · ${state.profile.xp} XP`),
      ]),
      bar(rank.pct, { thin: true }),
      el('p.tiny.muted', { style: { marginTop: '.35rem' }, dir: 'ltr' },
        `${Math.max(0, rank.to - state.profile.xp)} XP → ${t('common.rank', { n: rank.rank + 1 })}`),
    ]),

    el('div.card', { style: { marginTop: '.9rem' } }, [
      el('div.card__label', t('stats.mastery')),
      el('div.mastery-legend', { style: { margin: '.5rem 0' } }, Object.keys(breakdown).map((k) => el('span.mastery-pill', [
        el('span.mastery-swatch', { class: `ms-${k}` }),
        `${STATE_LABEL[k][lang()] || STATE_LABEL[k].en} ${breakdown[k]}`,
      ]))),
      el('div', conceptRows.map(({ id, c, st }) => {
        const title = findConceptTitle(id);
        return el('div.concept-row', [
          el('span.mastery-swatch', { class: `ms-${st}` }),
          el('span.concept-row__name', title ? (title[lang()] || title.en) : id),
          el('span.tiny.muted.nowrap', `${c.correct}/${c.seen}`),
          el('span.concept-row__bar', bar(c.strength, { thin: true, success: st === 'mastered' })),
        ]);
      })),
    ]),

    el('div.card', { style: { marginTop: '.9rem' } }, [
      el('div.card__label', t('stats.achievements')),
      el('div.ach-grid', { style: { marginTop: '.6rem' } }, ACHIEVEMENTS.map((a) => {
        const earned = Boolean(state.achievements[a.id]);
        return el(`div.ach${earned ? '' : '.is-locked'}`, [
          el('div.ach__icon', { 'aria-hidden': 'true' }, earned ? a.icon : '🔒'),
          el('div.ach__name', a.name[lang()] || a.name.en),
          el('div.ach__desc', a.desc[lang()] || a.desc.en),
        ]);
      })),
    ]),
  ]));
}

function last14Days(state) {
  const out = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = dayKey(d);
    out.push({ key, xp: state.streak.days[key] || 0 });
  }
  return out;
}
