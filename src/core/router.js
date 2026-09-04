/**
 * Hash router — works on any static host (GitHub Pages included) with no
 * server rewrites and no 404 fallback needed.
 */

const routes = [];
let notFound = null;
let current = null;

/** Compile "/session/:kind/:arg?" into a regex plus its parameter names. */
export function compile(pattern) {
  const keys = [];
  // One pass, so `keys` stays in the same order as the capture groups.
  const rx = new RegExp('^' + pattern.replace(/\/:([\w]+)(\?)?/g, (_, k, optional) => {
    keys.push(k);
    return optional ? '(?:/([^/]+))?' : '/([^/]+)';
  }) + '/?$');
  return { rx, keys, pattern };
}

/** Match a path against a pattern. Returns params, or null when it does not match. */
export function matchRoute(pattern, path) {
  const { rx, keys } = compile(pattern);
  const m = rx.exec(path);
  if (!m) return null;
  const params = {};
  keys.forEach((k, i) => { params[k] = m[i + 1] ? decodeURIComponent(m[i + 1]) : undefined; });
  return params;
}

/** @param {string} pattern e.g. "/unit/:id" */
export function route(pattern, handler) {
  routes.push({ ...compile(pattern), handler });
}

export function setNotFound(handler) { notFound = handler; }

export function parseHash(hash) {
  const raw = (hash || '').replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const query = {};
  if (qs) for (const [k, v] of new URLSearchParams(qs)) query[k] = v;
  return { path: path.startsWith('/') ? path : '/' + path, query };
}

export function navigate(path, { replace = false } = {}) {
  const target = '#' + (path.startsWith('/') ? path : '/' + path);
  if (location.hash === target) { resolve(); return; }
  if (replace) history.replaceState(null, '', target);
  else location.hash = target;
}

export function currentRoute() { return current; }

export function resolve() {
  const { path, query } = parseHash(location.hash);
  for (const r of routes) {
    const m = r.rx.exec(path);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => { params[k] = m[i + 1] ? decodeURIComponent(m[i + 1]) : undefined; });
    current = { path, params, query, pattern: r.pattern };
    r.handler({ params, query, path });
    return;
  }
  current = { path, params: {}, query, pattern: null };
  if (notFound) notFound({ path });
}

export function start() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
