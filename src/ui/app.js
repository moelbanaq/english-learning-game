/** Application shell: header, navigation, view host, toasts, theme. */
import { el, mount, clear, scrollTop } from '../core/dom.js';
import { t, lang, setLang, applyDocumentLang } from '../core/i18n.js';
import { getState, subscribe, update } from '../core/store.js';
import { navigate, currentRoute } from '../core/router.js';

let host = null;
let navEl = null;
let toastHost = null;

const NAV = [
  { path: '/', icon: '🏠', key: 'nav.home' },
  { path: '/learn', icon: '📚', key: 'nav.learn' },
  { path: '/review', icon: '🔁', key: 'nav.review' },
  { path: '/stats', icon: '📈', key: 'nav.stats' },
  { path: '/settings', icon: '⚙️', key: 'nav.settings' },
];

export function buildShell(root) {
  applyDocumentLang();
  applyTheme();

  host = el('main#main', { tabindex: '-1' });
  navEl = el('nav.nav', { 'aria-label': t('nav.home') });
  toastHost = el('div.toasts', { 'aria-live': 'polite', 'aria-atomic': 'true' });

  const shell = el('div.shell', [
    el('header.topbar', el('div.topbar__in', [
      el('a.brand', { href: '#/', 'aria-label': t('app.name') }, [
        el('span.brand__mark', { 'aria-hidden': 'true' }, 'م'),
        el('span.brand__name', { id: 'brand-name' }, t('app.name')),
      ]),
      el('div.topbar__spacer'),
      el('span.chip.chip--accent', { id: 'xp-chip', dir: 'ltr' }, `${getState().profile.xp} ${t('common.xp')}`),
      el('button.btn.btn--ghost.btn--sm', {
        id: 'lang-toggle', type: 'button', title: 'العربية / English',
        onClick: () => { setLang(lang() === 'ar' ? 'en' : 'ar'); rerenderShell(); },
      }, lang() === 'ar' ? 'EN' : 'ع'),
    ])),
    navEl,
    host,
    toastHost,
  ]);

  mount(root, shell);
  root.removeAttribute('aria-busy');
  renderNav();

  // Keep the header in sync — including after the language is changed from Settings.
  subscribe(() => {
    const chipEl = document.getElementById('xp-chip');
    if (chipEl) chipEl.textContent = `${getState().profile.xp} ${t('common.xp')}`;
    const brand = document.getElementById('brand-name');
    if (brand) brand.textContent = t('app.name');
    const toggle = document.getElementById('lang-toggle');
    if (toggle) toggle.textContent = lang() === 'ar' ? 'EN' : 'ع';
  });

  return { host };
}

function rerenderShell() {
  const root = document.getElementById('app');
  buildShell(root);
  const r = currentRoute();
  if (r) navigate(r.path, { replace: true });
}

export function renderNav() {
  if (!navEl) return;
  const path = (currentRoute() && currentRoute().path) || '/';
  clear(navEl);
  NAV.forEach((item) => {
    const active = item.path === '/' ? path === '/' : path.startsWith(item.path);
    navEl.append(el('a.nav__item', {
      href: '#' + item.path,
      ...(active ? { 'aria-current': 'page' } : {}),
    }, [
      el('span.nav__icon', { 'aria-hidden': 'true' }, item.icon),
      el('span', t(item.key)),
    ]));
  });
}

export function setView(content, { hideNav = false } = {}) {
  if (!host) return;
  mount(host, content);
  navEl.classList.toggle('hidden', hideNav);
  renderNav();
  scrollTop();
}

export function page(children, opts = {}) {
  return el(`div.page${opts.flush ? '.page--flush' : ''}`, children);
}

export function pageHead(title, sub, extra) {
  return el('div.page__head', [
    el('h1.page__title', title),
    sub ? el('p.page__sub', sub) : null,
    extra || null,
  ]);
}

export function toast(message, variant) {
  if (!toastHost) return;
  const node = el(`div.toast${variant ? '.toast--' + variant : ''}`, { dir: 'ltr' }, message);
  toastHost.append(node);
  while (toastHost.children.length > 2) toastHost.firstChild.remove();
  setTimeout(() => {
    node.style.transition = 'opacity .3s';
    node.style.opacity = '0';
    setTimeout(() => node.remove(), 320);
  }, 1700);
}

export function applyTheme() {
  const theme = getState().settings.theme;
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('is-dark', dark && theme === 'system');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0e1015' : '#4f46e5');
}

export function setTheme(theme) {
  update((s) => { s.settings.theme = theme; }, 'theme');
  applyTheme();
}

/** Confirmation modal that returns a promise. */
export function confirmDialog({ title, body, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    const close = (value) => { backdrop.remove(); document.removeEventListener('keydown', onKey); resolve(value); };
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    const backdrop = el('div.modal-backdrop', {
      role: 'dialog', 'aria-modal': 'true',
      onClick: (e) => { if (e.target === backdrop) close(false); },
    }, el('div.modal', [
      el('h2', title),
      body ? el('p.muted', body) : null,
      el('div.btn-row.btn-row--end', { style: { marginTop: '1rem' } }, [
        el('button.btn', { type: 'button', onClick: () => close(false) }, t('common.cancel')),
        el(`button.btn.${danger ? 'btn--danger' : 'btn--primary'}`, { type: 'button', onClick: () => close(true) }, confirmLabel || t('common.save')),
      ]),
    ]));
    document.body.append(backdrop);
    document.addEventListener('keydown', onKey);
  });
}
