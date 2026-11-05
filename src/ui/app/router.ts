import { signal } from '@preact/signals';

export type Route = 'start' | 'host' | 'display' | 'prizes' | 'results' | 'settings';

const ROUTES: Readonly<Record<string, Route>> = {
  '#/': 'start',
  '#/host': 'host',
  '#/display': 'display',
  '#/prizes': 'prizes',
  '#/results': 'results',
  '#/settings': 'settings',
};

/** Hash routing: GitHub Pages cannot rewrite deep links (C3). Unknown hashes fall back to Start. */
export function parseRoute(hash: string): Route {
  const path = hash.split('?')[0] ?? '';
  return ROUTES[path === '' || path === '#' ? '#/' : path] ?? 'start';
}

/** The `href` of a route. */
export function href(route: Route): string {
  return route === 'start' ? '#/' : `#/${route}`;
}

export const currentRoute = signal<Route>(parseRoute(window.location.hash));

/** Keeps the route signal in sync with the location hash. */
export function startRouter(): () => void {
  const update = () => {
    currentRoute.value = parseRoute(window.location.hash);
  };
  window.addEventListener('hashchange', update);
  return () => {
    window.removeEventListener('hashchange', update);
  };
}

/** Navigates to a route. */
export function navigate(route: Route): void {
  window.location.hash = href(route);
}
