/** First-run screen: explains the product in five seconds and gets the learner moving. */
import { el } from '../../core/dom.js';
import { t, lang, setLang } from '../../core/i18n.js';
import { setView, page } from '../app.js';
import { update } from '../../core/store.js';
import { LEVELS, LEVEL_META } from '../../data/content.js';
import { setLevel } from '../../engine/record.js';
import { navigate } from '../../core/router.js';

export async function welcomeView() {
  let picked = null;

  const beginBtn = el('button.btn.btn--lg.btn--block', {
    type: 'button', disabled: true,
    onClick: () => {
      if (!picked) return;
      setLevel(picked);
      update((s) => { s.onboarded = true; }, 'onboard');
      navigate('/learn');
    },
  }, t('welcome.begin'));

  const picks = LEVELS.map((lv) => el('button.pick', {
    type: 'button', dataset: { level: lv }, style: { '--lvl': `var(--lvl-${lv.toLowerCase()})` },
    onClick: (e) => {
      picked = lv;
      document.querySelectorAll('.pick').forEach((p) => p.classList.remove('is-active'));
      e.currentTarget.classList.add('is-active');
      beginBtn.disabled = false;
    },
  }, [
    el('div.pick__k', lv),
    el('div.pick__v', (LEVEL_META[lv].name[lang()] || '').split('·').pop().trim()),
  ]));

  setView(page([
    el('div.welcome', [
      el('div.welcome__logo', { 'aria-hidden': 'true' }, 'م'),
      el('h1', { style: { margin: 0 } }, t('welcome.title')),
      el('p.muted', { style: { maxWidth: '34rem' } }, t('welcome.sub')),
      el('div.seg', [
        el('button.seg__btn', { type: 'button', 'aria-pressed': String(lang() === 'en'), onClick: () => { setLang('en'); welcomeView(); } }, 'English'),
        el('button.seg__btn', { type: 'button', 'aria-pressed': String(lang() === 'ar'), onClick: () => { setLang('ar'); welcomeView(); } }, 'العربية'),
      ]),
      el('a.btn.btn--primary.btn--lg.btn--block', { href: '#/placement', style: { maxWidth: '26rem' } }, t('welcome.start')),
      el('p.small.muted', { style: { margin: '.2rem 0' } }, t('welcome.pick')),
      el('div.pick-grid', picks),
      el('div', { style: { maxWidth: '26rem', width: '100%' } }, beginBtn),
    ]),
  ]), { hideNav: true });
}
