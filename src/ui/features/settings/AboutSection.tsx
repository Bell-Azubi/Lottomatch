import { useEffect, useState } from 'preact/hooks';
import type { PwaStatus } from '../../../application/pwa';
import { buildDiagnostics } from '../../../application/settings-editor';
import type { SettingsDataMessages } from '../../../i18n/de-CH/settings-data';
import { formatBytes, formatDateTime } from '../../../i18n/format';
import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { Button } from '../../design-system/Button';
import { showToast } from '../../design-system/toast-store';
import { settingsDataText, settingsText } from './messages';
import { Section } from './Section';
import styles from './Settings.module.css';

type Usage = { readonly usage: number; readonly quota: number } | undefined;

function serviceWorkerText(status: PwaStatus, m: SettingsDataMessages['about']): string {
  const states = m.serviceWorkerStates;
  if (!status.supported) return states.unsupported;
  if (status.failed) return states.failed;
  if (status.updateReady) return states.update;
  return status.offlineReady ? states.ready : states.pending;
}

/** Über: version, build, storage, offline status and the diagnostics export (FR-9). */
export function AboutSection() {
  const m = t(settingsDataText).about;
  const s = t(settingsText);
  const { app, pwa } = useHostServices();
  const { platform } = app;
  const [usage, setUsage] = useState<Usage>(undefined);
  useEffect(() => {
    let active = true;
    void platform.storage.estimate().then((estimate) => {
      if (active) setUsage(estimate);
    });
    return () => {
      active = false;
    };
  }, [platform]);
  const { build } = platform;
  const errors = platform.diagnostics.list();
  const exportDiagnostics = () => {
    const session = app.session.value;
    const report = buildDiagnostics({
      generatedAt: platform.clock.nowIso(),
      build,
      userAgent: navigator.userAgent,
      language: navigator.language,
      backend: platform.backend,
      persistence: app.persistence.value,
      storage: usage,
      pwa: pwa.status.value,
      prefs: app.prefs.value,
      matches: app.matches.value,
      active:
        session === undefined
          ? undefined
          : {
              kind: session.match.value.kind,
              phase: session.game.value.phase,
              rounds: session.match.value.settings.rounds,
              logEntries: session.log.length,
              settingsVersion: session.match.value.settingsVersion,
            },
      errors,
    });
    const name = `lottomatch-diagnose-${platform.clock.nowIso().slice(0, 10)}.json`;
    platform.screen.download(
      name,
      platform.binary.textToBlob(JSON.stringify(report, null, 2), 'application/json'),
    );
    showToast(m.diagnosticsDone, { tone: 'success' });
  };
  return (
    <Section id="about" title={s.sections.about} intro={m.intro}>
      <dl class={styles.facts}>
        <dt>{m.version}</dt>
        <dd>{build.version}</dd>
        <dt>{m.commit}</dt>
        <dd title={build.commit}>{build.commit.slice(0, 12)}</dd>
        <dt>{m.buildDate}</dt>
        <dd>{formatDateTime(build.date)}</dd>
        <dt>{m.storage}</dt>
        <dd>
          {usage === undefined
            ? m.storageUnknown
            : m.storageUsage(formatBytes(usage.usage), formatBytes(usage.quota))}
        </dd>
        <dt>{m.persistence}</dt>
        <dd>{m.persistenceStates[app.persistence.value]}</dd>
        <dt>{m.backend}</dt>
        <dd>{m.backends[platform.backend]}</dd>
        <dt>{m.serviceWorker}</dt>
        <dd>{serviceWorkerText(pwa.status.value, m)}</dd>
      </dl>
      {platform.backend === 'MEMORY' && (
        <p class={`${styles.notice} ${styles.warning}`}>{m.backends.MEMORY}</p>
      )}
      <p class={styles.hint}>
        {m.diagnosticsHint} {m.errors(errors.length)}
      </p>
      <div class={styles.actions}>
        <Button onClick={exportDiagnostics}>{m.diagnostics}</Button>
      </div>
    </Section>
  );
}
