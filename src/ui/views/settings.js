/** Settings: language, explanations, theme, level, and data ownership. */
import { el } from '../../core/dom.js';
import { t, lang, setLang } from '../../core/i18n.js';
import { setView, page, pageHead, setTheme, toast, confirmDialog } from '../app.js';
import { getState, update, exportState, importState, resetAll } from '../../core/store.js';
import { isPersistent } from '../../core/storage.js';
import { LEVELS, LEVEL_META } from '../../data/content.js';
import { setLevel } from '../../engine/record.js';
import { navigate } from '../../core/router.js';

export async function settingsView() {
  const state = getState();

  const section = (title, children) => el('div.card', { style: { marginTop: '.8rem' } }, [
    el('div.card__label', title), el('div', { style: { marginTop: '.5rem' } }, children),
  ]);

  const seg = (options, current, onPick) => el('div.seg', options.map((o) => el('button.seg__btn', {
    type: 'button', 'aria-pressed': String(o.value === current),
    onClick: () => onPick(o.value),
  }, o.label)));

  setView(page([
    pageHead(t('set.title')),

    !isPersistent() ? el('div.teach__warn', t('set.storageWarn')) : null,

    section(t('set.uiLang'), seg(
      [{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }],
      state.settings.uiLang,
      (v) => { setLang(v); settingsView(); },
    )),

    section(t('set.explainLang'), seg(
      [{ value: 'both', label: t('set.both') }, { value: 'en', label: t('set.en') }, { value: 'ar', label: t('set.ar') }],
      state.settings.explainLang,
      (v) => { update((s) => { s.settings.explainLang = v; }, 'explainLang'); settingsView(); },
    )),

    section(t('set.theme'), seg(
      [{ value: 'system', label: t('set.system') }, { value: 'light', label: t('set.light') }, { value: 'dark', label: t('set.dark') }],
      state.settings.theme,
      (v) => { setTheme(v); settingsView(); },
    )),

    section(t('set.goal'), seg(
      [{ value: 20, label: '20 XP' }, { value: 30, label: '30 XP' }, { value: 60, label: '60 XP' }, { value: 100, label: '100 XP' }],
      state.settings.dailyGoal,
      (v) => { update((s) => { s.settings.dailyGoal = v; }, 'goal'); settingsView(); },
    )),

    section(t('set.level'), [
      el('p.small.muted', t('set.levelDesc')),
      el('div.pick-grid', LEVELS.map((lv) => el(`button.pick${lv === state.profile.level ? '.is-active' : ''}`, {
        type: 'button', dataset: { level: lv }, style: { '--lvl': `var(--lvl-${lv.toLowerCase()})` },
        onClick: () => { setLevel(lv); settingsView(); toast(lv); },
      }, [
        el('div.pick__k', lv),
        el('div.pick__v', (LEVEL_META[lv].name[lang()] || '').split('·').pop().trim()),
      ]))),
      el('button.btn.btn--sm', { type: 'button', style: { marginTop: '.6rem' }, onClick: () => navigate('/placement') },
        t('set.placement')),
    ]),

    section(t('set.data'), [
      el('p.small.muted', t('set.dataDesc')),
      el('div.btn-row', [
        el('button.btn.btn--sm', { type: 'button', onClick: doExport }, t('set.export')),
        el('label.btn.btn--sm', { style: { cursor: 'pointer' } }, [
          t('set.import'),
          el('input', {
            type: 'file', accept: 'application/json,.json', class: 'sr-only',
            onChange: (e) => doImport(e.target.files[0]),
          }),
        ]),
        el('button.btn.btn--sm.btn--danger', { type: 'button', onClick: doReset }, t('set.reset')),
      ]),
    ]),

    section(t('set.about'), [
      el('p.small.muted', t('app.tagline')),
      el('p.tiny.faint', 'Masar English · open content, offline-friendly, no tracking. '
        + 'Progress lives in this browser only.'),
    ]),
  ]));
}

function doExport() {
  const blob = new Blob([exportState()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `masar-english-backup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function doImport(file) {
  if (!file) return;
  try {
    importState(await file.text());
    toast('✓');
    settingsView();
  } catch (err) {
    toast(t('common.error'));
  }
}

async function doReset() {
  const ok = await confirmDialog({ title: t('set.reset'), body: t('set.resetConfirm'), confirmLabel: t('set.reset'), danger: true });
  if (!ok) return;
  resetAll();
  navigate('/');
  location.reload();
}
