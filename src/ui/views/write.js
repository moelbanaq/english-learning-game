/**
 * Writing practice.
 *
 * Three stages, in this order and no other: write, then mark yourself against the
 * checklist, then read the model answer. The order is the whole pedagogy — a model
 * answer shown first is copied, and a checklist read after the model is just agreement.
 */
import { el, mount } from '../../core/dom.js';
import { t, lang } from '../../core/i18n.js';
import { setView, page, toast } from '../app.js';
import { bilingual, loading, errorState, backLink } from '../components/bits.js';
import { getState } from '../../core/store.js';
import { getUnit } from '../../data/content.js';
import { saveDraft, recordWriting } from '../../engine/record.js';
import { wordCount, promptState, selfScore, XP_PER_PROMPT } from '../../engine/writing.js';
import { navigate } from '../../core/router.js';

export async function writeView({ params }) {
  setView(page(loading()));
  let unit;
  try { unit = await getUnit(params.id); }
  catch { setView(page(errorState(t('common.error'), () => location.reload()))); return; }

  const prompts = unit.writing || [];
  if (!prompts.length) { navigate(`/unit/${unit.id}`, { replace: true }); return; }

  const state = getState();
  setView(page([
    backLink(() => navigate(`/unit/${unit.id}`), unit.title[lang()] || unit.title.en),
    el('div.page__head', { style: { marginTop: '.5rem' } }, [
      el('h1.page__title', t('write.title')),
      el('p.page__sub', t('write.sub')),
    ]),
    el('div.list', { style: { marginTop: '.8rem' } }, prompts.map((w, i) => {
      const st = promptState(state.writing[w.id]);
      return el(`button.rowcard${st === 'done' ? '.is-done' : ''}`, {
        type: 'button', onClick: () => runPrompt(unit, w),
      }, [
        el('div.rowcard__icon', st === 'done' ? '✓' : String(i + 1)),
        el('div.rowcard__body', [
          el('div.rowcard__title.small', w.prompt[lang()] || w.prompt.en),
          el('div.rowcard__meta', t(`write.state.${st}`)),
        ]),
        el('span.rowcard__end', lang() === 'ar' ? '‹' : '›'),
      ]);
    })),
  ]));
}

function runPrompt(unit, w) {
  const saved = getState().writing[w.id] || {};
  const checked = new Set(saved.checked || []);

  const area = el('textarea.field.field--area', {
    rows: '10', lang: 'en', dir: 'ltr', spellcheck: 'false',
    placeholder: t('write.placeholder'),
    value: saved.text || '',
    onInput: () => { updateCount(); scheduleSave(); },
  });
  const count = el('span.small.muted');
  const stageHost = el('div', { style: { marginTop: '.8rem' } });

  let saveTimer = null;
  function scheduleSave() {
    // Debounced: a learner writing a paragraph should not write to storage per keystroke.
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveDraft(w.id, area.value), 600);
  }
  function updateCount() {
    const n = wordCount(area.value);
    count.textContent = t('write.words', { n, min: w.minWords });
    count.classList.toggle('ok', n >= w.minWords);
  }

  setView(page([
    backLink(() => { saveDraft(w.id, area.value); writeView({ params: { id: unit.id } }); }, t('write.title')),
    el('div.card', { style: { marginTop: '.5rem' } }, [
      el('div.card__label', t('write.prompt')),
      bilingual(w.prompt, { class: 'write__prompt' }),
      w.context ? bilingual(w.context, { class: 'small muted' }) : null,
    ]),
    el('div.card', { style: { marginTop: '.8rem' } }, [
      area,
      el('div.row.row--between', { style: { marginTop: '.4rem' } }, [
        count,
        el('button.btn.btn--primary.btn--sm', {
          type: 'button',
          onClick: () => { saveDraft(w.id, area.value); showChecklist(); },
        }, t('write.done')),
      ]),
    ]),
    stageHost,
  ]));
  updateCount();

  function showChecklist() {
    const boxes = w.checklist.map((item, i) => {
      const id = String(i);
      const input = el('input', {
        type: 'checkbox', class: 'check__box', checked: checked.has(id),
        onChange: (e) => { if (e.target.checked) checked.add(id); else checked.delete(id); },
      });
      return el('label.check', [input, el('span.check__text', bilingual(item, { class: 'small' }))]);
    });

    mount(stageHost, el('div.card', [
      el('div.card__label', t('write.checklist')),
      el('p.small.muted', t('write.checklistSub')),
      el('div.list', { style: { marginTop: '.5rem' } }, boxes),
      el('button.btn.btn--primary.btn--block', {
        type: 'button', style: { marginTop: '.6rem' }, onClick: showModel,
      }, t('write.showModel')),
    ]));
    stageHost.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showModel() {
    const out = recordWriting(w.id, [...checked]);
    if (out.first) toast(`+${XP_PER_PROMPT} ${t('common.xp')}`, 'xp');
    const score = selfScore([...checked], w.checklist);

    mount(stageHost, [
      el('div.card', [
        el('div.card__label', t('write.selfScore')),
        el('p.write__score', `${score}%`),
        el('p.small.muted', t('write.selfScoreSub')),
      ]),
      el('div.card', { style: { marginTop: '.8rem' } }, [
        el('div.card__label', t('write.model')),
        el('p.write__model', { lang: 'en', dir: 'ltr' }, w.model.en),
        w.notes ? el('p.small.muted', { style: { marginTop: '.6rem' } }, w.notes[lang()] || w.notes.en) : null,
      ]),
      el('div.btn-row', { style: { marginTop: '1rem' } }, [
        el('button.btn.btn--primary', { type: 'button', onClick: () => writeView({ params: { id: unit.id } }) },
          t('write.back')),
        el('button.btn', { type: 'button', onClick: () => navigate(`/unit/${unit.id}`) }, t('common.done')),
      ]),
    ]);
    stageHost.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
