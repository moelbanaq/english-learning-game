/**
 * Minimal DOM helpers. No framework, no build step.
 * el('div.card#id', props, children) -> HTMLElement
 *
 * There is deliberately no innerHTML escape hatch: every string that reaches the
 * page goes through createTextNode, so content JSON can never inject markup.
 */

/** @param {string} sel  e.g. "button.btn.btn--primary" */
function parseSel(sel) {
  const m = /^([a-zA-Z0-9-]+)?((?:[.#][\w-]+)*)$/.exec(sel);
  if (!m) throw new Error('Bad selector: ' + sel);
  const tag = m[1] || 'div';
  const classes = [];
  let id = '';
  (m[2] || '').split(/(?=[.#])/).forEach((tok) => {
    if (!tok) return;
    if (tok[0] === '.') classes.push(tok.slice(1));
    else id = tok.slice(1);
  });
  return { tag, classes, id };
}

/**
 * @param {string} sel
 * @param {Object|Array|string|Node} [props]
 * @param {Array|string|Node} [children]
 */
export function el(sel, props, children) {
  if (props != null && (Array.isArray(props) || typeof props === 'string' || props instanceof Node)) {
    children = props;
    props = null;
  }
  const { tag, classes, id } = parseSel(sel);
  const node = document.createElement(tag);
  if (classes.length) node.className = classes.join(' ');
  if (id) node.id = id;

  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = [node.className, v].filter(Boolean).join(' ');
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'text') node.textContent = String(v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'ref' && typeof v === 'function') v(node);
      else if (k in node && k !== 'list' && typeof v !== 'object') {
        try { node[k] = v; } catch { node.setAttribute(k, String(v)); }
      } else node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(node, children);
  return node;
}

export function append(node, children) {
  if (children === null || children === undefined || children === false) return node;
  if (Array.isArray(children)) {
    children.forEach((c) => append(node, c));
    return node;
  }
  node.appendChild(children instanceof Node ? children : document.createTextNode(String(children)));
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(node, children) {
  clear(node);
  append(node, children);
  return node;
}

/** Focus an element without scrolling the page unexpectedly. */
export function focusSoft(node) {
  if (!node) return;
  try { node.focus({ preventScroll: true }); } catch { node.focus(); }
}

export function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}
