import { registerSW } from 'virtual:pwa-register';
import type { PwaState } from '../application/pwa';

/**
 * Registers the Workbox service worker in prompt mode: updates install in the background and
 * wait; nothing reloads until the host applies the update between rounds.
 */
export function registerServiceWorker(
  state: PwaState,
  reportError: (error: unknown, context: string) => void,
): void {
  const supported = 'serviceWorker' in navigator;
  if (!supported) {
    state.connect(false, () => Promise.resolve());
    return;
  }
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      state.markUpdateReady();
    },
    onOfflineReady() {
      state.markOfflineReady();
    },
    onNeedReload() {
      window.location.reload();
    },
    onRegisteredSW(_url, registration) {
      state.markRegistered(registration?.active !== null && registration?.active !== undefined);
    },
    onRegisterError(error: unknown) {
      state.markFailed();
      reportError(error, 'service-worker');
    },
  });
  state.connect(true, () => updateServiceWorker(true));
}
