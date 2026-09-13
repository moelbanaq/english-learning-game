/**
 * Offline support. No build step and no dependencies — this file is the whole thing.
 *
 * The audience is learners on patchy mobile data, so the two strategies are chosen
 * around that rather than around raw speed:
 *
 *   content/  → cache first. Lessons and questions are large and change rarely, so a
 *               unit you have opened once should never cost data again. A fresh copy
 *               is fetched in the background for next time.
 *   everything else → network first, with a short timeout and a cache fallback. Code
 *               must never get stuck on an old version, but a slow or dead connection
 *               falls back to the last good copy instead of a blank page.
 *
 * Bump CACHE when releasing; the old cache is deleted on activate.
 */
const CACHE = 'masar-v1';
const NET_TIMEOUT = 4000;

/** The minimum needed to paint something useful with no network at all. */
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/icon.svg',
  './assets/css/base.css',
  './assets/css/components.css',
  './assets/css/views.css',
  './src/main.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One missing file must not fail the whole install, so add them individually.
    await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.includes('/content/')) event.respondWith(cacheFirst(request));
  else event.respondWith(networkFirst(request));
});

/** Only store responses we can actually replay later. */
function storable(res) {
  return res && res.status === 200 && (res.type === 'basic' || res.type === 'default');
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const fresh = fetch(request)
    .then((res) => { if (storable(res)) cache.put(request, res.clone()); return res; })
    .catch(() => null);
  if (hit) return hit;
  const res = await fresh;
  return res || new Response('Offline', { status: 503, statusText: 'Offline' });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await withTimeout(fetch(request), NET_TIMEOUT);
    if (storable(res)) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    // A deep link opened offline still has to render: hand it the app shell and let
    // the hash router take it from there.
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html') || await cache.match('./');
      if (shell) return shell;
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); });
  });
}
