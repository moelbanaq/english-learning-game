/**
 * Masar English — entry point.
 * Static ES modules, no build step, no runtime dependencies.
 * Views are imported on demand so the first paint stays small on mobile data.
 */
import { buildShell, setView, page, applyTheme } from './ui/app.js';
import { route, setNotFound, start, navigate } from './core/router.js';
import { getState, saveNow, ensureToday, update } from './core/store.js';
import { loading, errorState } from './ui/components/bits.js';
import { t } from './core/i18n.js';

const root = document.getElementById('app');
buildShell(root);

/** Wrap a lazily-imported view so failures never leave a blank screen. */
function lazy(loader, name) {
  return async (ctx) => {
    try {
      setView(page(loading()));
      const mod = await loader();
      await mod[name](ctx);
    } catch (err) {
      console.error(`[route] ${name} failed`, err);
      setView(page(errorState(t('common.error'), () => location.reload())));
    }
  };
}

const home = lazy(() => import('./ui/views/home.js'), 'homeView');
const welcome = lazy(() => import('./ui/views/welcome.js'), 'welcomeView');

route('/', (ctx) => (getState().onboarded ? home(ctx) : welcome(ctx)));
route('/learn', lazy(() => import('./ui/views/learn.js'), 'learnView'));
route('/unit/:id', lazy(() => import('./ui/views/unit.js'), 'unitView'));
route('/lesson/:id', lazy(() => import('./ui/views/unit.js'), 'lessonView'));
route('/session/:kind/:arg?', lazy(() => import('./ui/views/session.js'), 'sessionView'));
route('/review', lazy(() => import('./ui/views/review.js'), 'reviewView'));
route('/stats', lazy(() => import('./ui/views/stats.js'), 'statsView'));
route('/settings', lazy(() => import('./ui/views/settings.js'), 'settingsView'));
route('/placement', lazy(() => import('./ui/views/placement.js'), 'placementView'));
setNotFound(() => navigate('/', { replace: true }));

update((s) => { ensureToday(s); }, 'boot');
start();

// Keep the system theme live, and never lose progress on the way out.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
