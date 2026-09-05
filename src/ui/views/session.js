/** Session runner: plays a list of questions, then shows a teaching-oriented result. */
import { el, mount } from '../../core/dom.js';
import { t, lang } from '../../core/i18n.js';
import { setView, page, toast } from '../app.js';
import { bar, bilingual, loading, errorState, emptyState } from '../components/bits.js';
import { renderQuestion } from '../components/question.js';
import { navigate } from '../../core/router.js';
import { recordAnswer, recordSession, PASS_MARK } from '../../engine/record.js';
import { buildPractice, buildTest, buildReview, buildDaily } from '../../data/sessions.js';
import { findConceptTitle, loadConceptIndex } from '../../data/content.js';
import { correctText } from '../../engine/grade.js';

const TITLES = {
  practice: { en: 'Practice', ar: 'تدريب' },
  test: { en: 'Mini test', ar: 'اختبار قصير' },
  review: { en: 'Review session', ar: 'جلسة مراجعة' },
  daily: { en: 'Daily mission', ar: 'مهمة اليوم' },
};

export async function sessionView({ params, query }) {
  const kind = params.kind;
  setView(page(loading()));

  let session;
  try {
    if (kind === 'practice') session = await buildPractice(params.arg, query.c || null);
    else if (kind === 'test') session = await buildTest(params.arg);
    else if (kind === 'review') session = await buildReview();
    else if (kind === 'daily') session = await buildDaily();
    else { navigate('/'); return; }
  } catch (err) {
    console.error(err);
    setView(page(errorState(t('common.error'), () => location.reload())));
    return;
  }

  if (!session.questions.length) {
    setView(page([
      emptyState('🎉', t('review.allClear'),
        el('a.btn.btn--primary', { href: '#/learn' }, t('nav.learn'))),
    ]));
    return;
  }
  runSession(session);
}

export function runSession(session) {
  const { questions, kind } = session;
  const answers = [];
  let i = 0;
  let xpTotal = 0;
  let activeQuestion = null;

  const host = el('div');
  const progress = bar(0, { label: t('res.score') });
  const counter = el('span.chip', `1/${questions.length}`);

  const view = page([
    el('div.runner__top', [
      el('button.btn.btn--ghost.btn--sm', {
        type: 'button', 'aria-label': t('common.close'),
        onClick: () => quit(),
      }, '✕'),
      el('div.runner__bar', progress),
      counter,
    ]),
    host,
  ], { flush: true });

  setView(view, { hideNav: true });
  show();

  function show() {
    if (activeQuestion) activeQuestion.destroy();
    const q = questions[i];
    counter.textContent = `${i + 1}/${questions.length}`;
    progress.querySelector('.bar__fill').style.width = `${(i / questions.length) * 100}%`;

    activeQuestion = renderQuestion({
      question: q,
      index: i,
      total: questions.length,
      onCheck: (result) => {
        const rec = recordAnswer({ question: q, correct: result.correct, kind });
        xpTotal += rec.xp;
        answers.push({ q, correct: result.correct });
        if (result.correct) toast(`+${rec.xp} ${t('common.xp')}`, 'xp');
        rec.achievements.forEach((a) => toast(`${a.icon} ${a.name[lang()] || a.name.en}`, 'gold'));
      },
      onNext: () => {
        i += 1;
        if (i >= questions.length) finish();
        else show();
      },
    });
    mount(host, activeQuestion.node);
  }

  function quit() {
    if (activeQuestion) activeQuestion.destroy();
    if (answers.length) {
      recordSession({
        kind: kind === 'test' ? 'practice-partial' : kind,
        unitId: null, level: session.level,
        correct: answers.filter((a) => a.correct).length, total: answers.length, xp: xpTotal,
      });
    }
    navigate(session.unit ? `/unit/${session.unit.id}` : '/');
  }

  async function finish() {
    if (activeQuestion) activeQuestion.destroy();
    await loadConceptIndex();
    const correct = answers.filter((a) => a.correct).length;
    const units = session.unit ? await unitsOfLevel(session.unit.level) : [];
    const outcome = recordSession({
      kind, unitId: session.unit ? session.unit.id : null, level: session.level,
      correct, total: answers.length, xp: xpTotal, units,
    });
    outcome.achievements.forEach((a) => toast(`${a.icon} ${a.name[lang()] || a.name.en}`, 'gold'));
    setView(resultsView({ session, answers, outcome, xpTotal }), { hideNav: false });
  }
}

async function unitsOfLevel(levelId) {
  const { getLevel } = await import('../../data/content.js');
  const lv = await getLevel(levelId);
  return lv ? lv.units.filter((u) => u.status !== 'planned') : [];
}

function resultsView({ session, answers, outcome, xpTotal }) {
  const total = answers.length;
  const correct = answers.filter((a) => a.correct).length;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const kind = session.kind;

  // Per-concept breakdown, so the result explains *what* to work on.
  const byConcept = new Map();
  answers.forEach(({ q, correct: ok }) => {
    const item = byConcept.get(q.concept) || { correct: 0, total: 0, id: q.concept };
    item.total += 1; if (ok) item.correct += 1;
    byConcept.set(q.concept, item);
  });
  const concepts = [...byConcept.values()].sort((a, b) => (a.correct / a.total) - (b.correct / b.total));
  const weak = concepts.filter((c) => c.correct / c.total < 0.7);
  const strong = concepts.filter((c) => c.correct / c.total >= 0.8);

  const conceptName = (id) => {
    const title = findConceptTitle(id);
    return title ? (title[lang()] || title.en) : id;
  };

  const line = (c) => el('div.result-line', [
    el('span.result-line__name', conceptName(c.id)),
    el('span.small.muted.nowrap', `${c.correct}/${c.total}`),
    el('span.result-line__bar', bar((c.correct / c.total) * 100, { thin: true, success: c.correct / c.total >= 0.8 })),
  ]);

  const wrongOnes = answers.filter((a) => !a.correct);

  return page([
    el('div.card.result-hero', [
      el('div.result-hero__score', `${pct}%`),
      el('div.result-hero__sub', `${correct} / ${total} · ${t('res.xp', { n: outcome.xp || xpTotal })}`),
      kind === 'test' ? el('p', { style: { marginTop: '.6rem' } },
        outcome.passed
          ? el('span.chip.chip--success', t('res.passed'))
          : el('span.chip.chip--warn', t('res.notPassed', { n: PASS_MARK }))) : null,
      outcome.best && kind === 'test' && total ? el('p.small.muted', t('res.newBest')) : null,
      pct === 100 ? el('p.small.muted', `🎯 ${t('res.perfect')}`) : null,
      outcome.unlocked ? el('p', el('span.chip.chip--accent', `🚪 ${outcome.unlocked}`)) : null,
    ]),

    strong.length ? el('div.card', { style: { marginTop: '.8rem' } }, [
      el('div.card__label', t('res.strong')),
      el('div.result-breakdown', { style: { marginTop: '.5rem' } }, strong.map(line)),
    ]) : null,

    weak.length ? el('div.card', { style: { marginTop: '.8rem' } }, [
      el('div.card__label', t('res.work')),
      el('div.result-breakdown', { style: { marginTop: '.5rem' } }, weak.map(line)),
      el('p.small.muted', { style: { marginTop: '.6rem' } },
        lang() === 'ar'
          ? 'ستظهر هذه المفاهيم أكثر في جلساتك القادمة حتى تتقنها.'
          : 'These concepts will appear more often in your next sessions until they are solid.'),
    ]) : null,

    wrongOnes.length ? el('div.card', { style: { marginTop: '.8rem' } }, [
      el('div.card__label', t('review.mistakes')),
      el('div.list', { style: { marginTop: '.5rem' } }, wrongOnes.slice(0, 5).map(({ q }) => el('div.rowcard.rowcard--static', [
        el('div.rowcard__body', [
          el('div.tiny.faint', conceptName(q.concept)),
          el('div.rowcard__title.small', { lang: 'en', dir: 'ltr' },
            q.sentence ? q.sentence.replace('___', correctText(q)) : correctText(q)),
          q.explanation ? el('div.rowcard__meta', bilingual(q.explanation)) : null,
        ]),
      ]))),
    ]) : null,

    el('div.btn-row', { style: { marginTop: '1rem' } }, [
      session.unit
        ? el('a.btn.btn--primary', { href: `#/unit/${session.unit.id}` }, t('res.continue'))
        : el('a.btn.btn--primary', { href: '#/' }, t('res.home')),
      wrongOnes.length ? el('a.btn', { href: '#/session/review' }, t('res.review')) : null,
      session.unit ? el('a.btn', { href: `#/session/practice/${session.unit.id}` }, t('res.again')) : null,
    ]),
  ]);
}
