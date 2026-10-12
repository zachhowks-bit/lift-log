import { lazy, type ComponentType } from 'react';

export const RELOAD_FLAG = 'lift-log:lazy-reload';

/**
 * React.lazy that reloads the page once when the chunk can't be loaded (after an update the old
 * chunk is gone). A sessionStorage flag stops a reload loop; if storage is unavailable, or the
 * reload already happened, the error goes to the error boundary instead.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same constraint as React.lazy
export function lazyWithReload<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
  reload: () => void = () => window.location.reload(),
) {
  return lazy(() => load().then(
    (mod) => {
      try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* storage unavailable */ }
      return mod;
    },
    (err: unknown) => {
      let canReload = false;
      try {
        if (sessionStorage.getItem(RELOAD_FLAG) !== '1') {
          sessionStorage.setItem(RELOAD_FLAG, '1');
          canReload = true;
        }
      } catch { /* storage unavailable: don't risk a loop */ }
      if (!canReload) throw err;
      reload();
      return new Promise<{ default: T }>(() => {}); // keep showing the fallback while the page reloads
    },
  ));
}
