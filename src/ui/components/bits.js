/** Small shared UI pieces used across views. */
import { el } from '../../core/dom.js';
import { t, lang } from '../../core/i18n.js';
import { getState } from '../../core/store.js';

export function bar(pct, opts = {}) {
  return el(`div.bar${opts.thin ? '.bar--thin' : ''}${opts.success ? '.bar--success' : ''}${opts.level ? '.bar--level' : ''}`, {
    role: 'progressbar', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100,
    'aria-label': opts.label || '',
    ...(opts.levelId ? { dataset: { level: opts.levelId } } : {}),
  }, el('div.bar__fill', { style: { width: `${Math.max(0, Math.min(100, pct))}%` } }));
}

export function statTile(value, key) {
  return el('div.stat', [
    el('div.stat__v', String(value)),
    el('div.stat__k', t(key)),
  ]);
}

export function chip(text, variant) {
  return el(`span.chip${variant ? '.chip--' + variant : ''}`, text);
}

export function levelChip(levelId) {
  return el('span.chip', { dataset: { level: levelId } }, [el('span.level-dot'), levelId]);
}

export function sectionTitle(text, action) {
  return el('div.row.row--between', [el('h2', { style: { margin: '0' } }, text), action || null]);
}

/**
 * Render a bilingual content field, honouring the learner's "explanations"
 * setting. Arabic is rendered RTL inside an LTR page (and vice versa).
 */
export function bilingual(field, opts = {}) {
  if (!field) return null;
  const pref = getState().settings.explainLang;
  const nodes = [];
  const enText = typeof field === 'string' ? field : field.en;
  const arText = typeof field === 'string' ? '' : field.ar;
  const showEn = pref !== 'ar' && enText;
  const showAr = pref !== 'en' && arText;

  if (showEn) nodes.push(el(opts.tag || 'p', { class: 'en' + (opts.class ? ' ' + opts.class : ''), lang: 'en' }, enText));
  if (showAr) nodes.push(el(opts.tag || 'p', { class: 'ar' + (opts.class ? ' ' + opts.class : ''), lang: 'ar', dir: 'rtl' }, arText));
  if (!nodes.length && (enText || arText)) {
    nodes.push(el(opts.tag || 'p', enText || arText));
  }
  return nodes.length === 1 ? nodes[0] : el('div', nodes);
}

export function emptyState(icon, message, action) {
  return el('div.empty', [
    el('span.empty__icon', icon),
    el('p', message),
    action || null,
  ]);
}

export function loading() {
  return el('div.empty', [el('span.empty__icon', '⏳'), el('p', t('common.loading'))]);
}

export function errorState(message, onRetry) {
  return el('div.empty', [
    el('span.empty__icon', '⚠️'),
    el('p', message || t('common.error')),
    onRetry ? el('button.btn.btn--sm', { onClick: onRetry }, t('common.retry')) : null,
  ]);
}

export function backLink(onClick, label) {
  return el('button.btn.btn--ghost.btn--sm', { onClick, type: 'button' },
    [el('span', { 'aria-hidden': 'true' }, lang() === 'ar' ? '→' : '←'), label || t('common.back')]);
}
