/** Dashboard — answers one question first: what should I do next? */
import { el } from '../../core/dom.js';
import { t, lang } from '../../core/i18n.js';
import { setView, page } from '../app.js';
import { bar, statTile, loading } from '../components/bits.js';
import { getState, ensureToday, update } from '../../core/store.js';
import { rankProgress, dailyTasks } from '../../engine/xp.js';
import { weakConcepts, dueConceptIds } from '../../engine/select.js';
import { nextAction } from '../../data/sessions.js';
import { findConceptTitle, LEVEL_META, getLevelUnitMetas, loadConceptIndex } from '../../data/content.js';
import { stateFor } from '../../engine/mastery.js';

const NEXT_COPY = {
  learn: { icon: '📖', en: 'Learn a new concept', ar: 'تعلَّم مفهوماً جديداً' },
  practice: { icon: '✏️', en: 'Practise what you learned', ar: 'تدرَّب على ما تعلّمته' },
  test: { icon: '🎯', en: 'Take the mini test', ar: 'اجتز الاختبار القصير' },
  review: { icon: '🔁', en: 'Review your mistakes', ar: 'راجع أخطاءك' },
  daily: { icon: '⚡', en: 'Daily mission', ar: 'مهمة اليوم' },
};

export async function homeView() {
  setView(page(loading()));
  update((s) => { ensureToday(s); }, 'day-roll');

  const state = getState();
  await loadConceptIndex();
  const action = await nextAction(state);
  const units = await getLevelUnitMetas(state.profile.level);
  const doneUnits = units.filter((u) => state.units[u.id] && state.units[u.id].completedAt).length;
  const rank = rankProgress(state.profile.xp);
  const tasks = dailyTasks(state);
  const goal = state.settings.dailyGoal;
  const todayXp = state.daily.xp;
  const weak = weakConcepts(state, 3);
  const due = dueConceptIds(state).length;
  const openMistakes = Object.values(state.mistakes).filter((m) => m.status === 'open').length;
  const mastered = Object.values(state.concepts).filter((c) => stateFor(c) === 'mastered').length;

  const copy = NEXT_COPY[action.type] || NEXT_COPY.daily;
  const sub = action.unit
    ? (action.unit.title ? (action.unit.title[lang()] || action.unit.title.en) : '')
    : (action.count ? `${action.count} ${lang() === 'ar' ? 'عنصر' : 'items'}` : '');

  setView(page([
    el('div.hero', [
      el('div.hero__row', [
        el('div', { dataset: { level: state.profile.level } }, [
          el('div.card__label', t('common.level')),
          el('div.hero__level', { style: { color: 'var(--lvl)' } }, state.profile.level),
        ]),
        el('div.hero__body', [
          el('div.row.row--between', [
            el('span.small.muted', `${LEVEL_META[state.profile.level].name[lang()] || state.profile.level}`),
            el('span.small.muted', `${doneUnits}/${units.length}`),
          ]),
          bar(units.length ? (doneUnits / units.length) * 100 : 0, { level: true, levelId: state.profile.level }),
          el('div.row.row--between', { style: { marginTop: '.45rem' } }, [
            el('span.tiny.muted', t('common.rank', { n: rank.rank })),
            el('span.tiny.muted', { dir: 'ltr' }, `${state.profile.xp} ${t('common.xp')}`),
          ]),
          bar(rank.pct, { thin: true }),
        ]),
      ]),
    ]),

    el('a.next-card', { href: '#' + action.path, style: { marginTop: '.9rem' } }, [
      el('span.next-card__icon', { 'aria-hidden': 'true' }, copy.icon),
      el('span', [
        el('span.next-card__title', copy[lang()] || copy.en),
        el('span.next-card__sub', sub),
      ]),
    ]),

    el('div.grid.grid--3', { style: { marginTop: '.9rem' } }, [
      statTile(state.streak.current, 'home.streak'),
      statTile(mastered, 'home.mastered'),
      statTile(openMistakes + due, 'home.dueReview'),
    ]),

    el('div.card', { style: { marginTop: '.9rem' } }, [
      el('div.row.row--between', [
        el('h2', { style: { margin: 0, fontSize: '1.05rem' } }, t('home.today')),
        el('span.small.muted', todayXp >= goal ? `✓ ${t('home.goalDone')}` : t('home.goalProgress', { a: todayXp, b: goal })),
      ]),
      bar(Math.min(100, (todayXp / goal) * 100), { thin: true, success: todayXp >= goal }),
      el('div.mission', { style: { marginTop: '.7rem' } }, tasks.map((task) => el(`div.mission__item${task.done ? '.is-done' : ''}`, [
        el('span.mission__box', { 'aria-hidden': 'true' }, task.done ? '✓' : ''),
        el('span.mission__text', t(task.key, { n: task.need })),
        el('span.mission__count', `${Math.min(task.have, task.need)}/${task.need}`),
      ]))),
      el('a.btn.btn--block', { href: '#/session/daily', style: { marginTop: '.7rem' } },
        lang() === 'ar' ? 'ابدأ جلسة اليوم' : 'Start today’s session'),
    ]),

    weak.length ? el('div.card', { style: { marginTop: '.9rem' } }, [
      el('div.card__label', t('home.weakAreas')),
      el('div.list', { style: { marginTop: '.5rem' } }, weak.map((w) => {
        const title = findConceptTitle(w.id);
        return el('div.rowcard.rowcard--static', [
          el('div.rowcard__icon', '⚠️'),
          el('div.rowcard__body', [
            el('div.rowcard__title.small', title ? (title[lang()] || title.en) : w.id),
            el('div.rowcard__meta', `${Math.round(w.accuracy * 100)}% · ${w.c.seen} ${lang() === 'ar' ? 'محاولة' : 'attempts'}`),
          ]),
          el('span.rowcard__end', { style: { width: '64px' } }, bar(w.c.strength, { thin: true })),
        ]);
      })),
      el('a.btn.btn--sm', { href: '#/session/review', style: { marginTop: '.6rem' } }, t('review.start')),
    ]) : null,

    state.history.length ? el('div.card', { style: { marginTop: '.9rem' } }, [
      el('div.card__label', t('home.recent')),
      el('div.list', { style: { marginTop: '.5rem' } }, state.history.slice(0, 4).map((h) => el('div.rowcard.rowcard--static', [
        el('div.rowcard__icon', h.type === 'test' ? '🎯' : h.type === 'review' ? '🔁' : '✏️'),
        el('div.rowcard__body', [
          el('div.rowcard__title.small', `${h.correct}/${h.total} · ${h.level || ''}`),
          el('div.rowcard__meta', new Date(h.at).toLocaleDateString(lang() === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })),
        ]),
        el('span.rowcard__end', { dir: 'ltr' }, `+${h.xp}`),
      ]))),
    ]) : null,
  ]));
}
