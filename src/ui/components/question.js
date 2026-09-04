/**
 * Question renderer — one question at a time, any exercise type,
 * with immediate, explanatory feedback.
 *
 * Types: choice | text | order | match
 * Formats are pedagogical labels (fill_blank, natural, error_id, …) and only
 * affect the little chip above the question.
 */
import { el, clear, focusSoft } from '../../core/dom.js';
import { t, lang } from '../../core/i18n.js';
import { bilingual, chip } from './bits.js';
import { grade, correctText, splitBlank, shuffle } from '../../engine/grade.js';

const FORMAT_LABEL = {
  mcq: { en: 'Choose', ar: 'اختر' },
  fill_blank: { en: 'Fill the gap', ar: 'أكمل الفراغ' },
  choose_sentence: { en: 'Correct sentence', ar: 'الجملة الصحيحة' },
  error_id: { en: 'Find the mistake', ar: 'اعثر على الخطأ' },
  meaning: { en: 'Meaning', ar: 'المعنى' },
  synonym: { en: 'Synonym', ar: 'مرادف' },
  collocation: { en: 'Word partners', ar: 'تلازم لفظي' },
  phrasal: { en: 'Phrasal verb', ar: 'فعل مركّب' },
  natural: { en: 'Most natural', ar: 'الأكثر طبيعية' },
  register: { en: 'Register', ar: 'مستوى اللغة' },
  transform: { en: 'Rewrite', ar: 'أعد الصياغة' },
  order: { en: 'Word order', ar: 'ترتيب الكلمات' },
  match: { en: 'Match', ar: 'وصّل' },
  comprehension: { en: 'Reading', ar: 'استيعاب' },
  write: { en: 'Type it', ar: 'اكتبها' },
  inference: { en: 'Inference', ar: 'استنتاج' },
};

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * @param {object} opts { question, index, total, kind, onCheck, onNext }
 * @returns {{node: HTMLElement, destroy: Function}}
 */
export function renderQuestion({ question, index, total, onCheck, onNext }) {
  let response = null;
  let checked = false;
  let result = null;

  const body = el('div.qcard');
  const feedbackHost = el('div');
  const actionHost = el('div.runner__footer');

  const label = FORMAT_LABEL[question.format] || FORMAT_LABEL[question.type] || null;

  body.append(
    el('div.qcard__meta', [
      el('span.chip.chip--accent', t('q.of', { a: index + 1, b: total })),
      label ? chip(label[lang()] || label.en) : null,
      question.difficulty >= 4 ? chip('★'.repeat(Math.min(question.difficulty - 2, 3)), 'warn') : null,
    ]),
  );

  if (question.passage) {
    body.append(el('div.passage', [
      question.passage.title ? el('div.passage__title', question.passage.title) : null,
      el('div', { lang: 'en' }, question.passage.text),
    ]));
  }

  const prompt = question.prompt;
  if (prompt) {
    const p = el('div');
    if (prompt.en) p.append(el('div.qcard__prompt', { lang: 'en' }, prompt.en));
    if (prompt.ar) p.append(el('div.qcard__prompt.qcard__prompt-ar', { lang: 'ar', dir: 'rtl' }, prompt.ar));
    body.append(p);
  }

  let blankEl = null;
  if (question.sentence) {
    const sentenceNode = renderSentence(question.sentence);
    blankEl = sentenceNode.querySelector('.blank');
    body.append(sentenceNode);
  }

  // The buttons exist before the interaction is built: some exercises call
  // setResponse() while they render (the ordering exercise syncs its empty slot).
  const checkBtn = el('button.btn.btn--primary.btn--lg.btn--block', {
    type: 'button', disabled: true, onClick: () => doCheck(),
  }, t('q.check'));

  const nextBtn = el('button.btn.btn--primary.btn--lg.btn--block.hidden', {
    type: 'button', onClick: () => onNext && onNext(result),
  }, index + 1 >= total ? t('q.finish') : t('q.continue'));

  actionHost.append(checkBtn, nextBtn);

  const setResponse = (value, autoCheck = false) => {
    response = value;
    checkBtn.disabled = value === null || value === undefined || value === '';
    if (autoCheck) doCheck();
  };

  const interaction = buildInteraction(question, setResponse);
  body.append(interaction.node);

  function doCheck() {
    if (checked) return;
    checked = true;
    result = grade(question, response);
    interaction.lock(result.correct, question);
    // Show the sentence as it should read — seeing the finished sentence teaches more
    // than seeing an empty gap.
    if (blankEl) {
      blankEl.textContent = correctText(question);
      blankEl.classList.add('is-filled');
    }
    checkBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');
    clear(feedbackHost).append(feedbackPanel(question, result));
    focusSoft(nextBtn);
    if (onCheck) onCheck(result);
  }

  function onKey(e) {
    if (e.target && /input|textarea|select/i.test(e.target.tagName) && e.key !== 'Enter') return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (checked) nextBtn.click();
      else if (!checkBtn.disabled) checkBtn.click();
      return;
    }
    if (!checked && question.type === 'choice' && /^[1-9]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      const btn = interaction.node.querySelectorAll('.opt')[i];
      if (btn) { btn.click(); e.preventDefault(); }
    }
  }
  document.addEventListener('keydown', onKey);

  const node = el('div.runner', [body, feedbackHost, actionHost]);
  return {
    node,
    destroy() { document.removeEventListener('keydown', onKey); },
  };
}

function renderSentence(sentence) {
  const parts = splitBlank(sentence);
  if (parts.length === 1) return el('p.sentence', { lang: 'en' }, sentence);
  return el('p.sentence', { lang: 'en' }, [parts[0], el('span.blank', '?'), parts[1]]);
}

/* ---------------- interaction builders ---------------- */

function buildInteraction(q, setResponse) {
  switch (q.type) {
    case 'choice': return buildChoice(q, setResponse);
    case 'text': return buildText(q, setResponse);
    case 'order': return buildOrder(q, setResponse);
    case 'match': return buildMatch(q, setResponse);
    default: return { node: el('p.muted', 'Unsupported question type.'), lock() {} };
  }
}

function buildChoice(q, setResponse) {
  const long = q.options.some((o) => String(o).length > 22);
  const wrap = el(`div.options${long ? '.options--wide' : '.options--compact'}`, { role: 'group' });
  const buttons = q.options.map((opt, i) => el('button.opt', {
    type: 'button',
    onClick: () => {
      buttons.forEach((b) => b.classList.remove('is-selected'));
      buttons[i].classList.add('is-selected');
      setResponse(i);
    },
  }, [
    el('span.opt__key', { 'aria-hidden': 'true' }, KEYS[i] || String(i + 1)),
    el('span.opt__text', { lang: 'en' }, String(opt)),
  ]));
  buttons.forEach((b) => wrap.append(b));

  return {
    node: wrap,
    lock(correct) {
      buttons.forEach((b, i) => {
        b.disabled = true;
        if (i === q.answer) { b.classList.add('is-correct'); b.append(el('span.opt__mark', '✓')); }
        else if (b.classList.contains('is-selected')) { b.classList.add('is-wrong'); b.append(el('span.opt__mark', '✕')); }
        else b.classList.add('is-dim');
      });
      void correct;
    },
  };
}

function buildText(q, setResponse) {
  const input = el('input.field', {
    type: 'text', placeholder: t('q.typeHere'), autocomplete: 'off', autocapitalize: 'none',
    spellcheck: false, lang: 'en', dir: 'ltr', 'aria-label': t('q.yourAnswer'),
    onInput: (e) => setResponse(e.target.value.trim()),
  });
  const hint = q.hint ? el('p.small.muted', q.hint) : null;
  const node = el('div.stack', { style: { '--gap': '.5rem' } }, [input, hint]);
  setTimeout(() => focusSoft(input), 40);
  return {
    node,
    lock(correct) {
      input.disabled = true;
      input.classList.add(correct ? 'is-correct' : 'is-wrong');
    },
  };
}

function buildOrder(q, setResponse) {
  const slot = el('div.answer-slot', { 'aria-live': 'polite' });
  const bankHost = el('div.tokens');
  const placed = [];
  const tokens = shuffle(q.tokens, hashId(q.id));

  const empty = el('span.answer-slot__empty', t('q.tapWords'));

  function sync() {
    clear(slot);
    if (!placed.length) slot.append(empty);
    else {
      placed.forEach((p, i) => {
        slot.append(el('button.token.token--placed', {
          type: 'button',
          onClick: () => { placed.splice(i, 1); bankBtns[p.idx].disabled = false; sync(); },
        }, p.word));
      });
    }
    setResponse(placed.length ? placed.map((p) => p.word) : null);
  }

  const bankBtns = tokens.map((word, idx) => el('button.token', {
    type: 'button',
    onClick: () => { placed.push({ word, idx }); bankBtns[idx].disabled = true; sync(); },
  }, word));
  bankBtns.forEach((b) => bankHost.append(b));

  const clearBtn = el('button.btn.btn--ghost.btn--sm', {
    type: 'button',
    onClick: () => { placed.length = 0; bankBtns.forEach((b) => { b.disabled = false; }); sync(); },
  }, t('q.clear'));

  sync();
  const node = el('div.stack', { style: { '--gap': '.6rem' } }, [
    slot, bankHost, el('div.row', clearBtn),
  ]);

  return {
    node,
    lock(correct) {
      slot.classList.add(correct ? 'is-correct' : 'is-wrong');
      bankBtns.forEach((b) => { b.disabled = true; });
      clearBtn.disabled = true;
      slot.querySelectorAll('.token').forEach((b) => { b.disabled = true; });
    },
  };
}

function buildMatch(q, setResponse) {
  let wrong = 0;
  let done = 0;
  let selected = null;
  const lefts = q.pairs.map(([l]) => l);
  const rights = shuffle(q.pairs.map(([, r]) => r), hashId(q.id) + 7);

  const leftBtns = lefts.map((text, i) => el('button.match__btn', {
    type: 'button', lang: 'en',
    onClick: () => {
      if (leftBtns[i].classList.contains('is-done')) return;
      leftBtns.forEach((b) => b.classList.remove('is-selected'));
      leftBtns[i].classList.add('is-selected');
      selected = i;
    },
  }, text));

  const rightBtns = rights.map((text, j) => el('button.match__btn', {
    type: 'button', lang: 'en',
    onClick: () => {
      if (selected === null || rightBtns[j].classList.contains('is-done')) return;
      const expected = q.pairs[selected][1];
      if (expected === text) {
        leftBtns[selected].classList.remove('is-selected');
        leftBtns[selected].classList.add('is-done');
        rightBtns[j].classList.add('is-done');
        done += 1;
        selected = null;
        if (done === q.pairs.length) setResponse({ wrong }, true);
      } else {
        wrong += 1;
        rightBtns[j].classList.add('is-shake');
        setTimeout(() => rightBtns[j].classList.remove('is-shake'), 350);
      }
    },
  }, text));

  const node = el('div.stack', { style: { '--gap': '.5rem' } }, [
    el('p.small.muted', t('q.match')),
    el('div.match', [
      el('div.match__col', leftBtns),
      el('div.match__col', rightBtns),
    ]),
  ]);

  return {
    node,
    lock() { [...leftBtns, ...rightBtns].forEach((b) => { b.disabled = true; }); },
  };
}

function hashId(id) {
  let h = 2166136261;
  for (let i = 0; i < String(id).length; i++) {
    h ^= String(id).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ---------------- feedback ---------------- */

export function feedbackPanel(q, result) {
  const ok = result.correct;
  const panel = el(`div.feedback.feedback--${ok ? 'ok' : 'no'}`, { role: 'status', 'aria-live': 'polite' });

  panel.append(el('div.feedback__head', [
    el('span', { 'aria-hidden': 'true' }, ok ? '✓' : '✕'),
    ok ? t('q.correct') : t('q.incorrect'),
  ]));

  if (!ok) {
    panel.append(el('div.feedback__label', t('q.answerWas')));
    panel.append(el('div.feedback__correct', { lang: 'en' }, correctText(q)));
  }

  if (q.explanation) {
    panel.append(el('div.feedback__section', [
      el('div.feedback__label', t('q.why')),
      bilingual(q.explanation),
    ]));
  }

  if (!ok && q.commonMistake) {
    panel.append(el('div.feedback__section', [
      el('div.feedback__label', t('lesson.watch')),
      bilingual(q.commonMistake),
    ]));
  }

  return panel;
}
