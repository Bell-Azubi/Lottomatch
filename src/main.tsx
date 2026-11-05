import './ui/design-system/tokens.css';
import './ui/design-system/base.css';
import { render } from 'preact';
import { AppStore, type WindowRole } from './application/app-store';
import { DisplayLink } from './application/display-link';
import { HostController } from './application/host-controller';
import { HostLink } from './application/host-link';
import { MatchAdmin } from './application/match-admin';
import { PinService } from './application/pin';
import type { Platform } from './application/platform';
import { PwaState } from './application/pwa';
import { commonText } from './i18n/catalogues';
import { t } from './i18n';
import { createPlatform } from './infrastructure/create-platform';
import { registerServiceWorker } from './infrastructure/pwa';
import { App } from './ui/app/App';
import type { Services } from './ui/app/context';
import { startRouter } from './ui/app/router';
import { showToast } from './ui/design-system/toast-store';

/** Global handlers: every unexpected error is logged locally and shown as a toast. */
function installErrorHandlers(platform: Platform): void {
  const report = (error: unknown, context: string) => {
    platform.reportError(error, context);
    showToast(t(commonText).unexpectedError, { tone: 'error', id: 'unexpected-error' });
  };
  window.addEventListener('error', (event) => {
    report(event.error ?? event.message, 'window.error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    report(event.reason, 'unhandledrejection');
  });
}

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (root === null) return;
  const role: WindowRole = window.location.hash.startsWith('#/display') ? 'display' : 'host';
  document.documentElement.dataset['role'] = role;
  const platform = await createPlatform({
    version: __APP_VERSION__,
    commit: __COMMIT_SHA__,
    date: __BUILD_DATE__,
    baseUrl: import.meta.env.BASE_URL,
  });
  installErrorHandlers(platform);
  const app = new AppStore(platform);
  const pwa = new PwaState();
  const base = { app, pwa, admin: new MatchAdmin(app), pin: new PinService(app) };
  const windowId = platform.ids.next();
  if (role === 'host') {
    const host = new HostController(app);
    const hostLink = new HostLink(app, host, windowId);
    const services: Services = { ...base, role, host, hostLink };
    startRouter();
    render(<App services={services} />, root);
    await hostLink.start();
    await app.boot('host');
    await services.pin.load();
  } else {
    const display = new DisplayLink(app, windowId, () => {
      window.location.reload();
    });
    const services: Services = { ...base, role, display };
    render(<App services={services} />, root);
    await app.boot('display');
    display.start();
  }
  registerServiceWorker(pwa, platform.reportError);
  void platform.wakeLock.enable();
}

void main();
