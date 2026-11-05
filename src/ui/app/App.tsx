import { useEffect } from 'preact/hooks';
import { commonText, liveText } from '../../i18n/catalogues';
import { locale, t } from '../../i18n';
import { BadgeRing } from '../design-system/BadgeRing';
import { Button } from '../design-system/Button';
import { Panel } from '../design-system/Surface';
import { Toaster } from '../design-system/Toaster';
import { StartPage } from '../features/start/StartPage';
import styles from './App.module.css';
import { ServicesContext, useServices, type Services } from './context';
import { ErrorBoundary } from './ErrorBoundary';
import { Header } from './Header';
import { LazyRoute } from './LazyRoute';
import { PinGate } from './PinGate';
import { RecoveryScreen } from './RecoveryScreen';
import { currentRoute } from './router';
import { SystemBanners } from './SystemBanners';
import { applyTheme } from './theme';

const loadHost = () => import('../features/host/HostPage');
const loadDisplay = () => import('../features/display/DisplayPage');
const loadPrizes = () => import('../features/prizes/PrizesPage');
const loadResults = () => import('../features/results/ResultsPage');
const loadSettings = () => import('../features/settings/SettingsPage');

function Booting() {
  return (
    <div class={styles.booting} role="status">
      <span class={styles.bootRing}>
        <BadgeRing variant="ring" sweepMs={1200} />
      </span>
      <span>{t(commonText).loading}</span>
    </div>
  );
}

function DisplayElsewhere() {
  const { app } = useServices();
  const m = t(liveText);
  return (
    <Panel>
      <h1>{t(commonText).appName}</h1>
      <p>
        <Button
          variant="primary"
          onClick={() => {
            void app.platform.screen.openDisplay(`${window.location.pathname}#/display`);
          }}
        >
          {m.bar.openDisplay}
        </Button>
      </p>
    </Panel>
  );
}

function HostShell() {
  const { app } = useServices();
  const m = t(commonText);
  const route = currentRoute.value;
  return (
    <>
      <a class={styles.skipLink} href="#main">
        {m.skipToContent}
      </a>
      <Header />
      <SystemBanners />
      <main id="main" class={styles.main} tabIndex={-1}>
        <ErrorBoundary
          resetKey={route}
          onError={(error) => {
            app.platform.reportError(error, `route:${route}`);
          }}
        >
          {route === 'start' && <StartPage />}
          {route === 'host' && <LazyRoute id="host" load={loadHost} />}
          {route === 'display' && <DisplayElsewhere />}
          {route === 'prizes' && (
            <PinGate>
              <LazyRoute id="prizes" load={loadPrizes} />
            </PinGate>
          )}
          {route === 'results' && <LazyRoute id="results" load={loadResults} />}
          {route === 'settings' && (
            <PinGate>
              <LazyRoute id="settings" load={loadSettings} />
            </PinGate>
          )}
        </ErrorBoundary>
      </main>
      <Toaster />
    </>
  );
}

function Root() {
  const { app, role } = useServices();
  const prefs = app.prefs.value;
  useEffect(() => {
    locale.value = prefs.locale;
    document.documentElement.lang = prefs.locale;
    if (role === 'host') applyTheme(prefs.hostTheme);
    document.documentElement.dataset['performance'] = prefs.performanceMode ? 'on' : 'off';
  }, [prefs.locale, prefs.hostTheme, prefs.performanceMode, role]);
  const phase = app.phase.value;
  if (phase.kind === 'BOOTING') return <Booting />;
  if (phase.kind === 'RECOVERY') return <RecoveryScreen cause={phase.cause} />;
  if (role === 'display') {
    return (
      <ErrorBoundary
        resetKey="display"
        onError={(error) => {
          app.platform.reportError(error, 'route:display');
        }}
      >
        <LazyRoute id="display" load={loadDisplay} />
      </ErrorBoundary>
    );
  }
  return <HostShell />;
}

/** Root component; services come from the composition root in `main.tsx`. */
export function App({ services }: { readonly services: Services }) {
  return (
    <ServicesContext.Provider value={services}>
      <Root />
    </ServicesContext.Provider>
  );
}
